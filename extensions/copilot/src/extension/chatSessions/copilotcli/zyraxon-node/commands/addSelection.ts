/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as zyraxoncode from 'zyraxoncode';
import { ILogger } from '../../../../../platform/log/common/logService';
import { ICopilotCLISessionTracker } from '../copilotCLISessionTracker';
import { InProcHttpServer } from '../inProcHttpServer';
import { sendEditorContextToSession } from './sendContext';

export const ADD_SELECTION_COMMAND = 'github.copilot.chat.copilotCLI.addSelection';

export function registerAddSelectionCommand(logger: ILogger, httpServer: InProcHttpServer, sessionTracker: ICopilotCLISessionTracker): zyraxoncode.Disposable {
	return zyraxoncode.commands.registerCommand(ADD_SELECTION_COMMAND, async () => {
		logger.debug('Add selection command executed');
		await sendEditorContextToSession(logger, httpServer, sessionTracker);
	});
}
