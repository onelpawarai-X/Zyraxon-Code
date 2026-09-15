/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'fs';
import path from 'path';
import * as os from 'os';
import * as child_process from 'child_process';
import { dirs } from './dirs.ts';
import { root, stateFile, stateContentsFile, computeState, computeContents, isUpToDate } from './installStateHash.ts';

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const rootNpmrcConfigKeys = getNpmrcConfigKeys(path.join(root, '.npmrc'));

function log(dir: string, message: string) {
	if (process.stdout.isTTY) {
		console.log(`\x1b[34m[${dir}]\x1b[0m`, message);
	} else {
		console.log(`[${dir}]`, message);
	}
}

function run(command: string, args: string[], opts: child_process.SpawnSyncOptions) {
	log(opts.cwd as string || '.', '$ ' + command + ' ' + args.join(' '));

	const result = child_process.spawnSync(command, args, opts);

	if (result.error) {
		console.error(`ERR Failed to spawn process: ${result.error}`);
		process.exit(1);
	} else if (result.status !== 0) {
		console.error(`ERR Process exited with code: ${result.status}`);
		process.exit(result.status);
	}
}

function spawnAsync(command: string, args: string[], opts: child_process.SpawnOptions): Promise<string> {
	return new Promise((resolve, reject) => {
		const child = child_process.spawn(command, args, { ...opts, stdio: ['ignore', 'pipe', 'pipe'] });
		let output = '';
		child.stdout?.on('data', (data: Buffer) => { output += data.toString(); });
		child.stderr?.on('data', (data: Buffer) => { output += data.toString(); });
		child.on('error', reject);
		child.on('close', (code) => {
			if (code !== 0) {
				reject(new Error(`Process exited with code: ${code}\n${output}`));
			} else {
				resolve(output);
			}
		});
	});
}

async function npmInstallAsync(dir: string, opts?: child_process.SpawnOptions): Promise<void> {
	const targetDir = path.join(root, dir);
	// Skip gracefully when the extension/package directory does not exist (e.g. optional .vscode/extensions subdirs absent in forks). Avoids ENOENT.
	if (!fs.existsSync(targetDir)) {
		log(dir, `Skipping npm install: directory does not exist (${targetDir})`);
		return;
	}
	const finalOpts: child_process.SpawnOptions = {
		env: { ...process.env, npm_config_workspaces: 'false', npm_config_install_links: 'true' },
		...(opts ?? {}),
		cwd: path.join(root, dir),
		shell: true,
	};

	const command = process.env['npm_command'] || 'install';

	if (process.env['VSCODE_REMOTE_DEPENDENCIES_CONTAINER_NAME'] && /^(.build\/distro\/npm\/)?remote$/.test(dir)) {
		const syncOpts: child_process.SpawnSyncOptions = {
			env: finalOpts.env,
			cwd: root,
			stdio: 'inherit',
			shell: true,
		};
		const userinfo = os.userInfo();
		log(dir, `Installing dependencies inside container ${process.env['VSCODE_REMOTE_DEPENDENCIES_CONTAINER_NAME']}...`);

		if (process.env['npm_config_arch'] === 'arm64') {
			run('sudo', ['docker', 'run', '--rm', '--privileged', 'vscodehub.azurecr.io/multiarch/qemu-user-static@sha256:fe60359c92e86a43cc87b3d906006245f77bfc0565676b80004cc666e4feb9f0', '--reset', '-p', 'yes'], syncOpts);
		}
		run('sudo', [
			'docker', 'run',
			'-e', 'GITHUB_TOKEN',
			'-v', `${process.env['VSCODE_HOST_MOUNT']}:/root/vscode`,
			'-v', `${process.env['VSCODE_HOST_MOUNT']}/.build/.gitconfig-distro:/root/.gitconfig`,
			'-v', `${process.env['VSCODE_NPMRC_PATH']}:/root/.npmrc`,
			'-w', path.resolve('/root/vscode', dir),
			process.env['VSCODE_REMOTE_DEPENDENCIES_CONTAINER_NAME'],
			'sh', '-c', `\"chown -R root:root ${path.resolve('/root/vscode', dir)} && export PATH="/root/vscode/.build/nodejs-musl/usr/local/bin:$PATH" && npm i -g node-gyp-build && npm ci\"`
		], syncOpts);
		run('sudo', ['chown', '-R', `${userinfo.uid}:${userinfo.gid}`, `${path.resolve(root, dir)}`], syncOpts);
	} else {
		log(dir, 'Installing dependencies...');
		const output = await spawnAsync(npm, command.split(' '), finalOpts);
		if (output.trim()) {
			for (const line of output.trim().split('\n')) {
				log(dir, line);
			}
		}
	}
	removeParcelWatcherPrebuild(dir);
}

