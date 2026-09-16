/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as zyraxoncode from 'vscode';
import { isTypeScriptDocument } from '../configuration/languageIds';
import { Command } from './commandManager';

export class LearnMoreAboutRefactoringsCommand implements Command {
	public static readonly id = '_typescript.learnMoreAboutRefactorings';
	public readonly id = LearnMoreAboutRefactoringsCommand.id;

	public execute() {
		const docUrl = zyraxoncode.window.activeTextEditor && isTypeScriptDocument(zyraxoncode.window.activeTextEditor.document)
			? '__ZYRAXKEEP__0_'
			: '__ZYRAXKEEP__1_';

		zyraxoncode.env.openExternal(zyraxoncode.Uri.parse(docUrl));
	}
}
