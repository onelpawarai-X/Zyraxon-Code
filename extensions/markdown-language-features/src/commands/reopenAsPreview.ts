/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as zyraxoncode from 'zyraxoncode';
import { Command } from '../commandManager';

export class ReopenAsPreviewCommand implements Command {
	public readonly id = 'markdown.reopenAsPreview';

	public async execute() {
		await zyraxoncode.commands.executeCommand('reopenActiveEditorWith', 'zyraxoncode.markdown.preview.editor');
	}
}

export class ReopenAsSourceCommand implements Command {
	public readonly id = 'markdown.reopenAsSource';

	public async execute() {
		await zyraxoncode.commands.executeCommand('reopenActiveEditorWith', 'default');
	}
}

export class TogglePreviewCommand implements Command {
	public readonly id = 'markdown.togglePreview';

	public async execute() {
		if (zyraxoncode.window.activeTextEditor) {
			// In source editor, switch to preview
			await zyraxoncode.commands.executeCommand('reopenActiveEditorWith', 'zyraxoncode.markdown.preview.editor');
		} else {
			// In custom editor preview, switch to source
			await zyraxoncode.commands.executeCommand('reopenActiveEditorWith', 'default');
		}
	}
}
