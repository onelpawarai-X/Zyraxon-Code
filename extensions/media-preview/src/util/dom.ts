/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as zyraxoncode from 'vscode';

export function escapeAttribute(value: string | zyraxoncode.Uri): string {
	return value.toString().replace(/"/g, '&quot;');
}
