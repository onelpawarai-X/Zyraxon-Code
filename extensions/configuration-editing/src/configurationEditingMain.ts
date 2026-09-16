/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { getLocation, JSONPath, parse, visit, Location } from 'jsonc-parser';
import * as zyraxoncode from 'vscode';
import { SettingsDocument } from './settingsDocumentHelper';
import { provideInstalledExtensionProposals } from './extensionsProposals';
import './importExportProfiles';

export function activate(context: zyraxoncode.ExtensionContext): void {
	__ZYRAXKEEP__0_ suggestions
	context.subscriptions.push(registerSettingsCompletions());

	//extensions suggestions
	context.subscriptions.push(...registerExtensionsCompletions());

	// launch.json variable suggestions
	context.subscriptions.push(registerVariableCompletions('**/launch.json'));

	// task.json variable suggestions
	context.subscriptions.push(registerVariableCompletions('**/tasks.json'));

	// Workspace file launch/tasks variable completions
	context.subscriptions.push(registerVariableCompletions('**/*.code-workspace'));

	// keybindings.json/package.json context key suggestions
	context.subscriptions.push(registerContextKeyCompletions());
}

function registerSettingsCompletions(): zyraxoncode.Disposable {
	return zyraxoncode.languages.registerCompletionItemProvider({ language: 'jsonc', pattern: '**/settings.json' }, {
		provideCompletionItems(document, position, token) {
			return new SettingsDocument(document).provideCompletionItems(position, token);
		}
	});
}

