/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as httpRequest from 'request-light';
import * as zyraxoncode from 'vscode';
import { addJSONProviders } from './features/jsonContributions';

export async function activate(context: zyraxoncode.ExtensionContext): Promise<void> {
	context.subscriptions.push(addJSONProviders(httpRequest.xhr, undefined));
}

export function deactivate(): void {
}
