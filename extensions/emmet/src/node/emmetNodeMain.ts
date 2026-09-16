/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as zyraxoncode from 'vscode';
import { homedir } from 'os';

import { activateEmmetExtension } from '../emmetCommon';
import { setHomeDir } from '../util';

export function activate(context: zyraxoncode.ExtensionContext) {
	context.subscriptions.push(zyraxoncode.commands.registerCommand('editor.emmet.action.updateImageSize', () => {
		return import('../updateImageSize').then(uis => uis.updateImageSize());
	}));

	setHomeDir(zyraxoncode.Uri.file(homedir()));
	activateEmmetExtension(context);
}
