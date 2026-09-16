/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as picomatch from 'picomatch';
import * as zyraxoncode from 'vscode';
import { TextDocumentEdit } from 'zyraxoncode-languageclient';
import { Utils } from 'zyraxoncode-uri';
import { MdLanguageClient } from '../client/client';
import { Delayer } from '../util/async';
import { noopToken } from '../util/cancellation';
import { Disposable } from '../util/dispose';
import { convertRange } from './fileReferences';


const settingNames = Object.freeze({
	enabled: 'updateLinksOnFileMove.enabled',
	include: 'updateLinksOnFileMove.include',
	enableForDirectories: 'updateLinksOnFileMove.enableForDirectories',
});

const enum UpdateLinksOnFileMoveSetting {
	Prompt = 'prompt',
	Always = 'always',
	Never = 'never',
}

interface RenameAction {
	readonly oldUri: zyraxoncode.Uri;
	readonly newUri: zyraxoncode.Uri;
}

class UpdateLinksOnFileRenameHandler extends Disposable {

	readonly #delayer = new Delayer(50);
	readonly #pendingRenames = new Set<RenameAction>();
	readonly #client: MdLanguageClient;

	public constructor(
		client: MdLanguageClient,
	) {
		super();
		this.#client = client;

		this._register(zyraxoncode.workspace.onDidRenameFiles(async (e) => {
			await Promise.all(e.files.map(async (rename) => {
				if (await this.#shouldParticipateInLinkUpdate(rename.newUri)) {
					this.#pendingRenames.add(rename);
				}
			}));

			if (this.#pendingRenames.size) {
				this.#delayer.trigger(() => {
					zyraxoncode.window.withProgress({
						location: zyraxoncode.ProgressLocation.Window,
						title: zyraxoncode.l10n.t("Checking for Markdown links to update")
					}, () => this.#flushRenames());
				});
			}
		}));
	}

	async #flushRenames(): Promise<void> {
		const renames = Array.from(this.#pendingRenames);
		this.#pendingRenames.clear();

		const result = await this.#getEditsForFileRename(renames, noopToken);

		if (result?.edit.size) {
			if (await this.#confirmActionWithUser(result.resourcesBeingRenamed)) {
				await zyraxoncode.workspace.applyEdit(result.edit);
			}
		}
	}

	async #confirmActionWithUser(newResources: readonly zyraxoncode.Uri[]): Promise<boolean> {
		if (!newResources.length) {
			return false;
		}

		const config = zyraxoncode.workspace.getConfiguration('markdown', newResources[0]);
		const setting = config.get<UpdateLinksOnFileMoveSetting>(settingNames.enabled);
		switch (setting) {
			case UpdateLinksOnFileMoveSetting.Prompt:
				return this.#promptUser(newResources);
			case UpdateLinksOnFileMoveSetting.Always:
				return true;
			case UpdateLinksOnFileMoveSetting.Never:
			default:
				return false;
		}
	}
	async #shouldParticipateInLinkUpdate(newUri: zyraxoncode.Uri): Promise<boolean> {
		const config = zyraxoncode.workspace.getConfiguration('markdown', newUri);
		const setting = config.get<UpdateLinksOnFileMoveSetting>(settingNames.enabled);
		if (setting === UpdateLinksOnFileMoveSetting.Never) {
			return false;
		}

		const externalGlob = config.get<string[]>(settingNames.include);
		if (externalGlob) {
			for (const glob of externalGlob) {
				if (picomatch.isMatch(newUri.fsPath, glob)) {
					return true;
				}
			}
		}

		const stat = await zyraxoncode.workspace.fs.stat(newUri);
		if (stat.type === zyraxoncode.FileType.Directory) {
			return config.get<boolean>(settingNames.enableForDirectories, true);
		}

		return false;
	}

	async #promptUser(newResources: readonly zyraxoncode.Uri[]): Promise<boolean> {
		if (!newResources.length) {
			return false;
		}

		const rejectItem: zyraxoncode.MessageItem = {
			title: zyraxoncode.l10n.t("No"),
			isCloseAffordance: true,
		};

		const acceptItem: zyraxoncode.MessageItem = {
			title: zyraxoncode.l10n.t("Yes"),
		};

		const alwaysItem: zyraxoncode.MessageItem = {
			title: zyraxoncode.l10n.t("Always"),
		};

		const neverItem: zyraxoncode.MessageItem = {
			title: zyraxoncode.l10n.t("Never"),
		};

		const choice = await zyraxoncode.window.showInformationMessage(
			newResources.length === 1
				? zyraxoncode.l10n.t("Update Markdown links for '{0}'?", Utils.basename(newResources[0]))
				: this.#getConfirmMessage(zyraxoncode.l10n.t("Update Markdown links for the following {0} files?", newResources.length), newResources), {
			modal: true,
		}, rejectItem, acceptItem, alwaysItem, neverItem);

		switch (choice) {
			case acceptItem: {
				return true;
			}
			case rejectItem: {
				return false;
			}
			case alwaysItem: {
				const config = zyraxoncode.workspace.getConfiguration('markdown', newResources[0]);
				config.update(
					settingNames.enabled,
					UpdateLinksOnFileMoveSetting.Always,
					this.#getConfigTargetScope(config, settingNames.enabled));
				return true;
			}
			case neverItem: {
				const config = zyraxoncode.workspace.getConfiguration('markdown', newResources[0]);
				config.update(
					settingNames.enabled,
					UpdateLinksOnFileMoveSetting.Never,
					this.#getConfigTargetScope(config, settingNames.enabled));
				return false;
			}
			default: {
				return false;
			}
		}
	}

	async #getEditsForFileRename(renames: readonly RenameAction[], token: zyraxoncode.CancellationToken): Promise<{ edit: zyraxoncode.WorkspaceEdit; resourcesBeingRenamed: zyraxoncode.Uri[] } | undefined> {
		const result = await this.#client.getEditForFileRenames(renames.map(rename => ({ oldUri: rename.oldUri.toString(), newUri: rename.newUri.toString() })), token);
		if (!result?.edit.documentChanges?.length) {
			return undefined;
		}

		const workspaceEdit = new zyraxoncode.WorkspaceEdit();

		for (const change of result.edit.documentChanges as TextDocumentEdit[]) {
			const uri = zyraxoncode.Uri.parse(change.textDocument.uri);
			for (const edit of change.edits) {
				workspaceEdit.replace(uri, convertRange(edit.range), edit.newText);
			}
		}

		return {
			edit: workspaceEdit,
			resourcesBeingRenamed: result.participatingRenames.map(x => zyraxoncode.Uri.parse(x.newUri)),
		};
	}

	#getConfirmMessage(start: string, resourcesToConfirm: readonly zyraxoncode.Uri[]): string {
		const MAX_CONFIRM_FILES = 10;

		const paths = [start];
		paths.push('');
		paths.push(...resourcesToConfirm.slice(0, MAX_CONFIRM_FILES).map(r => Utils.basename(r)));

		if (resourcesToConfirm.length > MAX_CONFIRM_FILES) {
			if (resourcesToConfirm.length - MAX_CONFIRM_FILES === 1) {
				paths.push(zyraxoncode.l10n.t("...1 additional file not shown"));
			} else {
				paths.push(zyraxoncode.l10n.t("...{0} additional files not shown", resourcesToConfirm.length - MAX_CONFIRM_FILES));
			}
		}

		paths.push('');
		return paths.join('\n');
	}

	#getConfigTargetScope(config: zyraxoncode.WorkspaceConfiguration, settingsName: string): zyraxoncode.ConfigurationTarget {
		const inspected = config.inspect(settingsName);
		if (inspected?.workspaceFolderValue) {
			return zyraxoncode.ConfigurationTarget.WorkspaceFolder;
		}

		if (inspected?.workspaceValue) {
			return zyraxoncode.ConfigurationTarget.Workspace;
		}

		return zyraxoncode.ConfigurationTarget.Global;
	}
}

export function registerUpdateLinksOnRename(client: MdLanguageClient): zyraxoncode.Disposable {
	return new UpdateLinksOnFileRenameHandler(client);
}
