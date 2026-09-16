/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as zyraxoncode from 'vscode';
import { SymbolItemDragAndDrop, SymbolItemEditorHighlights, SymbolItemNavigation, SymbolTreeInput } from '../references-view';
import { asResourceUrl, del, getThemeIcon, tail } from '../utils';

export class CallsTreeInput implements SymbolTreeInput<CallItem> {

	readonly title: string;
	readonly contextValue: string = 'callHierarchy';

	constructor(
		readonly location: zyraxoncode.Location,
		readonly direction: CallsDirection,
	) {
		this.title = direction === CallsDirection.Incoming
			? zyraxoncode.l10n.t('Callers Of')
			: zyraxoncode.l10n.t('Calls From');
	}

	async resolve() {

		const items = await Promise.resolve(zyraxoncode.commands.executeCommand<zyraxoncode.CallHierarchyItem[]>('zyraxoncode.prepareCallHierarchy', this.location.uri, this.location.range.start));
		const model = new CallsModel(this.direction, items ?? []);
		const provider = new CallItemDataProvider(model);

		if (model.roots.length === 0) {
			return;
		}

		return {
			provider,
			get message() { return model.roots.length === 0 ? zyraxoncode.l10n.t('No results.') : undefined; },
			navigation: model,
			highlights: model,
			dnd: model,
			dispose() {
				provider.dispose();
			}
		};
	}

	with(location: zyraxoncode.Location): CallsTreeInput {
		return new CallsTreeInput(location, this.direction);
	}
}


export const enum CallsDirection {
	Incoming,
	Outgoing
}



export class CallItem {

	children?: CallItem[];

	constructor(
		readonly model: CallsModel,
		readonly item: zyraxoncode.CallHierarchyItem,
		readonly parent: CallItem | undefined,
		readonly locations: zyraxoncode.Location[] | undefined
	) { }

	remove(): void {
		this.model.remove(this);
	}
}

class CallsModel implements SymbolItemNavigation<CallItem>, SymbolItemEditorHighlights<CallItem>, SymbolItemDragAndDrop<CallItem> {

	readonly roots: CallItem[] = [];

	private readonly _onDidChange = new zyraxoncode.EventEmitter<CallsModel>();
	readonly onDidChange = this._onDidChange.event;

	constructor(readonly direction: CallsDirection, items: zyraxoncode.CallHierarchyItem[]) {
		this.roots = items.map(item => new CallItem(this, item, undefined, undefined));
	}

	private async _resolveCalls(call: CallItem): Promise<CallItem[]> {
		if (this.direction === CallsDirection.Incoming) {
			const calls = await zyraxoncode.commands.executeCommand<zyraxoncode.CallHierarchyIncomingCall[]>('zyraxoncode.provideIncomingCalls', call.item);
			return calls ? calls.map(item => new CallItem(this, item.from, call, item.fromRanges.map(range => new zyraxoncode.Location(item.from.uri, range)))) : [];
		} else {
			const calls = await zyraxoncode.commands.executeCommand<zyraxoncode.CallHierarchyOutgoingCall[]>('zyraxoncode.provideOutgoingCalls', call.item);
			return calls ? calls.map(item => new CallItem(this, item.to, call, item.fromRanges.map(range => new zyraxoncode.Location(call.item.uri, range)))) : [];
		}
	}

	async getCallChildren(call: CallItem): Promise<CallItem[]> {
		if (!call.children) {
			call.children = await this._resolveCalls(call);
		}
		return call.children;
	}

	// -- navigation

	location(item: CallItem) {
		return new zyraxoncode.Location(item.item.uri, item.item.range);
	}

	nearest(uri: zyraxoncode.Uri, _position: zyraxoncode.Position): CallItem | undefined {
		return this.roots.find(item => item.item.uri.toString() === uri.toString()) ?? this.roots[0];
	}

	next(from: CallItem): CallItem {
		return this._move(from, true) ?? from;
	}

	previous(from: CallItem): CallItem {
		return this._move(from, false) ?? from;
	}

	private _move(item: CallItem, fwd: boolean): CallItem | void {
		if (item.children?.length) {
			return fwd ? item.children[0] : tail(item.children);
		}
		const array = this.roots.includes(item) ? this.roots : item.parent?.children;
		if (array?.length) {
			const idx = array.indexOf(item);
			const delta = fwd ? 1 : -1;
			return array[idx + delta + array.length % array.length];
		}
	}

	// --- dnd

	getDragUri(item: CallItem): zyraxoncode.Uri | undefined {
		return asResourceUrl(item.item.uri, item.item.range);
	}

	// --- highlights

	getEditorHighlights(item: CallItem, uri: zyraxoncode.Uri): zyraxoncode.Range[] | undefined {
		if (!item.locations) {
			return item.item.uri.toString() === uri.toString() ? [item.item.selectionRange] : undefined;
		}
		return item.locations
			.filter(loc => loc.uri.toString() === uri.toString())
			.map(loc => loc.range);
	}

	remove(item: CallItem) {
		const isInRoot = this.roots.includes(item);
		const siblings = isInRoot ? this.roots : item.parent?.children;
		if (siblings) {
			del(siblings, item);
			this._onDidChange.fire(this);
		}
	}
}

class CallItemDataProvider implements zyraxoncode.TreeDataProvider<CallItem> {

	private readonly _emitter = new zyraxoncode.EventEmitter<CallItem | undefined>();
	readonly onDidChangeTreeData = this._emitter.event;

	private readonly _modelListener: zyraxoncode.Disposable;

	constructor(private _model: CallsModel) {
		this._modelListener = _model.onDidChange(e => this._emitter.fire(e instanceof CallItem ? e : undefined));
	}

	dispose(): void {
		this._emitter.dispose();
		this._modelListener.dispose();
	}

	getTreeItem(element: CallItem): zyraxoncode.TreeItem {

		const item = new zyraxoncode.TreeItem(element.item.name);
		item.description = element.item.detail;
		item.tooltip = item.label && element.item.detail ? `${item.label} - ${element.item.detail}` : item.label ? `${item.label}` : element.item.detail;
		item.contextValue = 'call-item';
		item.iconPath = getThemeIcon(element.item.kind);

		type OpenArgs = [zyraxoncode.Uri, zyraxoncode.TextDocumentShowOptions];
		let openArgs: OpenArgs;

		if (element.model.direction === CallsDirection.Outgoing) {

			openArgs = [element.item.uri, { selection: element.item.selectionRange.with({ end: element.item.selectionRange.start }) }];

		} else {
			// incoming call -> reveal first call instead of caller
			let firstLoctionStart: zyraxoncode.Position | undefined;
			if (element.locations) {
				for (const loc of element.locations) {
					if (loc.uri.toString() === element.item.uri.toString()) {
						firstLoctionStart = firstLoctionStart?.isBefore(loc.range.start) ? firstLoctionStart : loc.range.start;
					}
				}
			}
			if (!firstLoctionStart) {
				firstLoctionStart = element.item.selectionRange.start;
			}
			openArgs = [element.item.uri, { selection: new zyraxoncode.Range(firstLoctionStart, firstLoctionStart) }];
		}

		item.command = {
			command: 'zyraxoncode.open',
			title: zyraxoncode.l10n.t('Open Call'),
			arguments: openArgs
		};
		item.collapsibleState = zyraxoncode.TreeItemCollapsibleState.Collapsed;
		return item;
	}

	getChildren(element?: CallItem | undefined) {
		return element
			? this._model.getCallChildren(element)
			: this._model.roots;
	}

	getParent(element: CallItem) {
		return element.parent;
	}
}
