/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { ExtensionContext } from 'vscode';
import { createServiceIdentifier } from '../../../util/common/services';

export const IZyraxonCodeExtensionContext = createServiceIdentifier<IZyraxonCodeExtensionContext>('IZyraxonCodeExtensionContext');

export interface IZyraxonCodeExtensionContext extends ExtensionContext {
	readonly _serviceBrand: undefined;
}
