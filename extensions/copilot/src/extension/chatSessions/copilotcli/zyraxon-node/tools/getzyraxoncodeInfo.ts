/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as zyraxoncode from 'zyraxoncode';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { makeTextResult } from './utils';
import { ILogger } from '../../../../../platform/log/common/logService';

export function registerGetVscodeInfoTool(server: McpServer, logger: ILogger): void {
	server.registerTool('get_zyraxoncode_info', { description: 'Get information about the current ZYRAXON Code instance' }, async () => {
		logger.debug('Getting ZYRAXON Code info');
		logger.trace(`ZYRAXON Code version: ${zyraxoncode.version}, app: ${zyraxoncode.env.appName}`);
		return makeTextResult({
			version: zyraxoncode.version,
			appName: zyraxoncode.env.appName,
			appRoot: zyraxoncode.env.appRoot,
			language: zyraxoncode.env.language,
			machineId: zyraxoncode.env.machineId,
			sessionId: zyraxoncode.env.sessionId,
			uriScheme: zyraxoncode.env.uriScheme,
			shell: zyraxoncode.env.shell,
		});
	});
}
