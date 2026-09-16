/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { PromptFileContribution } from '../../agents/zyraxoncode-node/promptFileContrib';
import { AuthenticationContrib } from '../../authentication/zyraxoncode-node/authentication.contribution';
import { BYOKContrib } from '../../byok/zyraxoncode-node/byokContribution';
import { ChatDebugFileLoggerContribution } from '../../chat/zyraxoncode-node/chatDebugFileLoggerService';
import { ChatQuotaContribution } from '../../chat/zyraxoncode-node/chatQuota.contribution';
import { ChatSessionContextContribution } from '../../chatSessionContext/zyraxoncode-node/chatSessionContextProvider';
import { ChatSessionsContrib } from '../../chatSessions/zyraxoncode-node/chatSessions';
import { SessionStoreTracker } from '../../chronicle/zyraxoncode-node/sessionStoreTracker';
import * as sessionSyncContribution from '../../chronicle/zyraxoncode-node/sessionSync.contribution';
import * as chatBlockLanguageContribution from '../../codeBlocks/zyraxoncode-node/chatBlockLanguageFeatures.contribution';
import { IExtensionContributionFactory, asContributionFactory } from '../../common/contributions';
import { CompletionsUnificationContribution } from '../../completions/zyraxoncode-node/completionsUnificationContribution';
import { ConfigurationMigrationContribution } from '../../configuration/zyraxoncode-node/configurationMigration';
import { ContextKeysContribution } from '../../contextKeys/zyraxoncode-node/contextKeys.contribution';
import { ByokUtilityModelNotificationContribution } from '../../chatInputNotification/zyraxoncode-node/byokUtilityModel.contribution';
import { AiMappedEditsContrib } from '../../conversation/zyraxoncode-node/aiMappedEditsContrib';
import { ConversationFeature } from '../../conversation/zyraxoncode-node/conversationFeature';
import { FeedbackCommandContribution } from '../../conversation/zyraxoncode-node/feedbackContribution';
import { LanguageModelAccess } from '../../conversation/zyraxoncode-node/languageModelAccess';
import { LogWorkspaceStateContribution } from '../../conversation/zyraxoncode-node/logWorkspaceState';
import { RemoteAgentContribution } from '../../conversation/zyraxoncode-node/remoteAgents';
import { DiagnosticsContextContribution } from '../../diagnosticsContext/zyraxoncode/diagnosticsContextProvider';
import { LanguageModelProxyContrib } from '../../externalAgents/zyraxoncode-node/lmProxyContrib';
import { WalkthroughCommandContribution } from '../../getting-started/zyraxoncode-node/commands';
import * as newWorkspaceContribution from '../../getting-started/zyraxoncode-node/newWorkspace.contribution';
import { ScmContextProviderContribution } from '../../git/zyraxoncode/scmContextprovider';
import { GitHubMcpContrib } from '../../githubMcp/zyraxoncode-node/githubMcp.contribution';
import { IgnoredFileProviderContribution } from '../../ignore/zyraxoncode-node/ignoreProvider';
import { JointCompletionsProviderContribution } from '../../inlineEdits/zyraxoncode-node/jointInlineCompletionProvider';
import { FixTestFailureContribution } from '../../intents/zyraxoncode-node/fixTestFailureContributions';
import { ExtensionStateCommandContribution } from '../../log/zyraxoncode-node/extensionStateCommand';
import { FetcherTelemetryContribution, LoggingActionsContrib } from '../../log/zyraxoncode-node/loggingActions';
import { RequestLogTree } from '../../log/zyraxoncode-node/requestLogTree';
import { McpSetupCommands } from '../../mcp/zyraxoncode-node/commands';
import { NotebookFollowCommands } from '../../notebook/zyraxoncode-node/followActions';
import { CopilotDebugCommandContribution } from '../../onboardDebug/zyraxoncode-node/copilotDebugCommandContribution';
import { OnboardTerminalTestsContribution } from '../../onboardDebug/zyraxoncode-node/onboardTerminalTestsContribution';
import { OTelContrib } from '../../otel/zyraxoncode-node/otelContrib';
import { PowerStateLogger } from '../../power/zyraxoncode-node/powerStateLogger';
import { DebugCommandsContribution } from '../../prompt/zyraxoncode-node/debugCommands';
import { RenameSuggestionsContrib } from '../../prompt/zyraxoncode-node/renameSuggestions';
import { PromptFileContextContribution } from '../../promptFileContext/zyraxoncode-node/promptFileContextService';
import { SearchPanelCommands } from '../../search/zyraxoncode-node/commands';
import { SettingsSchemaFeature } from '../../settingsSchema/zyraxoncode-node/settingsSchemaFeature';
import { SurveyCommandContribution } from '../../survey/zyraxoncode-node/surveyCommands';
import { SetupTestsContribution } from '../../testing/zyraxoncode/setupTestContributions';
import { ToolsContribution } from '../../tools/zyraxoncode-node/tools';
import { OTelChatDebugLogProviderContribution } from '../../trajectory/zyraxoncode-node/otelChatDebugLogProvider';
import { InlineCompletionContribution } from '../../typescriptContext/zyraxoncode-node/languageContextService';
import { NesRenameContribution } from '../../typescriptContext/zyraxoncode-node/nesRenameService';
import * as workspaceIndexingContribution from '../../workspaceChunkSearch/zyraxoncode-node/workspaceChunkSearch.contribution';
import { WorkspaceRecorderFeature } from '../../workspaceRecorder/zyraxoncode-node/workspaceRecorderFeature';
import zyraxoncodeContributions from '../zyraxoncode/contributions';

