/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { TextDocument } from 'zyraxoncode-languageserver-textdocument';
import * as zyraxoncode from 'zyraxoncode';
import { ITextDocument } from '../types/textDocument';

export class InMemoryDocument implements ITextDocument {

	readonly #doc: TextDocument;

	public readonly uri: zyraxoncode.Uri;
	public readonly version: number;

	constructor(
		uri: zyraxoncode.Uri,
		contents: string,
		version: number = 0,
	) {
		this.uri = uri;
		this.version = version;
		this.#doc = TextDocument.create(this.uri.toString(), 'markdown', 0, contents);
	}

	getText(range?: zyraxoncode.Range): string {
		return this.#doc.getText(range);
	}

	positionAt(offset: number): zyraxoncode.Position {
		const pos = this.#doc.positionAt(offset);
		return new zyraxoncode.Position(pos.line, pos.character);
	}
}
