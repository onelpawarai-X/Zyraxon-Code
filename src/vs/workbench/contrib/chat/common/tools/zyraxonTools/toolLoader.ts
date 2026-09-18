/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Tool loader for ZYRAXON-AI tools.
 * Uses Node.js require() to dynamically load tool modules from the source directory.
 * Works in the Electron renderer process where Node.js APIs are available.
 */

import { registerZyraxonTool, ZyraxonToolDef, getAllZyraxonTools } from './zyraxonToolRegistry.js';
import { ILogService } from '../../../../../../platform/log/common/log.js';

const TOOL_DIR = __dirname + '/source';
const MCP_TOOL_DIR = TOOL_DIR + '/mcp';

/**
 * Scan a directory and load all tool modules.
 * Each file must export an `execute` function.
 */
function loadToolsFromDir(dir: string, category: string, logService: ILogService): void {
	try {
		const fs = require('fs');
		const path = require('path');

		const files = fs.readdirSync(dir);
		for (const file of files) {
			const fullPath = path.join(dir, file);
			const stat = fs.statSync(fullPath);

			if (stat.isDirectory()) {
				loadToolsFromDir(fullPath, category, logService);
			} else if (file.endsWith('.js') || file.endsWith('.ts')) {
				if (file === 'index.js' || file === 'index.ts') continue;
				if (file === 'zyraxonToolRegistry.js' || file === 'toolLoader.js') continue;
				if (file === 'zyraxonToolWrapper.js') continue;

				try {
					const modulePath = fullPath.replace(/\\/g, '/');
					const module = require(modulePath);

					// Check if module exports execute
					if (typeof module.execute === 'function') {
						const toolName = file.replace(/\.(js|ts)$/, '');
						const toolId = toolName.replace(/_/g, '-');

						const tool: ZyraxonToolDef = {
							id: toolId,
							name: toolName.replace(/-/g, ' '),
							description: `ZYRAXON tool: ${toolName}`,
							category: category,
							parameters: {},
							execute: module.execute,
						};
						registerZyraxonTool(tool);
						logService.info(`[zyraxon-tools] Loaded tool: ${toolId} from ${file}`);
					}
				} catch (err) {
					// Module doesn't export execute, skip it
				}
			}
		}
	} catch (err) {
		logService.error(`[zyraxon-tools] Failed to scan ${dir}:`, err);
	}
}

/**
 * Load all ZYRAXON-AI tools from the source directory.
 * Called by the contribution during startup.
 */
export async function loadAllZyraxonTools(logService: ILogService): Promise<void> {
	// Load core tools
	loadToolsFromDir(TOOL_DIR, 'core', logService);

	// Load MCP/ultra tools
	loadToolsFromDir(MCP_TOOL_DIR, 'ultra', logService);

	const tools = getAllZyraxonTools();
	logService.info(`[zyraxon-tools] Total tools loaded: ${tools.length}`);
}
