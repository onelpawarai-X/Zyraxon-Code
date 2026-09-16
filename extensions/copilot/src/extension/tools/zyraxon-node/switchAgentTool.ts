/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as zyraxoncode from 'vscode';
import { ConfigKey, IConfigurationService } from '../../../platform/configuration/common/configurationService';
import { IExperimentationService } from '../../../platform/telemetry/common/nullExperimentationService';
import { CancellationToken } from '../../../util/vs/base/common/cancellation';
import { LanguageModelTextPart, LanguageModelToolResult, MarkdownString } from '../../../zyraxoncodeTypes';
import { PlanAgentProvider } from '../../agents/zyraxoncode-node/planAgentProvider';
import { ToolName } from '../common/toolNames';
import { ICopilotTool, ToolRegistry } from '../common/toolsRegistry';

interface ISwitchAgentParams {
	agentName: string;
}

export class SwitchAgentTool implements ICopilotTool<ISwitchAgentParams> {
	public static readonly toolName = ToolName.SwitchAgent;
	public static readonly nonDeferred = true;

	constructor(
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@IExperimentationService private readonly experimentationService: IExperimentationService,
	) { }

	async invoke(options: zyraxoncode.LanguageModelToolInvocationOptions<ISwitchAgentParams>, token: CancellationToken): Promise<zyraxoncode.LanguageModelToolResult> {
		const { agentName } = options.input;

		// Only 'Plan' is supported
		if (agentName !== 'Plan') {
			throw new Error(zyraxoncode.l10n.t('Only "Plan" agent is supported'));
		}

		const exploreEnabled = this.configurationService.getExperimentBasedConfig(ConfigKey.ExploreAgentEnabled, this.experimentationService);
		const searchSubagentEnabled = this.configurationService.getExperimentBasedConfig(ConfigKey.Advanced.SearchSubagentToolEnabled, this.experimentationService);
		const planAgentBody = PlanAgentProvider.buildAgentBody(exploreEnabled, searchSubagentEnabled);

		// Execute command to switch agent
		await zyraxoncode.commands.executeCommand('workbench.action.chat.toggleAgentMode', {
			modeId: agentName,
			sessionResource: options.chatSessionResource
		});

		return new LanguageModelToolResult([
			new LanguageModelTextPart(`Switched to ${agentName} agent. You are now the ${agentName} agent. This tool may no longer be available in the new agent.\n\n${planAgentBody}`)
		]);
	}

	prepareInvocation(options: zyraxoncode.LanguageModelToolInvocationPrepareOptions<ISwitchAgentParams>, token: zyraxoncode.CancellationToken): zyraxoncode.ProviderResult<zyraxoncode.PreparedToolInvocation> {
		const { agentName } = options.input;

		if (agentName !== 'Plan') {
			throw new Error(zyraxoncode.l10n.t('Only "Plan" agent is supported. Received: "{0}"', agentName));
		}

		return {
			invocationMessage: new MarkdownString(zyraxoncode.l10n.t('Switching to {0} agent', agentName)),
			pastTenseMessage: new MarkdownString(zyraxoncode.l10n.t('Switched to {0} agent', agentName))
		};
	}
}

ToolRegistry.registerTool(SwitchAgentTool);
