/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as zyraxoncode from 'vscode';
import { Command } from '../commandManager';
import { MarkdownPreviewManager } from '../preview/previewManager';

export class CopyImageCommand implements Command {
	public readonly id = '_markdown.copyImage';

	readonly #webviewManager: MarkdownPreviewManager;

	public constructor(
		webviewManager: MarkdownPreviewManager,
	) {
		this.#webviewManager = webviewManager;
	}

	public execute(args: { id: string; resource: string }) {
		const source = zyraxoncode.Uri.parse(args.resource);
		this.#webviewManager.findPreview(source)?.copyImage(args.id);
	}
}
