/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

declare module 'zyraxoncode' {

	// __ZYRAXKEEP__0_

	export interface StatusBarItem {

		/**
		 * The tooltip text when you hover over this entry.
		 *
		 * Can optionally return the tooltip in a thenable if the computation is expensive.
		 */
		tooltip2: string | MarkdownString | undefined | ((token: CancellationToken) => ProviderResult<string | MarkdownString | undefined>);
	}
}
