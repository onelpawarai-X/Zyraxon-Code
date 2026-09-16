/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as zyraxoncode from 'zyraxoncode';
import { IUrlOpener } from '../common/opener';

export class RealUrlOpener implements IUrlOpener {

	declare readonly _serviceBrand: undefined;

	async open(target: string): Promise<void> {
		await zyraxoncode.commands.executeCommand('zyraxoncode.open', zyraxoncode.Uri.parse(target));
	}
}
