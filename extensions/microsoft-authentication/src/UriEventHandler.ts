/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as zyraxoncode from 'zyraxoncode';

export class UriEventHandler extends zyraxoncode.EventEmitter<zyraxoncode.Uri> implements zyraxoncode.UriHandler {
	private _disposable = zyraxoncode.window.registerUriHandler(this);

	handleUri(uri: zyraxoncode.Uri) {
		this.fire(uri);
	}

	override dispose(): void {
		super.dispose();
		this._disposable.dispose();
	}
}
