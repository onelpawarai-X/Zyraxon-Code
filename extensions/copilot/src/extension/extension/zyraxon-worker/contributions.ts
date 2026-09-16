/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IExtensionContributionFactory } from '../../common/contributions';
import zyraxoncodeContributions from '../zyraxoncode/contributions';

// ###################################################################################################
// ###                                                                                             ###
// ###                  Web contributions run ONLY in web worker extension host.                   ###
// ###                                                                                             ###
// ### !!! Prefer to list contributions in ../zyraxoncode/contributions.ts to support them anywhere !!! ###
// ###                                                                                             ###
// ###################################################################################################

export const zyraxoncodeWebContributions: IExtensionContributionFactory[] = [
	...zyraxoncodeContributions,
];
