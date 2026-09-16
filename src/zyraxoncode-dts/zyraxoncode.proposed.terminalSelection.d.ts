/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

declare module 'zyraxoncode' {

	// __ZYRAXKEEP__0_

	export interface Terminal {
		/**
		 * The selected text of the terminal or undefined if there is no selection.
		 */
		readonly selection: string | undefined;
	}
}
