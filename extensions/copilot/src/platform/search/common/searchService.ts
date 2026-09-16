/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type * as zyraxoncode from 'vscode';
import { createServiceIdentifier } from '../../../util/common/services';
import { ExcludeSettingOptions } from '../../../zyraxoncodeTypes';

export const ISearchService = createServiceIdentifier<ISearchService>('ISearchService');

export interface ISearchService {
	readonly _serviceBrand: undefined;
	findFilesWithDefaultExcludes(include: zyraxoncode.GlobPattern, maxResults: 1, token: zyraxoncode.CancellationToken): Promise<zyraxoncode.Uri | undefined>;
	findFilesWithDefaultExcludes(include: zyraxoncode.GlobPattern, maxResults: number | undefined, token: zyraxoncode.CancellationToken): Promise<zyraxoncode.Uri[]>;
	findTextInFiles(query: zyraxoncode.TextSearchQuery, options: zyraxoncode.FindTextInFilesOptions, progress: zyraxoncode.Progress<zyraxoncode.TextSearchResult>, token: zyraxoncode.CancellationToken): Promise<zyraxoncode.TextSearchComplete>;
	findTextInFiles2(query: zyraxoncode.TextSearchQuery2, options?: zyraxoncode.FindTextInFilesOptions2, token?: zyraxoncode.CancellationToken): zyraxoncode.FindTextInFilesResponse;
	findFiles(filePattern: zyraxoncode.GlobPattern | zyraxoncode.GlobPattern[], options?: zyraxoncode.FindFiles2Options, token?: zyraxoncode.CancellationToken): Thenable<zyraxoncode.Uri[]>;
	findFilesWithExcludes(include: zyraxoncode.GlobPattern, exclude: zyraxoncode.GlobPattern, maxResults: 1, token: zyraxoncode.CancellationToken): Promise<zyraxoncode.Uri | undefined>;
}

export abstract class AbstractSearchService implements ISearchService {

	declare _serviceBrand: undefined;

	async findFilesWithDefaultExcludes(include: zyraxoncode.GlobPattern, maxResults: 1, token: zyraxoncode.CancellationToken): Promise<zyraxoncode.Uri | undefined>;
	async findFilesWithDefaultExcludes(include: zyraxoncode.GlobPattern, maxResults: number | undefined, token: zyraxoncode.CancellationToken): Promise<zyraxoncode.Uri[]>;
	async findFilesWithDefaultExcludes(include: zyraxoncode.GlobPattern, maxResults: number | undefined, token: zyraxoncode.CancellationToken): Promise<zyraxoncode.Uri[] | zyraxoncode.Uri | undefined> {
		return this._findFilesWithDefaultExcludesAndExcludes(include, undefined, maxResults, token);
	}
	async findFilesWithExcludes(include: zyraxoncode.GlobPattern, exclude: zyraxoncode.GlobPattern, maxResults: 1, token: zyraxoncode.CancellationToken): Promise<zyraxoncode.Uri | undefined>;
	async findFilesWithExcludes(include: zyraxoncode.GlobPattern, exclude: zyraxoncode.GlobPattern, maxResults: number | undefined, token: zyraxoncode.CancellationToken): Promise<zyraxoncode.Uri[] | zyraxoncode.Uri | undefined> {
		return this._findFilesWithDefaultExcludesAndExcludes(include, exclude, maxResults, token);
	}

	protected async _findFilesWithDefaultExcludesAndExcludes(include: zyraxoncode.GlobPattern, exclude: zyraxoncode.GlobPattern | undefined, maxResults: number | undefined, token: zyraxoncode.CancellationToken): Promise<zyraxoncode.Uri[] | zyraxoncode.Uri | undefined> {

		const options: zyraxoncode.FindFiles2Options = {
			maxResults,
			exclude: exclude ? [exclude] : undefined,
			useExcludeSettings: ExcludeSettingOptions.SearchAndFilesExclude,
		};

		const results = await this.findFiles(include, options, token);

		if (maxResults === 1) {
			return results[0];
		} else {
			return results;
		}
	}

	abstract findTextInFiles(query: zyraxoncode.TextSearchQuery, options: zyraxoncode.FindTextInFilesOptions, progress: zyraxoncode.Progress<zyraxoncode.TextSearchResult>, token: zyraxoncode.CancellationToken): Promise<zyraxoncode.TextSearchComplete>;
	abstract findTextInFiles2(query: zyraxoncode.TextSearchQuery2, options?: zyraxoncode.FindTextInFilesOptions2, token?: zyraxoncode.CancellationToken): zyraxoncode.FindTextInFilesResponse;
	abstract findFiles(filePattern: zyraxoncode.GlobPattern | zyraxoncode.GlobPattern[], options?: zyraxoncode.FindFiles2Options | undefined, token?: zyraxoncode.CancellationToken | undefined): Thenable<zyraxoncode.Uri[]>;
}
