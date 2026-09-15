#!/usr/bin/env node
/**
 * ZYRAXON Code — Standalone packaging script
 *
 * Replaces the broken @vscode/gulp-electron pipeline (streamx crashes on Node 24).
 * Uses electron-builder to produce NSIS installers for Windows.
 *
 * Flow:
 *   1. Verify esbuild bundle output exists (out-vscode-min/)
 *   2. Create proper Electron app structure in dist/app/
 *   3. Run electron-builder to produce NSIS installer
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT_BUNDLE = path.join(ROOT, 'out-vscode-min');
const DIST_APP = path.join(ROOT, 'dist', 'app');
const PRODUCT = JSON.parse(fs.readFileSync(path.join(ROOT, 'product.json'), 'utf8'));
const PACKAGE = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

function log(msg: string) {
	console.log(`\x1b[36m[package]\x1b[0m ${msg}`);
}

function logError(msg: string) {
	console.error(`\x1b[31m[package]\x1b[0m ${msg}`);
}

function ensureDir(dir: string): void {
	fs.mkdirSync(dir, { recursive: true });
}

function rimraf(dir: string): void {
	if (fs.existsSync(dir)) {
		fs.rmSync(dir, { recursive: true, force: true });
	}
}

function copyDirSync(src: string, dst: string): void {
	fs.cpSync(src, dst, { recursive: true });
}

/**
 * Step 1: Verify esbuild bundle output exists
 */
function checkBundleOutput(): void {
	if (!fs.existsSync(OUT_BUNDLE)) {
		logError(`Bundle output not found at ${OUT_BUNDLE}`);
		logError('Run the esbuild bundle first:');
		logError('  node build/next/index.ts bundle --minify --nls --out out-vscode-min --target desktop');
		process.exit(1);
	}

	const jsFiles = fs.readdirSync(OUT_BUNDLE).filter(f => f.endsWith('.js'));
	if (jsFiles.length === 0) {
		logError('No .js files found in bundle output');
		process.exit(1);
	}

	log(`Found ${jsFiles.length} JS bundles in out-vscode-min/`);
}

/**
 * Step 2: Create proper Electron app structure
 */
function createAppStructure(): void {
	log('Creating app structure...');

	rimraf(DIST_APP);
	ensureDir(DIST_APP);

	// Copy bundled output → dist/app/out/
	const appOut = path.join(DIST_APP, 'out');
	rimraf(appOut);
	copyDirSync(OUT_BUNDLE, appOut);
	log(`Copied bundle → dist/app/out/ (${fs.readdirSync(appOut).length} items)`);

	// Create package.json for Electron
	const appPackageJson = {
		name: PRODUCT.nameShort.toLowerCase().replace(/\s+/g, '-'),
		version: PACKAGE.version,
		type: 'module',
		main: 'out/vs/code/electron-browser/workbench/workbench.js',
		author: 'Zyraxon Corporation',
		license: 'BSL-1.1',
	};
	fs.writeFileSync(
		path.join(DIST_APP, 'package.json'),
		JSON.stringify(appPackageJson, null, 2)
	);

	// Create product.json
	const productCopy = { ...PRODUCT };
	productCopy.commit = 'local';
	productCopy.date = new Date().toISOString();
	productCopy.version = PACKAGE.version;
	fs.writeFileSync(
		path.join(DIST_APP, 'product.json'),
		JSON.stringify(productCopy, null, 2)
	);

	// Copy bootstrap files from out-vscode-min to dist/app/
	for (const bootstrap of ['main.js', 'cli.js', 'bootstrap-fork.js']) {
		const src = path.join(OUT_BUNDLE, bootstrap);
		const dst = path.join(DIST_APP, bootstrap);
		if (fs.existsSync(src)) {
			fs.copyFileSync(src, dst);
			log(`Copied ${bootstrap}`);
		}
	}

	log('App structure created at dist/app/');
}

/**
 * Step 3: Copy production node_modules
 */
function copyNodeModules(): void {
	log('Copying production dependencies...');

	const depsDir = path.join(DIST_APP, 'node_modules');
	ensureDir(depsDir);

	const prodDeps = Object.keys(PACKAGE.dependencies || {});
	const srcNodeModules = path.join(ROOT, 'node_modules');

	let copied = 0;
	for (const dep of prodDeps) {
		if (dep.startsWith('@')) {
			const [scope, name] = dep.split('/');
			const scopeDir = path.join(depsDir, scope);
			ensureDir(scopeDir);
			const srcScoped = path.join(srcNodeModules, scope, name);
			const dstScoped = path.join(depsDir, scope, name);
			if (fs.existsSync(srcScoped)) {
				copyDirSync(srcScoped, dstScoped);
				copied++;
			}
		} else {
			const src = path.join(srcNodeModules, dep);
			const dst = path.join(depsDir, dep);
			if (fs.existsSync(src)) {
				copyDirSync(src, dst);
				copied++;
			}
		}
	}

	// Always include ws (used by extension host)
	const wsSrc = path.join(srcNodeModules, 'ws');
	const wsDst = path.join(depsDir, 'ws');
	if (!fs.existsSync(wsDst) && fs.existsSync(wsSrc)) {
		copyDirSync(wsSrc, wsDst);
		copied++;
	}

	log(`Copied ${copied} production dependencies`);
}

/**
 * Step 4: Copy built-in extensions
 */
function copyExtensions(): void {
	const extSrc = path.join(ROOT, '.build', 'extensions');
	const extDst = path.join(DIST_APP, 'extensions');

	if (!fs.existsSync(extSrc)) {
		log('No built-in extensions found, skipping');
		return;
	}

	copyDirSync(extSrc, extDst);
	log('Copied built-in extensions');
}

/**
 * Step 5: Copy resource files needed by the app
 */
function copyResources(): void {
	const licenseSrc = path.join(ROOT, 'LICENSE.txt');
	if (fs.existsSync(licenseSrc)) {
		fs.copyFileSync(licenseSrc, path.join(DIST_APP, 'LICENSE.txt'));
	}

	const apiSrc = path.join(ROOT, 'src', 'vscode-dts', 'vscode.d.ts');
	if (fs.existsSync(apiSrc)) {
		const apiDst = path.join(DIST_APP, 'out', 'vscode-dts');
		ensureDir(apiDst);
		fs.copyFileSync(apiSrc, path.join(apiDst, 'vscode.d.ts'));
	}

	log('Copied resource files');
}

/**
 * Step 6: Run electron-builder
 */
function runElectronBuilder(): void {
	log('Running electron-builder for NSIS installer...');

	try {
		execSync('npx electron-builder --config electron-builder.yml --win', {
			cwd: ROOT,
			stdio: 'inherit',
			env: {
				...process.env,
				NODE_OPTIONS: '--max-old-space-size=8192',
			},
		});
		log('electron-builder completed successfully!');
	} catch (err) {
		logError('electron-builder failed');
		process.exit(1);
	}
}

/**
 * Main
 */
function main(): void {
	log('=== ZYRAXON Code Packaging ===');
	log(`Product: ${PRODUCT.nameLong}`);
	log(`Version: ${PACKAGE.version}`);

	checkBundleOutput();
	createAppStructure();
	copyNodeModules();
	copyExtensions();
	copyResources();
	runElectronBuilder();

	log('=== Done! Check dist/ for output ===');
}

main();
