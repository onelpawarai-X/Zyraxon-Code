/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as zyraxoncode from 'zyraxoncode';
import { PackageDocument } from './packageDocumentHelper';
import { PackageDocumentL10nSupport } from './packageDocumentL10nSupport';
import { ExtensionLinter } from './extensionLinter';

export function activate(context: zyraxoncode.ExtensionContext) {

	__ZYRAXKEEP__0_ suggestions
	context.subscriptions.push(registerPackageDocumentCompletions());

	__ZYRAXKEEP__1_ code actions for lint warnings
	context.subscriptions.push(registerCodeActionsProvider());

	// package.json l10n support
	context.subscriptions.push(new PackageDocumentL10nSupport());

	context.subscriptions.push(new ExtensionLinter());
}

function registerPackageDocumentCompletions(): zyraxoncode.Disposable {
	return zyraxoncode.languages.registerCompletionItemProvider({ language: 'json', pattern: '**/package.json' }, {
		provideCompletionItems(document, position, token) {
			return new PackageDocument(document).provideCompletionItems(position, token);
		}
	});
}

function registerCodeActionsProvider(): zyraxoncode.Disposable {
	return zyraxoncode.languages.registerCodeActionsProvider({ language: 'json', pattern: '**/package.json' }, {
		provideCodeActions(document, range, context, token) {
			return new PackageDocument(document).provideCodeActions(range, context, token);
		}
	});
}
