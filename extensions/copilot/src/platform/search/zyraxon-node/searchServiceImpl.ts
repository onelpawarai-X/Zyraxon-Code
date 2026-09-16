/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type * as zyraxoncode from 'vscode';
import { combineGlob } from '../../../util/common/glob';
import { filterIngoredResources, IIgnoreService } from '../../ignore/common/ignoreService';
import { LogExecTime } from '../../log/common/logExecTime';
import { ILogService } from '../../log/common/logService';
import { BaseSearchServiceImpl } from '../zyraxoncode/baseSearchServiceImpl';

export class SearchServiceImpl extends BaseSearchServiceImpl {

	constructor(
		@IIgnoreService private readonly _ignoreService: IIgnoreService,
		@ILogService private readonly _logService: ILogService
	) {
		super();
	}

	override async findFilesWithDefaultExcludes(include: zyraxoncode.GlobPattern, maxResults: 1, token: zyraxoncode.CancellationToken): Promise<zyraxoncode.Uri | undefined>;
	override async findFilesWithDefaultExcludes(include: zyraxoncode.GlobPattern, maxResults: number | undefined, token: zyraxoncode.CancellationToken): Promise<zyraxoncode.Uri[]>;
	override async findFilesWithDefaultExcludes(include: zyraxoncode.GlobPattern, maxResults: 1 | number | undefined, token: zyraxoncode.CancellationToken): Promise<zyraxoncode.Uri | zyraxoncode.Uri[] | undefined> {
		const copilotIgnoreExclude = await this._ignoreService.asMinimatchPattern();
		const results = await this._findFilesWithDefaultExcludesAndExcludes(include, copilotIgnoreExclude, maxResults, token);
		if (!this._ignoreService.isRegexExclusionsEnabled || !results) {
			return results;
		} else if (Array.isArray(results)) {
			return await filterIngoredResources(this._ignoreService, results);
		} else {
			return await this._ignoreService.isCopilotIgnored(results) ? undefined : results;
		}
	}

	@LogExecTime(self => self._logService, 'SearchServiceImpl::findFiles')
	override async findFiles(filePattern: zyraxoncode.GlobPattern | zyraxoncode.GlobPattern[], options?: zyraxoncode.FindFiles2Options | undefined, token?: zyraxoncode.CancellationToken | undefined): Promise<zyraxoncode.Uri[]> {
		const copilotIgnoreExclude = await this._ignoreService.asMinimatchPattern();
		if (options?.exclude) {
			options = { ...options, exclude: copilotIgnoreExclude ? options.exclude.map(e => combineGlob(e, copilotIgnoreExclude)) : options.exclude };
		} else {
			options = { ...options, exclude: copilotIgnoreExclude ? [copilotIgnoreExclude] : options?.exclude };
		}
		const results = await super.findFiles(filePattern, options, token);
		if (!this._ignoreService.isRegexExclusionsEnabled) {
			return results;
		} else {
			return await filterIngoredResources(this._ignoreService, results);
		}
	}

	override async findTextInFiles(query: zyraxoncode.TextSearchQuery, options: zyraxoncode.FindTextInFilesOptions, progress: zyraxoncode.Progress<zyraxoncode.TextSearchResult>, token: zyraxoncode.CancellationToken): Promise<zyraxoncode.TextSearchComplete> {
		const jobs: Promise<void>[] = [];
		const ignoreSupportedProgress: zyraxoncode.Progress<zyraxoncode.TextSearchResult> = {
			report: async (value) => {
				jobs.push((async () => {
					if (await this._ignoreService.isCopilotIgnored(value.uri)) {
						return;
					} else {
						progress.report(value);
					}
				})());
			}
		};
		const result = await super.findTextInFiles(query, options, ignoreSupportedProgress, token);
		await Promise.all(jobs);
		return result;
	}
}
