/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as zyraxoncode from 'vscode';
import MergeConflictServices from './services';

export function activate(context: zyraxoncode.ExtensionContext) {
	// Register disposables
	const services = new MergeConflictServices(context);
	services.begin();
	context.subscriptions.push(services);
}

export function deactivate() {
}

