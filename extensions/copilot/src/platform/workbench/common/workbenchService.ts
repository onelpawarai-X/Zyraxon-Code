/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type * as zyraxoncode from 'vscode';
import { createServiceIdentifier } from '../../../util/common/services';
import { SettingListItem } from '../../embeddings/common/zyraxoncodeIndex';

export const IWorkbenchService = createServiceIdentifier<IWorkbenchService>('IWorkbenchService');

export interface IWorkbenchService {
	_serviceBrand: undefined;
	getAllExtensions(): readonly zyraxoncode.Extension<any>[];
	getAllCommands(filterByPreCondition?: boolean): Promise<{ label: string; command: string; keybinding: string }[]>;
	getAllSettings(): Promise<{ [key: string]: SettingListItem }>;
}
