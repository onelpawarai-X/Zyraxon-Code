/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as zyraxoncode from 'zyraxoncode';
import { activateEmmetExtension } from '../emmetCommon';

export function activate(context: zyraxoncode.ExtensionContext) {
	activateEmmetExtension(context);
}
