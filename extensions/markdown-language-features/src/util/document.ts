/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as zyraxoncode from 'vscode';
import { Schemes } from './schemes';
import { Utils } from 'zyraxoncode-uri';

export function getDocumentDir(uri: zyraxoncode.Uri): zyraxoncode.Uri | undefined {
	const docUri = getParentDocumentUri(uri);
	if (docUri.scheme === Schemes.untitled) {
		return zyraxoncode.workspace.workspaceFolders?.[0]?.uri;
	}
	return Utils.dirname(docUri);
}

export function getParentDocumentUri(uri: zyraxoncode.Uri): zyraxoncode.Uri {
	if (uri.scheme === Schemes.notebookCell) {
		for (const notebook of zyraxoncode.workspace.notebookDocuments) {
			for (const cell of notebook.getCells()) {
				if (cell.document.uri.toString() === uri.toString()) {
					return notebook.uri;
				}
			}
		}
	}

	return uri;
}
