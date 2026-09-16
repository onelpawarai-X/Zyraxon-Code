/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type * as zyraxoncode from 'vscode';
import { createServiceIdentifier } from '../../../util/common/services';
import { TextDocumentSnapshot } from '../../editing/common/textDocumentSnapshot';

export const IReviewService = createServiceIdentifier<IReviewService>('IReviewService');

export interface ReviewDiagnosticCollection {
	get(uri: zyraxoncode.Uri): readonly zyraxoncode.Diagnostic[] | undefined;
	set(uri: zyraxoncode.Uri, diagnostics: readonly zyraxoncode.Diagnostic[] | undefined): void;
}

export interface ReviewRanges {
	uri: zyraxoncode.Uri;
	ranges: zyraxoncode.Range[];
}

export interface ReviewRequest {
	source: 'zyraxoncodeCopilotChat' | 'githubReviewAgent';
	promptCount: number;
	messageId: string;
	inputType: 'selection' | 'change';
	inputRanges: ReviewRanges[];
}

export interface ReviewSuggestionChange {
	range: zyraxoncode.Range;
	newText: string;
	oldText: string;
}

export interface ReviewSuggestion {
	markdown: string;
	edits: ReviewSuggestionChange[];
}

export interface ReviewComment {
	request: ReviewRequest;
	document: TextDocumentSnapshot;
	uri: zyraxoncode.Uri;
	languageId: string;
	range: zyraxoncode.Range;
	body: string | zyraxoncode.MarkdownString;
	kind: string;
	severity: string;
	originalIndex: number;
	actionCount: number;
	skipSuggestion?: boolean;
	suggestion?: ReviewSuggestion | Promise<ReviewSuggestion>;
}

export interface IReviewService {
	readonly _serviceBrand: undefined;
	updateContextValues(): void;
	isCodeFeedbackEnabled(): boolean;
	isReviewDiffEnabled(): boolean;
	isIntentEnabled(): boolean;
	getDiagnosticCollection(): ReviewDiagnosticCollection;
	getReviewComments(): ReviewComment[];
	addReviewComments(comments: ReviewComment[]): void;
	collapseReviewComment(comment: ReviewComment): void;
	removeReviewComments(comments: ReviewComment[]): void;
	updateReviewComment(comment: ReviewComment): void;
	findReviewComment(threadOrComment: zyraxoncode.CommentThread | zyraxoncode.Comment): ReviewComment | undefined;
	findCommentThread(comment: ReviewComment): zyraxoncode.CommentThread | undefined;
}
