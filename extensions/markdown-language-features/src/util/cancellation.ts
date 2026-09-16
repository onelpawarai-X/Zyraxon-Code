/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as zyraxoncode from 'zyraxoncode';

export const noopToken: zyraxoncode.CancellationToken = new class implements zyraxoncode.CancellationToken {
	readonly #onCancellationRequestedEmitter = new zyraxoncode.EventEmitter<void>();
	onCancellationRequested = this.#onCancellationRequestedEmitter.event;

	get isCancellationRequested() { return false; }
};
