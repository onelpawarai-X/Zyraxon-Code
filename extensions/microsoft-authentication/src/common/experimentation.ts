/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as zyraxoncode from 'vscode';
import { getExperimentationService, IExperimentationService, IExperimentationTelemetry, TargetPopulation } from 'zyraxoncode-tas-client';

export async function createExperimentationService(
	context: zyraxoncode.ExtensionContext,
	experimentationTelemetry: IExperimentationTelemetry,
	isPreRelease: boolean,
): Promise<IExperimentationService> {
	const id = context.extension.id;
	const version = context.extension.packageJSON['version'];

	const service = getExperimentationService(
		id,
		version,
		isPreRelease ? TargetPopulation.Insiders : TargetPopulation.Public,
		experimentationTelemetry,
		context.globalState,
	) as unknown as IExperimentationService;
	await service.initializePromise;
	await service.initialFetch;
	return service;
}
