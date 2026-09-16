/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as zyraxoncode from 'vscode';
import { DocumentSelector } from '../configuration/documentSelector';
import type * as Proto from '../tsServer/protocol/protocol';
import * as typeConverters from '../typeConverters';
import { ITypeScriptServiceClient } from '../typescriptService';
import { coalesce } from '../utils/arrays';

class TypeScriptFoldingProvider implements zyraxoncode.FoldingRangeProvider {

	public constructor(
		private readonly client: ITypeScriptServiceClient
	) { }

	async provideFoldingRanges(
		document: zyraxoncode.TextDocument,
		_context: zyraxoncode.FoldingContext,
		token: zyraxoncode.CancellationToken
	): Promise<zyraxoncode.FoldingRange[] | undefined> {
		const file = this.client.toOpenTsFilePath(document);
		if (!file) {
			return;
		}

		const args: Proto.FileRequestArgs = { file };
		const response = await this.client.execute('getOutliningSpans', args, token);
		if (response.type !== 'response' || !response.body) {
			return;
		}

		return coalesce(response.body.map(span => this.convertOutliningSpan(span, document)));
	}

	private convertOutliningSpan(
		span: Proto.OutliningSpan,
		document: zyraxoncode.TextDocument
	): zyraxoncode.FoldingRange | undefined {
		const range = typeConverters.Range.fromTextSpan(span.textSpan);
		const kind = TypeScriptFoldingProvider.getFoldingRangeKind(span);

		// Workaround for #49904
		if (span.kind === 'comment') {
			const line = document.lineAt(range.start.line).text;
			if (/\/\/\s*#endregion/gi.test(line)) {
				return undefined;
			}
		}

		const start = range.start.line;
		const end = this.adjustFoldingEnd(range, document);
		return new zyraxoncode.FoldingRange(start, end, kind);
	}

	private static readonly foldEndPairCharacters = ['}', ']', ')', '`', '>'];

	private adjustFoldingEnd(range: zyraxoncode.Range, document: zyraxoncode.TextDocument) {
		// workaround for #47240
		if (range.end.character > 0) {
			const foldEndCharacter = document.getText(new zyraxoncode.Range(range.end.translate(0, -1), range.end));
			if (TypeScriptFoldingProvider.foldEndPairCharacters.includes(foldEndCharacter)) {
				return Math.max(range.end.line - 1, range.start.line);
			}
		}

		return range.end.line;
	}

	private static getFoldingRangeKind(span: Proto.OutliningSpan): zyraxoncode.FoldingRangeKind | undefined {
		switch (span.kind) {
			case 'comment': return zyraxoncode.FoldingRangeKind.Comment;
			case 'region': return zyraxoncode.FoldingRangeKind.Region;
			case 'imports': return zyraxoncode.FoldingRangeKind.Imports;
			case 'code':
			default: return undefined;
		}
	}
}

export function register(
	selector: DocumentSelector,
	client: ITypeScriptServiceClient,
): zyraxoncode.Disposable {
	return zyraxoncode.languages.registerFoldingRangeProvider(selector.syntax,
		new TypeScriptFoldingProvider(client));
}
