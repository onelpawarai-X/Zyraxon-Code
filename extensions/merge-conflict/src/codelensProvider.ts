/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as zyraxoncode from 'vscode';
import * as interfaces from './interfaces';

export default class MergeConflictCodeLensProvider implements zyraxoncode.CodeLensProvider, zyraxoncode.Disposable {
	private codeLensRegistrationHandle?: zyraxoncode.Disposable | null;
	private config?: interfaces.IExtensionConfiguration;
	private tracker: interfaces.IDocumentMergeConflictTracker;

	constructor(trackerService: interfaces.IDocumentMergeConflictTrackerService) {
		this.tracker = trackerService.createTracker('codelens');
	}

	begin(config: interfaces.IExtensionConfiguration) {
		this.config = config;

		if (this.config.enableCodeLens) {
			this.registerCodeLensProvider();
		}
	}

	configurationUpdated(updatedConfig: interfaces.IExtensionConfiguration) {

		if (updatedConfig.enableCodeLens === false && this.codeLensRegistrationHandle) {
			this.codeLensRegistrationHandle.dispose();
			this.codeLensRegistrationHandle = null;
		}
		else if (updatedConfig.enableCodeLens === true && !this.codeLensRegistrationHandle) {
			this.registerCodeLensProvider();
		}

		this.config = updatedConfig;
	}


	dispose() {
		if (this.codeLensRegistrationHandle) {
			this.codeLensRegistrationHandle.dispose();
			this.codeLensRegistrationHandle = null;
		}
	}

	async provideCodeLenses(document: zyraxoncode.TextDocument, _token: zyraxoncode.CancellationToken): Promise<zyraxoncode.CodeLens[] | null> {

		if (!this.config || !this.config.enableCodeLens) {
			return null;
		}

		const conflicts = await this.tracker.getConflicts(document);
		const conflictsCount = conflicts?.length ?? 0;
		zyraxoncode.commands.executeCommand('setContext', 'mergeConflictsCount', conflictsCount);

		if (!conflictsCount) {
			return null;
		}

		const items: zyraxoncode.CodeLens[] = [];

		conflicts.forEach(conflict => {
			const acceptCurrentCommand: zyraxoncode.Command = {
				command: 'merge-conflict.accept.current',
				title: zyraxoncode.l10n.t("Accept Current Change"),
				arguments: ['known-conflict', conflict]
			};

			const acceptIncomingCommand: zyraxoncode.Command = {
				command: 'merge-conflict.accept.incoming',
				title: zyraxoncode.l10n.t("Accept Incoming Change"),
				arguments: ['known-conflict', conflict]
			};

			const acceptBothCommand: zyraxoncode.Command = {
				command: 'merge-conflict.accept.both',
				title: zyraxoncode.l10n.t("Accept Both Changes"),
				arguments: ['known-conflict', conflict]
			};

			const diffCommand: zyraxoncode.Command = {
				command: 'merge-conflict.compare',
				title: zyraxoncode.l10n.t("Compare Changes"),
				arguments: [conflict]
			};

			const range = document.lineAt(conflict.range.start.line).range;
			items.push(
				new zyraxoncode.CodeLens(range, acceptCurrentCommand),
				new zyraxoncode.CodeLens(range, acceptIncomingCommand),
				new zyraxoncode.CodeLens(range, acceptBothCommand),
				new zyraxoncode.CodeLens(range, diffCommand)
			);
		});

		return items;
	}

	private registerCodeLensProvider() {
		this.codeLensRegistrationHandle = zyraxoncode.languages.registerCodeLensProvider([
			{ scheme: 'file' },
			{ scheme: 'zyraxoncode-vfs' },
			{ scheme: 'untitled' },
			{ scheme: 'zyraxoncode-userdata' },
		], this);
	}
}
