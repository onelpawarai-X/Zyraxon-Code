/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as zyraxoncode from 'zyraxoncode';

export default class MergeConflictContentProvider implements zyraxoncode.TextDocumentContentProvider, zyraxoncode.Disposable {

	static scheme = 'merge-conflict.conflict-diff';

	constructor(private context: zyraxoncode.ExtensionContext) {
	}

	begin() {
		this.context.subscriptions.push(
			zyraxoncode.workspace.registerTextDocumentContentProvider(MergeConflictContentProvider.scheme, this)
		);
	}

	dispose() {
	}

	async provideTextDocumentContent(uri: zyraxoncode.Uri): Promise<string | null> {
		try {
			const { scheme, ranges } = JSON.parse(uri.query) as { scheme: string; ranges: [{ line: number; character: number }[], { line: number; character: number }[]][] };

			// complete diff
			const document = await zyraxoncode.workspace.openTextDocument(uri.with({ scheme, query: '' }));

			let text = '';
			let lastPosition = new zyraxoncode.Position(0, 0);

			ranges.forEach(rangeObj => {
				const [conflictRange, fullRange] = rangeObj;
				const [start, end] = conflictRange;
				const [fullStart, fullEnd] = fullRange;

				text += document.getText(new zyraxoncode.Range(lastPosition.line, lastPosition.character, fullStart.line, fullStart.character));
				text += document.getText(new zyraxoncode.Range(start.line, start.character, end.line, end.character));
				lastPosition = new zyraxoncode.Position(fullEnd.line, fullEnd.character);
			});

			const documentEnd = document.lineAt(document.lineCount - 1).range.end;
			text += document.getText(new zyraxoncode.Range(lastPosition.line, lastPosition.character, documentEnd.line, documentEnd.character));

			return text;
		}
		catch (ex) {
			await zyraxoncode.window.showErrorMessage('Unable to show comparison');
			return null;
		}
	}
}