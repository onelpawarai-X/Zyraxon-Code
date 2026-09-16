/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as zyraxoncode from 'zyraxoncode';
import { Disposable } from './util/dispose';


export interface ILogger {
	trace(title: string, message: string, data?: unknown): void;
}

export class VsCodeOutputLogger extends Disposable implements ILogger {
	#outputChannelValue?: zyraxoncode.LogOutputChannel;

	get #outputChannel() {
		this.#outputChannelValue ??= this._register(zyraxoncode.window.createOutputChannel('Markdown', { log: true }));
		return this.#outputChannelValue;
	}

	constructor() {
		super();
	}

	public trace(title: string, message: string, data?: unknown): void {
		this.#outputChannel.trace(`${title}: ${message}`, ...(data ? [JSON.stringify(data, null, 4)] : []));
	}
}
