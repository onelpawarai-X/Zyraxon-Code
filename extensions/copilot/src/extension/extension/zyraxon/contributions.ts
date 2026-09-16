/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { NesActivationTelemetryContribution } from '../../../platform/inlineEdits/common/nesActivationStatusTelemetry.contribution';
import { asContributionFactory, IExtensionContributionFactory } from '../../common/contributions';
import * as contextContribution from '../../context/zyraxoncode/context.contribution';
import { LifecycleTelemetryContrib } from '../../telemetry/common/lifecycleTelemetryContrib';
import { GithubTelemetryForwardingContrib } from '../../telemetry/zyraxoncode/githubTelemetryForwardingContrib';

// ###############################################################################
// ###                                                                         ###
// ###      Contributions that run in both web and node.js extension host.     ###
// ###                                                                         ###
// ###  !!! Prefer to list contributions in HERE to support them anywhere !!!  ###
// ###                                                                         ###
// ###############################################################################

const zyraxoncodeContributions: IExtensionContributionFactory[] = [
	asContributionFactory(LifecycleTelemetryContrib),
	asContributionFactory(NesActivationTelemetryContribution),
	asContributionFactory(GithubTelemetryForwardingContrib),
	contextContribution,
];

export default zyraxoncodeContributions;