function setNpmrcConfig(dir: string, env: NodeJS.ProcessEnv) {
	const npmrcPath = path.join(root, dir, '.npmrc');
	const lines = fs.readFileSync(npmrcPath, 'utf8').split('\n');

	for (const line of lines) {
		const trimmedLine = line.trim();
		if (trimmedLine && !trimmedLine.startsWith('#')) {
			const [key, value] = trimmedLine.split('=');
			env[`npm_config_${key}`] = value.replace(/^"(.*)"$/, '$1');
		}
	}

	// Use our bundled node-gyp version
	env['npm_config_node_gyp'] =
		process.platform === 'win32'
			? path.join(import.meta.dirname, 'gyp', 'node_modules', '.bin', 'node-gyp.cmd')
			: path.join(import.meta.dirname, 'gyp', 'node_modules', '.bin', 'node-gyp');

	// Force node-gyp to use process.config on macOS
	// which defines clang variable as expected. Otherwise we
	// run into compilation errors due to incorrect compiler
	// configuration.
	// NOTE: This means the process.config should contain
	// the correct clang variable. So keep the version check
	// in preinstall sync with this logic.
	// Change was first introduced in https://github.com/nodejs/node/commit/6e0a2bb54c5bbeff0e9e33e1a0c683ed980a8a0f
	if ((dir === 'remote' || dir === 'build') && process.platform === 'darwin') {
		env['npm_config_force_process_config'] = 'true';
	} else {
		delete env['npm_config_force_process_config'];
	}

	if (dir === 'build') {
		// Temporarily lock the target version.
		// Node 24 V8 headers require C++20, but tree-sitter hard-pin "c++17" in their binding.gyp.
		// This is fixed in v0.25.1 however the version is not published to npm, refs
		// https://github.com/tree-sitter/node-tree-sitter/issues/268.
		// env['npm_config_target'] = process.versions.node;
		env['npm_config_arch'] = process.arch;
	}
}

function removeParcelWatcherPrebuild(dir: string) {
	const parcelModuleFolder = path.join(root, dir, 'node_modules', '@parcel');
	if (!fs.existsSync(parcelModuleFolder)) {
		return;
	}

	const parcelModules = fs.readdirSync(parcelModuleFolder);
	for (const moduleName of parcelModules) {
		if (moduleName.startsWith('watcher-')) {
			const modulePath = path.join(parcelModuleFolder, moduleName);
			fs.rmSync(modulePath, { recursive: true, force: true });
			log(dir, `Removed @parcel/watcher prebuilt module ${modulePath}`);
		}
	}
}

function getNpmrcConfigKeys(npmrcPath: string): string[] {
	if (!fs.existsSync(npmrcPath)) {
		return [];
	}
	const lines = fs.readFileSync(npmrcPath, 'utf8').split('\n');
	const keys: string[] = [];
	for (const line of lines) {
		const trimmedLine = line.trim();
		if (trimmedLine && !trimmedLine.startsWith('#')) {
			const eqIndex = trimmedLine.indexOf('=');
			if (eqIndex > 0) {
				keys.push(trimmedLine.substring(0, eqIndex).trim());
			}
		}
	}
	return keys;
}

