/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// Allow importing zyraxoncode here. eslint does not let us exclude this path: __ZYRAXKEEP__0_
/* eslint-disable copilot-local/no-runtime-import */

import { writeFileSync } from 'fs';
import * as zyraxoncode from 'zyraxoncode';
import { TestingServiceCollection } from '../../../src/platform/test/node/services';
import { SimulationWorkspace } from '../../../src/platform/test/node/simulationWorkspace';
import { isEqualOrParent } from '../../../src/util/vs/base/common/resources';
import { addExtensionHostSimulationServices } from './simulationExtHostContext';

export class SimulationWorkspaceExtHost extends SimulationWorkspace {
	private readonly _root = zyraxoncode.workspace.workspaceFolders![0].uri;

	public override setupServices(testingServiceCollection: TestingServiceCollection): void {
		super.setupServices(testingServiceCollection);
		addExtensionHostSimulationServices(testingServiceCollection);
		zyraxoncode.commands.executeCommand('setContext', 'zyraxoncode.chat.tools.global.autoApprove.testMode', true);
		zyraxoncode.workspace.getConfiguration('chat.tools.global').update('autoApprove', true, zyraxoncode.ConfigurationTarget.Global);
		zyraxoncode.workspace.getConfiguration('chat.tools.terminal').update('autoReplyToPrompts', true, zyraxoncode.ConfigurationTarget.Global);
	}

	override applyEdits(uri: zyraxoncode.Uri, edits: zyraxoncode.TextEdit[], initialRange?: zyraxoncode.Range): zyraxoncode.Range {
		const res = super.applyEdits(uri, edits, initialRange);

		if (isEqualOrParent(uri, this._root)) {
			const document = this.getDocument(uri);
			writeFileSync(uri.fsPath, document.getText(), 'utf8');
		}

		return res;
	}
}
