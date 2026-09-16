/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

declare module 'zyraxoncode' {

	// @kycutler __ZYRAXKEEP__0_

	export interface MarkdownString {

		/**
		 * Indicates that this markdown string can contain alert syntax. Defaults to `false`.
		 *
		 * When `supportAlertSyntax` is true, the markdown renderer will parse GitHub-style alert syntax:
		 *
		 * ```markdown
		 * > [!NOTE]
		 * > This is a note alert
		 *
		 * > [!WARNING]
		 * > This is a warning alert
		 * ```
		 *
		 * Supported alert types: `NOTE`, `TIP`, `IMPORTANT`, `WARNING`, `CAUTION`.
		 */
		supportAlertSyntax?: boolean;
	}
}
