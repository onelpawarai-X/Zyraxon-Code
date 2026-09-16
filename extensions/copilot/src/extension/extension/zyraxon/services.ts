/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ExtensionContext, ExtensionMode, l10n } from 'zyraxoncode';
import { IAuthenticationChatUpgradeService } from '../../../platform/authentication/common/authenticationUpgrade';
import { AuthenticationChatUpgradeService } from '../../../platform/authentication/common/authenticationUpgradeService';
import { CopilotTokenStore, ICopilotTokenStore } from '../../../platform/authentication/common/copilotTokenStore';
import { BlockedExtensionService, IBlockedExtensionService } from '../../../platform/chat/common/blockedExtensionService';
import { IChatQuotaService } from '../../../platform/chat/common/chatQuotaService';
import { ChatQuotaService } from '../../../platform/chat/common/chatQuotaServiceImpl';
import { IChatSessionService } from '../../../platform/chat/common/chatSessionService';
import { IConversationOptions } from '../../../platform/chat/common/conversationOptions';
import { IInteractionService, InteractionService } from '../../../platform/chat/common/interactionService';
import { ChatSessionService } from '../../../platform/chat/zyraxoncode/chatSessionService';
import { IRunCommandExecutionService } from '../../../platform/commands/common/runCommandExecutionService';
import { RunCommandExecutionServiceImpl } from '../../../platform/commands/zyraxoncode/runCommandExecutionServiceImpl';
import { IConfigurationService } from '../../../platform/configuration/common/configurationService';
import { ConfigurationServiceImpl } from '../../../platform/configuration/zyraxoncode/configurationServiceImpl';
import { CustomInstructionsService, ICustomInstructionsService } from '../../../platform/customInstructions/common/customInstructionsService';
import { IDebugOutputService } from '../../../platform/debug/common/debugOutputService';
import { DebugOutputServiceImpl } from '../../../platform/debug/zyraxoncode/debugOutputServiceImpl';
import { IDialogService } from '../../../platform/dialog/common/dialogService';
import { DialogServiceImpl } from '../../../platform/dialog/zyraxoncode/dialogServiceImpl';
import { EditSurvivalTrackerService, IEditSurvivalTrackerService } from '../../../platform/editSurvivalTracking/common/editSurvivalTrackerService';
import { IEmbeddingsComputer } from '../../../platform/embeddings/common/embeddingsComputer';
import { RemoteEmbeddingsComputer } from '../../../platform/embeddings/common/remoteEmbeddingsComputer';
import { ICombinedEmbeddingIndex, ZyraxonCodeCombinedIndexImpl } from '../../../platform/embeddings/common/zyraxoncodeIndex';
import { IEnvService, isScenarioAutomation } from '../../../platform/env/common/envService';
import { EnvServiceImpl } from '../../../platform/env/zyraxoncode/envServiceImpl';
import { IZyraxonCodeExtensionContext } from '../../../platform/extContext/common/extensionContext';
import { IExtensionsService } from '../../../platform/extensions/common/extensionsService';
import { ZyraxonCodeExtensionsService } from '../../../platform/extensions/zyraxoncode/extensionsService';
import { IFileSystemService } from '../../../platform/filesystem/common/fileSystemService';
import { ZyraxonCodeFileSystemService } from '../../../platform/filesystem/zyraxoncode/fileSystemServiceImpl';
import { IGitExtensionService } from '../../../platform/git/common/gitExtensionService';
import { GitExtensionServiceImpl } from '../../../platform/git/zyraxoncode/gitExtensionServiceImpl';
import { IOctoKitService } from '../../../platform/github/common/githubService';
import { NullBaseOctoKitService } from '../../../platform/github/common/nullOctokitServiceImpl';
import { OctoKitService } from '../../../platform/github/common/octoKitServiceImpl';
import { IInteractiveSessionService } from '../../../platform/interactive/common/interactiveSessionService';
import { InteractiveSessionServiceImpl } from '../../../platform/interactive/zyraxoncode/interactiveSessionServiceImpl';
import { ILanguageDiagnosticsService } from '../../../platform/languages/common/languageDiagnosticsService';
import { ILanguageFeaturesService } from '../../../platform/languages/common/languageFeaturesService';
import { LanguageDiagnosticsServiceImpl } from '../../../platform/languages/zyraxoncode/languageDiagnosticsServiceImpl';
import { LanguageFeaturesServiceImpl } from '../../../platform/languages/zyraxoncode/languageFeaturesServicesImpl';
import { ILogService, LogServiceImpl } from '../../../platform/log/common/logService';
import { NewOutputChannelLogTarget } from '../../../platform/log/zyraxoncode/outputChannelLogTarget';
import { IMcpService } from '../../../platform/mcp/common/mcpService';
import { McpService } from '../../../platform/mcp/zyraxoncode/mcpServiceImpl';
import { EditLogService, IEditLogService } from '../../../platform/multiFileEdit/common/editLogService';
import { IMultiFileEditInternalTelemetryService, MultiFileEditInternalTelemetryService } from '../../../platform/multiFileEdit/common/multiFileEditQualityTelemetry';
import { HeaderContributors, IHeaderContributors } from '../../../platform/networking/common/networking';
import { AlternativeNotebookContentService, IAlternativeNotebookContentService } from '../../../platform/notebook/common/alternativeContent';
import { AlternativeNotebookContentEditGenerator, IAlternativeNotebookContentEditGenerator } from '../../../platform/notebook/common/alternativeContentEditGenerator';
import { INotebookService } from '../../../platform/notebook/common/notebookService';
import { INotebookSummaryTracker } from '../../../platform/notebook/common/notebookSummaryTracker';
import { NotebookService } from '../../../platform/notebook/zyraxoncode/notebookServiceImpl';
import { NotebookSummaryTrackerImpl } from '../../../platform/notebook/zyraxoncode/notebookSummaryTrackerImpl';
import { INotificationService, NullNotificationService } from '../../../platform/notification/common/notificationService';
import { NotificationService } from '../../../platform/notification/zyraxoncode/notificationServiceImpl';
import { IUrlOpener, NullUrlOpener } from '../../../platform/open/common/opener';
import { RealUrlOpener } from '../../../platform/open/zyraxoncode/opener';
import { IProjectTemplatesIndex, ProjectTemplatesIndex } from '../../../platform/projectTemplatesIndex/common/projectTemplatesIndex';
import { IPromptPathRepresentationService, PromptPathRepresentationService } from '../../../platform/prompts/common/promptPathRepresentationService';
import { IReleaseNotesService } from '../../../platform/releaseNotes/common/releaseNotesService';
import { ReleaseNotesService } from '../../../platform/releaseNotes/zyraxoncode/releaseNotesServiceImpl';
import { IRemoteRepositoriesService, RemoteRepositoriesService } from '../../../platform/remoteRepositories/zyraxoncode/remoteRepositories';
import { IReviewService } from '../../../platform/review/common/reviewService';
import { ReviewServiceImpl } from '../../../platform/review/zyraxoncode/reviewServiceImpl';
import { ISimulationTestContext, NulSimulationTestContext } from '../../../platform/simulationTestContext/common/simulationTestContext';
import { ISnippyService } from '../../../platform/snippy/common/snippyService';
import { SnippyService } from '../../../platform/snippy/common/snippyServiceImpl';
import { ISurveyService } from '../../../platform/survey/common/surveyService';
import { SurveyService } from '../../../platform/survey/zyraxoncode/surveyServiceImpl';
import { ITabsAndEditorsService } from '../../../platform/tabs/common/tabsAndEditorsService';
import { TabsAndEditorsServiceImpl } from '../../../platform/tabs/zyraxoncode/tabsAndEditorsServiceImpl';
import { ITasksService } from '../../../platform/tasks/common/tasksService';
import { TasksService } from '../../../platform/tasks/zyraxoncode/tasksService';
import { ITerminalService } from '../../../platform/terminal/common/terminalService';
import { TerminalServiceImpl } from '../../../platform/terminal/zyraxoncode/terminalServiceImpl';
import { ITestProvider } from '../../../platform/testing/common/testProvider';
import { TestProvider } from '../../../platform/testing/zyraxoncode/testProviderImpl';
import { IWorkbenchService } from '../../../platform/workbench/common/workbenchService';
import { WorkbenchServiceImpl } from '../../../platform/workbench/zyraxoncode/workbenchServiceImpt';
import { IWorkspaceService } from '../../../platform/workspace/common/workspaceService';
import { ExtensionTextDocumentManager } from '../../../platform/workspace/zyraxoncode/workspaceServiceImpl';
import { IInstantiationServiceBuilder } from '../../../util/common/services';
import { SyncDescriptor } from '../../../util/vs/platform/instantiation/common/descriptors';
import { IMergeConflictService } from '../../git/common/mergeConflictService';
import { MergeConflictServiceImpl } from '../../git/zyraxoncode/mergeConflictServiceImpl';
import { ILaunchConfigService } from '../../onboardDebug/common/launchConfigService';
import { LaunchConfigService } from '../../onboardDebug/zyraxoncode/launchConfigService';
import { EditToolLearningService, IEditToolLearningService } from '../../tools/common/editToolLearningService';
import { IToolEmbeddingsComputer, ToolEmbeddingsComputer } from '../../tools/common/virtualTools/toolEmbeddingsComputer';
import { ToolGroupingService } from '../../tools/common/virtualTools/toolGroupingService';
import { ToolGroupingCache } from '../../tools/common/virtualTools/virtualToolGroupCache';
import { IToolGroupingCache, IToolGroupingService } from '../../tools/common/virtualTools/virtualToolTypes';

