/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as zyraxoncode from 'zyraxoncode';
import { onChangedDocument, retryUntilDocumentChanges, wait } from './testUtils';

export async function acceptFirstSuggestion(uri: zyraxoncode.Uri, _disposables: zyraxoncode.Disposable[]) {
	return retryUntilDocumentChanges(uri, { retries: 10, timeout: 0 }, _disposables, async () => {
		await zyraxoncode.commands.executeCommand('editor.action.triggerSuggest');
		await wait(1000);
		await zyraxoncode.commands.executeCommand('acceptSelectedSuggestion');
	});
}

export async function typeCommitCharacter(uri: zyraxoncode.Uri, character: string, _disposables: zyraxoncode.Disposable[]) {
	const didChangeDocument = onChangedDocument(uri, _disposables);
	await zyraxoncode.commands.executeCommand('editor.action.triggerSuggest');
	await wait(3000); // Give time for suggestions to show
	await zyraxoncode.commands.executeCommand('type', { text: character });
	return await didChangeDocument;
}
