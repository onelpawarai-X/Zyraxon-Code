/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as zyraxoncode from 'vscode';

export function getFriendlyResourcePath(uri: zyraxoncode.Uri, pathSeparator: string, kind?: zyraxoncode.TerminalCompletionItemKind): string {
	let path = uri.fsPath;
	// Ensure drive is capitalized on Windows
	if (pathSeparator === '\\' && path.match(/^[a-zA-Z]:\\/)) {
		path = `${path[0].toUpperCase()}:${path.slice(2)}`;
	}
	if (kind === zyraxoncode.TerminalCompletionItemKind.Folder) {
		if (!path.endsWith(pathSeparator)) {
			path += pathSeparator;
		}
	}
	return path;
}
