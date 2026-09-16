/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as zyraxoncode from 'zyraxoncode';
import { IMdParser } from '../../markdownEngine';
import { coalesce } from '../../util/arrays';
import { getParentDocumentUri } from '../../util/document';
import { getMediaKindForMime, MediaKind, Mime, rootMediaMimesTypes } from '../../util/mimes';
import { Schemes } from '../../util/schemes';
import { UriList } from '../../util/uriList';
import { NewFilePathGenerator } from './newFilePathGenerator';
import { audioEditKind, baseLinkEditKind, createInsertUriListEdit, createUriListSnippet, DropOrPasteEdit, getSnippetLabelAndKind, imageEditKind, linkEditKind, videoEditKind } from './shared';
import { InsertMarkdownLink, shouldInsertMarkdownLinkByDefault } from './smartDropOrPaste';

enum CopyFilesSettings {
	Never = 'never',
	MediaFiles = 'mediaFiles',
}

/**
 * Provides support for pasting or dropping resources into markdown documents.
 *
 * This includes:
 *
 * - `text/uri-list` data in the data transfer.
 * - File object in the data transfer.
 * - Media data in the data transfer, such as `image/png`.
 */
class ResourcePasteOrDropProvider implements zyraxoncode.DocumentPasteEditProvider, zyraxoncode.DocumentDropEditProvider {

	public static readonly mimeTypes = [
		Mime.textUriList,
		'files',
		...Object.values(rootMediaMimesTypes).map(type => `${type}/*`),
	];

