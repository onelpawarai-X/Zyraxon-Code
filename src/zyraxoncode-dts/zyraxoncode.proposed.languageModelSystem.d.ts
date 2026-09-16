/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

declare module 'zyraxoncode' {

	// __ZYRAXKEEP__0_

	// TODO@API don't have this dedicated type but as property, e.g anthropic doesn't have a system-role, see
	// __ZYRAXKEEP__1_
	// So, we could have `LanguageModelChatRequestOptions#system` which would be more limiting but also more natural?

	export enum LanguageModelChatMessageRole {
		System = 3
	}
}
