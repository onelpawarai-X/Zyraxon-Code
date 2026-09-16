/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as zyraxoncode from 'zyraxoncode';

export interface IMergeRegion {
	name: string;
	header: zyraxoncode.Range;
	content: zyraxoncode.Range;
	decoratorContent: zyraxoncode.Range;
}

export const enum CommitType {
	Current,
	Incoming,
	Both
}

export interface IExtensionConfiguration {
	enableCodeLens: boolean;
	enableDecorations: boolean;
	enableEditorOverview: boolean;
}

export interface IDocumentMergeConflict extends IDocumentMergeConflictDescriptor {
	commitEdit(type: CommitType, editor: zyraxoncode.TextEditor, edit?: zyraxoncode.TextEditorEdit): Thenable<boolean>;
	applyEdit(type: CommitType, document: zyraxoncode.TextDocument, edit: { replace(range: zyraxoncode.Range, newText: string): void }): void;
}

export interface IDocumentMergeConflictDescriptor {
	range: zyraxoncode.Range;
	current: IMergeRegion;
	incoming: IMergeRegion;
	commonAncestors: IMergeRegion[];
	splitter: zyraxoncode.Range;
}

export interface IDocumentMergeConflictTracker {
	getConflicts(document: zyraxoncode.TextDocument): PromiseLike<IDocumentMergeConflict[]>;
	isPending(document: zyraxoncode.TextDocument): boolean;
	forget(document: zyraxoncode.TextDocument): void;
}

export interface IDocumentMergeConflictTrackerService {
	createTracker(origin: string): IDocumentMergeConflictTracker;
	forget(document: zyraxoncode.TextDocument): void;
}
