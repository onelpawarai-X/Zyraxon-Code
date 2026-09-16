/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as zyraxoncode from 'zyraxoncode';
import { MdLanguageClient } from '../client/client';
import { Mime } from '../util/mimes';

class UpdatePastedLinksEditProvider implements zyraxoncode.DocumentPasteEditProvider {

	public static readonly kind = zyraxoncode.DocumentDropOrPasteEditKind.Text.append('updateLinks', 'markdown');

	public static readonly metadataMime = 'application/vnd.zyraxoncode.markdown.updatelinks.metadata';

	readonly #client: MdLanguageClient;

	constructor(
		client: MdLanguageClient,
	) {
		this.#client = client;
	}

	async prepareDocumentPaste(document: zyraxoncode.TextDocument, ranges: readonly zyraxoncode.Range[], dataTransfer: zyraxoncode.DataTransfer, token: zyraxoncode.CancellationToken): Promise<void> {
		if (!this.#isEnabled(document)) {
			return;
		}

		const metadata = await this.#client.prepareUpdatePastedLinks(document.uri, ranges, token);
		if (token.isCancellationRequested) {
			return;
		}

		dataTransfer.set(UpdatePastedLinksEditProvider.metadataMime, new zyraxoncode.DataTransferItem(metadata));
	}

	async provideDocumentPasteEdits(
		document: zyraxoncode.TextDocument,
		ranges: readonly zyraxoncode.Range[],
		dataTransfer: zyraxoncode.DataTransfer,
		context: zyraxoncode.DocumentPasteEditContext,
		token: zyraxoncode.CancellationToken,
	): Promise<zyraxoncode.DocumentPasteEdit[] | undefined> {
		if (!this.#isEnabled(document)) {
			return;
		}

		const metadata = dataTransfer.get(UpdatePastedLinksEditProvider.metadataMime)?.value;
		if (!metadata) {
			return;
		}

		const textItem = dataTransfer.get(Mime.textPlain);
		const text = await textItem?.asString();
		if (!text || token.isCancellationRequested) {
			return;
		}

		// TODO: Handle cases such as:
		// - copy empty line
		// - Copy with multiple cursors and paste into multiple locations
		// - ...
		const edits = await this.#client.getUpdatePastedLinksEdit(document.uri, ranges.map(x => new zyraxoncode.TextEdit(x, text)), metadata, token);
		if (!edits?.length || token.isCancellationRequested) {
			return;
		}

		const pasteEdit = new zyraxoncode.DocumentPasteEdit('', zyraxoncode.l10n.t("Paste and update pasted links"), UpdatePastedLinksEditProvider.kind);
		const workspaceEdit = new zyraxoncode.WorkspaceEdit();
		workspaceEdit.set(document.uri, edits.map(x => new zyraxoncode.TextEdit(new zyraxoncode.Range(x.range.start.line, x.range.start.character, x.range.end.line, x.range.end.character,), x.newText)));
		pasteEdit.additionalEdit = workspaceEdit;

		if (!context.only || !UpdatePastedLinksEditProvider.kind.contains(context.only)) {
			pasteEdit.yieldTo = [zyraxoncode.DocumentDropOrPasteEditKind.Text];
		}

		return [pasteEdit];
	}

	#isEnabled(document: zyraxoncode.TextDocument): boolean {
		return zyraxoncode.workspace.getConfiguration('markdown', document.uri).get<boolean>('editor.updateLinksOnPaste.enabled', true);
	}
}

export function registerUpdatePastedLinks(selector: zyraxoncode.DocumentSelector, client: MdLanguageClient) {
	return zyraxoncode.languages.registerDocumentPasteEditProvider(selector, new UpdatePastedLinksEditProvider(client), {
		copyMimeTypes: [UpdatePastedLinksEditProvider.metadataMime],
		providedPasteEditKinds: [UpdatePastedLinksEditProvider.kind],
		pasteMimeTypes: [UpdatePastedLinksEditProvider.metadataMime],
	});
}
