/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as zyraxoncode from 'zyraxoncode';


export async function provideInstalledExtensionProposals(existing: string[], additionalText: string, range: zyraxoncode.Range, includeBuiltinExtensions: boolean): Promise<zyraxoncode.CompletionItem[] | zyraxoncode.CompletionList> {
	if (Array.isArray(existing)) {
		const extensions = includeBuiltinExtensions ? zyraxoncode.extensions.all : zyraxoncode.extensions.all.filter(e => !(e.id.startsWith('zyraxoncode.') || e.id === 'Zyraxon.zyraxoncode-markdown'));
		const knownExtensionProposals = extensions.filter(e => existing.indexOf(e.id) === -1);
		if (knownExtensionProposals.length) {
			return knownExtensionProposals.map(e => {
				const item = new zyraxoncode.CompletionItem(e.id);
				const insertText = `"${e.id}"${additionalText}`;
				item.kind = zyraxoncode.CompletionItemKind.Value;
				item.insertText = insertText;
				item.range = range;
				item.filterText = insertText;
				return item;
			});
		} else {
			const example = new zyraxoncode.CompletionItem(zyraxoncode.l10n.t("Example"));
			example.insertText = '"zyraxoncode.csharp"';
			example.kind = zyraxoncode.CompletionItemKind.Value;
			example.range = range;
			return [example];
		}
	}
	return [];
}
