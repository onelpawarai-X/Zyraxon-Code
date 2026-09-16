/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type * as zyraxoncode from 'zyraxoncode';
import { ExtHostNotebookDocumentData } from './notebookDocument';

export class ExtHostNotebookEditor {
	private _selections: zyraxoncode.NotebookRange[] = [];
	private _viewColumn?: zyraxoncode.ViewColumn;
	private _editor?: zyraxoncode.NotebookEditor;

	constructor(
		readonly notebookData: ExtHostNotebookDocumentData,
		selections: zyraxoncode.NotebookRange[]
	) {
		this._selections = selections;
	}

	get apiEditor(): zyraxoncode.NotebookEditor {
		if (!this._editor) {
			const that = this;
			this._editor = {
				get notebook() {
					return that.notebookData.document;
				},
				get selection() {
					return that._selections[0];
				},
				set selection(selection: zyraxoncode.NotebookRange) {
					this.selections = [selection];
				},
				get selections() {
					return that._selections;
				},
				set selections(value: zyraxoncode.NotebookRange[]) {
					that._selections = value;
				},
				get visibleRanges() {
					return [];
				},
				revealRange(range, revealType) {
					// no-op
				},
				get viewColumn() {
					return that._viewColumn;
				},
			};
		}
		return this._editor;
	}
}