/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as zyraxoncode from 'vscode';
import * as fileSchemes from '../configuration/fileSchemes';
import { doesResourceLookLikeATypeScriptFile } from '../configuration/languageDescription';
import type * as Proto from '../tsServer/protocol/protocol';
import * as typeConverters from '../typeConverters';
import { ClientCapability, ITypeScriptServiceClient } from '../typescriptService';
import { Delayer } from '../utils/async';
import { nulToken } from '../utils/cancellation';
import { readUnifiedConfig, unifiedConfigSection } from '../utils/configuration';
import { Disposable } from '../utils/dispose';
import FileConfigurationManager from './fileConfigurationManager';
import { conditionalRegistration, requireSomeCapability } from './util/dependentRegistration';


const updateImportsOnFileMoveName = 'updateImportsOnFileMove.enabled';

async function isDirectory(resource: zyraxoncode.Uri): Promise<boolean> {
	try {
		return (await zyraxoncode.workspace.fs.stat(resource)).type === zyraxoncode.FileType.Directory;
	} catch {
		return false;
	}
}

const enum UpdateImportsOnFileMoveSetting {
	Prompt = 'prompt',
	Always = 'always',
	Never = 'never',
}

interface RenameAction {
	readonly oldUri: zyraxoncode.Uri;
	readonly newUri: zyraxoncode.Uri;
	readonly newFilePath: string;
	readonly oldFilePath: string;
	readonly jsTsFileThatIsBeingMoved: zyraxoncode.Uri;
}

class UpdateImportsOnFileRenameHandler extends Disposable {

	private readonly _delayer = new Delayer(50);
	private readonly _pendingRenames = new Set<RenameAction>();

	public constructor(
		private readonly client: ITypeScriptServiceClient,
		private readonly fileConfigurationManager: FileConfigurationManager,
		private readonly _handles: (uri: zyraxoncode.Uri) => Promise<boolean>,
	) {
		super();

		this._register(zyraxoncode.workspace.onDidRenameFiles(async (e) => {
			for (const { newUri, oldUri } of e.files) {
				const newFilePath = this.client.toTsFilePath(newUri);
				if (!newFilePath) {
					continue;
				}

				const oldFilePath = this.client.toTsFilePath(oldUri);
				if (!oldFilePath) {
					continue;
				}

				const fallbackSection = doesResourceLookLikeATypeScriptFile(newUri) ? 'typescript' : 'javascript';
				const setting = readUnifiedConfig<UpdateImportsOnFileMoveSetting>(updateImportsOnFileMoveName, UpdateImportsOnFileMoveSetting.Prompt, { scope: null, fallbackSection });
				if (setting === UpdateImportsOnFileMoveSetting.Never) {
					continue;
				}

				// Try to get a js/ts file that is being moved
				// For directory moves, this returns a js/ts file under the directory.
				const jsTsFileThatIsBeingMoved = await this.getJsTsFileBeingMoved(newUri);
				if (!jsTsFileThatIsBeingMoved || !this.client.toTsFilePath(jsTsFileThatIsBeingMoved)) {
					continue;
				}

				this._pendingRenames.add({ oldUri, newUri, newFilePath, oldFilePath, jsTsFileThatIsBeingMoved });

				this._delayer.trigger(() => {
					zyraxoncode.window.withProgress({
						location: zyraxoncode.ProgressLocation.Window,
						title: zyraxoncode.l10n.t("Checking for update of JS/TS imports")
					}, () => this.flushRenames());
				});
			}
		}));
	}

	private async flushRenames(): Promise<void> {
		const renames = Array.from(this._pendingRenames);
		this._pendingRenames.clear();
		for (const group of this.groupRenames(renames)) {
			const edits = new zyraxoncode.WorkspaceEdit();
			const resourcesBeingRenamed: zyraxoncode.Uri[] = [];

			for (const { oldUri, newUri, newFilePath, oldFilePath, jsTsFileThatIsBeingMoved } of group) {
				const document = await zyraxoncode.workspace.openTextDocument(jsTsFileThatIsBeingMoved);

				// Make sure TS knows about file
				this.client.bufferSyncSupport.closeResource(oldUri);
				this.client.bufferSyncSupport.openTextDocument(document);

				if (await this.withEditsForFileRename(edits, document, oldFilePath, newFilePath)) {
					resourcesBeingRenamed.push(newUri);
				}
			}

			if (edits.size) {
				if (await this.confirmActionWithUser(resourcesBeingRenamed)) {
					await zyraxoncode.workspace.applyEdit(edits, { isRefactoring: true });
				}
			}
		}
	}

