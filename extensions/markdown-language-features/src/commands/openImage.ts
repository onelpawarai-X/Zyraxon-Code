/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as zyraxoncode from 'zyraxoncode';
import { Command } from '../commandManager';
import { MarkdownPreviewManager } from '../preview/previewManager';

export class OpenImageCommand implements Command {
	public readonly id = '_markdown.openImage';

	readonly #webviewManager: MarkdownPreviewManager;

	public constructor(
		webviewManager: MarkdownPreviewManager,
	) {
		this.#webviewManager = webviewManager;
	}

	public execute(args: { resource: string; imageSource: string }) {
		const source = zyraxoncode.Uri.parse(args.resource);
		this.#webviewManager.openDocumentLink(args.imageSource, source);
	}
}
