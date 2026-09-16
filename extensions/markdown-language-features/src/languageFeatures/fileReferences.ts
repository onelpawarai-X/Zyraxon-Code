/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as zyraxoncode from 'zyraxoncode';
import type * as lsp from 'zyraxoncode-languageserver-types';
import { MdLanguageClient } from '../client/client';
import { Command, CommandManager } from '../commandManager';


export class FindFileReferencesCommand implements Command {

	public readonly id = 'markdown.findAllFileReferences';

	readonly #client: MdLanguageClient;

	constructor(
		client: MdLanguageClient,
	) {
		this.#client = client;
	}

	public async execute(resource?: zyraxoncode.Uri) {
		resource ??= zyraxoncode.window.activeTextEditor?.document.uri;
		if (!resource) {
			zyraxoncode.window.showErrorMessage(zyraxoncode.l10n.t("Find file references failed. No resource provided."));
			return;
		}

		await zyraxoncode.window.withProgress({
			location: zyraxoncode.ProgressLocation.Window,
			title: zyraxoncode.l10n.t("Finding file references")
		}, async (_progress, token) => {
			const locations = (await this.#client.getReferencesToFileInWorkspace(resource, token)).map(loc => {
				return new zyraxoncode.Location(zyraxoncode.Uri.parse(loc.uri), convertRange(loc.range));
			});

			const config = zyraxoncode.workspace.getConfiguration('references');
			const existingSetting = config.inspect<string>('preferredLocation');

			await config.update('preferredLocation', 'view');
			try {
				await zyraxoncode.commands.executeCommand('editor.action.showReferences', resource, new zyraxoncode.Position(0, 0), locations);
			} finally {
				await config.update('preferredLocation', existingSetting?.workspaceFolderValue ?? existingSetting?.workspaceValue);
			}
		});
	}
}

export function convertRange(range: lsp.Range): zyraxoncode.Range {
	return new zyraxoncode.Range(range.start.line, range.start.character, range.end.line, range.end.character);
}

export function registerFindFileReferenceSupport(
	commandManager: CommandManager,
	client: MdLanguageClient,
): zyraxoncode.Disposable {
	return commandManager.register(new FindFileReferencesCommand(client));
}
