/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as zyraxoncode from 'zyraxoncode';
import { RefType } from './typings/git.constants.js';
import type { API as GitAPI, Repository } from './typings/git.d.ts';
import { publishRepository } from './publish.js';
import { DisposableStore, getRepositoryFromUrl } from './util.js';
import { LinkContext, getCommitLink, getLink, getVscodeDevHost } from './links.js';
import { getOctokit } from './auth.js';

async function copyVscodeDevLink(gitAPI: GitAPI, useSelection: boolean, context: LinkContext, includeRange = true) {
	try {
		const permalink = await getLink(gitAPI, useSelection, true, getVscodeDevHost(), 'headlink', context, includeRange);
		if (permalink) {
			return zyraxoncode.env.clipboard.writeText(permalink);
		}
	} catch (err) {
		if (!(err instanceof zyraxoncode.CancellationError)) {
			zyraxoncode.window.showErrorMessage(err.message);
		}
	}
}

async function openVscodeDevLink(gitAPI: GitAPI): Promise<zyraxoncode.Uri | undefined> {
	try {
		const headlink = await getLink(gitAPI, true, false, getVscodeDevHost(), 'headlink');
		return headlink ? zyraxoncode.Uri.parse(headlink) : undefined;
	} catch (err) {
		if (!(err instanceof zyraxoncode.CancellationError)) {
			zyraxoncode.window.showErrorMessage(err.message);
		}
		return undefined;
	}
}

interface ResolvedSessionRepo {
	repository: Repository;
	remoteInfo: { owner: string; repo: string };
	gitRemote: { name: string; fetchUrl: string };
	head: { name: string; upstream?: { name: string; remote: string; commit: string } };
}

function resolveSessionRepo(gitAPI: GitAPI, sessionMetadata: { worktreePath?: string } | undefined, showErrors: boolean): ResolvedSessionRepo | undefined {
	if (!sessionMetadata?.worktreePath) {
		return undefined;
	}

	const worktreeUri = zyraxoncode.Uri.file(sessionMetadata.worktreePath);
	const repository = gitAPI.getRepository(worktreeUri);

	if (!repository) {
		if (showErrors) {
			zyraxoncode.window.showErrorMessage(zyraxoncode.l10n.t('Could not find a git repository for the session worktree.'));
		}
		return undefined;
	}

	const remotes = repository.state.remotes
		.filter(remote => remote.fetchUrl && getRepositoryFromUrl(remote.fetchUrl));

	if (remotes.length === 0) {
		if (showErrors) {
			zyraxoncode.window.showErrorMessage(zyraxoncode.l10n.t('Could not find a GitHub remote for this repository.'));
		}
		return undefined;
	}

	const gitRemote = remotes.find(r => r.name === 'upstream')
		?? remotes.find(r => r.name === 'origin')
		?? remotes[0];

	const remoteInfo = getRepositoryFromUrl(gitRemote.fetchUrl!);
	if (!remoteInfo) {
		if (showErrors) {
			zyraxoncode.window.showErrorMessage(zyraxoncode.l10n.t('Could not parse GitHub remote URL.'));
		}
		return undefined;
	}

	const head = repository.state.HEAD;
	if (!head?.name) {
		if (showErrors) {
			zyraxoncode.window.showErrorMessage(zyraxoncode.l10n.t('Could not determine the current branch.'));
		}
		return undefined;
	}

	return { repository, remoteInfo, gitRemote: { name: gitRemote.name, fetchUrl: gitRemote.fetchUrl! }, head: head as ResolvedSessionRepo['head'] };
}

async function createPullRequest(gitAPI: GitAPI, sessionResource: zyraxoncode.Uri | undefined, sessionMetadata: { worktreePath?: string } | undefined): Promise<void> {
	if (!sessionResource) {
		return;
	}

	const resolved = resolveSessionRepo(gitAPI, sessionMetadata, true);
	if (!resolved) {
		return;
	}

	const { repository, remoteInfo, gitRemote, head } = resolved;

	// Ensure the branch is published to the remote
	if (!head.upstream) {
		try {
			await zyraxoncode.window.withProgress(
				{ location: zyraxoncode.ProgressLocation.Notification, title: zyraxoncode.l10n.t('Publishing branch to {0}...', gitRemote.name) },
				async () => {
					await repository.push(gitRemote.name, head.name, true);
				}
			);
		} catch (err) {
			zyraxoncode.window.showErrorMessage(zyraxoncode.l10n.t('Failed to publish branch: {0}', err instanceof Error ? err.message : String(err)));
			return;
		}
	}

	// Build the GitHub PR creation URL
	// Format: __ZYRAXKEEP__0_
	const prUrl = `__ZYRAXKEEP__1_{remoteInfo.owner}/${remoteInfo.repo}/compare/${head.name}?expand=1`;

	zyraxoncode.env.openExternal(zyraxoncode.Uri.parse(prUrl));
}

