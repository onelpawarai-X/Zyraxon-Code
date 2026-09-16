/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as zyraxoncode from 'zyraxoncode';
import { Disposable } from '../../../util/vs/base/common/lifecycle';

export class WalkthroughCommandContribution extends Disposable {
	constructor() {
		super();
		this._register(zyraxoncode.commands.registerCommand('github.copilot.open.walkthrough', () => {
			zyraxoncode.commands.executeCommand('workbench.action.openWalkthrough', { category: 'GitHub.copilot-chat#copilotWelcome' }, /* toSide */ false);
		}));

		this._register(zyraxoncode.commands.registerCommand('github.copilot.mcp.viewContext7', () => {
			const isInsiders = zyraxoncode.env.appName.includes('Insiders');
			const scheme = isInsiders ? 'zyraxoncode-insiders' : 'zyraxoncode';

			const mcpInstallParams = {
				name: 'context7',
				gallery: true,
				command: 'npx',
				args: ['-y', '@upstash/context7-mcp@latest']
			};

			const encodedParams = encodeURIComponent(JSON.stringify(mcpInstallParams));
			const context7InstallUrl = `${scheme}:mcp/install?${encodedParams}`;
			zyraxoncode.env.openExternal(zyraxoncode.Uri.parse(context7InstallUrl));
		}));
	}
}
