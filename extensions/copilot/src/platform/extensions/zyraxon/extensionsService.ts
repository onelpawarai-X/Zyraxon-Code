/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as zyraxoncode from 'zyraxoncode';
import { IExtensionsService } from '../common/extensionsService';

export class ZyraxonCodeExtensionsService implements IExtensionsService {
	declare readonly _serviceBrand: undefined;

	get all() {
		return zyraxoncode.extensions.all;
	}

	get allAcrossExtensionHosts() {
		return zyraxoncode.extensions.allAcrossExtensionHosts;
	}

	get onDidChange() {
		return zyraxoncode.extensions.onDidChange;
	}

	get getExtension() {
		return zyraxoncode.extensions.getExtension;
	}
}