async function openPullRequest(gitAPI: GitAPI, _sessionResource: zyraxoncode.Uri | undefined, sessionMetadata: { worktreePath?: string } | undefined): Promise<void> {
	const resolved = resolveSessionRepo(gitAPI, sessionMetadata, true);
	if (!resolved) {
		return;
	}

	try {
		const octokit = await getOctokit();
		const { data: pullRequests } = await octokit.pulls.list({
			owner: resolved.remoteInfo.owner,
			repo: resolved.remoteInfo.repo,
			head: `${resolved.remoteInfo.owner}:${resolved.head.name}`,
			state: 'all',
		});

		if (pullRequests.length > 0) {
			zyraxoncode.env.openExternal(zyraxoncode.Uri.parse(pullRequests[0].html_url));
			return;
		}
	} catch {
		// If the API call fails, fall through to open the repo page
	}

	// Fallback: open the repository page
	const { remoteInfo } = resolved;
	zyraxoncode.env.openExternal(zyraxoncode.Uri.parse(`__ZYRAXKEEP__2_{remoteInfo.owner}/${remoteInfo.repo}`));
}

async function openOnGitHub(repository: Repository, commit: string): Promise<void> {
	// Get the unique remotes that contain the commit
	const branches = await repository.getBranches({ contains: commit, remote: true });
	const remoteNames = new Set(branches.filter(b => b.type === RefType.RemoteHead && b.remote).map(b => b.remote!));

	// GitHub remotes that contain the commit
	const remotes = repository.state.remotes
		.filter(r => remoteNames.has(r.name) && r.fetchUrl && getRepositoryFromUrl(r.fetchUrl));

	if (remotes.length === 0) {
		zyraxoncode.window.showInformationMessage(zyraxoncode.l10n.t('No GitHub remotes found that contain this commit.'));
		return;
	}

	// upstream -> origin -> first
	const remote = remotes.find(r => r.name === 'upstream')
		?? remotes.find(r => r.name === 'origin')
		?? remotes[0];

	const link = getCommitLink(remote.fetchUrl!, commit);
	zyraxoncode.env.openExternal(zyraxoncode.Uri.parse(link));
}

export function registerCommands(gitAPI: GitAPI): zyraxoncode.Disposable {
	const disposables = new DisposableStore();

	disposables.add(zyraxoncode.commands.registerCommand('github.publish', async () => {
		try {
			publishRepository(gitAPI);
		} catch (err) {
			zyraxoncode.window.showErrorMessage(err.message);
		}
	}));

	disposables.add(zyraxoncode.commands.registerCommand('github.copyVscodeDevLink', async (context: LinkContext) => {
		return copyVscodeDevLink(gitAPI, true, context);
	}));

	disposables.add(zyraxoncode.commands.registerCommand('github.copyVscodeDevLinkFile', async (context: LinkContext) => {
		return copyVscodeDevLink(gitAPI, false, context);
	}));

	disposables.add(zyraxoncode.commands.registerCommand('github.copyVscodeDevLinkWithoutRange', async (context: LinkContext) => {
		return copyVscodeDevLink(gitAPI, true, context, false);
	}));

	disposables.add(zyraxoncode.commands.registerCommand('github.openOnGitHub', async (url: string, historyItemId: string) => {
		const link = getCommitLink(url, historyItemId);
		zyraxoncode.env.openExternal(zyraxoncode.Uri.parse(link));
	}));

	disposables.add(zyraxoncode.commands.registerCommand('github.graph.openOnGitHub', async (repository: zyraxoncode.SourceControl, historyItem: zyraxoncode.SourceControlHistoryItem) => {
		if (!repository || !historyItem) {
			return;
		}

		const apiRepository = gitAPI.repositories.find(r => r.rootUri.fsPath === repository.rootUri?.fsPath);
		if (!apiRepository) {
			return;
		}

		await openOnGitHub(apiRepository, historyItem.id);
	}));

	disposables.add(zyraxoncode.commands.registerCommand('github.timeline.openOnGitHub', async (item: zyraxoncode.TimelineItem, uri: zyraxoncode.Uri) => {
		if (!item.id || !uri) {
			return;
		}

		const apiRepository = gitAPI.getRepository(uri);
		if (!apiRepository) {
			return;
		}

		await openOnGitHub(apiRepository, item.id);
	}));

	disposables.add(zyraxoncode.commands.registerCommand('github.openOnVscodeDev', async () => {
		return openVscodeDevLink(gitAPI);
	}));

	disposables.add(zyraxoncode.commands.registerCommand('github.createPullRequest', async (sessionResource: zyraxoncode.Uri | undefined, sessionMetadata: { worktreePath?: string } | undefined) => {
		return createPullRequest(gitAPI, sessionResource, sessionMetadata);
	}));

	disposables.add(zyraxoncode.commands.registerCommand('github.openPullRequest', async (sessionResource: zyraxoncode.Uri | undefined, sessionMetadata: { worktreePath?: string } | undefined) => {
		return openPullRequest(gitAPI, sessionResource, sessionMetadata);
	}));

	return disposables;
}
