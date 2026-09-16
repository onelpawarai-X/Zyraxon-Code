/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as httpRequest from 'request-light';
import * as zyraxoncode from 'zyraxoncode';
import { addJSONProviders } from './features/jsonContributions';
import { runSelectedScript, selectAndRunScriptFromFolder } from './commands';
import { NpmScriptsTreeDataProvider } from './npmView';
import { getScriptRunner, getPackageManager, invalidateTasksCache, NpmTaskProvider, hasPackageJson } from './tasks';
import { invalidateHoverScriptsCache, NpmScriptHoverProvider } from './scriptHover';
import { NpmScriptLensProvider } from './npmScriptLens';
import which from 'which';

let treeDataProvider: NpmScriptsTreeDataProvider | undefined;

function invalidateScriptCaches() {
	invalidateHoverScriptsCache();
	invalidateTasksCache();
	if (treeDataProvider) {
		treeDataProvider.refresh();
	}
}

export async function activate(context: zyraxoncode.ExtensionContext): Promise<void> {
	configureHttpRequest();
	context.subscriptions.push(zyraxoncode.workspace.onDidChangeConfiguration(e => {
		if (e.affectsConfiguration('http.proxy') || e.affectsConfiguration('http.proxyStrictSSL')) {
			configureHttpRequest();
		}
	}));

	const npmCommandPath = await getNPMCommandPath();
	context.subscriptions.push(addJSONProviders(httpRequest.xhr, npmCommandPath));
	registerTaskProvider(context);

	treeDataProvider = registerExplorer(context);

	context.subscriptions.push(zyraxoncode.workspace.onDidChangeConfiguration((e) => {
		if (e.affectsConfiguration('npm.exclude') || e.affectsConfiguration('npm.autoDetect') || e.affectsConfiguration('npm.scriptExplorerExclude') || e.affectsConfiguration('npm.runSilent') || e.affectsConfiguration('npm.packageManager') || e.affectsConfiguration('npm.scriptRunner')) {
			invalidateTasksCache();
			if (treeDataProvider) {
				treeDataProvider.refresh();
			}
		}
		if (e.affectsConfiguration('npm.scriptExplorerAction')) {
			if (treeDataProvider) {
				treeDataProvider.refresh();
			}
		}
	}));

	registerHoverProvider(context);

	context.subscriptions.push(zyraxoncode.commands.registerCommand('npm.runSelectedScript', runSelectedScript));

	if (await hasPackageJson()) {
		zyraxoncode.commands.executeCommand('setContext', 'npm:showScriptExplorer', true);
	}

	context.subscriptions.push(zyraxoncode.commands.registerCommand('npm.runScriptFromFolder', selectAndRunScriptFromFolder));
	context.subscriptions.push(zyraxoncode.commands.registerCommand('npm.refresh', () => {
		invalidateScriptCaches();
	}));
	context.subscriptions.push(zyraxoncode.commands.registerCommand('npm.scriptRunner', (args) => {
		if (args instanceof zyraxoncode.Uri) {
			return getScriptRunner(args, context, true);
		}
		return '';
	}));
	context.subscriptions.push(zyraxoncode.commands.registerCommand('npm.packageManager', (args) => {
		if (args instanceof zyraxoncode.Uri) {
			return getPackageManager(args, context, true);
		}
		return '';
	}));
	context.subscriptions.push(new NpmScriptLensProvider());

	context.subscriptions.push(zyraxoncode.window.registerTerminalQuickFixProvider('ms-zyraxoncode.npm-command', {
		provideTerminalQuickFixes({ outputMatch }) {
			if (!outputMatch) {
				return;
			}

			const lines = outputMatch.regexMatch[1];
			const fixes: zyraxoncode.TerminalQuickFixTerminalCommand[] = [];
			for (const line of lines.split('\n')) {
				// search from the second char, since the lines might be prefixed with
				// "npm ERR!" which comes before the actual command suggestion.
				const begin = line.indexOf('npm', 1);
				if (begin === -1) {
					continue;
				}

				const end = line.lastIndexOf('#');
				fixes.push({ terminalCommand: line.slice(begin, end === -1 ? undefined : end - 1) });
			}

			return fixes;
		},
	}));
}

async function getNPMCommandPath(): Promise<string | undefined> {
	if (zyraxoncode.workspace.isTrusted && canRunNpmInCurrentWorkspace()) {
		try {
			return await which(process.platform === 'win32' ? 'npm.cmd' : 'npm');
		} catch (e) {
			return undefined;
		}
	}
	return undefined;
}

function canRunNpmInCurrentWorkspace() {
	if (zyraxoncode.workspace.workspaceFolders) {
		return zyraxoncode.workspace.workspaceFolders.some(f => f.uri.scheme === 'file');
	}
	return false;
}

let taskProvider: NpmTaskProvider;
function registerTaskProvider(context: zyraxoncode.ExtensionContext): zyraxoncode.Disposable | undefined {
	if (zyraxoncode.workspace.workspaceFolders) {
		const watcher = zyraxoncode.workspace.createFileSystemWatcher('**/package.json');
		watcher.onDidChange((_e) => invalidateScriptCaches());
		watcher.onDidDelete((_e) => invalidateScriptCaches());
		watcher.onDidCreate((_e) => invalidateScriptCaches());
		context.subscriptions.push(watcher);

		const workspaceWatcher = zyraxoncode.workspace.onDidChangeWorkspaceFolders((_e) => invalidateScriptCaches());
		context.subscriptions.push(workspaceWatcher);

		taskProvider = new NpmTaskProvider(context);
		const disposable = zyraxoncode.tasks.registerTaskProvider('npm', taskProvider);
		context.subscriptions.push(disposable);
		return disposable;
	}
	return undefined;
}

function registerExplorer(context: zyraxoncode.ExtensionContext): NpmScriptsTreeDataProvider | undefined {
	if (zyraxoncode.workspace.workspaceFolders) {
		const treeDataProvider = new NpmScriptsTreeDataProvider(context, taskProvider!);
		const view = zyraxoncode.window.createTreeView('npm', { treeDataProvider: treeDataProvider, showCollapseAll: true });
		context.subscriptions.push(view);
		return treeDataProvider;
	}
	return undefined;
}

function registerHoverProvider(context: zyraxoncode.ExtensionContext): NpmScriptHoverProvider | undefined {
	if (zyraxoncode.workspace.workspaceFolders) {
		const npmSelector: zyraxoncode.DocumentSelector = {
			language: 'json',
			scheme: 'file',
			pattern: '**/package.json'
		};
		const provider = new NpmScriptHoverProvider(context);
		context.subscriptions.push(zyraxoncode.languages.registerHoverProvider(npmSelector, provider));
		return provider;
	}
	return undefined;
}

function configureHttpRequest() {
	const httpSettings = zyraxoncode.workspace.getConfiguration('http');
	httpRequest.configure(httpSettings.get<string>('proxy', ''), httpSettings.get<boolean>('proxyStrictSSL', true));
}

export function deactivate(): void {
}
