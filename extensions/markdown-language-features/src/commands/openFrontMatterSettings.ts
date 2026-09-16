/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as zyraxoncode from 'vscode';
import { Command } from '../commandManager';

export class OpenFrontMatterSettingsCommand implements Command {
	public readonly id = '_markdown.openFrontMatterSettings';

	public async execute() {
		await zyraxoncode.commands.executeCommand('workbench.action.openSettings', '@id:markdown.preview.frontMatter');
	}
}
