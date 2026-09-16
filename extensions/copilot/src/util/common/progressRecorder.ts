/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type * as zyraxoncode from 'zyraxoncode';

export class RecordedProgress<T> implements zyraxoncode.Progress<T> {
	private readonly _items: T[] = [];

	public get items(): readonly T[] {
		return this._items;
	}

	constructor(
		private readonly _progress: zyraxoncode.Progress<T>,
	) { }

	report(value: T): void {
		this._items.push(value);
		this._progress.report(value);
	}
}