	private async confirmActionWithUser(newResources: readonly zyraxoncode.Uri[]): Promise<boolean> {
		if (!newResources.length) {
			return false;
		}

		const fallbackSection = doesResourceLookLikeATypeScriptFile(newResources[0]) ? 'typescript' : 'javascript';
		const setting = readUnifiedConfig<UpdateImportsOnFileMoveSetting>(updateImportsOnFileMoveName, UpdateImportsOnFileMoveSetting.Prompt, { scope: null, fallbackSection });
		switch (setting) {
			case UpdateImportsOnFileMoveSetting.Always:
				return true;
			case UpdateImportsOnFileMoveSetting.Never:
				return false;
			case UpdateImportsOnFileMoveSetting.Prompt:
			default:
				return this.promptUser(newResources);
		}
	}

	private async promptUser(newResources: readonly zyraxoncode.Uri[]): Promise<boolean> {
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

		const response = await zyraxoncode.window.showInformationMessage(
			newResources.length === 1
				? zyraxoncode.l10n.t("Update imports for '{0}'?", path.basename(newResources[0].fsPath))
				: this.getConfirmMessage(zyraxoncode.l10n.t("Update imports for the following {0} files?", newResources.length), newResources), {
			modal: true,
		}, rejectItem, acceptItem, alwaysItem, neverItem);


		switch (response) {
			case acceptItem: {
				return true;
			}
			case rejectItem: {
				return false;
			}
			case alwaysItem: {
				const config = zyraxoncode.workspace.getConfiguration(unifiedConfigSection);
				config.update(
					updateImportsOnFileMoveName,
					UpdateImportsOnFileMoveSetting.Always,
					this.getConfigTargetScope(config, updateImportsOnFileMoveName));
				return true;
			}
			case neverItem: {
				const config = zyraxoncode.workspace.getConfiguration(unifiedConfigSection);
				config.update(
					updateImportsOnFileMoveName,
					UpdateImportsOnFileMoveSetting.Never,
					this.getConfigTargetScope(config, updateImportsOnFileMoveName));
				return false;
			}
			default: {
				return false;
			}
		}
	}

	private async getJsTsFileBeingMoved(resource: zyraxoncode.Uri): Promise<zyraxoncode.Uri | undefined> {
		if (resource.scheme !== fileSchemes.file) {
			return undefined;
		}

		if (await isDirectory(resource)) {
			const files = await zyraxoncode.workspace.findFiles(new zyraxoncode.RelativePattern(resource, '**/*.{ts,tsx,js,jsx}'), '**/node_modules/**', 1);
			return files[0];
		}

		return (await this._handles(resource)) ? resource : undefined;
	}

	private async withEditsForFileRename(
		edits: zyraxoncode.WorkspaceEdit,
		document: zyraxoncode.TextDocument,
		oldFilePath: string,
		newFilePath: string,
	): Promise<boolean> {
		const response = await this.client.interruptGetErr(() => {
			this.fileConfigurationManager.setGlobalConfigurationFromDocument(document, nulToken);
			const args: Proto.GetEditsForFileRenameRequestArgs = {
				oldFilePath,
				newFilePath,
			};
			return this.client.execute('getEditsForFileRename', args, nulToken);
		});
		if (response.type !== 'response' || !response.body.length) {
			return false;
		}

		typeConverters.WorkspaceEdit.withFileCodeEdits(edits, this.client, response.body);
		return true;
	}

	private groupRenames(renames: Iterable<RenameAction>): Iterable<Iterable<RenameAction>> {
		const groups = new Map<string, Set<RenameAction>>();

		for (const rename of renames) {
			// Group renames by type (js/ts) and by workspace.
			const key = `${this.client.getWorkspaceRootForResource(rename.jsTsFileThatIsBeingMoved)?.fsPath}@@@${doesResourceLookLikeATypeScriptFile(rename.jsTsFileThatIsBeingMoved)}`;
			if (!groups.has(key)) {
				groups.set(key, new Set());
			}
			groups.get(key)!.add(rename);
		}

		return groups.values();
	}

	private getConfirmMessage(start: string, resourcesToConfirm: readonly zyraxoncode.Uri[]): string {
		const MAX_CONFIRM_FILES = 10;

		const paths = [start];
		paths.push('');
		paths.push(...resourcesToConfirm.slice(0, MAX_CONFIRM_FILES).map(r => path.basename(r.fsPath)));

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

	private getConfigTargetScope(config: zyraxoncode.WorkspaceConfiguration, settingsName: string): zyraxoncode.ConfigurationTarget {
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

export function register(
	client: ITypeScriptServiceClient,
	fileConfigurationManager: FileConfigurationManager,
	handles: (uri: zyraxoncode.Uri) => Promise<boolean>,
) {
	return conditionalRegistration([
		requireSomeCapability(client, ClientCapability.Semantic),
	], () => {
		return new UpdateImportsOnFileRenameHandler(client, fileConfigurationManager, handles);
	});
}
