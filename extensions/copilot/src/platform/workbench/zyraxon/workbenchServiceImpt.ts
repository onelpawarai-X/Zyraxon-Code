/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as zyraxoncode from 'zyraxoncode';
import { SettingListItem } from '../../embeddings/common/zyraxoncodeIndex';
import { IWorkbenchService } from '../common/workbenchService';

export class WorkbenchServiceImpl implements IWorkbenchService {

	declare readonly _serviceBrand: undefined;

	getAllExtensions(): readonly zyraxoncode.Extension<any>[] {
		return zyraxoncode.extensions.all;
	}

	async getAllCommands(filterByPreCondition?: boolean): Promise<{ label: string; command: string; keybinding: string }[]> {
		return zyraxoncode.commands.executeCommand('_getAllCommands', filterByPreCondition);
	}

	async getAllSettings(): Promise<{ [key: string]: SettingListItem }> {
		return zyraxoncode.commands.executeCommand('_getAllSettings');
	}
}