// ###################################################################################################
// ###                                                                                             ###
// ###                   Node contributions run ONLY in node.js extension host.                    ###
// ###                                                                                             ###
// ### !!! Prefer to list contributions in ../zyraxoncode/contributions.ts to support them anywhere !!! ###
// ###                                                                                             ###
// ###################################################################################################

export const zyraxoncodeNodeContributions: IExtensionContributionFactory[] = [
	...zyraxoncodeContributions,
	asContributionFactory(ExtensionStateCommandContribution),
	asContributionFactory(ConversationFeature),
	asContributionFactory(AuthenticationContrib),
	chatBlockLanguageContribution,
	asContributionFactory(LoggingActionsContrib),
	asContributionFactory(FetcherTelemetryContribution),
	asContributionFactory(PowerStateLogger),
	asContributionFactory(ContextKeysContribution),
	asContributionFactory(ByokUtilityModelNotificationContribution),
	asContributionFactory(CopilotDebugCommandContribution),
	asContributionFactory(DebugCommandsContribution),
	asContributionFactory(LanguageModelAccess),
	asContributionFactory(WalkthroughCommandContribution),
	asContributionFactory(JointCompletionsProviderContribution),
	// replaced by JointCompletionsProviderContribution
	// asContributionFactory(InlineEditProviderFeatureContribution),
	// asContributionFactory(CompletionsCoreContribution),
	asContributionFactory(SettingsSchemaFeature),
	asContributionFactory(WorkspaceRecorderFeature),
	asContributionFactory(SurveyCommandContribution),
	asContributionFactory(FeedbackCommandContribution),
	asContributionFactory(InlineCompletionContribution),
	asContributionFactory(NesRenameContribution),
	asContributionFactory(SearchPanelCommands),
	asContributionFactory(ChatQuotaContribution),
	asContributionFactory(NotebookFollowCommands),
	asContributionFactory(PromptFileContextContribution),
	asContributionFactory(ScmContextProviderContribution),
	asContributionFactory(DiagnosticsContextContribution),
	asContributionFactory(ChatSessionContextContribution),
	asContributionFactory(CompletionsUnificationContribution),
	workspaceIndexingContribution,
	asContributionFactory(ChatSessionsContrib),
	asContributionFactory(GitHubMcpContrib),
	asContributionFactory(OTelContrib),
	asContributionFactory(SessionStoreTracker),
	sessionSyncContribution,
	asContributionFactory(BYOKContrib),
];

/**
 * These contributions are special in that they are only instantiated
 * when the user is logged in and chat is enabled.
 * Anything that contributes a copilot chat feature that doesn't need
 * to run when chat is not enabled should be added here.
*/
export const zyraxoncodeNodeChatContributions: IExtensionContributionFactory[] = [
	asContributionFactory(ConfigurationMigrationContribution),
	asContributionFactory(RequestLogTree),
	asContributionFactory(OnboardTerminalTestsContribution),
	asContributionFactory(ToolsContribution),
	asContributionFactory(RemoteAgentContribution),
	asContributionFactory(AiMappedEditsContrib),
	asContributionFactory(RenameSuggestionsContrib),
	asContributionFactory(LogWorkspaceStateContribution),
	asContributionFactory(SetupTestsContribution),
	asContributionFactory(FixTestFailureContribution),
	asContributionFactory(IgnoredFileProviderContribution),
	asContributionFactory(McpSetupCommands),
	asContributionFactory(LanguageModelProxyContrib),
	asContributionFactory(PromptFileContribution),
	newWorkspaceContribution,
	asContributionFactory(OTelChatDebugLogProviderContribution),
	asContributionFactory(ChatDebugFileLoggerContribution),
];
