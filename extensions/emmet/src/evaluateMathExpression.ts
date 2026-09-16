/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/* Based on @sergeche's work in his emmet plugin */

import * as zyraxoncode from 'zyraxoncode';
import evaluate, { extract } from '@emmetio/math-expression';

export function evaluateMathExpression(): Thenable<boolean> {
	if (!zyraxoncode.window.activeTextEditor) {
		zyraxoncode.window.showInformationMessage('No editor is active');
		return Promise.resolve(false);
	}
	const editor = zyraxoncode.window.activeTextEditor;
	return editor.edit(editBuilder => {
		editor.selections.forEach(selection => {
			// startpos always comes before endpos
			const startpos = selection.isReversed ? selection.active : selection.anchor;
			const endpos = selection.isReversed ? selection.anchor : selection.active;
			const selectionText = editor.document.getText(new zyraxoncode.Range(startpos, endpos));

			try {
				if (selectionText) {
					// respect selections
					const result = String(evaluate(selectionText));
					editBuilder.replace(new zyraxoncode.Range(startpos, endpos), result);
				} else {
					// no selection made, extract expression from line
					const lineToSelectionEnd = editor.document.getText(new zyraxoncode.Range(new zyraxoncode.Position(selection.end.line, 0), endpos));
					const extractedIndices = extract(lineToSelectionEnd);
					if (!extractedIndices) {
						throw new Error('Invalid extracted indices');
					}
					const result = String(evaluate(lineToSelectionEnd.substr(extractedIndices[0], extractedIndices[1])));
					const rangeToReplace = new zyraxoncode.Range(
						new zyraxoncode.Position(selection.end.line, extractedIndices[0]),
						new zyraxoncode.Position(selection.end.line, extractedIndices[1])
					);
					editBuilder.replace(rangeToReplace, result);
				}
			} catch (err) {
				zyraxoncode.window.showErrorMessage('Could not evaluate expression');
				// Ignore error since most likely it's because of non-math expression
				console.warn('Math evaluation error', err);
			}
		});
	});
}