function clearInheritedNpmrcConfig(dir: string, env: NodeJS.ProcessEnv): void {
	const dirNpmrcPath = path.join(root, dir, '.npmrc');
	if (fs.existsSync(dirNpmrcPath)) {
		return;
	}

	for (const key of rootNpmrcConfigKeys) {
		const envKey = `npm_config_${key.replace(/-/g, '_')}`;
		delete env[envKey];
	}
}

function ensureAgentHarnessLink(sourceRelativePath: string, linkPath: string): 'existing' | 'junction' | 'symlink' | 'hard link' {
	if (fs.existsSync(linkPath)) {
		return 'existing';
	}

	const sourcePath = path.resolve(path.dirname(linkPath), sourceRelativePath);
	const isDirectory = fs.statSync(sourcePath).isDirectory();

	try {
		if (process.platform === 'win32' && isDirectory) {
			fs.symlinkSync(sourcePath, linkPath, 'junction');
			return 'junction';
		}

		fs.symlinkSync(sourceRelativePath, linkPath, isDirectory ? 'dir' : 'file');
		return 'symlink';
	} catch (error) {
		if (process.platform === 'win32' && !isDirectory && (error as NodeJS.ErrnoException).code === 'EPERM') {
			fs.linkSync(sourcePath, linkPath);
			return 'hard link';
		}

		throw error;
	}
}

async function runWithConcurrency(tasks: (() => Promise<void>)[], concurrency: number): Promise<void> {
	const errors: Error[] = [];
	let index = 0;

	async function worker() {
		while (index < tasks.length) {
			const i = index++;
			try {
				await tasks[i]();
			} catch (err) {
				errors.push(err as Error);
			}
		}
	}

	await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker()));

	if (errors.length > 0) {
		for (const err of errors) {
			console.error(err.message);
		}
		process.exit(1);
	}
}

function fixBrokenPackages() {
	log('.', 'Auto-fixing packages with missing dist/ (bun skips prepublish)...');

	// Scan ALL extension node_modules for packages where main/module points to missing file
	// and the package has a prepublish/prepare/build script we can run
	const extDirs = [
		'extensions/copilot',
		'extensions/markdown-language-features',
		'extensions/markdown-math',
		'extensions/emmet',
		'extensions/git',
		'extensions/github',
		'extensions/github-authentication',
		'extensions/microsoft-authentication',
		'extensions/html-language-features',
		'extensions/json-language-features',
		'extensions/css-language-features',
		'extensions/notebook-renderers',
		'extensions/simple-browser',
		'extensions/typescript-language-features',
		'extensions/typescript-language-features/server',
		'extensions/ipynb',
	];

	const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
	let fixedCount = 0;

	for (const extDir of extDirs) {
		const nmDir = path.join(root, extDir, 'node_modules');
		if (!fs.existsSync(nmDir)) {
			continue;
		}

		// Process regular packages
		const processPackage = (pkgDir: string, pkgName: string) => {
			const pkgJsonPath = path.join(pkgDir, 'package.json');
			if (!fs.existsSync(pkgJsonPath)) {
				return;
			}
			try {
				const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
				const mainFile = pkgJson.main || pkgJson.module;
				if (!mainFile) {
					return;
				}
				const mainPath = path.join(pkgDir, mainFile);
				if (fs.existsSync(mainPath)) {
					return; // Already built
				}

				// Check if package has a build/prepublish/prepare script
				const scripts = pkgJson.scripts || {};
				const buildCmd = scripts.build || scripts.prepublish || scripts.prepare;
				if (!buildCmd) {
					return; // No build script, can't fix
				}

				log(`${extDir}`, `Rebuilding ${pkgName} (missing ${mainFile})...`);
				child_process.spawnSync(npm, ['run', 'build'], {
					cwd: pkgDir, shell: true, stdio: 'pipe',
				});
				if (fs.existsSync(mainPath)) {
					log(`${extDir}`, `  Fixed: ${pkgName}`);
					fixedCount++;
				} else {
					log(`${extDir}`, `  WARNING: ${pkgName} build completed but ${mainFile} still missing`);
				}
			} catch {
				// Skip broken packages
			}
		};

		// Scan regular packages
		const entries = fs.readdirSync(nmDir, { withFileTypes: true });
		for (const entry of entries) {
			if (entry.name.startsWith('.')) {
				continue;
			}
			if (entry.name.startsWith('@')) {
				// Scoped package - scan sub-dirs
				const scopePath = path.join(nmDir, entry.name);
				const scopedEntries = fs.readdirSync(scopePath, { withFileTypes: true }).filter(e => e.isDirectory());
				for (const scopedEntry of scopedEntries) {
					processPackage(path.join(scopePath, scopedEntry.name), `${entry.name}/${scopedEntry.name}`);
				}
			} else if (entry.isDirectory()) {
				processPackage(path.join(nmDir, entry.name), entry.name);
			}
		}
	}

	log('.', `Auto-fixed ${fixedCount} packages`);
}

