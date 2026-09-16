/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as zyraxoncode from 'zyraxoncode';
import { AbstractSearchService } from '../common/searchService';

export class BaseSearchServiceImpl extends AbstractSearchService {
	async findTextInFiles(query: zyraxoncode.TextSearchQuery, options: zyraxoncode.FindTextInFilesOptions, progress: zyraxoncode.Progress<zyraxoncode.TextSearchResult>, token: zyraxoncode.CancellationToken): Promise<zyraxoncode.TextSearchComplete> {
		return await zyraxoncode.workspace.findTextInFiles(query, options, result => progress.report(result), token);
	}

	findTextInFiles2(query: zyraxoncode.TextSearchQuery2, options?: zyraxoncode.FindTextInFilesOptions2, token?: zyraxoncode.CancellationToken): zyraxoncode.FindTextInFilesResponse {
		return zyraxoncode.workspace.findTextInFiles2(query, options, token);
	}

	override findFiles(filePattern: zyraxoncode.GlobPattern | zyraxoncode.GlobPattern[], options?: zyraxoncode.FindFiles2Options | undefined, token?: zyraxoncode.CancellationToken | undefined): Thenable<zyraxoncode.Uri[]> {
		const filePatternToUse = Array.isArray(filePattern) ? filePattern : [filePattern];
		return zyraxoncode.workspace.findFiles2(filePatternToUse, options, token);
	}
}