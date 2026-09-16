/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../../base/common/lifecycle.js';
import * as nls from '../../../../../nls.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { registerWorkbenchContribution2, WorkbenchPhase } from '../../../../common/contributions.js';
import { Extensions as ConfigurationExtensions, IConfigurationRegistry } from '../../../../../platform/configuration/common/configurationRegistry.js';
import { Registry } from '../../../../../platform/registry/common/platform.js';
import { ILanguageModelsService } from '../../common/languageModels.js';
import { ZyraxonBridgeLanguageModelProvider, DEFAULT_ZYRAXON_BRIDGE_URL, ZYRAXON_BRIDGE_URL_SETTING, DEFAULT_ZYRAXON_MODE, ZYRAXON_MODE_SETTING, ZYRAXON_MODES } from './zyraxonBridgeLanguageModelProvider.js';

export const ZYRAXON_BRIDGE_VENDOR = 'opencode';

const configurationRegistry = Registry.as<IConfigurationRegistry>(ConfigurationExtensions.Configuration);
configurationRegistry.registerConfiguration({
	id: 'zyraxon',
	order: 25,
	title: nls.localize('zyraxon.configuration.title', 'Zyraxon'),
	type: 'object',
	properties: {
		[ZYRAXON_BRIDGE_URL_SETTING]: {
			type: 'string',
			default: DEFAULT_ZYRAXON_BRIDGE_URL,
			markdownDescription: nls.localize('zyraxon.bridgeUrl', 'Base URL of the local OpenCode-compatible bridge used to serve models and chat requests. Override this only for a self-hosted bridge.'),
		},
		[ZYRAXON_MODE_SETTING]: {
			type: 'string',
			enum: ZYRAXON_MODES.map(m => m.id),
			enumDescriptions: ZYRAXON_MODES.map(m => nls.localize(m.id, m.description)),
			default: DEFAULT_ZYRAXON_MODE,
			markdownDescription: nls.localize('zyraxon.mode', 'Active Zyraxon AI mode. The mode prompt is injected into every chat request.'),
		},
	},
});

/**
 * Registers the OpenCode-compatible provider so its live model catalogue
 * appears in the editor's chat model picker.
 */
class ZyraxonBridgeContribution extends Disposable {
	static readonly ID = 'workbench.contrib.chat.zyraxonBridge';

	constructor(
		@ILanguageModelsService languageModelsService: ILanguageModelsService,
		@IInstantiationService instantiationService: IInstantiationService,
	) {
		super();

		const provider = this._register(instantiationService.createInstance(ZyraxonBridgeLanguageModelProvider));
		this._register(languageModelsService.registerLanguageModelProvider(ZYRAXON_BRIDGE_VENDOR, provider));

		// Prime the model list shortly after startup and keep refreshing on a
		// modest interval so agent-side credential changes propagate live.
		void provider._refresh();
		const refreshHandle = setInterval(() => {
			void provider._refresh();
		}, 30_000);
		this._register({ dispose: () => clearInterval(refreshHandle) });
	}
}

registerWorkbenchContribution2(ZyraxonBridgeContribution.ID, ZyraxonBridgeContribution, WorkbenchPhase.BlockRestore);
