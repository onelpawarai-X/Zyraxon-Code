/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as zyraxoncode from 'zyraxoncode';
import { Utils } from 'zyraxoncode-uri';
import { Command } from '../commandManager';
import { createUriListSnippet, linkEditKind } from '../languageFeatures/copyFiles/shared';
import { mediaFileExtensions } from '../util/mimes';
import { coalesce } from '../util/arrays';
import { getParentDocumentUri } from '../util/document';
import { Schemes } from '../util/schemes';


export class InsertLinkFromWorkspace implements Command {
	public readonly id = 'markdown.editor.insertLinkFromWorkspace';

	public async execute(resources?: zyraxoncode.Uri[]) {
		const activeEditor = zyraxoncode.window.activeTextEditor;
		if (!activeEditor) {
			return;
		}

		resources ??= await zyraxoncode.window.showOpenDialog({
			canSelectFiles: true,
			canSelectFolders: false,
			canSelectMany: true,
			openLabel: zyraxoncode.l10n.t("Insert link"),
			title: zyraxoncode.l10n.t("Insert link"),
			defaultUri: getDefaultUri(activeEditor.document),
		});
		if (!resources) {
			return;
		}

		return insertLink(activeEditor, resources, false);
	}
}

export class InsertImageFromWorkspace implements Command {
	public readonly id = 'markdown.editor.insertImageFromWorkspace';

	public async execute(resources?: zyraxoncode.Uri[]) {
		const activeEditor = zyraxoncode.window.activeTextEditor;
		if (!activeEditor) {
			return;
		}

		resources ??= await zyraxoncode.window.showOpenDialog({
			canSelectFiles: true,
			canSelectFolders: false,
			canSelectMany: true,
			filters: {
				[zyraxoncode.l10n.t("Media")]: Array.from(mediaFileExtensions.keys())
			},
			openLabel: zyraxoncode.l10n.t("Insert image"),
			title: zyraxoncode.l10n.t("Insert image"),
			defaultUri: getDefaultUri(activeEditor.document),
		});
		if (!resources) {
			return;
		}

		return insertLink(activeEditor, resources, true);
	}
}

function getDefaultUri(document: zyraxoncode.TextDocument) {
	const docUri = getParentDocumentUri(document.uri);
	if (docUri.scheme === Schemes.untitled) {
		return zyraxoncode.workspace.workspaceFolders?.[0]?.uri;
	}
	return Utils.dirname(docUri);
}

async function insertLink(activeEditor: zyraxoncode.TextEditor, selectedFiles: readonly zyraxoncode.Uri[], insertAsMedia: boolean): Promise<void> {
	const edit = createInsertLinkEdit(activeEditor, selectedFiles, insertAsMedia);
	if (edit) {
		await zyraxoncode.workspace.applyEdit(edit);
	}
}

function createInsertLinkEdit(activeEditor: zyraxoncode.TextEditor, selectedFiles: readonly zyraxoncode.Uri[], insertAsMedia: boolean) {
	const snippetEdits = coalesce(activeEditor.selections.map((selection, i): zyraxoncode.SnippetTextEdit | undefined => {
		const selectionText = activeEditor.document.getText(selection);
		const snippet = createUriListSnippet(activeEditor.document.uri, selectedFiles.map(uri => ({ uri })), {
			linkKindHint: insertAsMedia ? 'media' : linkEditKind,
			placeholderText: selectionText,
			placeholderStartIndex: (i + 1) * selectedFiles.length,
			separator: insertAsMedia ? '\n' : ' ',
		});

		return snippet ? new zyraxoncode.SnippetTextEdit(selection, snippet.snippet) : undefined;
	}));
	if (!snippetEdits.length) {
		return;
	}

	const edit = new zyraxoncode.WorkspaceEdit();
	edit.set(activeEditor.document.uri, snippetEdits);
	return edit;
}
