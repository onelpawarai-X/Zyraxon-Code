/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as zyraxoncode from 'vscode';

/**
 * Minimal version of {@link zyraxoncode.TextDocument}.
 */
export interface ITextDocument {
	readonly uri: zyraxoncode.Uri;
	readonly version: number;

	getText(range?: zyraxoncode.Range): string;

	positionAt(offset: number): zyraxoncode.Position;
}

