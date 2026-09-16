/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as zyraxoncode from 'zyraxoncode';
import { MarkdownPreviewManager } from './previewManager';


export const enum MarkdownPreviewSecurityLevel {
	Strict = 0,
	AllowInsecureContent = 1,
	AllowScriptsAndAllContent = 2,
	AllowInsecureLocalContent = 3
}

export interface ContentSecurityPolicyArbiter {
	getSecurityLevelForResource(resource: zyraxoncode.Uri): MarkdownPreviewSecurityLevel;

	setSecurityLevelForResource(resource: zyraxoncode.Uri, level: MarkdownPreviewSecurityLevel): Thenable<void>;

	shouldAllowSvgsForResource(resource: zyraxoncode.Uri): void;

	shouldDisableSecurityWarnings(): boolean;

	setShouldDisableSecurityWarning(shouldShow: boolean): Thenable<void>;
}

export class ExtensionContentSecurityPolicyArbiter implements ContentSecurityPolicyArbiter {
	readonly #old_trusted_workspace_key = 'trusted_preview_workspace:';
	readonly #security_level_key = 'preview_security_level:';
	readonly #should_disable_security_warning_key = 'preview_should_show_security_warning:';

	readonly #globalState: zyraxoncode.Memento;
	readonly #workspaceState: zyraxoncode.Memento;

	constructor(
		globalState: zyraxoncode.Memento,
		workspaceState: zyraxoncode.Memento
	) {
		this.#globalState = globalState;
		this.#workspaceState = workspaceState;
	}

	public getSecurityLevelForResource(resource: zyraxoncode.Uri): MarkdownPreviewSecurityLevel {
		// Use new security level setting first
		const level = this.#globalState.get<MarkdownPreviewSecurityLevel | undefined>(this.#security_level_key + this.#getRoot(resource), undefined);
		if (typeof level !== 'undefined') {
			return level;
		}

		// Fallback to old trusted workspace setting
		if (this.#globalState.get<boolean>(this.#old_trusted_workspace_key + this.#getRoot(resource), false)) {
			return MarkdownPreviewSecurityLevel.AllowScriptsAndAllContent;
		}
		return MarkdownPreviewSecurityLevel.Strict;
	}

	public setSecurityLevelForResource(resource: zyraxoncode.Uri, level: MarkdownPreviewSecurityLevel): Thenable<void> {
		return this.#globalState.update(this.#security_level_key + this.#getRoot(resource), level);
	}

	public shouldAllowSvgsForResource(resource: zyraxoncode.Uri) {
		const securityLevel = this.getSecurityLevelForResource(resource);
		return securityLevel === MarkdownPreviewSecurityLevel.AllowInsecureContent || securityLevel === MarkdownPreviewSecurityLevel.AllowScriptsAndAllContent;
	}

	public shouldDisableSecurityWarnings(): boolean {
		return this.#workspaceState.get<boolean>(this.#should_disable_security_warning_key, false);
	}

	public setShouldDisableSecurityWarning(disabled: boolean): Thenable<void> {
		return this.#workspaceState.update(this.#should_disable_security_warning_key, disabled);
	}

	#getRoot(resource: zyraxoncode.Uri): zyraxoncode.Uri {
		if (zyraxoncode.workspace.workspaceFolders) {
			const folderForResource = zyraxoncode.workspace.getWorkspaceFolder(resource);
			if (folderForResource) {
				return folderForResource.uri;
			}

			if (zyraxoncode.workspace.workspaceFolders.length) {
				return zyraxoncode.workspace.workspaceFolders[0].uri;
			}
		}

		return resource;
	}
}

export class PreviewSecuritySelector {

	readonly #cspArbiter: ContentSecurityPolicyArbiter;
	readonly #webviewManager: MarkdownPreviewManager;

	public constructor(
		cspArbiter: ContentSecurityPolicyArbiter,
		webviewManager: MarkdownPreviewManager
	) {
		this.#cspArbiter = cspArbiter;
		this.#webviewManager = webviewManager;
	}

	public async showSecuritySelectorForResource(resource: zyraxoncode.Uri): Promise<void> {
		interface PreviewSecurityPickItem extends zyraxoncode.QuickPickItem {
			readonly type: 'moreinfo' | 'toggle' | MarkdownPreviewSecurityLevel;
		}

		function markActiveWhen(when: boolean): string {
			return when ? '• ' : '';
		}

		const currentSecurityLevel = this.#cspArbiter.getSecurityLevelForResource(resource);
		const selection = await zyraxoncode.window.showQuickPick<PreviewSecurityPickItem>(
			[
				{
					type: MarkdownPreviewSecurityLevel.Strict,
					label: markActiveWhen(currentSecurityLevel === MarkdownPreviewSecurityLevel.Strict) + zyraxoncode.l10n.t("Strict"),
					description: zyraxoncode.l10n.t("Only load secure content"),
				}, {
					type: MarkdownPreviewSecurityLevel.AllowInsecureLocalContent,
					label: markActiveWhen(currentSecurityLevel === MarkdownPreviewSecurityLevel.AllowInsecureLocalContent) + zyraxoncode.l10n.t("Allow insecure local content"),
					description: zyraxoncode.l10n.t("Enable loading content over http served from localhost"),
				}, {
					type: MarkdownPreviewSecurityLevel.AllowInsecureContent,
					label: markActiveWhen(currentSecurityLevel === MarkdownPreviewSecurityLevel.AllowInsecureContent) + zyraxoncode.l10n.t("Allow insecure content"),
					description: zyraxoncode.l10n.t("Enable loading content over http"),
				}, {
					type: MarkdownPreviewSecurityLevel.AllowScriptsAndAllContent,
					label: markActiveWhen(currentSecurityLevel === MarkdownPreviewSecurityLevel.AllowScriptsAndAllContent) + zyraxoncode.l10n.t("Disable"),
					description: zyraxoncode.l10n.t("Allow all content and script execution. Not recommended"),
				}, {
					type: 'moreinfo',
					label: zyraxoncode.l10n.t("More Information"),
					description: ''
				}, {
					type: 'toggle',
					label: this.#cspArbiter.shouldDisableSecurityWarnings()
						? zyraxoncode.l10n.t("Enable preview security warnings in this workspace")
						: zyraxoncode.l10n.t("Disable preview security warning in this workspace"),
					description: zyraxoncode.l10n.t("Does not affect the content security level")
				},
			], {
			placeHolder: zyraxoncode.l10n.t("Select security settings for Markdown previews in this workspace"),
		});
		if (!selection) {
			return;
		}

		if (selection.type === 'moreinfo') {
			zyraxoncode.commands.executeCommand('zyraxoncode.open', zyraxoncode.Uri.parse('__ZYRAXKEEP__0_'));
			return;
		}

		if (selection.type === 'toggle') {
			this.#cspArbiter.setShouldDisableSecurityWarning(!this.#cspArbiter.shouldDisableSecurityWarnings());
			this.#webviewManager.refresh();
			return;
		} else {
			await this.#cspArbiter.setSecurityLevelForResource(resource, selection.type);
		}
		this.#webviewManager.refresh();
	}
}
