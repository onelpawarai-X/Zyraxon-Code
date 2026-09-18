/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../../../base/common/lifecycle.js';
import { IInstantiationService } from '../../../../../../platform/instantiation/common/instantiation.js';
import { ILogService } from '../../../../../../platform/log/common/log.js';
import { IStorageService } from '../../../../../../platform/storage/common/storage.js';
import { registerWorkbenchContribution2, WorkbenchPhase } from '../../../../../common/contributions.js';
import { ILanguageModelToolsService } from '../languageModelToolsService.js';
import { ZyraxonToolRegistry, registerZyraxonTool, ZyraxonToolDef } from './zyraxonToolRegistry.js';

// Import tool modules from source
import * as subscriptionStatus from './source/subscriptionStatus.js';

/**
 * Tool definitions that will be registered.
 * Each tool has an execute function matching ZyraxonToolDef.
 */
const TOOLS: ZyraxonToolDef[] = [
	{
		id: 'subscription_status',
		name: 'Subscription Status',
		description: 'Check your current subscription tier and tool access',
		category: 'system',
		parameters: {},
		execute: async (args) => {
			// This will be implemented with proper VS Code API integration
			return { ok: true, data: { tier: 'free', tools: 'Basic tools available' } };
		},
	},
];

// Register all tools
for (const tool of TOOLS) {
	registerZyraxonTool(tool);
}

/**
 * Contribution that registers all ZYRAXON-AI tools with the editor's tool system.
 */
class ZyraxonToolsContribution extends Disposable {
	static readonly ID = 'workbench.contrib.chat.zyraxonTools';

	constructor(
		@ILanguageModelToolsService toolsService: ILanguageModelToolsService,
		@IInstantiationService instantiationService: IInstantiationService,
		@ILogService logService: ILogService,
		@IStorageService storageService: IStorageService,
	) {
		super();

		const registry = new ZyraxonToolRegistry(toolsService, logService, storageService);
		registry.registerAll();

		this._register(registry);
	}
}

registerWorkbenchContribution2(ZyraxonToolsContribution.ID, ZyraxonToolsContribution, WorkbenchPhase.BlockRestore);
