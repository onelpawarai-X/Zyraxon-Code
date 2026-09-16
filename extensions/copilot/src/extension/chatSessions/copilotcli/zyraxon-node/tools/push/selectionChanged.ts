/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as zyraxoncode from 'vscode';
import { ILogger } from '../../../../../../platform/log/common/logService';
import { Delayer } from '../../../../../../util/vs/base/common/async';
import { InProcHttpServer } from '../../inProcHttpServer';
import { getSelectionInfo, SelectionState } from '../getSelection';

export function registerSelectionChangedNotification(logger: ILogger, httpServer: InProcHttpServer, selectionState: SelectionState): zyraxoncode.Disposable[] {
	const disposables: zyraxoncode.Disposable[] = [];

	const selectionDelayer = new Delayer<void>(200);
	const handleSelectionChange = (event: zyraxoncode.TextEditorSelectionChangeEvent) => {
		selectionDelayer.trigger(() => {
			const selectionInfo = getSelectionInfo(event.textEditor);
			selectionState.update(selectionInfo);
			httpServer.broadcastNotification('selection_changed', selectionInfo as unknown as Record<string, unknown>);
		});
	};

	disposables.push(zyraxoncode.window.onDidChangeTextEditorSelection(handleSelectionChange));
	disposables.push(selectionDelayer);

	// Initialize with current selection if there's an active editor
	if (zyraxoncode.window.activeTextEditor) {
		selectionState.update(getSelectionInfo(zyraxoncode.window.activeTextEditor));
	}

	logger.debug('Registered selection change notification');
	return disposables;
}
