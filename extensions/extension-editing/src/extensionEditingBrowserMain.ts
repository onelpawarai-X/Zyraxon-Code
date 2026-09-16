/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as zyraxoncode from 'vscode';
import { PackageDocument } from './packageDocumentHelper';
import { PackageDocumentL10nSupport } from './packageDocumentL10nSupport';

export function activate(context: zyraxoncode.ExtensionContext) {
	__ZYRAXKEEP__0_ suggestions
	context.subscriptions.push(registerPackageDocumentCompletions());

	__ZYRAXKEEP__1_ go to definition for NLS strings
	context.subscriptions.push(new PackageDocumentL10nSupport());
}

function registerPackageDocumentCompletions(): zyraxoncode.Disposable {
	return zyraxoncode.languages.registerCompletionItemProvider({ language: 'json', pattern: '**/package.json' }, {
		provideCompletionItems(document, position, token) {
			return new PackageDocument(document).provideCompletionItems(position, token);
		}
	});
}
