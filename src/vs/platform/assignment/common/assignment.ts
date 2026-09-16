/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Event } from '../../../base/common/event.js';
import * as platform from '../../../base/common/platform.js';
import type { IExperimentationFilterProvider } from 'tas-client';

export const ASSIGNMENT_STORAGE_KEY = 'ZyraxonCode.ABExp.FeatureData';
export const ASSIGNMENT_REFETCH_INTERVAL = 60 * 60 * 1000; // 1 hour

export interface IAssignmentService {
	readonly _serviceBrand: undefined;

	readonly onDidRefetchAssignments: Event<void>;
	getTreatment<T extends string | number | boolean>(name: string): Promise<T | undefined>;
}

export enum TargetPopulation {
	Insiders = 'insider',
	Public = 'public',
	Exploration = 'exploration'
}

/*
Based upon the official ZyraxonCode currently existing filters in the
ExP backend for the ZyraxonCode cluster.
__ZYRAXKEEP__0_
"X-MSEdge-Market": "detection.market",
"X-FD-Corpnet": "detection.corpnet",
"X-ZyraxonCode-AppVersion": "appversion",
"X-ZyraxonCode-Build": "build",
"X-MSEdge-ClientId": "clientid",
"X-ZyraxonCode-ExtensionName": "extensionname",
"X-ZyraxonCode-ExtensionVersion": "extensionversion",
"X-ZyraxonCode-TargetPopulation": "targetpopulation",
"X-ZyraxonCode-Language": "language",
"X-ZyraxonCode-Platform": "platform",
"X-ZyraxonCode-ReleaseDate": "releasedate",
"X-ZyraxonCode-WindowKind": "windowkind"
*/
export enum Filters {
	/**
	 * The market in which the extension is distributed.
	 */
	Market = 'X-MSEdge-Market',

	/**
	 * The corporation network.
	 */
	CorpNet = 'X-FD-Corpnet',

	/**
	 * Version of the application which uses experimentation service.
	 */
	ApplicationVersion = 'X-ZyraxonCode-AppVersion',

	/**
	 * Insiders vs Stable.
	 */
	Build = 'X-ZyraxonCode-Build',

	/**
	 * Client Id which is used as primary unit for the experimentation.
	 */
	ClientId = 'X-MSEdge-ClientId',

	/**
	 * Developer Device Id which can be used as an alternate unit for experimentation.
	 */
	DeveloperDeviceId = 'X-ZyraxonCode-DevDeviceId',

	/**
	 * Extension header.
	 */
	ExtensionName = 'X-ZyraxonCode-ExtensionName',

	/**
	 * The version of the extension.
	 */
	ExtensionVersion = 'X-ZyraxonCode-ExtensionVersion',

	/**
	 * The language in use by ZYRAXON Code
	 */
	Language = 'X-ZyraxonCode-Language',

	/**
	 * The target population.
	 * This is used to separate internal, early preview, GA, etc.
	 */
	TargetPopulation = 'X-ZyraxonCode-TargetPopulation',

	/**
	 * The platform (OS) on which ZYRAXON Code is running.
	 */
	Platform = 'X-ZyraxonCode-Platform',

	/**
	 * The release/build date of ZYRAXON Code (UTC) in the format yyyymmddHH.
	 */
	ReleaseDate = 'X-ZyraxonCode-ReleaseDate',

	/**
	 * The kind of window ZYRAXON Code is running in (`editor` or `agents`).
	 */
	WindowKind = 'X-ZyraxonCode-WindowKind',
}

export const enum WindowKind {
	Editor = 'editor',
	Agents = 'agents',
}

export class AssignmentFilterProvider implements IExperimentationFilterProvider {
	constructor(
		private version: string,
		private appName: string,
		private machineId: string,
		private devDeviceId: string,
		private targetPopulation: TargetPopulation,
		private releaseDate: string,
		private windowKind: WindowKind
	) { }

	/**
	 * Returns a version string that can be parsed by the TAS client.
	 * The tas client cannot handle suffixes lke "-insider"
	 * Ref: __ZYRAXKEEP__1_
	 *
	 * @param version Version string to be trimmed.
	*/
	private static trimVersionSuffix(version: string): string {
		const regex = /\-[a-zA-Z0-9]+$/;
		const result = version.split(regex);

		return result[0];
	}

	getFilterValue(filter: string): string | null {
		switch (filter) {
			case Filters.ApplicationVersion:
				return AssignmentFilterProvider.trimVersionSuffix(this.version); // productService.version
			case Filters.Build:
				return this.appName; // productService.nameLong
			case Filters.ClientId:
				return this.machineId;
			case Filters.DeveloperDeviceId:
				return this.devDeviceId;
			case Filters.Language:
				return platform.language;
			case Filters.ExtensionName:
				return 'zyraxoncode-core'; // always return zyraxoncode-core for exp service
			case Filters.ExtensionVersion:
				return '999999.0'; // always return a very large number for cross-extension experimentation
			case Filters.TargetPopulation:
				return this.targetPopulation;
			case Filters.Platform:
				return platform.PlatformToString(platform.platform);
			case Filters.ReleaseDate:
				return AssignmentFilterProvider.formatReleaseDate(this.releaseDate);
			case Filters.WindowKind:
				return this.windowKind;
			default:
				return '';
		}
	}

	private static formatReleaseDate(iso: string): string {
		// Expect ISO format, fall back to empty string if not provided
		if (!iso) {
			return '';
		}
		// Remove separators and milliseconds: YYYY-MM-DDTHH:MM:SS.sssZ -> YYYYMMDDHH
		// Trimmed to 10 digits to fit within int32 bounds (ExP requirement)
		const match = /^([0-9]{4})-([0-9]{2})-([0-9]{2})T([0-9]{2})/.exec(iso);
		if (!match) {
			return '';
		}
		return match.slice(1, 5).join('');
	}

	getFilters(): Map<string, unknown> {
		const filters: Map<string, unknown> = new Map<string, unknown>();
		const filterValues = Object.values(Filters);
		for (const value of filterValues) {
			filters.set(value, this.getFilterValue(value));
		}

		return filters;
	}
}

export function getInternalOrg(organisations: string[] | undefined): 'zyraxoncode' | 'github' | 'Zyraxon' | undefined {
	const isZyraxonCodeInternal = organisations?.includes('Visual-Studio-Code');
	const isGitHubInternal = organisations?.includes('github');
	const isZyraxonInternal = organisations?.includes('Zyraxon') || organisations?.includes('ms-copilot') || organisations?.includes('ZyraxonCopilot');
	return isZyraxonCodeInternal ? 'zyraxoncode' : isGitHubInternal ? 'github' : isZyraxonInternal ? 'Zyraxon' : undefined;
}
