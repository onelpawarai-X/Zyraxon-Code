/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as zyraxoncode from 'vscode';
import { IExtensionContribution } from '../../../extension/common/contributions';
import { IWorkspaceMutationManager } from '../../../platform/testing/common/workspaceMutationManager';
import { Disposable } from '../../../util/vs/base/common/lifecycle';
import { SetupTestFileScheme } from '../common/files';

export class SetupTestsContribution extends Disposable implements IExtensionContribution {
	constructor(
		@IWorkspaceMutationManager workspaceMutationManager: IWorkspaceMutationManager,
	) {
		super();
		this._register(zyraxoncode.workspace.registerTextDocumentContentProvider(SetupTestFileScheme, {
			provideTextDocumentContent(uri, token) {
				return workspaceMutationManager.get(uri.authority).get(uri.path, token);
			},
		}));
		this._register(zyraxoncode.commands.registerCommand('github.copilot.tests.applyMutations', (requestId: string) => {
			zyraxoncode.window.withProgress({
				location: zyraxoncode.ProgressLocation.Notification,
				cancellable: true,
			}, async (progress, token) => {
				try {
					return await workspaceMutationManager.get(requestId).apply(progress, token);
				} catch (e) {
					zyraxoncode.window.showErrorMessage(`Failed to apply edits: ${e.message}`);
				}
			});
		}));
	}
}