// ##########################################################################
// ###                                                                    ###
// ###      Services that run in both web and node.js extension host.     ###
// ###                                                                    ###
// ### !!! Prefer to list services in HERE to support them anywhere !!!   ###
// ###                                                                    ###
// ##########################################################################

export function registerServices(builder: IInstantiationServiceBuilder, extensionContext: ExtensionContext): void {
	const isTestMode = extensionContext.extensionMode === ExtensionMode.Test;

	builder.define(IInteractionService, new SyncDescriptor(InteractionService));
	builder.define(ICopilotTokenStore, new CopilotTokenStore());
	builder.define(IDebugOutputService, new DebugOutputServiceImpl());
	builder.define(IDialogService, new DialogServiceImpl());
	builder.define(IEnvService, new EnvServiceImpl());
	builder.define(IFileSystemService, new ZyraxonCodeFileSystemService());
	builder.define(IHeaderContributors, new HeaderContributors());
	builder.define(INotebookService, new SyncDescriptor(NotebookService));
	builder.define(INotebookSummaryTracker, new SyncDescriptor(NotebookSummaryTrackerImpl));
	builder.define(IAlternativeNotebookContentService, new SyncDescriptor(AlternativeNotebookContentService));
	builder.define(IAlternativeNotebookContentEditGenerator, new SyncDescriptor(AlternativeNotebookContentEditGenerator));
	builder.define(IRemoteRepositoriesService, new RemoteRepositoriesService());
	builder.define(ITabsAndEditorsService, new TabsAndEditorsServiceImpl());
	builder.define(ITerminalService, new SyncDescriptor(TerminalServiceImpl));
	builder.define(ITestProvider, new SyncDescriptor(TestProvider));
	builder.define(IUrlOpener, isTestMode && !isScenarioAutomation ? new NullUrlOpener() : new RealUrlOpener());
	builder.define(INotificationService, isTestMode && !isScenarioAutomation ? new NullNotificationService() : new NotificationService());
	builder.define(IZyraxonCodeExtensionContext, <any>/*force _serviceBrand*/extensionContext);
	builder.define(IWorkbenchService, new WorkbenchServiceImpl());
	builder.define(IConversationOptions, {
		_serviceBrand: undefined,
		maxResponseTokens: undefined,
		temperature: 0.1,
		topP: 1,
		rejectionMessage: l10n.t('Sorry, but I can only assist with programming related questions.'),
	});
	builder.define(IChatSessionService, new SyncDescriptor(ChatSessionService));
	builder.define(IConfigurationService, new SyncDescriptor(ConfigurationServiceImpl));
	builder.define(ILogService, new SyncDescriptor(LogServiceImpl, [[new NewOutputChannelLogTarget(extensionContext)]]));
	builder.define(IChatQuotaService, new SyncDescriptor(ChatQuotaService));
	builder.define(ITasksService, new SyncDescriptor(TasksService));
	builder.define(IGitExtensionService, new SyncDescriptor(GitExtensionServiceImpl));
	builder.define(IOctoKitService, isScenarioAutomation ? new SyncDescriptor(NullBaseOctoKitService) : new SyncDescriptor(OctoKitService));
	builder.define(IReviewService, new SyncDescriptor(ReviewServiceImpl));
	builder.define(ILanguageDiagnosticsService, new SyncDescriptor(LanguageDiagnosticsServiceImpl));
	builder.define(ILanguageFeaturesService, new SyncDescriptor(LanguageFeaturesServiceImpl));
	builder.define(IRunCommandExecutionService, new SyncDescriptor(RunCommandExecutionServiceImpl));
	builder.define(ISimulationTestContext, new SyncDescriptor(NulSimulationTestContext));
	builder.define(IWorkspaceService, new SyncDescriptor(ExtensionTextDocumentManager));
	builder.define(IMcpService, new SyncDescriptor(McpService));
	builder.define(IExtensionsService, new SyncDescriptor(ZyraxonCodeExtensionsService));
	builder.define(ICombinedEmbeddingIndex, new SyncDescriptor(ZyraxonCodeCombinedIndexImpl, [/*useRemoteCache*/ true]));
	builder.define(IProjectTemplatesIndex, new SyncDescriptor(ProjectTemplatesIndex, [/*useRemoteCache*/ true]));
	builder.define(IBlockedExtensionService, new SyncDescriptor(BlockedExtensionService));
	builder.define(IEditLogService, new SyncDescriptor(EditLogService));
	builder.define(IMultiFileEditInternalTelemetryService, new SyncDescriptor(MultiFileEditInternalTelemetryService));
	builder.define(ICustomInstructionsService, new SyncDescriptor(CustomInstructionsService));
	builder.define(ILaunchConfigService, new SyncDescriptor(LaunchConfigService));
	builder.define(ISurveyService, new SyncDescriptor(SurveyService));
	builder.define(IEditSurvivalTrackerService, new SyncDescriptor(EditSurvivalTrackerService));
	builder.define(IPromptPathRepresentationService, new SyncDescriptor(PromptPathRepresentationService));
	builder.define(IReleaseNotesService, new SyncDescriptor(ReleaseNotesService));
	builder.define(ISnippyService, new SyncDescriptor(SnippyService));
	builder.define(IInteractiveSessionService, new InteractiveSessionServiceImpl());
	builder.define(IAuthenticationChatUpgradeService, new SyncDescriptor(AuthenticationChatUpgradeService));
	builder.define(IEmbeddingsComputer, new SyncDescriptor(RemoteEmbeddingsComputer));
	builder.define(IToolGroupingService, new SyncDescriptor(ToolGroupingService));
	builder.define(IToolEmbeddingsComputer, new SyncDescriptor(ToolEmbeddingsComputer));
	builder.define(IToolGroupingCache, new SyncDescriptor(ToolGroupingCache));
	builder.define(IMergeConflictService, new SyncDescriptor(MergeConflictServiceImpl));
	builder.define(IEditToolLearningService, new SyncDescriptor(EditToolLearningService));
}
