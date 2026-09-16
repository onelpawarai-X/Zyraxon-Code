/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as zyraxoncode from 'vscode';
import { Command, CommandManager } from '../commands/commandManager';
import { isSupportedLanguageMode } from '../configuration/languageIds';
import { API } from '../tsServer/api';
import * as typeConverters from '../typeConverters';
import { ITypeScriptServiceClient } from '../typescriptService';


class SourceDefinitionCommand implements Command {

	public static readonly context = 'tsSupportsSourceDefinition';
	public static readonly minVersion = API.v470;

	public readonly id = 'typescript.goToSourceDefinition';

	public constructor(
		private readonly client: ITypeScriptServiceClient
	) { }

	public async execute() {
		if (this.client.apiVersion.lt(SourceDefinitionCommand.minVersion)) {
			zyraxoncode.window.showErrorMessage(zyraxoncode.l10n.t("Go to Source Definition failed. Requires TypeScript 4.7+."));
			return;
		}

		const activeEditor = zyraxoncode.window.activeTextEditor;
		if (!activeEditor) {
			zyraxoncode.window.showErrorMessage(zyraxoncode.l10n.t("Go to Source Definition failed. No resource provided."));
			return;
		}

		const resource = activeEditor.document.uri;
		const document = await zyraxoncode.workspace.openTextDocument(resource);
		if (!isSupportedLanguageMode(document)) {
			zyraxoncode.window.showErrorMessage(zyraxoncode.l10n.t("Go to Source Definition failed. Unsupported file type."));
			return;
		}

		const openedFiledPath = this.client.toOpenTsFilePath(document);
		if (!openedFiledPath) {
			zyraxoncode.window.showErrorMessage(zyraxoncode.l10n.t("Go to Source Definition failed. Unknown file type."));
			return;
		}

		await zyraxoncode.window.withProgress({
			location: zyraxoncode.ProgressLocation.Window,
			title: zyraxoncode.l10n.t("Finding source definitions")
		}, async (_progress, token) => {

			const position = activeEditor.selection.anchor;
			const args = typeConverters.Position.toFileLocationRequestArgs(openedFiledPath, position);
			const response = await this.client.execute('findSourceDefinition', args, token);
			if (response.type === 'response' && response.body) {
				const locations: zyraxoncode.Location[] = response.body.map(reference =>
					typeConverters.Location.fromTextSpan(this.client.toResource(reference.file), reference));

				if (locations.length) {
					if (locations.length === 1) {
						zyraxoncode.commands.executeCommand('zyraxoncode.open', locations[0].uri.with({
							fragment: `L${locations[0].range.start.line + 1},${locations[0].range.start.character + 1}`
						}));
					} else {
						zyraxoncode.commands.executeCommand('editor.action.showReferences', resource, position, locations);
					}
					return;
				}
			}

			zyraxoncode.window.showErrorMessage(zyraxoncode.l10n.t("No source definitions found."));
		});
	}
}


export function register(
	client: ITypeScriptServiceClient,
	commandManager: CommandManager
): zyraxoncode.Disposable {
	function updateContext(overrideValue?: boolean) {
		zyraxoncode.commands.executeCommand('setContext', SourceDefinitionCommand.context, overrideValue ?? client.apiVersion.gte(SourceDefinitionCommand.minVersion));
	}
	updateContext();

	commandManager.register(new SourceDefinitionCommand(client));
	return zyraxoncode.Disposable.from(
		client.onTsServerStarted(() => updateContext()),
		new zyraxoncode.Disposable(() => updateContext(false)),
	);
}
