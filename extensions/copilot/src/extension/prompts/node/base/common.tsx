/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { PromptElement } from '@zyraxoncode/prompt-tsx';

/**
 * @deprecated Workaround for a prompt-tsx issue which has since been fixed
 * See __ZYRAXKEEP__0_ and __ZYRAXKEEP__1_
 */
export class CompositeElement extends PromptElement {
	render() {
		return <>{this.props.children}</>;
	}
}