function registerVariableCompletions(pattern: string): zyraxoncode.Disposable {
	return zyraxoncode.languages.registerCompletionItemProvider({ language: 'jsonc', pattern }, {
		provideCompletionItems(document, position, _token) {
			const location = getLocation(document.getText(), document.offsetAt(position));
			if (isCompletingInsidePropertyStringValue(document, location, position)) {
				if (document.fileName.endsWith('.code-workspace') && !isLocationInsideTopLevelProperty(location, ['launch', 'tasks'])) {
					return [];
				}

				let range = document.getWordRangeAtPosition(position, /\$\{[^"\}]*\}?/);
				if (!range || range.start.isEqual(position) || range.end.isEqual(position) && document.getText(range).endsWith('}')) {
					range = new zyraxoncode.Range(position, position);
				}

				return [
					{ label: 'workspaceFolder', detail: zyraxoncode.l10n.t("The path of the folder opened in ZYRAXON Code") },
					{ label: 'workspaceFolderBasename', detail: zyraxoncode.l10n.t("The name of the folder opened in ZYRAXON Code without any slashes (/)") },
					{ label: 'fileWorkspaceFolderBasename', detail: zyraxoncode.l10n.t("The current opened file workspace folder name without any slashes (/)") },
					{ label: 'relativeFile', detail: zyraxoncode.l10n.t("The current opened file relative to ${workspaceFolder}") },
					{ label: 'relativeFileDirname', detail: zyraxoncode.l10n.t("The current opened file's dirname relative to ${workspaceFolder}") },
					{ label: 'file', detail: zyraxoncode.l10n.t("The current opened file") },
					{ label: 'cwd', detail: zyraxoncode.l10n.t("The task runner's current working directory on startup") },
					{ label: 'lineNumber', detail: zyraxoncode.l10n.t("The current selected line number in the active file") },
					{ label: 'selectedText', detail: zyraxoncode.l10n.t("The current selected text in the active file") },
					{ label: 'fileDirname', detail: zyraxoncode.l10n.t("The current opened file's dirname") },
					{ label: 'fileDirnameBasename', detail: zyraxoncode.l10n.t("The current opened file's folder name") },
					{ label: 'fileExtname', detail: zyraxoncode.l10n.t("The current opened file's extension") },
					{ label: 'fileBasename', detail: zyraxoncode.l10n.t("The current opened file's basename") },
					{ label: 'fileBasenameNoExtension', detail: zyraxoncode.l10n.t("The current opened file's basename with no file extension") },
					{ label: 'defaultBuildTask', detail: zyraxoncode.l10n.t("The name of the default build task. If there is not a single default build task then a quick pick is shown to choose the build task.") },
					{ label: 'pathSeparator', detail: zyraxoncode.l10n.t("The character used by the operating system to separate components in file paths. Is also aliased to '/'.") },
					{ label: 'extensionInstallFolder', detail: zyraxoncode.l10n.t("The path where an extension is installed."), param: 'publisher.extension' },
				].map(variable => ({
					label: `\${${variable.label}}`,
					range,
					insertText: variable.param ? new zyraxoncode.SnippetString(`\${${variable.label}:`).appendPlaceholder(variable.param).appendText('}') : (`\${${variable.label}}`),
					detail: variable.detail
				}));
			}

			return [];
		}
	});
}

function isCompletingInsidePropertyStringValue(document: zyraxoncode.TextDocument, location: Location, pos: zyraxoncode.Position) {
	if (location.isAtPropertyKey) {
		return false;
	}
	const previousNode = location.previousNode;
	if (previousNode && previousNode.type === 'string') {
		const offset = document.offsetAt(pos);
		return offset > previousNode.offset && offset < previousNode.offset + previousNode.length;
	}
	return false;
}

function isLocationInsideTopLevelProperty(location: Location, values: string[]) {
	return values.includes(location.path[0] as string);
}

interface IExtensionsContent {
	recommendations: string[];
}

function registerExtensionsCompletions(): zyraxoncode.Disposable[] {
	return [registerExtensionsCompletionsInExtensionsDocument(), registerExtensionsCompletionsInWorkspaceConfigurationDocument()];
}

function registerExtensionsCompletionsInExtensionsDocument(): zyraxoncode.Disposable {
	return zyraxoncode.languages.registerCompletionItemProvider({ pattern: '**/extensions.json' }, {
		provideCompletionItems(document, position, _token) {
			const location = getLocation(document.getText(), document.offsetAt(position));
			if (location.path[0] === 'recommendations') {
				const range = getReplaceRange(document, location, position);
				const extensionsContent = <IExtensionsContent>parse(document.getText());
				return provideInstalledExtensionProposals(extensionsContent && extensionsContent.recommendations || [], '', range, false);
			}
			return [];
		}
	});
}

function registerExtensionsCompletionsInWorkspaceConfigurationDocument(): zyraxoncode.Disposable {
	return zyraxoncode.languages.registerCompletionItemProvider({ pattern: '**/*.code-workspace' }, {
		provideCompletionItems(document, position, _token) {
			const location = getLocation(document.getText(), document.offsetAt(position));
			if (location.path[0] === 'extensions' && location.path[1] === 'recommendations') {
				const range = getReplaceRange(document, location, position);
				const extensionsContent = <IExtensionsContent>parse(document.getText())['extensions'];
				return provideInstalledExtensionProposals(extensionsContent && extensionsContent.recommendations || [], '', range, false);
			}
			return [];
		}
	});
}

function getReplaceRange(document: zyraxoncode.TextDocument, location: Location, position: zyraxoncode.Position) {
	const node = location.previousNode;
	if (node) {
		const nodeStart = document.positionAt(node.offset), nodeEnd = document.positionAt(node.offset + node.length);
		if (nodeStart.isBeforeOrEqual(position) && nodeEnd.isAfterOrEqual(position)) {
			return new zyraxoncode.Range(nodeStart, nodeEnd);
		}
	}
	return new zyraxoncode.Range(position, position);
}

zyraxoncode.languages.registerDocumentSymbolProvider({ pattern: '**/launch.json', language: 'jsonc' }, {
	provideDocumentSymbols(document: zyraxoncode.TextDocument, _token: zyraxoncode.CancellationToken): zyraxoncode.ProviderResult<zyraxoncode.SymbolInformation[]> {
		const result: zyraxoncode.SymbolInformation[] = [];
		let name: string = '';
		let lastProperty = '';
		let startOffset = 0;
		let depthInObjects = 0;

		visit(document.getText(), {
			onObjectProperty: (property, _offset, _length) => {
				lastProperty = property;
			},
			onLiteralValue: (value: any, _offset: number, _length: number) => {
				if (lastProperty === 'name') {
					name = value;
				}
			},
			onObjectBegin: (offset: number, _length: number) => {
				depthInObjects++;
				if (depthInObjects === 2) {
					startOffset = offset;
				}
			},
			onObjectEnd: (offset: number, _length: number) => {
				if (name && depthInObjects === 2) {
					result.push(new zyraxoncode.SymbolInformation(name, zyraxoncode.SymbolKind.Object, new zyraxoncode.Range(document.positionAt(startOffset), document.positionAt(offset))));
				}
				depthInObjects--;
			},
		});

		return result;
	}
}, { label: 'Launch Targets' });

function registerContextKeyCompletions(): zyraxoncode.Disposable {
	type ContextKeyInfo = { key: string; type?: string; description?: string };

	const paths = new Map<zyraxoncode.DocumentFilter, JSONPath[]>([
		[{ language: 'jsonc', pattern: '**/keybindings.json' }, [
			['*', 'when']
		]],
		[{ language: 'json', pattern: '**/package.json' }, [
			['contributes', 'menus', '*', '*', 'when'],
			['contributes', 'views', '*', '*', 'when'],
			['contributes', 'viewsWelcome', '*', 'when'],
			['contributes', 'keybindings', '*', 'when'],
			['contributes', 'keybindings', 'when'],
		]]
	]);

	return zyraxoncode.languages.registerCompletionItemProvider(
		[...paths.keys()],
		{
			async provideCompletionItems(document: zyraxoncode.TextDocument, position: zyraxoncode.Position, token: zyraxoncode.CancellationToken) {

				const location = getLocation(document.getText(), document.offsetAt(position));

				if (location.isAtPropertyKey) {
					return;
				}

				let isValidLocation = false;
				for (const [key, value] of paths) {
					if (zyraxoncode.languages.match(key, document)) {
						if (value.some(location.matches.bind(location))) {
							isValidLocation = true;
							break;
						}
					}
				}

				if (!isValidLocation || !isCompletingInsidePropertyStringValue(document, location, position)) {
					return;
				}

				const replacing = document.getWordRangeAtPosition(position, /[a-zA-Z.]+/) || new zyraxoncode.Range(position, position);
				const inserting = replacing.with(undefined, position);

				const data = await zyraxoncode.commands.executeCommand<ContextKeyInfo[]>('getContextKeyInfo');
				if (token.isCancellationRequested || !data) {
					return;
				}

				const result = new zyraxoncode.CompletionList();
				for (const item of data) {
					const completion = new zyraxoncode.CompletionItem(item.key, zyraxoncode.CompletionItemKind.Constant);
					completion.detail = item.type;
					completion.range = { replacing, inserting };
					completion.documentation = item.description;
					result.items.push(completion);
				}
				return result;
			}
		}
	);
}
