/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

declare module 'zyraxoncode' {

	// __ZYRAXKEEP__0_

	export enum StandardTokenType {
		Other = 0,
		Comment = 1,
		String = 2,
		RegEx = 3
	}

	export interface TokenInformation {
		type: StandardTokenType;
		range: Range;
	}

	export namespace languages {
		/** @deprecated */
		export function getTokenInformationAtPosition(document: TextDocument, position: Position): Thenable<TokenInformation>;
	}
}
