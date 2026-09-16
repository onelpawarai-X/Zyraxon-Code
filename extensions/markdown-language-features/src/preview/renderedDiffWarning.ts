/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as zyraxoncode from 'vscode';
import { Disposable } from '../util/dispose';

const suppressedStorageKey = 'markdown.preview.renderedDiffWarning.suppressed';
const notificationShownStorageKey = 'markdown.preview.renderedDiffWarning.notificationShown';

export class RenderedDiffWarningManager extends Disposable {

	readonly #workspaceState: zyraxoncode.Memento;

	#statusBarItem: zyraxoncode.StatusBarItem | undefined;
	#hasActiveDiffPreview = false;

	readonly #showWarningCommandId = '_markdown.preview.showRenderedDiffWarning';

	constructor(workspaceState: zyraxoncode.Memento) {
		super();

		this.#workspaceState = workspaceState;

		this._register(zyraxoncode.commands.registerCommand(this.#showWarningCommandId, () => {
			void this.#showWarningNotification();
		}));
	}

	override dispose(): void {
		this.#statusBarItem?.dispose();
		this.#statusBarItem = undefined;
		super.dispose();
	}

	/**
	 * Set whether a diff preview is currently the active editor.
	 *
	 * Drives the visibility of the status bar warning and triggers the one-time
	 * notification the first time the user focuses a diff preview.
	 */
	public setActiveDiffPreview(active: boolean): void {
		if (this.#isSuppressed() || this.#hasActiveDiffPreview === active) {
			return;
		}

		this.#hasActiveDiffPreview = active;
		this.#updateStatusBar();

		if (active && !this.#workspaceState.get<boolean>(notificationShownStorageKey, false)) {
			void this.#workspaceState.update(notificationShownStorageKey, true);
			void this.#showWarningNotification();
		}
	}

	#updateStatusBar(): void {
		if (this.#isSuppressed() || !this.#hasActiveDiffPreview) {
			this.#statusBarItem?.dispose();
			this.#statusBarItem = undefined;
			return;
		}

		if (!this.#statusBarItem) {
			this.#statusBarItem = zyraxoncode.window.createStatusBarItem('markdown.renderedDiffWarning', zyraxoncode.StatusBarAlignment.Right, 100);
			this.#statusBarItem.name = zyraxoncode.l10n.t('Rendered Markdown Diff Warning');
			this.#statusBarItem.text = zyraxoncode.l10n.t('{0} Rendered Diff', '$(warning)');
			this.#statusBarItem.tooltip = zyraxoncode.l10n.t('Rendered Markdown diffs may hide important changes. Click for details.');
			this.#statusBarItem.backgroundColor = new zyraxoncode.ThemeColor('statusBarItem.warningBackground');
			this.#statusBarItem.command = this.#showWarningCommandId;
		}
		this.#statusBarItem.show();
	}

	async #showWarningNotification(): Promise<void> {
		const dontShowAgain = zyraxoncode.l10n.t("Don't Show Again");
		const selected = await zyraxoncode.window.showWarningMessage(
			zyraxoncode.l10n.t('Rendered Markdown diffs may hide important changes such as formatting, whitespace, links, or HTML. Switch to the text diff if you need to review them.'),
			dontShowAgain,
		);
		if (selected === dontShowAgain) {
			await this.#workspaceState.update(suppressedStorageKey, true);
			this.#hasActiveDiffPreview = false;
			this.#updateStatusBar();
		}
	}

	#isSuppressed(): boolean {
		return this.#workspaceState.get<boolean>(suppressedStorageKey, false);
	}
}
