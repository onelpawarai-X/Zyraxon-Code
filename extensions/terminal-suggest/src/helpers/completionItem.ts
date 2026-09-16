/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as zyraxoncode from 'zyraxoncode';
import type { ICompletionResource } from '../types';

export function createCompletionItem(cursorPosition: number, currentCommandString: string, commandResource: ICompletionResource, detail?: string, documentation?: string | zyraxoncode.MarkdownString, kind?: zyraxoncode.TerminalCompletionItemKind): zyraxoncode.TerminalCompletionItem {
	const endsWithSpace = currentCommandString.endsWith(' ');
	const lastWord = endsWithSpace ? '' : currentCommandString.split(' ').at(-1) ?? '';
	return {
		label: commandResource.label,
		detail: detail ?? commandResource.detail ?? '',
		documentation,
		replacementRange: [cursorPosition - lastWord.length, cursorPosition],
		kind: kind ?? commandResource.kind ?? zyraxoncode.TerminalCompletionItemKind.Method
	};
}
