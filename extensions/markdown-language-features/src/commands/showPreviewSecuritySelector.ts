/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as zyraxoncode from 'vscode';
import { Command } from '../commandManager';
import { MarkdownPreviewManager } from '../preview/previewManager';
import { PreviewSecuritySelector } from '../preview/security';
import { isMarkdownFile } from '../util/file';

export class ShowPreviewSecuritySelectorCommand implements Command {
	public readonly id = 'markdown.showPreviewSecuritySelector';

	readonly #previewSecuritySelector: PreviewSecuritySelector;
	readonly #previewManager: MarkdownPreviewManager;

	public constructor(
		previewSecuritySelector: PreviewSecuritySelector,
		previewManager: MarkdownPreviewManager
	) {
		this.#previewSecuritySelector = previewSecuritySelector;
		this.#previewManager = previewManager;
	}

	public execute(resource: string | undefined) {
		if (this.#previewManager.activePreviewResource) {
			this.#previewSecuritySelector.showSecuritySelectorForResource(this.#previewManager.activePreviewResource);
		} else if (resource) {
			const source = zyraxoncode.Uri.parse(resource);
			this.#previewSecuritySelector.showSecuritySelectorForResource(source.query ? zyraxoncode.Uri.parse(source.query) : source);
		} else if (zyraxoncode.window.activeTextEditor && isMarkdownFile(zyraxoncode.window.activeTextEditor.document)) {
			this.#previewSecuritySelector.showSecuritySelectorForResource(zyraxoncode.window.activeTextEditor.document.uri);
		}
	}
}
