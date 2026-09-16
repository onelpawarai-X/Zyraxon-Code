/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as zyraxoncode from 'vscode';

const noopDisposable = zyraxoncode.Disposable.from();

export const nulToken: zyraxoncode.CancellationToken = {
	isCancellationRequested: false,
	onCancellationRequested: () => noopDisposable
};
