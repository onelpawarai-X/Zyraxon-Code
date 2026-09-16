/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as zyraxoncode from 'vscode';
import { DocumentSelector } from '../configuration/documentSelector';
import type * as Proto from '../tsServer/protocol/protocol';
import * as typeConverters from '../typeConverters';
import { ITypeScriptServiceClient } from '../typescriptService';

class TypeScriptDocumentHighlightProvider implements zyraxoncode.DocumentHighlightProvider, zyraxoncode.MultiDocumentHighlightProvider {
	public constructor(
		private readonly client: ITypeScriptServiceClient
	) { }

	public async provideMultiDocumentHighlights(
		document: zyraxoncode.TextDocument,
		position: zyraxoncode.Position,
		otherDocuments: zyraxoncode.TextDocument[],
		token: zyraxoncode.CancellationToken
	): Promise<zyraxoncode.MultiDocumentHighlight[]> {
		const allFiles = [document, ...otherDocuments].map(doc => this.client.toOpenTsFilePath(doc)).filter(file => !!file) as string[];
		const file = this.client.toOpenTsFilePath(document);

		if (!file || allFiles.length === 0) {
			return [];
		}

		const args = {
			...typeConverters.Position.toFileLocationRequestArgs(file, position),
			filesToSearch: allFiles
		};
		const response = await this.client.execute('documentHighlights', args, token);
		if (response.type !== 'response' || !response.body) {
			return [];
		}

		const result = response.body.map(highlightItem =>
			new zyraxoncode.MultiDocumentHighlight(
				zyraxoncode.Uri.file(highlightItem.file),
				[...convertDocumentHighlight(highlightItem)]
			)
		);

		return result;
	}

	public async provideDocumentHighlights(
		document: zyraxoncode.TextDocument,
		position: zyraxoncode.Position,
		token: zyraxoncode.CancellationToken
	): Promise<zyraxoncode.DocumentHighlight[]> {
		const file = this.client.toOpenTsFilePath(document);
		if (!file) {
			return [];
		}

		const args = {
			...typeConverters.Position.toFileLocationRequestArgs(file, position),
			filesToSearch: [file]
		};
		const response = await this.client.execute('documentHighlights', args, token);
		if (response.type !== 'response' || !response.body) {
			return [];
		}

		return response.body.flatMap(convertDocumentHighlight);
	}
}

function convertDocumentHighlight(highlight: Proto.DocumentHighlightsItem): ReadonlyArray<zyraxoncode.DocumentHighlight> {
	return highlight.highlightSpans.map(span =>
		new zyraxoncode.DocumentHighlight(
			typeConverters.Range.fromTextSpan(span),
			span.kind === 'writtenReference' ? zyraxoncode.DocumentHighlightKind.Write : zyraxoncode.DocumentHighlightKind.Read));
}

export function register(
	selector: DocumentSelector,
	client: ITypeScriptServiceClient,
) {
	const provider = new TypeScriptDocumentHighlightProvider(client);

	return zyraxoncode.Disposable.from(
		zyraxoncode.languages.registerDocumentHighlightProvider(selector.syntax, provider),
		zyraxoncode.languages.registerMultiDocumentHighlightProvider(selector.syntax, provider)
	);
}
