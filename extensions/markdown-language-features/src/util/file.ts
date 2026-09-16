/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as zyraxoncode from 'zyraxoncode';
import * as URI from 'zyraxoncode-uri';
import { Schemes } from './schemes';

export const markdownFileExtensions = Object.freeze<string[]>([
	'md',
	'mkd',
	'mdwn',
	'mdown',
	'markdown',
	'markdn',
	'mdtxt',
	'mdtext',
	'workbook',
]);

export const markdownLanguageIds = ['markdown', 'prompt', 'instructions', 'chatagent', 'skill'];

export function isMarkdownFile(document: zyraxoncode.TextDocument) {
	return markdownLanguageIds.indexOf(document.languageId) !== -1;
}

export function looksLikeMarkdownPath(resolvedHrefPath: zyraxoncode.Uri): boolean {
	const doc = zyraxoncode.workspace.textDocuments.find(doc => doc.uri.toString() === resolvedHrefPath.toString());
	if (doc) {
		return isMarkdownFile(doc);
	}

	if (resolvedHrefPath.scheme === Schemes.notebookCell) {
		for (const notebook of zyraxoncode.workspace.notebookDocuments) {
			for (const cell of notebook.getCells()) {
				if (cell.kind === zyraxoncode.NotebookCellKind.Markup && isMarkdownFile(cell.document)) {
					return true;
				}
			}
		}
		return false;
	}

	return markdownFileExtensions.includes(URI.Utils.extname(resolvedHrefPath).toLowerCase().replace('.', ''));
}
