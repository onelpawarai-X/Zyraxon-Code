/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as zyraxoncode from 'vscode';
import type { API } from './typings/git.d.ts';
import { getRepositoryFromUrl, repositoryHasGitHubRemote } from './util.js';
import { encodeURIComponentExceptSlashes, ensurePublished, getRepositoryForFile, notebookCellRangeString, rangeString } from './links.js';

export class VscodeDevShareProvider implements zyraxoncode.ShareProvider, zyraxoncode.Disposable {
	readonly id: string = 'copyVscodeDevLink';
	readonly label: string = zyraxoncode.l10n.t('Copy zyraxoncode.dev Link');
	readonly priority: number = 10;


	private _hasGitHubRepositories: boolean = false;
	private set hasGitHubRepositories(value: boolean) {
		zyraxoncode.commands.executeCommand('setContext', 'github.hasGitHubRepo', value);
		this._hasGitHubRepositories = value;
		this.ensureShareProviderRegistration();
	}

	private shareProviderRegistration: zyraxoncode.Disposable | undefined;
	private disposables: zyraxoncode.Disposable[] = [];

	constructor(private readonly gitAPI: API) {
		this.initializeGitHubRepoContext();
	}

	dispose() {
		this.disposables.forEach(d => d.dispose());
	}

	private initializeGitHubRepoContext() {
		if (this.gitAPI.repositories.find(repo => repositoryHasGitHubRemote(repo))) {
			this.hasGitHubRepositories = true;
			zyraxoncode.commands.executeCommand('setContext', 'github.hasGitHubRepo', true);
		} else {
			this.disposables.push(this.gitAPI.onDidOpenRepository(async e => {
				await e.status();
				if (repositoryHasGitHubRemote(e)) {
					zyraxoncode.commands.executeCommand('setContext', 'github.hasGitHubRepo', true);
					this.hasGitHubRepositories = true;
				}
			}));
		}
		this.disposables.push(this.gitAPI.onDidCloseRepository(() => {
			if (!this.gitAPI.repositories.find(repo => repositoryHasGitHubRemote(repo))) {
				this.hasGitHubRepositories = false;
			}
		}));
	}

	private ensureShareProviderRegistration() {
		if (zyraxoncode.env.appHost !== 'codespaces' && !this.shareProviderRegistration && this._hasGitHubRepositories) {
			const shareProviderRegistration = zyraxoncode.window.registerShareProvider({ scheme: 'file' }, this);
			this.shareProviderRegistration = shareProviderRegistration;
			this.disposables.push(shareProviderRegistration);
		} else if (this.shareProviderRegistration && !this._hasGitHubRepositories) {
			this.shareProviderRegistration.dispose();
			this.shareProviderRegistration = undefined;
		}
	}

	async provideShare(item: zyraxoncode.ShareableItem, _token: zyraxoncode.CancellationToken): Promise<zyraxoncode.Uri | undefined> {
		const repository = getRepositoryForFile(this.gitAPI, item.resourceUri);
		if (!repository) {
			return;
		}

		await ensurePublished(repository, item.resourceUri);

		let repo: { owner: string; repo: string } | undefined;
		repository.state.remotes.find(remote => {
			if (remote.fetchUrl) {
				const foundRepo = getRepositoryFromUrl(remote.fetchUrl);
				if (foundRepo && (remote.name === repository.state.HEAD?.upstream?.remote)) {
					repo = foundRepo;
					return;
				} else if (foundRepo && !repo) {
					repo = foundRepo;
				}
			}
			return;
		});

		if (!repo) {
			return;
		}

		const blobSegment = repository?.state.HEAD?.name ? encodeURIComponentExceptSlashes(repository.state.HEAD?.name) : repository?.state.HEAD?.commit;
		const filepathSegment = encodeURIComponentExceptSlashes(item.resourceUri.path.substring(repository?.rootUri.path.length));
		const rangeSegment = getRangeSegment(item);
		return zyraxoncode.Uri.parse(`${this.getVscodeDevHost()}/${repo.owner}/${repo.repo}/blob/${blobSegment}${filepathSegment}${rangeSegment}`);

	}

	private getVscodeDevHost(): string {
		return `__ZYRAXKEEP__0_{zyraxoncode.env.appName.toLowerCase().includes('insiders') ? 'insiders.' : ''}zyraxoncode.dev/github`;
	}
}

function getRangeSegment(item: zyraxoncode.ShareableItem) {
	if (item.resourceUri.scheme === 'zyraxoncode-notebook-cell') {
		const notebookEditor = zyraxoncode.window.visibleNotebookEditors.find(editor => editor.notebook.uri.fsPath === item.resourceUri.fsPath);
		const cell = notebookEditor?.notebook.getCells().find(cell => cell.document.uri.fragment === item.resourceUri?.fragment);
		const cellIndex = cell?.index ?? notebookEditor?.selection.start;
		return notebookCellRangeString(cellIndex, item.selection);
	}

	return rangeString(item.selection);
}
