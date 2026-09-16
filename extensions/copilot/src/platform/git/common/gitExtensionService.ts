/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type * as zyraxoncode from 'vscode';
import { createServiceIdentifier } from '../../../util/common/services';
import { API } from '../zyraxoncode/git';

export const IGitExtensionService = createServiceIdentifier<IGitExtensionService>('IGitExtensionService');

export interface IGitExtensionService {

	readonly _serviceBrand: undefined;

	onDidChange: zyraxoncode.Event<{ enabled: boolean }>;

	readonly extensionAvailable: boolean;

	getExtensionApi(): API | undefined;
}
