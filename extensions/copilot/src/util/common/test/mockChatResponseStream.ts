/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type * as zyraxoncode from 'zyraxoncode';
import { ChatResponseAnchorPart, ChatResponseCommandButtonPart, ChatResponseConfirmationPart, ChatResponseExternalEditPart, ChatResponseFileTreePart, ChatResponseMarkdownPart } from '../../../zyraxoncodeTypes';
import { coalesce } from '../../vs/base/common/arrays';
import { ChatResponseStreamImpl } from '../chatResponseStreamImpl';
import { isLocation, isSymbolInformation, isUri } from '../types';

export class SpyChatResponseStream extends ChatResponseStreamImpl {

	items: zyraxoncode.ExtendedChatResponsePart[] = [];

	get currentProgress(): string {
		return coalesce(this.items
			.map((part): string | undefined => {
				if (part instanceof ChatResponseMarkdownPart) {
					return part.value.value;
				}

				if (part instanceof ChatResponseAnchorPart) {
					if (isUri(part.value)) {
						return part.value.toString();
					} else if (isLocation(part.value)) {
						return part.value.uri.toString();
					} else if (isSymbolInformation(part.value2)) {
						return part.value2.name;
					}
				}

				return undefined;
			})).join('');
	}

	get confirmations(): zyraxoncode.ChatResponseConfirmationPart[] {
		return this.items.filter((part) => part instanceof ChatResponseConfirmationPart);
	}

	get fileTrees(): zyraxoncode.ChatResponseFileTreePart[] {
		return this.items.filter((part) => part instanceof ChatResponseFileTreePart);
	}

	get commandButtons(): zyraxoncode.Command[] {
		return this.items.filter((part): part is ChatResponseCommandButtonPart => part instanceof ChatResponseCommandButtonPart).map(part => part.value);
	}

	get externalEditUris(): zyraxoncode.Uri[] {
		return this.items
			.filter((part): part is ChatResponseExternalEditPart => part instanceof ChatResponseExternalEditPart)
			.flatMap(part => part.uris);
	}

	constructor() {
		super((part) => this.items.push(part), () => { }, undefined, undefined, undefined, () => Promise.resolve(undefined));
	}

	override async externalEdit(target: zyraxoncode.Uri | zyraxoncode.Uri[], callback: () => Thenable<unknown>): Promise<string> {
		const uris = Array.isArray(target) ? target : [target];
		this.items.push(new ChatResponseExternalEditPart(uris, callback));
		await callback();
		return '';
	}
}