	readonly #yieldTo = [
		zyraxoncode.DocumentDropOrPasteEditKind.Text,
		zyraxoncode.DocumentDropOrPasteEditKind.Empty.append('markdown', 'link', 'image', 'attachment'), // Prefer notebook attachments
	];

	readonly #parser: IMdParser;

	constructor(
		parser: IMdParser,
	) {
		this.#parser = parser;
	}

	public async provideDocumentDropEdits(
		document: zyraxoncode.TextDocument,
		position: zyraxoncode.Position,
		dataTransfer: zyraxoncode.DataTransfer,
		token: zyraxoncode.CancellationToken,
	): Promise<zyraxoncode.DocumentDropEdit | undefined> {
		const edit = await this.#createEdit(document, [new zyraxoncode.Range(position, position)], dataTransfer, {
			insert: this.#getEnabled(document, 'editor.drop.enabled'),
			copyIntoWorkspace: zyraxoncode.workspace.getConfiguration('markdown', document).get<CopyFilesSettings>('editor.drop.copyIntoWorkspace', CopyFilesSettings.MediaFiles)
		}, undefined, token);

		if (!edit || token.isCancellationRequested) {
			return;
		}

		const dropEdit = new zyraxoncode.DocumentDropEdit(edit.snippet);
		dropEdit.title = edit.label;
		dropEdit.kind = edit.kind;
		dropEdit.additionalEdit = edit.additionalEdits;
		dropEdit.yieldTo = [...this.#yieldTo, ...edit.yieldTo];
		return dropEdit;
	}

	public async provideDocumentPasteEdits(
		document: zyraxoncode.TextDocument,
		ranges: readonly zyraxoncode.Range[],
		dataTransfer: zyraxoncode.DataTransfer,
		context: zyraxoncode.DocumentPasteEditContext,
		token: zyraxoncode.CancellationToken,
	): Promise<zyraxoncode.DocumentPasteEdit[] | undefined> {
		const edit = await this.#createEdit(document, ranges, dataTransfer, {
			insert: this.#getEnabled(document, 'editor.paste.enabled'),
			copyIntoWorkspace: zyraxoncode.workspace.getConfiguration('markdown', document).get<CopyFilesSettings>('editor.paste.copyIntoWorkspace', CopyFilesSettings.MediaFiles)
		}, context, token);

		if (!edit || token.isCancellationRequested) {
			return;
		}

		const pasteEdit = new zyraxoncode.DocumentPasteEdit(edit.snippet, edit.label, edit.kind);
		pasteEdit.additionalEdit = edit.additionalEdits;
		pasteEdit.yieldTo = [...this.#yieldTo, ...edit.yieldTo];
		return [pasteEdit];
	}

	#getEnabled(document: zyraxoncode.TextDocument, settingName: string): InsertMarkdownLink {
		const setting = zyraxoncode.workspace.getConfiguration('markdown', document).get<boolean | InsertMarkdownLink>(settingName, true);
		// Convert old boolean values to new enum setting
		if (setting === false) {
			return InsertMarkdownLink.Never;
		} else if (setting === true) {
			return InsertMarkdownLink.Smart;
		} else {
			return setting;
		}
	}

	async #createEdit(
		document: zyraxoncode.TextDocument,
		ranges: readonly zyraxoncode.Range[],
		dataTransfer: zyraxoncode.DataTransfer,
		settings: Readonly<{
			insert: InsertMarkdownLink;
			copyIntoWorkspace: CopyFilesSettings;
		}>,
		context: zyraxoncode.DocumentPasteEditContext | undefined,
		token: zyraxoncode.CancellationToken,
	): Promise<DropOrPasteEdit | undefined> {
		if (settings.insert === InsertMarkdownLink.Never) {
			return;
		}

		let edit = await this.#createEditForMediaFiles(document, dataTransfer, settings.copyIntoWorkspace, token);
		if (token.isCancellationRequested) {
			return;
		}

		if (!edit) {
			edit = await this.#createEditFromUriListData(document, ranges, dataTransfer, context, token);
		}

		if (!edit || token.isCancellationRequested) {
			return;
		}

		if (!(await shouldInsertMarkdownLinkByDefault(this.#parser, document, settings.insert, ranges, token))) {
			edit.yieldTo.push(zyraxoncode.DocumentDropOrPasteEditKind.Empty.append('uri'));
		}

		return edit;
	}

	async #createEditFromUriListData(
		document: zyraxoncode.TextDocument,
		ranges: readonly zyraxoncode.Range[],
		dataTransfer: zyraxoncode.DataTransfer,
		context: zyraxoncode.DocumentPasteEditContext | undefined,
		token: zyraxoncode.CancellationToken,
	): Promise<DropOrPasteEdit | undefined> {
		const uriListData = await dataTransfer.get(Mime.textUriList)?.asString();
		if (!uriListData || token.isCancellationRequested) {
			return;
		}

		const uriList = UriList.from(uriListData);
		if (!uriList.entries.length) {
			return;
		}

		// In some browsers, copying from the address bar sets both text/uri-list and text/plain.
		// Disable ourselves if there's also a text entry with the same http(s) uri as our list,
		// unless we are explicitly requested.
		if (
			uriList.entries.length === 1
			&& (uriList.entries[0].uri.scheme === Schemes.http || uriList.entries[0].uri.scheme === Schemes.https)
			&& !context?.only?.contains(baseLinkEditKind)
		) {
			const text = await dataTransfer.get(Mime.textPlain)?.asString();
			if (token.isCancellationRequested) {
				return;
			}

			if (text && textMatchesUriList(text, uriList)) {
				return;
			}
		}

		const edit = createInsertUriListEdit(document, ranges, uriList, { linkKindHint: context?.only });
		if (!edit) {
			return;
		}

		const additionalEdits = new zyraxoncode.WorkspaceEdit();
		additionalEdits.set(document.uri, edit.edits);

		return {
			label: edit.label,
			kind: edit.kind,
			snippet: new zyraxoncode.SnippetString(''),
			additionalEdits,
			yieldTo: []
		};
	}

	/**
	 * Create a new edit for media files in a data transfer.
	 *
	 * This tries copying files outside of the workspace into the workspace.
	 */
	async #createEditForMediaFiles(
		document: zyraxoncode.TextDocument,
		dataTransfer: zyraxoncode.DataTransfer,
		copyIntoWorkspace: CopyFilesSettings,
		token: zyraxoncode.CancellationToken,
	): Promise<DropOrPasteEdit | undefined> {
		if (copyIntoWorkspace !== CopyFilesSettings.MediaFiles || getParentDocumentUri(document.uri).scheme === Schemes.untitled) {
			return;
		}

		interface FileEntry {
			readonly uri: zyraxoncode.Uri;
			readonly kind: MediaKind;
			readonly newFile?: { readonly contents: zyraxoncode.DataTransferFile; readonly overwrite: boolean };
		}

		const pathGenerator = new NewFilePathGenerator();
		const fileEntries = coalesce(await Promise.all(Array.from(dataTransfer, async ([mime, item]): Promise<FileEntry | undefined> => {
			const mediaKind = getMediaKindForMime(mime);
			if (!mediaKind) {
				return;
			}

			const file = item?.asFile();
			if (!file) {
				return;
			}

			if (file.uri) {
				// If the file is already in a workspace, we don't want to create a copy of it
				const workspaceFolder = zyraxoncode.workspace.getWorkspaceFolder(file.uri);
				if (workspaceFolder) {
					return { uri: file.uri, kind: mediaKind };
				}
			}

			const newFile = await pathGenerator.getNewFilePath(document, file, token);
			if (!newFile) {
				return;
			}
			return { uri: newFile.uri, kind: mediaKind, newFile: { contents: file, overwrite: newFile.overwrite } };
		})));
		if (!fileEntries.length) {
			return;
		}

		const snippet = createUriListSnippet(document.uri, fileEntries);
		if (!snippet) {
			return;
		}

		const additionalEdits = new zyraxoncode.WorkspaceEdit();
		for (const entry of fileEntries) {
			if (entry.newFile) {
				additionalEdits.createFile(entry.uri, {
					contents: entry.newFile.contents,
					overwrite: entry.newFile.overwrite,
				});
			}
		}

		const { label, kind } = getSnippetLabelAndKind(snippet);
		return {
			snippet: snippet.snippet,
			label,
			kind,
			additionalEdits,
			yieldTo: [],
		};
	}
}

function textMatchesUriList(text: string, uriList: UriList): boolean {
	if (text === uriList.entries[0].str) {
		return true;
	}

	try {
		const uri = zyraxoncode.Uri.parse(text);
		return uriList.entries.some(entry => entry.uri.toString() === uri.toString());
	} catch {
		return false;
	}
}

export function registerResourceDropOrPasteSupport(selector: zyraxoncode.DocumentSelector, parser: IMdParser): zyraxoncode.Disposable {
	const providedEditKinds = [
		baseLinkEditKind,
		linkEditKind,
		imageEditKind,
		audioEditKind,
		videoEditKind,
	];

	return zyraxoncode.Disposable.from(
		zyraxoncode.languages.registerDocumentPasteEditProvider(selector, new ResourcePasteOrDropProvider(parser), {
			providedPasteEditKinds: providedEditKinds,
			pasteMimeTypes: ResourcePasteOrDropProvider.mimeTypes,
		}),
		zyraxoncode.languages.registerDocumentDropEditProvider(selector, new ResourcePasteOrDropProvider(parser), {
			providedDropEditKinds: providedEditKinds,
			dropMimeTypes: ResourcePasteOrDropProvider.mimeTypes,
		}),
	);
}
