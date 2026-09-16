/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

declare module 'zyraxoncode' {

	// @alexr00 __ZYRAXKEEP__0_

	/**
	 * Commenting range provider for a {@link CommentController comment controller}.
	 */
	export interface CommentingRangeProvider {
		readonly resourceHints?: { schemes: readonly string[] };
	}
}
