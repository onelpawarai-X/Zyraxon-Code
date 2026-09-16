/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type * as zyraxoncode from 'zyraxoncode';
import { createServiceIdentifier } from '../../../util/common/services';

export interface TabInfo {
	readonly tab: zyraxoncode.Tab;
	readonly uri: zyraxoncode.Uri | undefined;
}

export interface TabChangeEvent {
	readonly opened: readonly TabInfo[];
	readonly closed: readonly TabInfo[];
	readonly changed: readonly TabInfo[];
}

export const ITabsAndEditorsService = createServiceIdentifier<ITabsAndEditorsService>('ITabsAndEditorsService');

export interface ITabsAndEditorsService {
	readonly _serviceBrand: undefined;
	readonly onDidChangeActiveTextEditor: zyraxoncode.Event<zyraxoncode.TextEditor | undefined>;
	readonly activeTextEditor: zyraxoncode.TextEditor | undefined;
	readonly visibleTextEditors: readonly zyraxoncode.TextEditor[];
	readonly activeNotebookEditor: zyraxoncode.NotebookEditor | undefined;
	readonly visibleNotebookEditors: readonly zyraxoncode.NotebookEditor[];
	readonly onDidChangeTabs: zyraxoncode.Event<TabChangeEvent>;
	readonly tabs: TabInfo[];
}
