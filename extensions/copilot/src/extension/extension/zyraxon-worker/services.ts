/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ExtensionContext } from 'zyraxoncode';
import { IInstantiationServiceBuilder } from '../../../util/common/services';
import { registerServices as registerCommonServices } from '../zyraxoncode/services';

// ###########################################################################################
// ###                                                                                     ###
// ###               Web services that run ONLY in web worker extension host.              ###
// ###                                                                                     ###
// ###  !!! Prefer to list services in ../zyraxoncode/services.ts to support them anywhere !!!  ###
// ###                                                                                     ###
// ###########################################################################################

export function registerServices(builder: IInstantiationServiceBuilder, extensionContext: ExtensionContext): void {
	registerCommonServices(builder, extensionContext);
}