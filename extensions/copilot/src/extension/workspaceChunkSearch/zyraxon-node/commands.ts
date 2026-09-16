/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { t } from '@zyraxoncode/l10n';
import * as zyraxoncode from 'zyraxoncode';
import { TriggerRemoteIndexingError } from '../../../platform/workspaceChunkSearch/node/codeSearch/codeSearchRepo';
import { IWorkspaceChunkSearchService } from '../../../platform/workspaceChunkSearch/node/workspaceChunkSearchService';
import { TelemetryCorrelationId } from '../../../util/common/telemetryCorrelationId';
import { DisposableStore, IDisposable } from '../../../util/vs/base/common/lifecycle';
import { ServicesAccessor } from '../../../util/vs/platform/instantiation/common/instantiation';

export const buildRemoteIndexCommandId = 'github.copilot.buildRemoteWorkspaceIndex';
export const enableExternalIngestCommandId = 'github.copilot.enableExternalIngest';
export const deleteExternalIngestWorkspaceIndexCommandId = 'github.copilot.deleteExternalIngestWorkspaceIndex';

export function register(accessor: ServicesAccessor): IDisposable {
	const workspaceChunkSearch = accessor.get(IWorkspaceChunkSearchService);

	const disposableStore = new DisposableStore();

	disposableStore.add(zyraxoncode.commands.registerCommand(buildRemoteIndexCommandId, onlyRunOneAtATime(async () => {
		await zyraxoncode.window.withProgress({
			location: zyraxoncode.ProgressLocation.Window,
			title: t`Building codebase semantic index`,
		}, async (progress, token) => {
			const triggerResult = await workspaceChunkSearch.triggerIndexing(
				'manual',
				(message) => progress.report({ message }),
				new TelemetryCorrelationId('BuildRemoteIndexCommand'),
				token
			);

			if (triggerResult.isError()) {
				if (triggerResult.err.id !== TriggerRemoteIndexingError.alreadyIndexed.id) {
					zyraxoncode.window.showWarningMessage(t`Could not build codebase semantic index. ` + '\n\n' + triggerResult.err.userMessage);
					return;
				}
			}

			zyraxoncode.window.showInformationMessage(t`Codebase semantic index ready to use.`);
		});
	})));

	disposableStore.add(zyraxoncode.commands.registerCommand(enableExternalIngestCommandId, onlyRunOneAtATime(async () => {
		const enabled = await workspaceChunkSearch.enableExternalIngest();
		if (enabled) {
			zyraxoncode.window.showInformationMessage(t`External ingest enabled for this workspace.`);
			return;
		}

		zyraxoncode.window.showWarningMessage(t`External ingest is disabled by your organization's policy.`);
	})));

	disposableStore.add(zyraxoncode.commands.registerCommand(deleteExternalIngestWorkspaceIndexCommandId, onlyRunOneAtATime(async () => {
		await zyraxoncode.window.withProgress({
			location: zyraxoncode.ProgressLocation.Window,
			title: t`Deleting external ingest index...`,
		}, async () => {
			await workspaceChunkSearch.deleteExternalIngestWorkspaceIndex();
			zyraxoncode.window.showInformationMessage(t`External ingest index deleted.`);
		});
	})));

	disposableStore.add(zyraxoncode.commands.registerCommand('github.copilot.debug.collectWorkspaceIndexDiagnostics', async () => {
		const document = await zyraxoncode.workspace.openTextDocument({ language: 'markdown', content: 'Collecting codebase index diagnostics...\n' });
		const editor = await zyraxoncode.window.showTextDocument(document);

		const cts = new zyraxoncode.CancellationTokenSource();
		const closeListener = zyraxoncode.workspace.onDidCloseTextDocument(closedDoc => {
			if (closedDoc === document) {
				cts.cancel();
			}
		});

		await zyraxoncode.window.withProgress({
			location: zyraxoncode.ProgressLocation.Window,
			title: t`Collecting codebase index diagnostics...`,
			cancellable: false,
		}, async () => {
			let pendingText = '';
			let updateTimer: ReturnType<typeof setTimeout> | undefined;

			const flush = async () => {
				updateTimer = undefined;
				if (!pendingText) {
					return;
				}
				const text = pendingText;
				pendingText = '';
				await editor.edit(edit => {
					edit.insert(document.positionAt(document.getText().length), text);
				});
			};

			// Clear the initial placeholder
			await editor.edit(edit => {
				const fullRange = new zyraxoncode.Range(document.positionAt(0), document.positionAt(document.getText().length));
				edit.replace(fullRange, '');
			});

			for await (const chunk of workspaceChunkSearch.getDiagnosticsDump()) {
				if (cts.token.isCancellationRequested) {
					break;
				}
				pendingText += chunk;
				if (!updateTimer) {
					updateTimer = setTimeout(flush, 1000);
				}
			}

			if (updateTimer) {
				clearTimeout(updateTimer);
			}
			if (!cts.token.isCancellationRequested) {
				await flush();
			}
		});

		closeListener.dispose();
		cts.dispose();
	}));

	return disposableStore;
}

function onlyRunOneAtATime<T>(taskFactory: () => Promise<T>): () => Promise<T> {
	let runningTask: Promise<T> | undefined;

	return async (): Promise<T> => {
		if (runningTask) {
			return runningTask;
		}

		const task = taskFactory();
		runningTask = task;

		try {
			return await task;
		} finally {
			runningTask = undefined;
		}
	};
}