async function main() {
	// Hide parent monorepo package.json to prevent npm workspace detection
	// (parent uses "catalog:" protocol which npm doesn't understand)
	const parentPkgJson = path.join(path.dirname(root), 'package.json');
	const parentPkgJsonBackup = parentPkgJson + '.bak';
	let parentWasHidden = false;
	if (fs.existsSync(parentPkgJson)) {
		try {
			const content = JSON.parse(fs.readFileSync(parentPkgJson, 'utf8'));
			if (content.workspaces || content.catalog) {
				fs.renameSync(parentPkgJson, parentPkgJsonBackup);
				parentWasHidden = true;
				log('.', 'Temporarily hidden parent monorepo package.json (catalog: protocol)');
			}
		} catch {
			// Ignore
		}
	}

	try {
		await _main();
	} finally {
		// Restore parent package.json
		if (parentWasHidden && fs.existsSync(parentPkgJsonBackup)) {
			fs.renameSync(parentPkgJsonBackup, parentPkgJson);
			log('.', 'Restored parent monorepo package.json');
		}
	}
}

async function _main() {
	// CRITICAL: Fix broken packages BEFORE sub-directory installs
	// bun install skips prepublish scripts, so many packages are missing dist/
	fixBrokenPackages();

	const _state = computeState();

	const nativeTasks: (() => Promise<void>)[] = [];
	const parallelTasks: (() => Promise<void>)[] = [];

	for (const dir of dirs) {
		if (dir === '') {
			removeParcelWatcherPrebuild(dir);
			continue; // already executed in root
		}

		if (dir === 'build') {
			nativeTasks.push(() => {
				const env: NodeJS.ProcessEnv = { ...process.env };
				if (process.env['CC']) { env['CC'] = 'gcc'; }
				if (process.env['CXX']) { env['CXX'] = 'g++'; }
				if (process.env['CXXFLAGS']) { env['CXXFLAGS'] = ''; }
				if (process.env['LDFLAGS']) { env['LDFLAGS'] = ''; }
				setNpmrcConfig('build', env);
				return npmInstallAsync('build', { env });
			});
			continue;
		}

		if (/^(.build\/distro\/npm\/)?remote$/.test(dir)) {
			const remoteDir = dir;
			nativeTasks.push(() => {
				const env: NodeJS.ProcessEnv = { ...process.env };
				if (process.env['VSCODE_REMOTE_CC']) {
					env['CC'] = process.env['VSCODE_REMOTE_CC'];
				} else {
					delete env['CC'];
				}
				if (process.env['VSCODE_REMOTE_CXX']) {
					env['CXX'] = process.env['VSCODE_REMOTE_CXX'];
				} else {
					delete env['CXX'];
				}
				if (process.env['CXXFLAGS']) { delete env['CXXFLAGS']; }
				if (process.env['CFLAGS']) { delete env['CFLAGS']; }
				if (process.env['LDFLAGS']) { delete env['LDFLAGS']; }
				if (process.env['VSCODE_REMOTE_CXXFLAGS']) { env['CXXFLAGS'] = process.env['VSCODE_REMOTE_CXXFLAGS']; }
				if (process.env['VSCODE_REMOTE_LDFLAGS']) { env['LDFLAGS'] = process.env['VSCODE_REMOTE_LDFLAGS']; }
				if (process.env['VSCODE_REMOTE_NODE_GYP']) { env['npm_config_node_gyp'] = process.env['VSCODE_REMOTE_NODE_GYP']; }
				setNpmrcConfig('remote', env);
				return npmInstallAsync(remoteDir, { env });
			});
			continue;
		}

		const taskDir = dir;
		parallelTasks.push(() => {
			const env = { ...process.env };
			clearInheritedNpmrcConfig(taskDir, env);
			return npmInstallAsync(taskDir, { env });
		});
	}

	// Native dirs (build, remote) run sequentially to avoid node-gyp conflicts
	for (const task of nativeTasks) {
		await task();
	}

	// JS-only dirs run in parallel
	const concurrency = Math.min(os.cpus().length, 8);
	log('.', `Running ${parallelTasks.length} npm installs with concurrency ${concurrency}...`);
	await runWithConcurrency(parallelTasks, concurrency);

	child_process.execSync('git config pull.rebase merges');
	child_process.execSync('git config blame.ignoreRevsFile .git-blame-ignore-revs');

	fs.writeFileSync(stateFile, JSON.stringify(_state));
	fs.writeFileSync(stateContentsFile, JSON.stringify(computeContents()));

	// Symlink .claude/ files to their canonical locations to test Claude agent harness
	const claudeDir = path.join(root, '.claude');
	fs.mkdirSync(claudeDir, { recursive: true });

	const claudeMdLink = path.join(claudeDir, 'CLAUDE.md');
	const claudeMdLinkType = ensureAgentHarnessLink(path.join('..', '.github', 'copilot-instructions.md'), claudeMdLink);
	if (claudeMdLinkType !== 'existing') {
		log('.', `Created ${claudeMdLinkType} .claude/CLAUDE.md -> .github/copilot-instructions.md`);
	}

	const claudeSkillsLink = path.join(claudeDir, 'skills');
	const claudeSkillsLinkType = ensureAgentHarnessLink(path.join('..', '.agents', 'skills'), claudeSkillsLink);
	if (claudeSkillsLinkType !== 'existing') {
		log('.', `Created ${claudeSkillsLinkType} .claude/skills -> .agents/skills`);
	}

	// Temporary: patch @github/copilot-sdk session.js to fix ESM import
	// (missing .js extension on vscode-jsonrpc/node). Fixed upstream in v0.1.32.
	// TODO: Remove once @github/copilot-sdk is updated to >=0.1.32
	for (const dir of ['', 'remote']) {
		const sessionFile = path.join(root, dir, 'node_modules', '@github', 'copilot-sdk', 'dist', 'session.js');
		if (fs.existsSync(sessionFile)) {
			const content = fs.readFileSync(sessionFile, 'utf8');
			const patched = content.replace(/from "vscode-jsonrpc\/node"/g, 'from "vscode-jsonrpc/node.js"');
			if (content !== patched) {
				fs.writeFileSync(sessionFile, patched);
				log(dir || '.', 'Patched @github/copilot-sdk session.js (vscode-jsonrpc ESM import fix)');
			}
		}
	}

	// foundry-local-sdk (on-device chat dictation) resolves its prebuilt N-API
	// addon and native core libraries from fixed, package-relative paths. We do
	// not ship that native payload (its addon requires a newer glibc than our
	// minimum supported Linux distros); it is downloaded on demand at runtime
	// into a per-user cache. Patch the SDK loader so it honors the
	// `VSCODE_FOUNDRY_LOCAL_NATIVE_DIR` env var (pointing at that cache) for both
	// the addon and the core libraries, falling back to the original
	// package-relative logic so dev-from-source still works. Idempotent.
	for (const dir of ['', 'remote']) {
		const coreInteropFile = path.join(root, dir, 'node_modules', 'foundry-local-sdk', 'dist', 'detail', 'coreInterop.js');
		if (!fs.existsSync(coreInteropFile)) {
			continue;
		}
		const content = fs.readFileSync(coreInteropFile, 'utf8');
		// Apply the addon and core patches independently. They previously shared
		// a single `VSCODE_FOUNDRY_LOCAL_NATIVE_DIR` presence check, so if only
		// one SDK needle changed the file was left half-patched and every later
		// run skipped it entirely — and since packaging removes both native
		// fallbacks, a missing half makes shipped dictation unusable. Use a
		// distinct marker per half and apply whichever is absent.
		const addonMarker = '// VSCODE_PATCH:foundry-addon-native-dir';
		const coreMarker = '// VSCODE_PATCH:foundry-core-native-dir';
		const addonNeedle = `    const platformKey = \`\${platform}-\${arch}\`;\n    // The prebuilt addon ships inside the SDK package under prebuilds/<platform>/\n    const sdkRoot = path.resolve(__dirname, '..', '..');`;
		const addonReplacement = `    const platformKey = \`\${platform}-\${arch}\`;\n    ${addonMarker}: prefer the on-demand native runtime cache when present.\n    const overrideDir = process.env.VSCODE_FOUNDRY_LOCAL_NATIVE_DIR;\n    if (overrideDir) {\n        const overridePath = path.join(overrideDir, 'prebuilds', platformKey, 'foundry_local_napi.node');\n        if (fs.existsSync(overridePath)) {\n            return require(overridePath);\n        }\n    }\n    // The prebuilt addon ships inside the SDK package under prebuilds/<platform>/\n    const sdkRoot = path.resolve(__dirname, '..', '..');`;
		const coreNeedle = `        const platformKey = \`\${platform}-\${arch}\`;\n        // Resolve the native binary directory at foundry-local-core/<platform>,`;
		const coreReplacement = `        const platformKey = \`\${platform}-\${arch}\`;\n        ${coreMarker}: prefer the on-demand native runtime cache when present.\n        const overrideDir = process.env.VSCODE_FOUNDRY_LOCAL_NATIVE_DIR;\n        if (overrideDir) {\n            const overrideExt = CoreInterop._getLibraryExtension();\n            const overrideCorePath = path.join(overrideDir, 'foundry-local-core', platformKey, \`Microsoft.AI.Foundry.Local.Core\${overrideExt}\`);\n            if (fs.existsSync(overrideCorePath)) {\n                config.params['FoundryLocalCorePath'] = overrideCorePath;\n                return overrideCorePath;\n            }\n        }\n        // Resolve the native binary directory at foundry-local-core/<platform>,`;
		let patched = content;
		if (!patched.includes(addonMarker)) {
			if (patched.includes(addonNeedle)) {
				patched = patched.replace(addonNeedle, addonReplacement);
			} else {
				log(dir || '.', 'WARNING: foundry-local-sdk coreInterop.js loadAddon shape changed; skipped addon override patch');
			}
		}
		if (!patched.includes(coreMarker)) {
			if (patched.includes(coreNeedle)) {
				patched = patched.replace(coreNeedle, coreReplacement);
			} else {
				log(dir || '.', 'WARNING: foundry-local-sdk coreInterop.js _resolveDefaultCorePath shape changed; skipped core override patch');
			}
		}
		if (content !== patched) {
			fs.writeFileSync(coreInteropFile, patched);
			log(dir || '.', 'Patched foundry-local-sdk coreInterop.js (on-demand native runtime override)');
		}
	}
}

main().catch(err => {
	console.error(err);
	process.exit(1);
});
