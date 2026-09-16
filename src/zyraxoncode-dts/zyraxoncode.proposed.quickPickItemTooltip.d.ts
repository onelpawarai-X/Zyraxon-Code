/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

declare module 'zyraxoncode' {

	// __ZYRAXKEEP__0_

	export interface QuickPickItem {
		/**
		 * An optional tooltip that is displayed when hovering over this item.
		 *
		 * When specified, this tooltip takes precedence over the default hover behavior which shows
		 * the {@link QuickPickItem.description description}.
		 */
		tooltip?: string | MarkdownString;
	}
}
