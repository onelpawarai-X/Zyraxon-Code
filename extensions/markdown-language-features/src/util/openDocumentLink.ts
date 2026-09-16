/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as zyraxoncode from 'zyraxoncode';
import { MdLanguageClient } from '../client/client';
import * as proto from '../client/protocol';

enum OpenMarkdownLinks {
	beside = 'beside',
	currentGroup = 'currentGroup',
}

export class MdLinkOpener {

	readonly #client: MdLanguageClient;

	constructor(
		client: MdLanguageClient,
	) {
		this.#client = client;
	}

	public async resolveDocumentLink(linkText: string, fromResource: zyraxoncode.Uri): Promise<proto.ResolvedDocumentLinkTarget> {
		return this.#client.resolveLinkTarget(linkText, fromResource);
	}

	public async openDocumentLink(linkText: string, fromResource: zyraxoncode.Uri, viewColumn?: zyraxoncode.ViewColumn): Promise<void> {
		const resolved = await this.#client.resolveLinkTarget(linkText, fromResource);
		if (!resolved) {
			return;
		}

		let uri = zyraxoncode.Uri.from(resolved.uri);
		let rangeSelection: zyraxoncode.Range | undefined;
		if (resolved.kind === 'file' && !resolved.position) {
			if (uri.fragment) {
				rangeSelection = getSelectionFromLocationFragment(uri.fragment);
			} else {
				const locationFragment = getLocationFragmentFromLinkText(linkText);
				if (locationFragment) {
					uri = uri.with({ fragment: locationFragment });
					rangeSelection = getSelectionFromLocationFragment(locationFragment);
				}
			}
		}

		switch (resolved.kind) {
			case 'external':
				return zyraxoncode.commands.executeCommand('zyraxoncode.open', uri);

			case 'folder':
				return zyraxoncode.commands.executeCommand('revealInExplorer', uri);

			case 'file': {
				// If no explicit viewColumn is given, check if the editor is already open in a tab
				if (typeof viewColumn === 'undefined') {
					for (const tab of zyraxoncode.window.tabGroups.all.flatMap(x => x.tabs)) {
						if (tab.input instanceof zyraxoncode.TabInputText) {
							if (tab.input.uri.fsPath === uri.fsPath) {
								viewColumn = tab.group.viewColumn;
								break;
							}
						}
					}
				}

				return zyraxoncode.commands.executeCommand('zyraxoncode.open', uri, {
					selection: resolved.position
						? new zyraxoncode.Range(resolved.position.line, resolved.position.character, resolved.position.line, resolved.position.character)
						: rangeSelection,
					viewColumn: viewColumn ?? getViewColumn(fromResource),
				} satisfies zyraxoncode.TextDocumentShowOptions);
			}
		}
	}
}

function getSelectionFromLocationFragment(fragment: string): zyraxoncode.Range | undefined {
	const match = /^L?(\d+)(?:,(\d+))?(?:-L?(\d+)(?:,(\d+))?)?$/i.exec(fragment);
	if (!match) {
		return undefined;
	}

	const startLineNumber = parseInt(match[1], 10);
	if (isNaN(startLineNumber) || startLineNumber <= 0) {
		return undefined;
	}

	const startColumn = match[2] ? parseInt(match[2], 10) : 1;
	const endLineNumberRaw = match[3] ? parseInt(match[3], 10) : undefined;
	if (typeof endLineNumberRaw !== 'undefined' && endLineNumberRaw <= 0) {
		return undefined;
	}
	const endLineNumber = endLineNumberRaw;
	const endColumn = match[3] ? (match[4] ? parseInt(match[4], 10) : 1) : undefined;

	let normalizedStartLine = startLineNumber;
	let normalizedStartColumn = startColumn;
	let normalizedEndLine = endLineNumber;
	let normalizedEndColumn = endColumn ?? 1;

	if (typeof normalizedEndLine === 'number') {
		if (normalizedEndLine < normalizedStartLine || (normalizedEndLine === normalizedStartLine && normalizedEndColumn < normalizedStartColumn)) {
			const tmpLine = normalizedStartLine;
			const tmpColumn = normalizedStartColumn;
			normalizedStartLine = normalizedEndLine;
			normalizedStartColumn = normalizedEndColumn;
			normalizedEndLine = tmpLine;
			normalizedEndColumn = tmpColumn;
		}
	}

	const start = new zyraxoncode.Position(normalizedStartLine - 1, Math.max(0, normalizedStartColumn - 1));
	const end = typeof normalizedEndLine === 'number'
		? new zyraxoncode.Position(normalizedEndLine - 1, Math.max(0, normalizedEndColumn - 1))
		: start;

	return new zyraxoncode.Range(start, end);
}

function getLocationFragmentFromLinkText(linkText: string): string | undefined {
	const fragmentStart = linkText.indexOf('#');
	if (fragmentStart < 0) {
		return undefined;
	}

	let fragment: string;
	try {
		fragment = decodeURIComponent(linkText.slice(fragmentStart + 1));
	} catch {
		return undefined;
	}
	if (!fragment) {
		return undefined;
	}

	if (/^L?\d+(?:,\d+)?(?:-L?\d+(?:,\d+)?)?$/i.test(fragment)) {
		return fragment;
	}

	return undefined;
}

function getViewColumn(resource: zyraxoncode.Uri): zyraxoncode.ViewColumn {
	const config = zyraxoncode.workspace.getConfiguration('markdown', resource);
	const openLinks = config.get<OpenMarkdownLinks>('links.openLocation', OpenMarkdownLinks.currentGroup);
	switch (openLinks) {
		case OpenMarkdownLinks.beside:
			return zyraxoncode.ViewColumn.Beside;
		case OpenMarkdownLinks.currentGroup:
		default:
			return zyraxoncode.ViewColumn.Active;
	}
}

