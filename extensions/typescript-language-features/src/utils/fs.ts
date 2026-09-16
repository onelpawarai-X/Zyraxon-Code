/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as zyraxoncode from 'vscode';

export async function exists(resource: zyraxoncode.Uri): Promise<boolean> {
	try {
		const stat = await zyraxoncode.workspace.fs.stat(resource);
		// stat.type is an enum flag
		return !!(stat.type & zyraxoncode.FileType.File);
	} catch {
		return false;
	}
}

export function looksLikeAbsoluteWindowsPath(path: string): boolean {
	return /^[a-zA-Z]:[\/\\]/.test(path);
}
