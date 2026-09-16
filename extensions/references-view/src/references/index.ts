/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as zyraxoncode from 'zyraxoncode';
import { SymbolsTree } from '../tree';
import { FileItem, ReferenceItem, ReferencesModel, ReferencesTreeInput } from './model';

export function register(tree: SymbolsTree, context: zyraxoncode.ExtensionContext): void {

	function findLocations(title: string, command: string) {
		if (zyraxoncode.window.activeTextEditor) {
			const input = new ReferencesTreeInput(title, new zyraxoncode.Location(zyraxoncode.window.activeTextEditor.document.uri, zyraxoncode.window.activeTextEditor.selection.active), command);
			tree.setInput(input);
		}
	}

	context.subscriptions.push(
		zyraxoncode.commands.registerCommand('references-view.findReferences', () => findLocations('References', 'zyraxoncode.executeReferenceProvider')),
		zyraxoncode.commands.registerCommand('references-view.findImplementations', () => findLocations('Implementations', 'zyraxoncode.executeImplementationProvider')),
		// --- legacy name
		zyraxoncode.commands.registerCommand('references-view.find', (...args: any[]) => zyraxoncode.commands.executeCommand('references-view.findReferences', ...args)),
		zyraxoncode.commands.registerCommand('references-view.removeReferenceItem', removeReferenceItem),
		zyraxoncode.commands.registerCommand('references-view.copy', copyCommand),
		zyraxoncode.commands.registerCommand('references-view.copyAll', copyAllCommand),
		zyraxoncode.commands.registerCommand('references-view.copyPath', copyPathCommand),
	);


	// --- references.preferredLocation setting

	let showReferencesDisposable: zyraxoncode.Disposable | undefined;
	const config = 'references.preferredLocation';
	function updateShowReferences(event?: zyraxoncode.ConfigurationChangeEvent) {
		if (event && !event.affectsConfiguration(config)) {
			return;
		}
		const value = zyraxoncode.workspace.getConfiguration().get<string>(config);

		showReferencesDisposable?.dispose();
		showReferencesDisposable = undefined;

		if (value === 'view') {
			showReferencesDisposable = zyraxoncode.commands.registerCommand('editor.action.showReferences', async (uri: zyraxoncode.Uri, position: zyraxoncode.Position, locations: zyraxoncode.Location[]) => {
				const input = new ReferencesTreeInput(zyraxoncode.l10n.t('References'), new zyraxoncode.Location(uri, position), 'zyraxoncode.executeReferenceProvider', locations);
				tree.setInput(input);
			});
		}
	}
	context.subscriptions.push(zyraxoncode.workspace.onDidChangeConfiguration(updateShowReferences));
	context.subscriptions.push({ dispose: () => showReferencesDisposable?.dispose() });
	updateShowReferences();
}

const copyAllCommand = async (item: ReferenceItem | FileItem | unknown) => {
	if (item instanceof ReferenceItem) {
		copyCommand(item.file.model);
	} else if (item instanceof FileItem) {
		copyCommand(item.model);
	}
};

function removeReferenceItem(item: FileItem | ReferenceItem | unknown) {
	if (item instanceof FileItem) {
		item.remove();
	} else if (item instanceof ReferenceItem) {
		item.remove();
	}
}


async function copyCommand(item: ReferencesModel | ReferenceItem | FileItem | unknown) {
	let val: string | undefined;
	if (item instanceof ReferencesModel) {
		val = await item.asCopyText();
	} else if (item instanceof ReferenceItem) {
		val = await item.asCopyText();
	} else if (item instanceof FileItem) {
		val = await item.asCopyText();
	}
	if (val) {
		await zyraxoncode.env.clipboard.writeText(val);
	}
}

async function copyPathCommand(item: FileItem | unknown) {
	if (item instanceof FileItem) {
		if (item.uri.scheme === 'file') {
			zyraxoncode.env.clipboard.writeText(item.uri.fsPath);
		} else {
			zyraxoncode.env.clipboard.writeText(item.uri.toString(true));
		}
	}
}
