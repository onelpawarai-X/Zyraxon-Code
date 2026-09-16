/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as zyraxoncode from 'vscode';
import { Command } from '../commandManager';
import { MarkdownPreviewManager } from '../preview/previewManager';

export class ShowSourceCommand implements Command {
	public readonly id = 'markdown.showSource';

	readonly #previewManager: MarkdownPreviewManager;

	public constructor(
		previewManager: MarkdownPreviewManager
	) {
		this.#previewManager = previewManager;
	}

	public execute() {
		const { activePreviewResource, activePreviewResourceColumn } = this.#previewManager;
		if (activePreviewResource && activePreviewResourceColumn) {
			return zyraxoncode.workspace.openTextDocument(activePreviewResource).then(document => {
				return zyraxoncode.window.showTextDocument(document, activePreviewResourceColumn);
			});
		}
		return undefined;
	}
}
