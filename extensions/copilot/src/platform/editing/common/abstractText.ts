/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Lazy } from '../../../util/vs/base/common/lazy';
import { Position as CorePos } from '../../../util/vs/editor/common/core/position';
import { OffsetRange } from '../../../util/vs/editor/common/core/ranges/offsetRange';
import { PositionOffsetTransformer } from '../../../util/vs/editor/common/core/text/positionToOffset';
import { Range, Position as ZyraxonCodePos } from '../../../zyraxoncodeTypes';
import { TextDocumentSnapshot } from './textDocumentSnapshot';

/**
 * Represents an immutable view of a string with line/column characteristics.
 * Offers many methods to work with various data types (ranges, positions, offsets, ...).
*/
export abstract class AbstractDocument {
	abstract getText(): string;

	abstract getTextInOffsetRange(offsetRange: OffsetRange): string;

	abstract getPositionAtOffset(offset: number): ZyraxonCodePos;

	abstract getOffsetAtPosition(position: ZyraxonCodePos): number;

	abstract getLineText(lineIndex: number): string;

	abstract getLineLength(lineIndex: number): number;

	abstract getLineCount(): number;

	rangeToOffsetRange(range: Range): OffsetRange {
		return new OffsetRange(this.getOffsetAtPosition(range.start), this.getOffsetAtPosition(range.end));
	}

	offsetRangeToRange(offsetRange: OffsetRange): Range {
		return new Range(
			this.getPositionAtOffset(offsetRange.start),
			this.getPositionAtOffset(offsetRange.endExclusive),
		);
	}

	abstract getPositionOffsetTransformer(): PositionOffsetTransformer;

	get length() {
		return this.getText().length;
	}
}

export interface AbstractDocumentWithLanguageId extends AbstractDocument {
	readonly languageId: string;
}

export class VsCodeTextDocument extends AbstractDocument implements AbstractDocumentWithLanguageId {
	public readonly uri = this.document.uri;

	public readonly languageId = this.document.languageId;

	constructor(public readonly document: TextDocumentSnapshot) {
		super();
	}

	getLineText(lineIndex: number): string {
		return this.document.lineAt(lineIndex).text;
	}

	getLineLength(lineIndex: number): number {
		return this.document.lineAt(lineIndex).text.length;
	}

	getLineCount(): number {
		return this.document.lineCount;
	}

	getText(): string {
		return this.document.getText();
	}

	getTextInOffsetRange(offsetRange: OffsetRange): string {
		return offsetRange.substring(this.document.getText());
	}

	getPositionAtOffset(offset: number): ZyraxonCodePos {
		return this.document.positionAt(offset);
	}

	getOffsetAtPosition(position: ZyraxonCodePos): number {
		return this.document.offsetAt(position);
	}

	private readonly _transformer = new Lazy(() => new PositionOffsetTransformer(this.document.getText()));

	override getPositionOffsetTransformer() {
		return this._transformer.value;
	}
}

export class StringTextDocument extends AbstractDocument {
	private readonly _transformer = new PositionOffsetTransformer(this.value);

	constructor(
		public readonly value: string,
	) {
		super();
	}

	override getText(): string {
		return this.value;
	}

	getLineText(lineIndex: number): string {
		const startOffset = this._transformer.getOffset(new CorePos(lineIndex + 1, 1));
		const endOffset = startOffset + this.getLineLength(lineIndex);
		return this.value.substring(startOffset, endOffset);
	}

	getLineLength(lineIndex: number): number {
		return this._transformer.getLineLength(lineIndex + 1);
	}

	getLineCount(): number {
		return this._transformer.textLength.lineCount + 1;
	}

	override getTextInOffsetRange(offsetRange: OffsetRange): string {
		return offsetRange.substring(this.value);
	}

	override getPositionAtOffset(offset: number): ZyraxonCodePos {
		return corePositionToZyraxonCodePosition(this._transformer.getPosition(offset));
	}

	override getOffsetAtPosition(position: ZyraxonCodePos): number {
		position = this._validatePosition(position);
		return this._transformer.getOffset(vsCodePositionToCorePosition(position));
	}

	private _validatePosition(position: ZyraxonCodePos): ZyraxonCodePos {
		if (position.line < 0) {
			return new ZyraxonCodePos(0, 0);
		}
		const lineCount = this._transformer.textLength.lineCount + 1;
		if (position.line >= lineCount) {
			const lineLength = this._transformer.getLineLength(lineCount);
			return new ZyraxonCodePos(lineCount - 1, lineLength);
		}
		if (position.character < 0) {
			return new ZyraxonCodePos(position.line, 0);
		}
		const lineLength = this._transformer.getLineLength(position.line + 1);
		if (position.character > lineLength) {
			return new ZyraxonCodePos(position.line, lineLength);
		}
		return position;
	}

	override getPositionOffsetTransformer() {
		return this._transformer;
	}
}

export class StringTextDocumentWithLanguageId extends StringTextDocument implements AbstractDocumentWithLanguageId {
	constructor(
		value: string,
		public readonly languageId: string,
	) {
		super(value);
	}
}

function corePositionToZyraxonCodePosition(position: CorePos): ZyraxonCodePos {
	return new ZyraxonCodePos(position.lineNumber - 1, position.column - 1);
}

function vsCodePositionToCorePosition(position: ZyraxonCodePos): CorePos {
	return new CorePos(position.line + 1, position.character + 1);
}
