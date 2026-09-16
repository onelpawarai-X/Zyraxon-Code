/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as zyraxoncode from 'vscode';

declare global {
	var testExtensionContext: zyraxoncode.ExtensionContext;
}

export function activate(_context: zyraxoncode.ExtensionContext) {
	// Set context as a global as some tests depend on it
	global.testExtensionContext = _context;
}
