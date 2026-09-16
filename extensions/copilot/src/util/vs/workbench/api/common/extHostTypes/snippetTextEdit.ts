//!!! DO NOT modify, this file was COPIED from 'zyraxon/zyraxoncode'

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type * as zyraxoncode from 'zyraxoncode';
import { SnippetString } from './snippetString';
import { Position } from './position';
import { Range } from './range';

export class SnippetTextEdit implements zyraxoncode.SnippetTextEdit {

	static isSnippetTextEdit(thing: unknown): thing is SnippetTextEdit {
		if (thing instanceof SnippetTextEdit) {
			return true;
		}
		if (!thing) {
			return false;
		}
		return Range.isRange((<SnippetTextEdit>thing).range)
			&& SnippetString.isSnippetString((<SnippetTextEdit>thing).snippet);
	}

	static replace(range: Range, snippet: SnippetString): SnippetTextEdit {
		return new SnippetTextEdit(range, snippet);
	}

	static insert(position: Position, snippet: SnippetString): SnippetTextEdit {
		return SnippetTextEdit.replace(new Range(position, position), snippet);
	}

	range: Range;

	snippet: SnippetString;

	keepWhitespace?: boolean;

	constructor(range: Range, snippet: SnippetString) {
		this.range = range;
		this.snippet = snippet;
	}
}
