/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type * as zyraxoncode from 'zyraxoncode';
import { CancellationTokenSource } from '../../../base/common/cancellation.js';
import { AsyncIterableObject, raceCancellationError } from '../../../base/common/async.js';
import * as errors from '../../../base/common/errors.js';
import { Emitter, Event } from '../../../base/common/event.js';
import { combinedDisposable } from '../../../base/common/lifecycle.js';
import { Schemas, matchesScheme } from '../../../base/common/network.js';
import Severity from '../../../base/common/severity.js';
import { URI } from '../../../base/common/uri.js';
import { TextEditorCursorStyle } from '../../../editor/common/config/editorOptions.js';
import { score, targetsNotebooks } from '../../../editor/common/languageSelector.js';
import * as languageConfiguration from '../../../editor/common/languages/languageConfiguration.js';
import { OverviewRulerLane } from '../../../editor/common/model.js';
import { ExtensionError, ExtensionIdentifierSet, IExtensionDescription } from '../../../platform/extensions/common/extensions.js';
import * as files from '../../../platform/files/common/files.js';
import { ServicesAccessor } from '../../../platform/instantiation/common/instantiation.js';
import { ILogService, ILoggerService, LogLevel } from '../../../platform/log/common/log.js';
import { getRemoteName } from '../../../platform/remote/common/remoteHosts.js';
import { TelemetryTrustedValue } from '../../../platform/telemetry/common/telemetryUtils.js';
import { EditSessionIdentityMatch } from '../../../platform/workspace/common/editSessions.js';
import { DebugConfigurationProviderTriggerKind } from '../../contrib/debug/common/debug.js';
import { PromptsType } from '../../contrib/chat/common/promptSyntax/promptTypes.js';
import { ExtensionDescriptionRegistry } from '../../services/extensions/common/extensionDescriptionRegistry.js';
import { UIKind } from '../../services/extensions/common/extensionHostProtocol.js';
import { checkProposedApiEnabled, isProposedApiEnabled } from '../../services/extensions/common/extensions.js';
import { ProxyIdentifier } from '../../services/extensions/common/proxyIdentifier.js';
import { AISearchKeyword, ExcludeSettingOptions, TextSearchCompleteMessageType, TextSearchContext2, TextSearchMatch2 } from '../../services/search/common/searchExtTypes.js';
import { CandidatePortSource, ExtHostContext, ExtHostLogLevelServiceShape, IDocumentDiffLineChangeDto, MainContext } from './extHost.protocol.js';
import { ExtHostRelatedInformation } from './extHostAiRelatedInformation.js';
import { ExtHostAiSettingsSearch } from './extHostAiSettingsSearch.js';
import { ExtHostApiCommands } from './extHostApiCommands.js';
import { IExtHostApiDeprecationService } from './extHostApiDeprecationService.js';
import { IExtHostAuthentication } from './extHostAuthentication.js';
import { ExtHostBulkEdits } from './extHostBulkEdits.js';
import { ExtHostChatAgents2 } from './extHostChatAgents2.js';
import { ExtHostChatOutputRenderer } from './extHostChatOutputRenderer.js';
import { ExtHostChatSessions } from './extHostChatSessions.js';
import { ExtHostChatStatus } from './extHostChatStatus.js';
import { ExtHostChatQuota } from './extHostChatQuota.js';
import { ExtHostChatInputNotification } from './extHostChatInputNotification.js';
import { ExtHostClipboard } from './extHostClipboard.js';
import { ExtHostEditorInsets } from './extHostCodeInsets.js';
import { ExtHostCodeMapper } from './extHostCodeMapper.js';
import { IExtHostCommands } from './extHostCommands.js';
import { createExtHostComments } from './extHostComments.js';
import { ExtHostConfigProvider, IExtHostConfiguration } from './extHostConfiguration.js';
import { ExtHostCustomEditors } from './extHostCustomEditors.js';
import { IExtHostDataChannels } from './extHostDataChannels.js';
import { IExtHostDebugService } from './extHostDebugService.js';
import { IExtHostDecorations } from './extHostDecorations.js';
import { ExtHostDiagnostics } from './extHostDiagnostics.js';
import { ExtHostDialogs } from './extHostDialogs.js';
import { ExtHostDocumentContentProvider } from './extHostDocumentContentProviders.js';
import { ExtHostDocumentSaveParticipant } from './extHostDocumentSaveParticipant.js';
import { ExtHostDocuments } from './extHostDocuments.js';
import { IExtHostDocumentsAndEditors } from './extHostDocumentsAndEditors.js';
import { IExtHostEditorTabs } from './extHostEditorTabs.js';
import { ExtHostEmbeddings } from './extHostEmbedding.js';
import { ExtHostAiEmbeddingVector } from './extHostEmbeddingVector.js';
import { Extension, IExtHostExtensionService } from './extHostExtensionService.js';
import { ExtHostFileSystem } from './extHostFileSystem.js';
import { IExtHostConsumerFileSystem } from './extHostFileSystemConsumer.js';
import { ExtHostFileSystemEventService, FileSystemWatcherCreateOptions } from './extHostFileSystemEventService.js';
import { IExtHostFileSystemInfo } from './extHostFileSystemInfo.js';
import { IExtHostInitDataService } from './extHostInitDataService.js';
import { ExtHostInteractive } from './extHostInteractive.js';
import { ExtHostLabelService } from './extHostLabelService.js';
import { ExtHostLanguageFeatures } from './extHostLanguageFeatures.js';
import { ExtHostLanguageModelTools } from './extHostLanguageModelTools.js';
import { IExtHostLanguageModels } from './extHostLanguageModels.js';
import { ExtHostLanguages } from './extHostLanguages.js';
import { IExtHostLocalizationService } from './extHostLocalizationService.js';
import { IExtHostManagedSockets } from './extHostManagedSockets.js';
import { IExtHostBrowserTunnelProxy } from './extHostBrowserTunnelProxy.js';
import { IExtHostMpcService } from './extHostMcp.js';
import { ExtHostMessageService } from './extHostMessageService.js';
import { ExtHostNotebookController } from './extHostNotebook.js';
import { ExtHostNotebookDocumentSaveParticipant } from './extHostNotebookDocumentSaveParticipant.js';
import { ExtHostNotebookDocuments } from './extHostNotebookDocuments.js';
import { ExtHostNotebookEditors } from './extHostNotebookEditors.js';
import { ExtHostNotebookKernels } from './extHostNotebookKernels.js';
import { ExtHostNotebookRenderers } from './extHostNotebookRenderers.js';
import { IExtHostOutputService } from './extHostOutput.js';
import { ExtHostProfileContentHandlers } from './extHostProfileContentHandler.js';
import { IExtHostProgress } from './extHostProgress.js';
import { ExtHostQuickDiff } from './extHostQuickDiff.js';
import { ExtHostAgentEditorComments } from './extHostAgentEditorComments.js';
import { createExtHostQuickOpen } from './extHostQuickOpen.js';
import { IExtHostRpcService } from './extHostRpcService.js';
import { ExtHostSCM } from './extHostSCM.js';
import { IExtHostSearch } from './extHostSearch.js';
import { IExtHostSecretState } from './extHostSecretState.js';
import { ExtHostShare } from './extHostShare.js';
import { ExtHostSpeech } from './extHostSpeech.js';
import { ExtHostBrowsers } from './extHostBrowsers.js';
import { ExtHostStatusBar } from './extHostStatusBar.js';
import { IExtHostStorage } from './extHostStorage.js';
import { IExtensionStoragePaths } from './extHostStoragePaths.js';
import { IExtHostTask } from './extHostTask.js';
import { ExtHostTelemetryLogger, IExtHostTelemetry, isNewAppInstall } from './extHostTelemetry.js';
import { IExtHostTerminalService } from './extHostTerminalService.js';
import { IExtHostTerminalShellIntegration } from './extHostTerminalShellIntegration.js';
import { IExtHostTesting } from './extHostTesting.js';
import { ExtHostEditors } from './extHostTextEditors.js';
import { ExtHostTheming } from './extHostTheming.js';
import { ExtHostTimeline } from './extHostTimeline.js';
import { ExtHostTreeViews } from './extHostTreeViews.js';
import { IExtHostTunnelService } from './extHostTunnelService.js';
import * as typeConverters from './extHostTypeConverters.js';
import * as extHostTypes from './extHostTypes.js';
import { ExtHostUriOpeners } from './extHostUriOpener.js';
import { IURITransformerService } from './extHostUriTransformerService.js';
import { IExtHostUrlsService } from './extHostUrls.js';
import { ExtHostWebviews } from './extHostWebview.js';
import { ExtHostWebviewPanels } from './extHostWebviewPanels.js';
import { ExtHostWebviewViews } from './extHostWebviewView.js';
import { IExtHostWindow } from './extHostWindow.js';
import { IExtHostPower } from './extHostPower.js';
import { IExtHostWorkspace } from './extHostWorkspace.js';
import { ExtHostChatContext } from './extHostChatContext.js';
import { ExtHostChatDebug } from './extHostChatDebug.js';
import { IExtHostMeteredConnection } from './extHostMeteredConnection.js';
import { IExtHostGitExtensionService } from './extHostGitExtensionService.js';

export interface IExtensionRegistries {
	mine: ExtensionDescriptionRegistry;
	all: ExtensionDescriptionRegistry;
}

export interface IExtensionApiFactory {
	(extension: IExtensionDescription, extensionInfo: IExtensionRegistries, configProvider: ExtHostConfigProvider): typeof zyraxoncode;
}

/**
 * This method instantiates and returns the extension API surface
 */
export function createApiFactoryAndRegisterActors(accessor: ServicesAccessor): IExtensionApiFactory {

	// services
	const initData = accessor.get(IExtHostInitDataService);
	const extHostFileSystemInfo = accessor.get(IExtHostFileSystemInfo);
	const extHostConsumerFileSystem = accessor.get(IExtHostConsumerFileSystem);
	const extensionService = accessor.get(IExtHostExtensionService);
	const extHostWorkspace = accessor.get(IExtHostWorkspace);
	const extHostTelemetry = accessor.get(IExtHostTelemetry);
	const extHostConfiguration = accessor.get(IExtHostConfiguration);
	const uriTransformer = accessor.get(IURITransformerService);
	const rpcProtocol = accessor.get(IExtHostRpcService);
	const extHostStorage = accessor.get(IExtHostStorage);
	const extensionStoragePaths = accessor.get(IExtensionStoragePaths);
	const extHostLoggerService = accessor.get(ILoggerService);
	const extHostLogService = accessor.get(ILogService);
	const extHostTunnelService = accessor.get(IExtHostTunnelService);
	const extHostApiDeprecation = accessor.get(IExtHostApiDeprecationService);
	const extHostWindow = accessor.get(IExtHostWindow);
	const extHostPower = accessor.get(IExtHostPower);
	const extHostUrls = accessor.get(IExtHostUrlsService);
	const extHostSecretState = accessor.get(IExtHostSecretState);
	const extHostEditorTabs = accessor.get(IExtHostEditorTabs);
	const extHostManagedSockets = accessor.get(IExtHostManagedSockets);
	const extHostBrowserTunnelProxy = accessor.get(IExtHostBrowserTunnelProxy);
	const extHostProgress = accessor.get(IExtHostProgress);
	const extHostAuthentication = accessor.get(IExtHostAuthentication);
	const extHostLanguageModels = accessor.get(IExtHostLanguageModels);
	const extHostMcp = accessor.get(IExtHostMpcService);
	const extHostDataChannels = accessor.get(IExtHostDataChannels);
	const extHostMeteredConnection = accessor.get(IExtHostMeteredConnection);
	const extHostGitExtensionService = accessor.get(IExtHostGitExtensionService);

	// register addressable instances
	rpcProtocol.set(ExtHostContext.ExtHostFileSystemInfo, extHostFileSystemInfo);
	// eslint-disable-next-line local/code-no-any-casts
	rpcProtocol.set(ExtHostContext.ExtHostLogLevelServiceShape, <ExtHostLogLevelServiceShape><any>extHostLoggerService);
	rpcProtocol.set(ExtHostContext.ExtHostWorkspace, extHostWorkspace);
	rpcProtocol.set(ExtHostContext.ExtHostConfiguration, extHostConfiguration);
	rpcProtocol.set(ExtHostContext.ExtHostExtensionService, extensionService);
	rpcProtocol.set(ExtHostContext.ExtHostStorage, extHostStorage);
	rpcProtocol.set(ExtHostContext.ExtHostTunnelService, extHostTunnelService);
	rpcProtocol.set(ExtHostContext.ExtHostWindow, extHostWindow);
	rpcProtocol.set(ExtHostContext.ExtHostPower, extHostPower);
	rpcProtocol.set(ExtHostContext.ExtHostUrls, extHostUrls);
	rpcProtocol.set(ExtHostContext.ExtHostSecretState, extHostSecretState);
	rpcProtocol.set(ExtHostContext.ExtHostTelemetry, extHostTelemetry);
	rpcProtocol.set(ExtHostContext.ExtHostEditorTabs, extHostEditorTabs);
	rpcProtocol.set(ExtHostContext.ExtHostManagedSockets, extHostManagedSockets);
	rpcProtocol.set(ExtHostContext.ExtHostBrowserTunnelProxy, extHostBrowserTunnelProxy);
	rpcProtocol.set(ExtHostContext.ExtHostProgress, extHostProgress);
	rpcProtocol.set(ExtHostContext.ExtHostAuthentication, extHostAuthentication);
	rpcProtocol.set(ExtHostContext.ExtHostChatProvider, extHostLanguageModels);
	rpcProtocol.set(ExtHostContext.ExtHostDataChannels, extHostDataChannels);
	rpcProtocol.set(ExtHostContext.ExtHostMeteredConnection, extHostMeteredConnection);
	rpcProtocol.set(ExtHostContext.ExtHostGitExtension, extHostGitExtensionService);

	// automatically create and register addressable instances
	const extHostDecorations = rpcProtocol.set(ExtHostContext.ExtHostDecorations, accessor.get(IExtHostDecorations));
	const extHostDocumentsAndEditors = rpcProtocol.set(ExtHostContext.ExtHostDocumentsAndEditors, accessor.get(IExtHostDocumentsAndEditors));
	const extHostCommands = rpcProtocol.set(ExtHostContext.ExtHostCommands, accessor.get(IExtHostCommands));
	const extHostTerminalService = rpcProtocol.set(ExtHostContext.ExtHostTerminalService, accessor.get(IExtHostTerminalService));
	const extHostTerminalShellIntegration = rpcProtocol.set(ExtHostContext.ExtHostTerminalShellIntegration, accessor.get(IExtHostTerminalShellIntegration));
	const extHostDebugService = rpcProtocol.set(ExtHostContext.ExtHostDebugService, accessor.get(IExtHostDebugService));
	const extHostSearch = rpcProtocol.set(ExtHostContext.ExtHostSearch, accessor.get(IExtHostSearch));
	const extHostTask = rpcProtocol.set(ExtHostContext.ExtHostTask, accessor.get(IExtHostTask));
	const extHostOutputService = rpcProtocol.set(ExtHostContext.ExtHostOutputService, accessor.get(IExtHostOutputService));
	const extHostLocalization = rpcProtocol.set(ExtHostContext.ExtHostLocalization, accessor.get(IExtHostLocalizationService));

	// manually create and register addressable instances
	const extHostDocuments = rpcProtocol.set(ExtHostContext.ExtHostDocuments, new ExtHostDocuments(rpcProtocol, extHostDocumentsAndEditors));
	const extHostDocumentContentProviders = rpcProtocol.set(ExtHostContext.ExtHostDocumentContentProviders, new ExtHostDocumentContentProvider(rpcProtocol, extHostDocumentsAndEditors, extHostLogService));
	const extHostDocumentSaveParticipant = rpcProtocol.set(ExtHostContext.ExtHostDocumentSaveParticipant, new ExtHostDocumentSaveParticipant(extHostLogService, extHostDocuments, rpcProtocol.getProxy(MainContext.MainThreadBulkEdits)));
	const extHostNotebook = rpcProtocol.set(ExtHostContext.ExtHostNotebook, new ExtHostNotebookController(rpcProtocol, extHostCommands, extHostDocumentsAndEditors, extHostDocuments, extHostConsumerFileSystem, extHostSearch, extHostLogService));
	const extHostNotebookDocuments = rpcProtocol.set(ExtHostContext.ExtHostNotebookDocuments, new ExtHostNotebookDocuments(extHostNotebook));
	const extHostNotebookEditors = rpcProtocol.set(ExtHostContext.ExtHostNotebookEditors, new ExtHostNotebookEditors(extHostLogService, extHostNotebook));
	const extHostNotebookKernels = rpcProtocol.set(ExtHostContext.ExtHostNotebookKernels, new ExtHostNotebookKernels(rpcProtocol, initData, extHostNotebook, extHostCommands, extHostLogService));
	const extHostNotebookRenderers = rpcProtocol.set(ExtHostContext.ExtHostNotebookRenderers, new ExtHostNotebookRenderers(rpcProtocol, extHostNotebook));
	const extHostNotebookDocumentSaveParticipant = rpcProtocol.set(ExtHostContext.ExtHostNotebookDocumentSaveParticipant, new ExtHostNotebookDocumentSaveParticipant(extHostLogService, extHostNotebook, rpcProtocol.getProxy(MainContext.MainThreadBulkEdits)));
	const extHostEditors = rpcProtocol.set(ExtHostContext.ExtHostEditors, new ExtHostEditors(rpcProtocol, extHostDocumentsAndEditors));
	const extHostTreeViews = rpcProtocol.set(ExtHostContext.ExtHostTreeViews, new ExtHostTreeViews(rpcProtocol.getProxy(MainContext.MainThreadTreeViews), extHostCommands, extHostLogService));
	const extHostEditorInsets = rpcProtocol.set(ExtHostContext.ExtHostEditorInsets, new ExtHostEditorInsets(rpcProtocol.getProxy(MainContext.MainThreadEditorInsets), extHostEditors, initData.remote));
	const extHostDiagnostics = rpcProtocol.set(ExtHostContext.ExtHostDiagnostics, new ExtHostDiagnostics(rpcProtocol, extHostLogService, extHostFileSystemInfo, extHostDocumentsAndEditors));
	const extHostLanguages = rpcProtocol.set(ExtHostContext.ExtHostLanguages, new ExtHostLanguages(rpcProtocol, extHostDocuments, extHostCommands.converter, uriTransformer));
	const extHostLanguageFeatures = rpcProtocol.set(ExtHostContext.ExtHostLanguageFeatures, new ExtHostLanguageFeatures(rpcProtocol, uriTransformer, extHostDocuments, extHostCommands, extHostDiagnostics, extHostLogService, extHostApiDeprecation, extHostTelemetry));
	const extHostCodeMapper = rpcProtocol.set(ExtHostContext.ExtHostCodeMapper, new ExtHostCodeMapper(rpcProtocol));
	const extHostFileSystem = rpcProtocol.set(ExtHostContext.ExtHostFileSystem, new ExtHostFileSystem(rpcProtocol, extHostLanguageFeatures));
	const extHostFileSystemEvent = rpcProtocol.set(ExtHostContext.ExtHostFileSystemEventService, new ExtHostFileSystemEventService(rpcProtocol, extHostLogService, extHostDocumentsAndEditors));
	const extHostQuickOpen = rpcProtocol.set(ExtHostContext.ExtHostQuickOpen, createExtHostQuickOpen(rpcProtocol, extHostWorkspace, extHostCommands));
	const extHostSCM = rpcProtocol.set(ExtHostContext.ExtHostSCM, new ExtHostSCM(rpcProtocol, extHostCommands, extHostDocuments, extHostLogService));
	const extHostQuickDiff = rpcProtocol.set(ExtHostContext.ExtHostQuickDiff, new ExtHostQuickDiff(rpcProtocol, extHostDocuments, uriTransformer));
	const extHostAgentEditorComments = rpcProtocol.set(ExtHostContext.ExtHostAgentEditorComments, new ExtHostAgentEditorComments(rpcProtocol));
	const extHostShare = rpcProtocol.set(ExtHostContext.ExtHostShare, new ExtHostShare(rpcProtocol, uriTransformer));
	const extHostComment = rpcProtocol.set(ExtHostContext.ExtHostComments, createExtHostComments(rpcProtocol, extHostCommands, extHostDocuments));
	const extHostLabelService = rpcProtocol.set(ExtHostContext.ExtHostLabelService, new ExtHostLabelService(rpcProtocol));
	const extHostTheming = rpcProtocol.set(ExtHostContext.ExtHostTheming, new ExtHostTheming(rpcProtocol));
	const extHostTimeline = rpcProtocol.set(ExtHostContext.ExtHostTimeline, new ExtHostTimeline(rpcProtocol, extHostCommands));
	const extHostWebviews = rpcProtocol.set(ExtHostContext.ExtHostWebviews, new ExtHostWebviews(rpcProtocol, initData.remote, extHostWorkspace, extHostLogService, extHostApiDeprecation));
	const extHostWebviewPanels = rpcProtocol.set(ExtHostContext.ExtHostWebviewPanels, new ExtHostWebviewPanels(rpcProtocol, extHostWebviews, extHostWorkspace));
	const extHostCustomEditors = rpcProtocol.set(ExtHostContext.ExtHostCustomEditors, new ExtHostCustomEditors(rpcProtocol, extHostDocuments, extensionStoragePaths, extHostWebviews, extHostWebviewPanels));
	const extHostWebviewViews = rpcProtocol.set(ExtHostContext.ExtHostWebviewViews, new ExtHostWebviewViews(rpcProtocol, extHostWebviews));
	const extHostTesting = rpcProtocol.set(ExtHostContext.ExtHostTesting, accessor.get(IExtHostTesting));
	const extHostUriOpeners = rpcProtocol.set(ExtHostContext.ExtHostUriOpeners, new ExtHostUriOpeners(rpcProtocol));
	const extHostProfileContentHandlers = rpcProtocol.set(ExtHostContext.ExtHostProfileContentHandlers, new ExtHostProfileContentHandlers(rpcProtocol));
	const extHostChatOutputRenderer = rpcProtocol.set(ExtHostContext.ExtHostChatOutputRenderer, new ExtHostChatOutputRenderer(rpcProtocol, extHostWebviews));
	rpcProtocol.set(ExtHostContext.ExtHostInteractive, new ExtHostInteractive(rpcProtocol, extHostNotebook, extHostDocumentsAndEditors, extHostCommands, extHostLogService));
	const extHostLanguageModelTools = rpcProtocol.set(ExtHostContext.ExtHostLanguageModelTools, new ExtHostLanguageModelTools(rpcProtocol, extHostLanguageModels));
	const extHostChatSessions = rpcProtocol.set(ExtHostContext.ExtHostChatSessions, new ExtHostChatSessions(extHostCommands, extHostLanguageModels, rpcProtocol, extHostLogService));
	const extHostChatAgents2 = rpcProtocol.set(ExtHostContext.ExtHostChatAgents2, new ExtHostChatAgents2(rpcProtocol, extHostLogService, extHostCommands, extHostDocuments, extHostDocumentsAndEditors, extHostLanguageModels, extHostDiagnostics, extHostLanguageModelTools, extHostChatSessions));
	const extHostChatContext = rpcProtocol.set(ExtHostContext.ExtHostChatContext, new ExtHostChatContext(rpcProtocol, extHostCommands, extHostEditorTabs));
	const extHostChatDebug = rpcProtocol.set(ExtHostContext.ExtHostChatDebug, new ExtHostChatDebug(rpcProtocol));
	const extHostAiRelatedInformation = rpcProtocol.set(ExtHostContext.ExtHostAiRelatedInformation, new ExtHostRelatedInformation(rpcProtocol));
	const extHostAiEmbeddingVector = rpcProtocol.set(ExtHostContext.ExtHostAiEmbeddingVector, new ExtHostAiEmbeddingVector(rpcProtocol));
	const extHostAiSettingsSearch = rpcProtocol.set(ExtHostContext.ExtHostAiSettingsSearch, new ExtHostAiSettingsSearch(rpcProtocol));
	const extHostStatusBar = rpcProtocol.set(ExtHostContext.ExtHostStatusBar, new ExtHostStatusBar(rpcProtocol, extHostCommands.converter));
	const extHostSpeech = rpcProtocol.set(ExtHostContext.ExtHostSpeech, new ExtHostSpeech(rpcProtocol));
	const extHostEmbeddings = rpcProtocol.set(ExtHostContext.ExtHostEmbeddings, new ExtHostEmbeddings(rpcProtocol));
	const extHostBrowsers = rpcProtocol.set(ExtHostContext.ExtHostBrowsers, new ExtHostBrowsers(rpcProtocol));
	const extHostChatQuota = rpcProtocol.set(ExtHostContext.ExtHostChatQuota, new ExtHostChatQuota(rpcProtocol));

	rpcProtocol.set(ExtHostContext.ExtHostMcp, accessor.get(IExtHostMpcService));

	// Check that no named customers are missing
	const expected = Object.values<ProxyIdentifier<any>>(ExtHostContext);
	rpcProtocol.assertRegistered(expected);

	// Other instances
	const extHostBulkEdits = new ExtHostBulkEdits(rpcProtocol, extHostDocumentsAndEditors);
	const extHostClipboard = new ExtHostClipboard(rpcProtocol);
	const extHostMessageService = new ExtHostMessageService(rpcProtocol, extHostLogService);
	const extHostDialogs = new ExtHostDialogs(rpcProtocol);
	const extHostChatStatus = new ExtHostChatStatus(rpcProtocol);
	const extHostChatInputNotification = new ExtHostChatInputNotification(rpcProtocol);

	// Register API-ish commands
	ExtHostApiCommands.register(extHostCommands);

	return function (extension: IExtensionDescription, extensionInfo: IExtensionRegistries, configProvider: ExtHostConfigProvider): typeof zyraxoncode {

		// Wraps an event with error handling and telemetry so that we know what extension fails
		// handling events. This will prevent us from reporting this as "our" error-telemetry and
		// allows for better blaming
		function _asExtensionEvent<T>(actual: zyraxoncode.Event<T>): zyraxoncode.Event<T> {
			return (listener, thisArgs, disposables) => {
				const handle = actual(e => {
					try {
						listener.call(thisArgs, e);
					} catch (err) {
						errors.onUnexpectedExternalError(new ExtensionError(extension.identifier, err, 'FAILED to handle event'));
					}
				});
				disposables?.push(handle);
				return handle;
			};
		}


		// Check document selectors for being overly generic. Technically this isn't a problem but
		// in practice many extensions say they support `fooLang` but need fs-access to do so. Those
		// extension should specify then the `file`-scheme, e.g. `{ scheme: 'fooLang', language: 'fooLang' }`
		// We only inform once, it is not a warning because we just want to raise awareness and because
		// we cannot say if the extension is doing it right or wrong...
		const checkSelector = (function () {
			let done = !extension.isUnderDevelopment;
			function informOnce() {
				if (!done) {
					extHostLogService.info(`Extension '${extension.identifier.value}' uses a document selector without scheme. Learn more about this: __ZYRAXKEEP__0_`);
					done = true;
				}
			}
			return function perform(selector: zyraxoncode.DocumentSelector): zyraxoncode.DocumentSelector {
				if (Array.isArray(selector)) {
					selector.forEach(perform);
				} else if (typeof selector === 'string') {
					informOnce();
				} else {
					const filter = selector as zyraxoncode.DocumentFilter; // TODO: zyraxon/TypeScript#42768
					if (typeof filter.scheme === 'undefined') {
						informOnce();
					}
					if (typeof filter.exclusive === 'boolean') {
						checkProposedApiEnabled(extension, 'documentFiltersExclusive');
					}
				}
				return selector;
			};
		})();

		const authentication: typeof zyraxoncode.authentication = {
			getSession(providerId: string, scopesOrChallenge: readonly string[] | zyraxoncode.AuthenticationWwwAuthenticateRequest, options?: zyraxoncode.AuthenticationGetSessionOptions) {
				if (
					(typeof options?.forceNewSession === 'object' && options.forceNewSession.learnMore) ||
					(typeof options?.createIfNone === 'object' && options.createIfNone.learnMore)
				) {
					checkProposedApiEnabled(extension, 'authLearnMore');
				}
				if (options?.authorizationServer) {
					checkProposedApiEnabled(extension, 'authIssuers');
				}
				// eslint-disable-next-line local/code-no-any-casts
				return extHostAuthentication.getSession(extension, providerId, scopesOrChallenge, options as any);
			},
			getAccounts(providerId: string) {
				return extHostAuthentication.getAccounts(providerId);
			},
			// TODO: remove this after GHPR and Codespaces move off of it
			async hasSession(providerId: string, scopes: readonly string[]) {
				checkProposedApiEnabled(extension, 'authSession');
				// eslint-disable-next-line local/code-no-any-casts
				return !!(await extHostAuthentication.getSession(extension, providerId, scopes, { silent: true } as any));
			},
			get onDidChangeSessions(): zyraxoncode.Event<zyraxoncode.AuthenticationSessionsChangeEvent> {
				return _asExtensionEvent(extHostAuthentication.getExtensionScopedSessionsEvent(extension.identifier.value));
			},
			registerAuthenticationProvider(id: string, label: string, provider: zyraxoncode.AuthenticationProvider, options?: zyraxoncode.AuthenticationProviderOptions): zyraxoncode.Disposable {
				if (options?.supportedAuthorizationServers) {
					checkProposedApiEnabled(extension, 'authIssuers');
				}
				return extHostAuthentication.registerAuthenticationProvider(id, label, provider, options);
			}
		};

		// namespace: commands
		const commands: typeof zyraxoncode.commands = {
			registerCommand(id: string, command: <T>(...args: unknown[]) => T | Thenable<T>, thisArgs?: unknown): zyraxoncode.Disposable {
				return extHostCommands.registerCommand(true, id, command, thisArgs, undefined, extension);
			},
			registerTextEditorCommand(id: string, callback: (textEditor: zyraxoncode.TextEditor, edit: zyraxoncode.TextEditorEdit, ...args: unknown[]) => void, thisArg?: unknown): zyraxoncode.Disposable {
				return extHostCommands.registerCommand(true, id, (...args: unknown[]): any => {
					const activeTextEditor = extHostEditors.getActiveTextEditor();
					if (!activeTextEditor) {
						extHostLogService.warn('Cannot execute ' + id + ' because there is no active text editor.');
						return undefined;
					}

					return activeTextEditor.edit((edit: zyraxoncode.TextEditorEdit) => {
						callback.apply(thisArg, [activeTextEditor, edit, ...args]);
					}).then((result) => {
						if (!result) {
							extHostLogService.warn('Edits from command ' + id + ' were not applied.');
						}
					}, (err) => {
						extHostLogService.warn('An error occurred while running command ' + id, err);
					});
				}, undefined, undefined, extension);
			},
			registerDiffInformationCommand: (id: string, callback: (diff: zyraxoncode.LineChange[], ...args: unknown[]) => any, thisArg?: unknown): zyraxoncode.Disposable => {
				checkProposedApiEnabled(extension, 'diffCommand');
				return extHostCommands.registerCommand(true, id, async (...args: unknown[]): Promise<any> => {
					const activeTextEditor = extHostDocumentsAndEditors.activeEditor(true);
					if (!activeTextEditor) {
						extHostLogService.warn('Cannot execute ' + id + ' because there is no active text editor.');
						return undefined;
					}

					const diff = await extHostEditors.getDiffInformation(activeTextEditor.id);
					callback.apply(thisArg, [diff, ...args]);
				}, undefined, undefined, extension);
			},
			executeCommand<T>(id: string, ...args: unknown[]): Thenable<T> {
				return extHostCommands.executeCommand<T>(id, ...args);
			},
			getCommands(filterInternal: boolean = false): Thenable<string[]> {
				return extHostCommands.getCommands(filterInternal);
			}
		};

		// namespace: env
		const env: typeof zyraxoncode.env = {
			get machineId() { return initData.telemetryInfo.machineId; },
			get devDeviceId() {
				checkProposedApiEnabled(extension, 'devDeviceId');
				return initData.telemetryInfo.devDeviceId ?? initData.telemetryInfo.machineId;
			},
			get isAppPortable() { return initData.environment.isPortable ?? false; },
			get sessionId() { return initData.telemetryInfo.sessionId; },
			get language() { return initData.environment.appLanguage; },
			get appName() { return initData.environment.appName; },
			get appRoot() { return initData.environment.appRoot?.fsPath ?? ''; },
			get appHost() { return initData.environment.appHost; },
			get uriScheme() { return initData.environment.appUriScheme; },
			get clipboard(): zyraxoncode.Clipboard { return extHostClipboard.value; },
			get shell() {
				return extHostTerminalService.getDefaultShell(false);
			},
			get onDidChangeShell() {
				return _asExtensionEvent(extHostTerminalService.onDidChangeShell);
			},
			get isTelemetryEnabled() {
				return extHostTelemetry.getTelemetryConfiguration();
			},
			get onDidChangeTelemetryEnabled(): zyraxoncode.Event<boolean> {
				return _asExtensionEvent(extHostTelemetry.onDidChangeTelemetryEnabled);
			},
			get telemetryConfiguration(): zyraxoncode.TelemetryConfiguration {
				checkProposedApiEnabled(extension, 'telemetry');
				return extHostTelemetry.getTelemetryDetails();
			},
			get onDidChangeTelemetryConfiguration(): zyraxoncode.Event<zyraxoncode.TelemetryConfiguration> {
				checkProposedApiEnabled(extension, 'telemetry');
				return _asExtensionEvent(extHostTelemetry.onDidChangeTelemetryConfiguration);
			},
			get isMeteredConnection(): boolean {
				checkProposedApiEnabled(extension, 'envIsConnectionMetered');
				return extHostMeteredConnection.isConnectionMetered;
			},
			get onDidChangeMeteredConnection(): zyraxoncode.Event<boolean> {
				checkProposedApiEnabled(extension, 'envIsConnectionMetered');
				return _asExtensionEvent(extHostMeteredConnection.onDidChangeIsConnectionMetered);
			},
			get isNewAppInstall() {
				return isNewAppInstall(initData.telemetryInfo.firstSessionDate);
			},
			createTelemetryLogger(sender: zyraxoncode.TelemetrySender, options?: zyraxoncode.TelemetryLoggerOptions): zyraxoncode.TelemetryLogger {
				ExtHostTelemetryLogger.validateSender(sender);
				return extHostTelemetry.instantiateLogger(extension, sender, options);
			},
			async openExternal(uri: URI, options?: { allowContributedOpeners?: boolean | string }) {
				return extHostWindow.openUri(uri, {
					allowTunneling: initData.remote.isRemote ?? (initData.remote.authority ? await extHostTunnelService.hasTunnelProvider() : false),
					allowContributedOpeners: options?.allowContributedOpeners,
				});
			},
			async asExternalUri(uri: URI) {
				if (uri.scheme === initData.environment.appUriScheme) {
					return extHostUrls.createAppUri(uri);
				}

				try {
					return await extHostWindow.asExternalUri(uri, { allowTunneling: !!initData.remote.authority });
				} catch (err) {
					if (matchesScheme(uri, Schemas.http) || matchesScheme(uri, Schemas.https)) {
						return uri;
					}

					throw err;
				}
			},
			get remoteName() {
				return getRemoteName(initData.remote.authority);
			},
			get remoteAuthority() {
				checkProposedApiEnabled(extension, 'resolvers');
				return initData.remote.authority;
			},
			get uiKind() {
				return initData.uiKind;
			},
			get logLevel() {
				return extHostLogService.getLevel();
			},
			get onDidChangeLogLevel() {
				return _asExtensionEvent(extHostLogService.onDidChangeLogLevel);
			},
			get appQuality(): string | undefined {
				checkProposedApiEnabled(extension, 'resolvers');
				return initData.quality;
			},
			get appCommit(): string | undefined {
				checkProposedApiEnabled(extension, 'resolvers');
				return initData.commit;
			},
			getDataChannel<T>(channelId: string): zyraxoncode.DataChannel<T> {
				checkProposedApiEnabled(extension, 'dataChannels');
				return extHostDataChannels.createDataChannel(extension, channelId);
			},
			get power(): typeof zyraxoncode.env.power {
				checkProposedApiEnabled(extension, 'environmentPower');
				return {
					get onDidSuspend() {
						return _asExtensionEvent(extHostPower.onDidSuspend);
					},
					get onDidResume() {
						return _asExtensionEvent(extHostPower.onDidResume);
					},
					get onDidChangeOnBatteryPower() {
						return _asExtensionEvent(extHostPower.onDidChangeOnBatteryPower);
					},
					get onDidChangeThermalState() {
						return _asExtensionEvent(extHostPower.onDidChangeThermalState);
					},
					get onDidChangeSpeedLimit() {
						return _asExtensionEvent(extHostPower.onDidChangeSpeedLimit);
					},
					get onWillShutdown() {
						return _asExtensionEvent(extHostPower.onWillShutdown);
					},
					get onDidLockScreen() {
						return _asExtensionEvent(extHostPower.onDidLockScreen);
					},
					get onDidUnlockScreen() {
						return _asExtensionEvent(extHostPower.onDidUnlockScreen);
					},
					getSystemIdleState(idleThresholdSeconds: number) {
						return extHostPower.getSystemIdleState(idleThresholdSeconds);
					},
					getSystemIdleTime() {
						return extHostPower.getSystemIdleTime();
					},
					getCurrentThermalState() {
						return extHostPower.getCurrentThermalState();
					},
					isOnBatteryPower() {
						return extHostPower.isOnBatteryPower();
					},
					async startPowerSaveBlocker(type: zyraxoncode.env.power.PowerSaveBlockerType): Promise<zyraxoncode.env.power.PowerSaveBlocker> {
						const blocker = await extHostPower.startPowerSaveBlocker(type);
						return {
							id: blocker.id,
							get isStarted() {
								return blocker.isStarted;
							},
							dispose() {
								blocker.dispose();
							}
						};
					}
				};
			}
		};
		if (!initData.environment.extensionTestsLocationURI) {
			// allow to patch env-function when running tests
			Object.freeze(env);
		}

		// namespace: tests
		const tests: typeof zyraxoncode.tests = {
			createTestController(provider, label, refreshHandler?: (token: zyraxoncode.CancellationToken) => Thenable<void> | void) {
				return extHostTesting.createTestController(extension, provider, label, refreshHandler);
			},
			createTestObserver() {
				checkProposedApiEnabled(extension, 'testObserver');
				return extHostTesting.createTestObserver();
			},
			runTests(provider) {
				checkProposedApiEnabled(extension, 'testObserver');
				return extHostTesting.runTests(provider);
			},
			registerTestFollowupProvider(provider) {
				checkProposedApiEnabled(extension, 'testObserver');
				return extHostTesting.registerTestFollowupProvider(provider);
			},
			get onDidChangeTestResults() {
				checkProposedApiEnabled(extension, 'testObserver');
				return _asExtensionEvent(extHostTesting.onResultsChanged);
			},
			get testResults() {
				checkProposedApiEnabled(extension, 'testObserver');
				return extHostTesting.results;
			},
		};

		// namespace: extensions
		const extensionKind = initData.remote.isRemote
			? extHostTypes.ExtensionKind.Workspace
			: extHostTypes.ExtensionKind.UI;

		const extensions: typeof zyraxoncode.extensions = {
			getExtension(extensionId: string, includeFromDifferentExtensionHosts?: boolean): zyraxoncode.Extension<any> | undefined {
				if (!isProposedApiEnabled(extension, 'extensionsAny')) {
					includeFromDifferentExtensionHosts = false;
				}
				const mine = extensionInfo.mine.getExtensionDescription(extensionId);
				if (mine) {
					return new Extension(extensionService, extension.identifier, mine, extensionKind, false);
				}
				if (includeFromDifferentExtensionHosts) {
					const foreign = extensionInfo.all.getExtensionDescription(extensionId);
					if (foreign) {
						return new Extension(extensionService, extension.identifier, foreign, extensionKind /* TODO@alexdima THIS IS WRONG */, true);
					}
				}
				return undefined;
			},
			get all(): zyraxoncode.Extension<any>[] {
				const result: zyraxoncode.Extension<any>[] = [];
				for (const desc of extensionInfo.mine.getAllExtensionDescriptions()) {
					result.push(new Extension(extensionService, extension.identifier, desc, extensionKind, false));
				}
				return result;
			},
			get allAcrossExtensionHosts(): zyraxoncode.Extension<any>[] {
				checkProposedApiEnabled(extension, 'extensionsAny');
				const local = new ExtensionIdentifierSet(extensionInfo.mine.getAllExtensionDescriptions().map(desc => desc.identifier));
				const result: zyraxoncode.Extension<any>[] = [];
				for (const desc of extensionInfo.all.getAllExtensionDescriptions()) {
					const isFromDifferentExtensionHost = !local.has(desc.identifier);
					result.push(new Extension(extensionService, extension.identifier, desc, extensionKind /* TODO@alexdima THIS IS WRONG */, isFromDifferentExtensionHost));
				}
				return result;
			},
			get onDidChange() {
				if (isProposedApiEnabled(extension, 'extensionsAny')) {
					return _asExtensionEvent(Event.any(extensionInfo.mine.onDidChange, extensionInfo.all.onDidChange));
				}
				return _asExtensionEvent(extensionInfo.mine.onDidChange);
			}
		};

		// namespace: languages
		const languages: typeof zyraxoncode.languages = {
			createDiagnosticCollection(name?: string): zyraxoncode.DiagnosticCollection {
				return extHostDiagnostics.createDiagnosticCollection(extension.identifier, name);
			},
			get onDidChangeDiagnostics() {
				return _asExtensionEvent(extHostDiagnostics.onDidChangeDiagnostics);
			},
			getDiagnostics: (resource?: zyraxoncode.Uri) => {
				// eslint-disable-next-line local/code-no-any-casts
				return <any>extHostDiagnostics.getDiagnostics(resource);
			},
			getLanguages(): Thenable<string[]> {
				return extHostLanguages.getLanguages();
			},
			setTextDocumentLanguage(document: zyraxoncode.TextDocument, languageId: string): Thenable<zyraxoncode.TextDocument> {
				return extHostLanguages.changeLanguage(document.uri, languageId);
			},
			match(selector: zyraxoncode.DocumentSelector, document: zyraxoncode.TextDocument): number {
				const interalSelector = typeConverters.LanguageSelector.from(selector);
				let notebook: zyraxoncode.NotebookDocument | undefined;
				if (targetsNotebooks(interalSelector)) {
					notebook = extHostNotebook.notebookDocuments.find(value => value.apiNotebook.getCells().find(c => c.document === document))?.apiNotebook;
				}
				return score(interalSelector, document.uri, document.languageId, true, notebook?.uri, notebook?.notebookType);
			},
			registerCodeActionsProvider(selector: zyraxoncode.DocumentSelector, provider: zyraxoncode.CodeActionProvider, metadata?: zyraxoncode.CodeActionProviderMetadata): zyraxoncode.Disposable {
				return extHostLanguageFeatures.registerCodeActionProvider(extension, checkSelector(selector), provider, metadata);
			},
			registerDocumentPasteEditProvider(selector: zyraxoncode.DocumentSelector, provider: zyraxoncode.DocumentPasteEditProvider, metadata: zyraxoncode.DocumentPasteProviderMetadata): zyraxoncode.Disposable {
				return extHostLanguageFeatures.registerDocumentPasteEditProvider(extension, checkSelector(selector), provider, metadata);
			},
			registerCodeLensProvider(selector: zyraxoncode.DocumentSelector, provider: zyraxoncode.CodeLensProvider): zyraxoncode.Disposable {
				return extHostLanguageFeatures.registerCodeLensProvider(extension, checkSelector(selector), provider);
			},
			registerDefinitionProvider(selector: zyraxoncode.DocumentSelector, provider: zyraxoncode.DefinitionProvider): zyraxoncode.Disposable {
				return extHostLanguageFeatures.registerDefinitionProvider(extension, checkSelector(selector), provider);
			},
			registerDeclarationProvider(selector: zyraxoncode.DocumentSelector, provider: zyraxoncode.DeclarationProvider): zyraxoncode.Disposable {
				return extHostLanguageFeatures.registerDeclarationProvider(extension, checkSelector(selector), provider);
			},
			registerImplementationProvider(selector: zyraxoncode.DocumentSelector, provider: zyraxoncode.ImplementationProvider): zyraxoncode.Disposable {
				return extHostLanguageFeatures.registerImplementationProvider(extension, checkSelector(selector), provider);
			},
			registerTypeDefinitionProvider(selector: zyraxoncode.DocumentSelector, provider: zyraxoncode.TypeDefinitionProvider): zyraxoncode.Disposable {
				return extHostLanguageFeatures.registerTypeDefinitionProvider(extension, checkSelector(selector), provider);
			},
			registerHoverProvider(selector: zyraxoncode.DocumentSelector, provider: zyraxoncode.HoverProvider): zyraxoncode.Disposable {
				return extHostLanguageFeatures.registerHoverProvider(extension, checkSelector(selector), provider, extension.identifier);
			},
			registerEvaluatableExpressionProvider(selector: zyraxoncode.DocumentSelector, provider: zyraxoncode.EvaluatableExpressionProvider): zyraxoncode.Disposable {
				return extHostLanguageFeatures.registerEvaluatableExpressionProvider(extension, checkSelector(selector), provider, extension.identifier);
			},
			registerInlineValuesProvider(selector: zyraxoncode.DocumentSelector, provider: zyraxoncode.InlineValuesProvider): zyraxoncode.Disposable {
				return extHostLanguageFeatures.registerInlineValuesProvider(extension, checkSelector(selector), provider, extension.identifier);
			},
			registerDocumentHighlightProvider(selector: zyraxoncode.DocumentSelector, provider: zyraxoncode.DocumentHighlightProvider): zyraxoncode.Disposable {
				return extHostLanguageFeatures.registerDocumentHighlightProvider(extension, checkSelector(selector), provider);
			},
			registerMultiDocumentHighlightProvider(selector: zyraxoncode.DocumentSelector, provider: zyraxoncode.MultiDocumentHighlightProvider): zyraxoncode.Disposable {
				return extHostLanguageFeatures.registerMultiDocumentHighlightProvider(extension, checkSelector(selector), provider);
			},
			registerLinkedEditingRangeProvider(selector: zyraxoncode.DocumentSelector, provider: zyraxoncode.LinkedEditingRangeProvider): zyraxoncode.Disposable {
				return extHostLanguageFeatures.registerLinkedEditingRangeProvider(extension, checkSelector(selector), provider);
			},
			registerReferenceProvider(selector: zyraxoncode.DocumentSelector, provider: zyraxoncode.ReferenceProvider): zyraxoncode.Disposable {
				return extHostLanguageFeatures.registerReferenceProvider(extension, checkSelector(selector), provider);
			},
			registerRenameProvider(selector: zyraxoncode.DocumentSelector, provider: zyraxoncode.RenameProvider): zyraxoncode.Disposable {
				return extHostLanguageFeatures.registerRenameProvider(extension, checkSelector(selector), provider);
			},
			registerNewSymbolNamesProvider(selector: zyraxoncode.DocumentSelector, provider: zyraxoncode.NewSymbolNamesProvider): zyraxoncode.Disposable {
				checkProposedApiEnabled(extension, 'newSymbolNamesProvider');
				return extHostLanguageFeatures.registerNewSymbolNamesProvider(extension, checkSelector(selector), provider);
			},
			registerDocumentSymbolProvider(selector: zyraxoncode.DocumentSelector, provider: zyraxoncode.DocumentSymbolProvider, metadata?: zyraxoncode.DocumentSymbolProviderMetadata): zyraxoncode.Disposable {
				return extHostLanguageFeatures.registerDocumentSymbolProvider(extension, checkSelector(selector), provider, metadata);
			},
			registerWorkspaceSymbolProvider(provider: zyraxoncode.WorkspaceSymbolProvider): zyraxoncode.Disposable {
				return extHostLanguageFeatures.registerWorkspaceSymbolProvider(extension, provider);
			},
			registerDocumentFormattingEditProvider(selector: zyraxoncode.DocumentSelector, provider: zyraxoncode.DocumentFormattingEditProvider): zyraxoncode.Disposable {
				return extHostLanguageFeatures.registerDocumentFormattingEditProvider(extension, checkSelector(selector), provider);
			},
			registerDocumentRangeFormattingEditProvider(selector: zyraxoncode.DocumentSelector, provider: zyraxoncode.DocumentRangeFormattingEditProvider): zyraxoncode.Disposable {
				return extHostLanguageFeatures.registerDocumentRangeFormattingEditProvider(extension, checkSelector(selector), provider);
			},
			registerOnTypeFormattingEditProvider(selector: zyraxoncode.DocumentSelector, provider: zyraxoncode.OnTypeFormattingEditProvider, firstTriggerCharacter: string, ...moreTriggerCharacters: string[]): zyraxoncode.Disposable {
				return extHostLanguageFeatures.registerOnTypeFormattingEditProvider(extension, checkSelector(selector), provider, [firstTriggerCharacter].concat(moreTriggerCharacters));
			},
			registerDocumentSemanticTokensProvider(selector: zyraxoncode.DocumentSelector, provider: zyraxoncode.DocumentSemanticTokensProvider, legend: zyraxoncode.SemanticTokensLegend): zyraxoncode.Disposable {
				return extHostLanguageFeatures.registerDocumentSemanticTokensProvider(extension, checkSelector(selector), provider, legend);
			},
			registerDocumentRangeSemanticTokensProvider(selector: zyraxoncode.DocumentSelector, provider: zyraxoncode.DocumentRangeSemanticTokensProvider, legend: zyraxoncode.SemanticTokensLegend): zyraxoncode.Disposable {
				return extHostLanguageFeatures.registerDocumentRangeSemanticTokensProvider(extension, checkSelector(selector), provider, legend);
			},
			registerSignatureHelpProvider(selector: zyraxoncode.DocumentSelector, provider: zyraxoncode.SignatureHelpProvider, firstItem?: string | zyraxoncode.SignatureHelpProviderMetadata, ...remaining: string[]): zyraxoncode.Disposable {
				if (typeof firstItem === 'object') {
					return extHostLanguageFeatures.registerSignatureHelpProvider(extension, checkSelector(selector), provider, firstItem);
				}
				return extHostLanguageFeatures.registerSignatureHelpProvider(extension, checkSelector(selector), provider, typeof firstItem === 'undefined' ? [] : [firstItem, ...remaining]);
			},
			registerCompletionItemProvider(selector: zyraxoncode.DocumentSelector, provider: zyraxoncode.CompletionItemProvider, ...triggerCharacters: string[]): zyraxoncode.Disposable {
				return extHostLanguageFeatures.registerCompletionItemProvider(extension, checkSelector(selector), provider, triggerCharacters);
			},
			registerInlineCompletionItemProvider(selector: zyraxoncode.DocumentSelector, provider: zyraxoncode.InlineCompletionItemProvider, metadata?: zyraxoncode.InlineCompletionItemProviderMetadata): zyraxoncode.Disposable {
				if (provider.handleDidShowCompletionItem) {
					checkProposedApiEnabled(extension, 'inlineCompletionsAdditions');
				}
				if (provider.handleDidPartiallyAcceptCompletionItem) {
					checkProposedApiEnabled(extension, 'inlineCompletionsAdditions');
				}
				if (metadata) {
					checkProposedApiEnabled(extension, 'inlineCompletionsAdditions');
				}
				return extHostLanguageFeatures.registerInlineCompletionsProvider(extension, checkSelector(selector), provider, metadata);
			},
			get inlineCompletionsUnificationState() {
				checkProposedApiEnabled(extension, 'inlineCompletionsAdditions');
				return extHostLanguageFeatures.inlineCompletionsUnificationState;
			},
			onDidChangeCompletionsUnificationState(listener, thisArg?, disposables?) {
				checkProposedApiEnabled(extension, 'inlineCompletionsAdditions');
				return _asExtensionEvent(extHostLanguageFeatures.onDidChangeInlineCompletionsUnificationState)(listener, thisArg, disposables);
			},
			registerDocumentLinkProvider(selector: zyraxoncode.DocumentSelector, provider: zyraxoncode.DocumentLinkProvider): zyraxoncode.Disposable {
				return extHostLanguageFeatures.registerDocumentLinkProvider(extension, checkSelector(selector), provider);
			},
			registerColorProvider(selector: zyraxoncode.DocumentSelector, provider: zyraxoncode.DocumentColorProvider): zyraxoncode.Disposable {
				return extHostLanguageFeatures.registerColorProvider(extension, checkSelector(selector), provider);
			},
			registerFoldingRangeProvider(selector: zyraxoncode.DocumentSelector, provider: zyraxoncode.FoldingRangeProvider): zyraxoncode.Disposable {
				return extHostLanguageFeatures.registerFoldingRangeProvider(extension, checkSelector(selector), provider);
			},
			registerSelectionRangeProvider(selector: zyraxoncode.DocumentSelector, provider: zyraxoncode.SelectionRangeProvider): zyraxoncode.Disposable {
				return extHostLanguageFeatures.registerSelectionRangeProvider(extension, selector, provider);
			},
			registerCallHierarchyProvider(selector: zyraxoncode.DocumentSelector, provider: zyraxoncode.CallHierarchyProvider): zyraxoncode.Disposable {
				return extHostLanguageFeatures.registerCallHierarchyProvider(extension, selector, provider);
			},
			registerTypeHierarchyProvider(selector: zyraxoncode.DocumentSelector, provider: zyraxoncode.TypeHierarchyProvider): zyraxoncode.Disposable {
				return extHostLanguageFeatures.registerTypeHierarchyProvider(extension, selector, provider);
			},
			setLanguageConfiguration: (language: string, configuration: zyraxoncode.LanguageConfiguration): zyraxoncode.Disposable => {
				return extHostLanguageFeatures.setLanguageConfiguration(extension, language, configuration);
			},
			getTokenInformationAtPosition(doc: zyraxoncode.TextDocument, pos: zyraxoncode.Position) {
				checkProposedApiEnabled(extension, 'tokenInformation');
				return extHostLanguages.tokenAtPosition(doc, pos);
			},
			computeFullSyntaxHighlighting(source: string, languageId: string) {
				checkProposedApiEnabled(extension, 'documentSyntaxHighlighting');
				return extHostLanguages.computeFullSyntaxHighlighting(source, languageId);
			},
			get onDidChangeSyntaxHighlighting() {
				checkProposedApiEnabled(extension, 'documentSyntaxHighlighting');
				return extHostLanguages.onDidChangeSyntaxHighlighting;
			},
			registerInlayHintsProvider(selector: zyraxoncode.DocumentSelector, provider: zyraxoncode.InlayHintsProvider): zyraxoncode.Disposable {
				return extHostLanguageFeatures.registerInlayHintsProvider(extension, selector, provider);
			},
			createLanguageStatusItem(id: string, selector: zyraxoncode.DocumentSelector): zyraxoncode.LanguageStatusItem {
				return extHostLanguages.createLanguageStatusItem(extension, id, selector);
			},
			registerDocumentDropEditProvider(selector: zyraxoncode.DocumentSelector, provider: zyraxoncode.DocumentDropEditProvider, metadata?: zyraxoncode.DocumentDropEditProviderMetadata): zyraxoncode.Disposable {
				return extHostLanguageFeatures.registerDocumentOnDropEditProvider(extension, selector, provider, metadata);
			}
		};

		// namespace: window
		const window: typeof zyraxoncode.window = {
			get activeTextEditor() {
				return extHostEditors.getActiveTextEditor();
			},
			get visibleTextEditors() {
				return extHostEditors.getVisibleTextEditors();
			},
			get activeTerminal() {
				return extHostTerminalService.activeTerminal;
			},
			get terminals() {
				return extHostTerminalService.terminals;
			},
			async showTextDocument(documentOrUri: zyraxoncode.TextDocument | zyraxoncode.Uri, columnOrOptions?: zyraxoncode.ViewColumn | zyraxoncode.TextDocumentShowOptions, preserveFocus?: boolean): Promise<zyraxoncode.TextEditor> {
				if (URI.isUri(documentOrUri) && documentOrUri.scheme === Schemas.zyraxoncodeRemote && !documentOrUri.authority) {
					extHostApiDeprecation.report('workspace.showTextDocument', extension, `A URI of 'zyraxoncode-remote' scheme requires an authority.`);
				}
				const document = await (URI.isUri(documentOrUri)
					? Promise.resolve(workspace.openTextDocument(documentOrUri))
					: Promise.resolve(<zyraxoncode.TextDocument>documentOrUri));

				return extHostEditors.showTextDocument(document, columnOrOptions, preserveFocus);
			},
			createTextEditorDecorationType(options: zyraxoncode.DecorationRenderOptions): zyraxoncode.TextEditorDecorationType {
				return extHostEditors.createTextEditorDecorationType(extension, options);
			},
			onDidChangeActiveTextEditor(listener, thisArg?, disposables?) {
				return _asExtensionEvent(extHostEditors.onDidChangeActiveTextEditor)(listener, thisArg, disposables);
			},
			onDidChangeVisibleTextEditors(listener, thisArg, disposables) {
				return _asExtensionEvent(extHostEditors.onDidChangeVisibleTextEditors)(listener, thisArg, disposables);
			},
			onDidChangeTextEditorSelection(listener: (e: zyraxoncode.TextEditorSelectionChangeEvent) => any, thisArgs?: any, disposables?: extHostTypes.Disposable[]) {
				return _asExtensionEvent(extHostEditors.onDidChangeTextEditorSelection)(listener, thisArgs, disposables);
			},
			onDidChangeTextEditorOptions(listener: (e: zyraxoncode.TextEditorOptionsChangeEvent) => any, thisArgs?: any, disposables?: extHostTypes.Disposable[]) {
				return _asExtensionEvent(extHostEditors.onDidChangeTextEditorOptions)(listener, thisArgs, disposables);
			},
			onDidChangeTextEditorVisibleRanges(listener: (e: zyraxoncode.TextEditorVisibleRangesChangeEvent) => any, thisArgs?: any, disposables?: extHostTypes.Disposable[]) {
				return _asExtensionEvent(extHostEditors.onDidChangeTextEditorVisibleRanges)(listener, thisArgs, disposables);
			},
			onDidChangeTextEditorViewColumn(listener, thisArg?, disposables?) {
				return _asExtensionEvent(extHostEditors.onDidChangeTextEditorViewColumn)(listener, thisArg, disposables);
			},
			onDidChangeTextEditorDiffInformation(listener, thisArg?, disposables?) {
				checkProposedApiEnabled(extension, 'textEditorDiffInformation');
				return _asExtensionEvent(extHostEditors.onDidChangeTextEditorDiffInformation)(listener, thisArg, disposables);
			},
			onDidCloseTerminal(listener, thisArg?, disposables?) {
				return _asExtensionEvent(extHostTerminalService.onDidCloseTerminal)(listener, thisArg, disposables);
			},
			onDidOpenTerminal(listener, thisArg?, disposables?) {
				return _asExtensionEvent(extHostTerminalService.onDidOpenTerminal)(listener, thisArg, disposables);
			},
			onDidChangeActiveTerminal(listener, thisArg?, disposables?) {
				return _asExtensionEvent(extHostTerminalService.onDidChangeActiveTerminal)(listener, thisArg, disposables);
			},
			onDidChangeTerminalDimensions(listener, thisArg?, disposables?) {
				checkProposedApiEnabled(extension, 'terminalDimensions');
				return _asExtensionEvent(extHostTerminalService.onDidChangeTerminalDimensions)(listener, thisArg, disposables);
			},
			onDidChangeTerminalState(listener, thisArg?, disposables?) {
				return _asExtensionEvent(extHostTerminalService.onDidChangeTerminalState)(listener, thisArg, disposables);
			},
			onDidWriteTerminalData(listener, thisArg?, disposables?) {
				checkProposedApiEnabled(extension, 'terminalDataWriteEvent');
				return _asExtensionEvent(extHostTerminalService.onDidWriteTerminalData)(listener, thisArg, disposables);
			},
			onDidExecuteTerminalCommand(listener, thisArg?, disposables?) {
				checkProposedApiEnabled(extension, 'terminalExecuteCommandEvent');
				return _asExtensionEvent(extHostTerminalService.onDidExecuteTerminalCommand)(listener, thisArg, disposables);
			},
			onDidChangeTerminalShellIntegration(listener, thisArg?, disposables?) {
				return _asExtensionEvent(extHostTerminalShellIntegration.onDidChangeTerminalShellIntegration)(listener, thisArg, disposables);
			},
			onDidStartTerminalShellExecution(listener, thisArg?, disposables?) {
				return _asExtensionEvent(extHostTerminalShellIntegration.onDidStartTerminalShellExecution)(listener, thisArg, disposables);
			},
			onDidEndTerminalShellExecution(listener, thisArg?, disposables?) {
				return _asExtensionEvent(extHostTerminalShellIntegration.onDidEndTerminalShellExecution)(listener, thisArg, disposables);
			},
			get state() {
				return extHostWindow.getState();
			},
			onDidChangeWindowState(listener, thisArg?, disposables?) {
				return _asExtensionEvent(extHostWindow.onDidChangeWindowState)(listener, thisArg, disposables);
			},
			showInformationMessage(message: string, ...rest: Array<zyraxoncode.MessageOptions | string | zyraxoncode.MessageItem>) {
				return <Thenable<any>>extHostMessageService.showMessage(extension, Severity.Info, message, rest[0], <Array<string | zyraxoncode.MessageItem>>rest.slice(1));
			},
			showWarningMessage(message: string, ...rest: Array<zyraxoncode.MessageOptions | string | zyraxoncode.MessageItem>) {
				return <Thenable<any>>extHostMessageService.showMessage(extension, Severity.Warning, message, rest[0], <Array<string | zyraxoncode.MessageItem>>rest.slice(1));
			},
			showErrorMessage(message: string, ...rest: Array<zyraxoncode.MessageOptions | string | zyraxoncode.MessageItem>) {
				return <Thenable<any>>extHostMessageService.showMessage(extension, Severity.Error, message, rest[0], <Array<string | zyraxoncode.MessageItem>>rest.slice(1));
			},
			showQuickPick(items: any, options?: zyraxoncode.QuickPickOptions, token?: zyraxoncode.CancellationToken): any {
				return extHostQuickOpen.showQuickPick(extension, items, options, token);
			},
			showWorkspaceFolderPick(options?: zyraxoncode.WorkspaceFolderPickOptions) {
				return extHostQuickOpen.showWorkspaceFolderPick(options);
			},
			showInputBox(options?: zyraxoncode.InputBoxOptions, token?: zyraxoncode.CancellationToken) {
				return extHostQuickOpen.showInput(options, token);
			},
			showOpenDialog(options) {
				return extHostDialogs.showOpenDialog(options);
			},
			showSaveDialog(options) {
				return extHostDialogs.showSaveDialog(options);
			},
			createStatusBarItem(alignmentOrId?: zyraxoncode.StatusBarAlignment | string, priorityOrAlignment?: number | zyraxoncode.StatusBarAlignment, priorityArg?: number): zyraxoncode.StatusBarItem {
				let id: string | undefined;
				let alignment: number | undefined;
				let priority: number | undefined;

				if (typeof alignmentOrId === 'string') {
					id = alignmentOrId;
					alignment = priorityOrAlignment;
					priority = priorityArg;
				} else {
					alignment = alignmentOrId;
					priority = priorityOrAlignment;
				}

				return extHostStatusBar.createStatusBarEntry(extension, id, alignment, priority);
			},
			setStatusBarMessage(text: string, timeoutOrThenable?: number | Thenable<any>): zyraxoncode.Disposable {
				return extHostStatusBar.setStatusBarMessage(text, timeoutOrThenable);
			},
			withScmProgress<R>(task: (progress: zyraxoncode.Progress<number>) => Thenable<R>) {
				extHostApiDeprecation.report('window.withScmProgress', extension,
					`Use 'withProgress' instead.`);

				return extHostProgress.withProgress(extension, { location: extHostTypes.ProgressLocation.SourceControl }, (progress, token) => task({ report(n: number) { /*noop*/ } }));
			},
			withProgress<R>(options: zyraxoncode.ProgressOptions, task: (progress: zyraxoncode.Progress<{ message?: string; worked?: number }>, token: zyraxoncode.CancellationToken) => Thenable<R>) {
				return extHostProgress.withProgress(extension, options, task);
			},
			createOutputChannel(name: string, options: string | { log: true } | undefined): any {
				return extHostOutputService.createOutputChannel(name, options, extension);
			},
			createWebviewPanel(viewType: string, title: string, showOptions: zyraxoncode.ViewColumn | { viewColumn: zyraxoncode.ViewColumn; preserveFocus?: boolean }, options?: zyraxoncode.WebviewPanelOptions & zyraxoncode.WebviewOptions): zyraxoncode.WebviewPanel {
				return extHostWebviewPanels.createWebviewPanel(extension, viewType, title, showOptions, options);
			},
			createWebviewTextEditorInset(editor: zyraxoncode.TextEditor, line: number, height: number, options?: zyraxoncode.WebviewOptions): zyraxoncode.WebviewEditorInset {
				checkProposedApiEnabled(extension, 'editorInsets');
				return extHostEditorInsets.createWebviewEditorInset(editor, line, height, options, extension);
			},
			createTerminal(nameOrOptions?: zyraxoncode.TerminalOptions | zyraxoncode.ExtensionTerminalOptions | string, shellPath?: string, shellArgs?: readonly string[] | string): zyraxoncode.Terminal {
				if (typeof nameOrOptions === 'object') {
					let options = nameOrOptions;
					if (!isProposedApiEnabled(extension, 'terminalTitle') && 'titleTemplate' in nameOrOptions && nameOrOptions.titleTemplate !== undefined) {
						console.error(`[${extension.identifier.value}] \`titleTemplate\` was provided to window.createTerminal but is ignored because the \`terminalTitle\` proposed API is not enabled.`);
						options = { ...nameOrOptions, titleTemplate: undefined };
					}
					if ('pty' in options) {
						return extHostTerminalService.createExtensionTerminal(options);
					}
					return extHostTerminalService.createTerminalFromOptions(options);
				}
				return extHostTerminalService.createTerminal(nameOrOptions, shellPath, shellArgs);
			},
			registerTerminalLinkProvider(provider: zyraxoncode.TerminalLinkProvider): zyraxoncode.Disposable {
				return extHostTerminalService.registerLinkProvider(provider);
			},
			registerTerminalProfileProvider(id: string, provider: zyraxoncode.TerminalProfileProvider): zyraxoncode.Disposable {
				return extHostTerminalService.registerProfileProvider(extension, id, provider);
			},
			registerTerminalCompletionProvider(provider: zyraxoncode.TerminalCompletionProvider<zyraxoncode.TerminalCompletionItem>, ...triggerCharacters: string[]): zyraxoncode.Disposable {
				checkProposedApiEnabled(extension, 'terminalCompletionProvider');
				return extHostTerminalService.registerTerminalCompletionProvider(extension, provider, ...triggerCharacters);
			},
			registerTerminalQuickFixProvider(id: string, provider: zyraxoncode.TerminalQuickFixProvider): zyraxoncode.Disposable {
				checkProposedApiEnabled(extension, 'terminalQuickFixProvider');
				return extHostTerminalService.registerTerminalQuickFixProvider(id, extension.identifier.value, provider);
			},
			registerTreeDataProvider(viewId: string, treeDataProvider: zyraxoncode.TreeDataProvider<any>): zyraxoncode.Disposable {
				return extHostTreeViews.registerTreeDataProvider(viewId, treeDataProvider, extension);
			},
			createTreeView(viewId: string, options: { treeDataProvider: zyraxoncode.TreeDataProvider<any> }): zyraxoncode.TreeView<any> {
				return extHostTreeViews.createTreeView(viewId, options, extension);
			},
			registerWebviewPanelSerializer: (viewType: string, serializer: zyraxoncode.WebviewPanelSerializer) => {
				return extHostWebviewPanels.registerWebviewPanelSerializer(extension, viewType, serializer);
			},
			registerCustomEditorProvider: (viewType: string, provider: zyraxoncode.CustomTextEditorProvider | zyraxoncode.CustomReadonlyEditorProvider, options: { webviewOptions?: zyraxoncode.WebviewPanelOptions; supportsMultipleEditorsPerDocument?: boolean } = {}) => {
				return extHostCustomEditors.registerCustomEditorProvider(extension, viewType, provider, options);
			},
			registerFileDecorationProvider(provider: zyraxoncode.FileDecorationProvider) {
				return extHostDecorations.registerFileDecorationProvider(provider, extension);
			},
			registerUriHandler(handler: zyraxoncode.UriHandler) {
				return extHostUrls.registerUriHandler(extension, handler);
			},
			createQuickPick<T extends zyraxoncode.QuickPickItem>(): zyraxoncode.QuickPick<T> {
				return extHostQuickOpen.createQuickPick(extension);
			},
			createInputBox(): zyraxoncode.InputBox {
				return extHostQuickOpen.createInputBox(extension);
			},
			get activeColorTheme(): zyraxoncode.ColorTheme {
				return extHostTheming.activeColorTheme;
			},
			onDidChangeActiveColorTheme(listener, thisArg?, disposables?) {
				return _asExtensionEvent(extHostTheming.onDidChangeActiveColorTheme)(listener, thisArg, disposables);
			},
			registerWebviewViewProvider(viewId: string, provider: zyraxoncode.WebviewViewProvider, options?: {
				webviewOptions?: {
					retainContextWhenHidden?: boolean;
				};
			}) {
				return extHostWebviewViews.registerWebviewViewProvider(extension, viewId, provider, options?.webviewOptions);
			},
			get activeNotebookEditor(): zyraxoncode.NotebookEditor | undefined {
				return extHostNotebook.activeNotebookEditor;
			},
			onDidChangeActiveNotebookEditor(listener, thisArgs?, disposables?) {
				return _asExtensionEvent(extHostNotebook.onDidChangeActiveNotebookEditor)(listener, thisArgs, disposables);
			},
			get visibleNotebookEditors() {
				return extHostNotebook.visibleNotebookEditors;
			},
			get onDidChangeVisibleNotebookEditors() {
				return _asExtensionEvent(extHostNotebook.onDidChangeVisibleNotebookEditors);
			},
			onDidChangeNotebookEditorSelection(listener, thisArgs?, disposables?) {
				return _asExtensionEvent(extHostNotebookEditors.onDidChangeNotebookEditorSelection)(listener, thisArgs, disposables);
			},
			onDidChangeNotebookEditorVisibleRanges(listener, thisArgs?, disposables?) {
				return _asExtensionEvent(extHostNotebookEditors.onDidChangeNotebookEditorVisibleRanges)(listener, thisArgs, disposables);
			},
			showNotebookDocument(document, options?) {
				return extHostNotebook.showNotebookDocument(document, options);
			},
			registerExternalUriOpener(id: string, opener: zyraxoncode.ExternalUriOpener, metadata: zyraxoncode.ExternalUriOpenerMetadata) {
				checkProposedApiEnabled(extension, 'externalUriOpener');
				return extHostUriOpeners.registerExternalUriOpener(extension.identifier, id, opener, metadata);
			},
			registerProfileContentHandler(id: string, handler: zyraxoncode.ProfileContentHandler) {
				checkProposedApiEnabled(extension, 'profileContentHandlers');
				return extHostProfileContentHandlers.registerProfileContentHandler(extension, id, handler);
			},
			registerQuickDiffProvider(selector: zyraxoncode.DocumentSelector, quickDiffProvider: zyraxoncode.QuickDiffProvider, id: string, label: string, rootUri?: zyraxoncode.Uri): zyraxoncode.Disposable {
				checkProposedApiEnabled(extension, 'quickDiffProvider');
				return extHostQuickDiff.registerQuickDiffProvider(extension, checkSelector(selector), quickDiffProvider, id, label, rootUri);
			},
			createSourceControlDiffInformation(uri: zyraxoncode.Uri): zyraxoncode.SourceControlDiffInformationProvider {
				checkProposedApiEnabled(extension, 'textEditorDiffInformation');
				return extHostQuickDiff.createSourceControlDiffInformation(uri);
			},
			createAgentEditorComments(uri: zyraxoncode.Uri): zyraxoncode.AgentEditorCommentsProvider {
				checkProposedApiEnabled(extension, 'agentEditorComments');
				return extHostAgentEditorComments.createAgentEditorComments(uri);
			},
			get tabGroups(): zyraxoncode.TabGroups {
				return extHostEditorTabs.tabGroups;
			},
			registerShareProvider(selector: zyraxoncode.DocumentSelector, provider: zyraxoncode.ShareProvider): zyraxoncode.Disposable {
				checkProposedApiEnabled(extension, 'shareProvider');
				return extHostShare.registerShareProvider(checkSelector(selector), provider);
			},
			get nativeHandle(): Uint8Array | undefined {
				checkProposedApiEnabled(extension, 'nativeWindowHandle');
				return extHostWindow.nativeHandle;
			},
			createChatStatusItem: (id: string) => {
				checkProposedApiEnabled(extension, 'chatStatusItem');
				return extHostChatStatus.createChatStatusItem(extension, id);
			},
			get activeChatPanelSessionResource() {
				checkProposedApiEnabled(extension, 'chatParticipantPrivate');
				return extHostChatAgents2.activeChatPanelSessionResource;
			},
			onDidChangeActiveChatPanelSessionResource: (listeners, thisArgs?, disposables?) => {
				checkProposedApiEnabled(extension, 'chatParticipantPrivate');
				return _asExtensionEvent(extHostChatAgents2.onDidChangeActiveChatPanelSessionResource)(listeners, thisArgs, disposables);
			},
			get browserTabs() {
				checkProposedApiEnabled(extension, 'browser');
				return extHostBrowsers.browserTabs;
			},
			onDidOpenBrowserTab(listener, thisArg?, disposables?) {
				checkProposedApiEnabled(extension, 'browser');
				return _asExtensionEvent(extHostBrowsers.onDidOpenBrowserTab)(listener, thisArg, disposables);
			},
			onDidCloseBrowserTab(listener, thisArg?, disposables?) {
				checkProposedApiEnabled(extension, 'browser');
				return _asExtensionEvent(extHostBrowsers.onDidCloseBrowserTab)(listener, thisArg, disposables);
			},
			get activeBrowserTab() {
				checkProposedApiEnabled(extension, 'browser');
				return extHostBrowsers.activeBrowserTab;
			},
			onDidChangeActiveBrowserTab(listener, thisArg?, disposables?) {
				checkProposedApiEnabled(extension, 'browser');
				return _asExtensionEvent(extHostBrowsers.onDidChangeActiveBrowserTab)(listener, thisArg, disposables);
			},
			onDidChangeBrowserTabState(listener, thisArg?, disposables?) {
				checkProposedApiEnabled(extension, 'browser');
				return _asExtensionEvent(extHostBrowsers.onDidChangeBrowserTabState)(listener, thisArg, disposables);
			},
			openBrowserTab(url: string, options?: zyraxoncode.BrowserTabShowOptions) {
				checkProposedApiEnabled(extension, 'browser');
				return extHostBrowsers.openBrowserTab(url, options);
			},
		};

		// namespace: workspace

		const workspace: typeof zyraxoncode.workspace = {
			get rootPath() {
				extHostApiDeprecation.report('workspace.rootPath', extension,
					`Please use 'workspace.workspaceFolders' instead. More details: __ZYRAXKEEP__1_`);

				return extHostWorkspace.getPath();
			},
			set rootPath(value) {
				throw new errors.ReadonlyError('rootPath');
			},
			getWorkspaceFolder(resource) {
				return extHostWorkspace.getWorkspaceFolder(resource);
			},
			get workspaceFolders() {
				return extHostWorkspace.getWorkspaceFolders();
			},
			get name() {
				return extHostWorkspace.name;
			},
			set name(value) {
				throw new errors.ReadonlyError('name');
			},
			get workspaceFile() {
				return extHostWorkspace.workspaceFile;
			},
			set workspaceFile(value) {
				throw new errors.ReadonlyError('workspaceFile');
			},
			get isAgentSessionsWorkspace() {
				checkProposedApiEnabled(extension, 'agentSessionsWorkspace');
				return !!initData.environment.isSessionsWindow;
			},
			updateWorkspaceFolders: (index, deleteCount, ...workspaceFoldersToAdd) => {
				return extHostWorkspace.updateWorkspaceFolders(extension, index, deleteCount || 0, ...workspaceFoldersToAdd);
			},
			onDidChangeWorkspaceFolders: function (listener, thisArgs?, disposables?) {
				return _asExtensionEvent(extHostWorkspace.onDidChangeWorkspace)(listener, thisArgs, disposables);
			},
			asRelativePath: (pathOrUri, includeWorkspace?) => {
				return extHostWorkspace.getRelativePath(pathOrUri, includeWorkspace);
			},
			findFiles: (include, exclude, maxResults?, token?) => {
				// Note, undefined/null have different meanings on "exclude"
				return extHostWorkspace.findFiles(include, exclude, maxResults, extension.identifier, token);
			},
			findFiles2: (filePattern: zyraxoncode.GlobPattern[], options?: zyraxoncode.FindFiles2Options, token?: zyraxoncode.CancellationToken): Thenable<zyraxoncode.Uri[]> => {
				checkProposedApiEnabled(extension, 'findFiles2');
				return extHostWorkspace.findFiles2(filePattern, options, extension.identifier, token);
			},
			findTextInFiles: (query: zyraxoncode.TextSearchQuery, optionsOrCallback: zyraxoncode.FindTextInFilesOptions | ((result: zyraxoncode.TextSearchResult) => void), callbackOrToken?: zyraxoncode.CancellationToken | ((result: zyraxoncode.TextSearchResult) => void), token?: zyraxoncode.CancellationToken) => {
				checkProposedApiEnabled(extension, 'findTextInFiles');
				let options: zyraxoncode.FindTextInFilesOptions;
				let callback: (result: zyraxoncode.TextSearchResult) => void;

				if (typeof optionsOrCallback === 'object') {
					options = optionsOrCallback;
					callback = callbackOrToken as (result: zyraxoncode.TextSearchResult) => void;
				} else {
					options = {};
					callback = optionsOrCallback;
					token = callbackOrToken as zyraxoncode.CancellationToken;
				}

				return extHostWorkspace.findTextInFiles(query, options || {}, callback, extension.identifier, token);
			},
			findTextInFiles2: (query: zyraxoncode.TextSearchQuery2, options?: zyraxoncode.FindTextInFilesOptions2, token?: zyraxoncode.CancellationToken): zyraxoncode.FindTextInFilesResponse => {
				checkProposedApiEnabled(extension, 'findTextInFiles2');
				checkProposedApiEnabled(extension, 'textSearchProvider2');
				return extHostWorkspace.findTextInFiles2(query, options, extension.identifier, token);
			},
			getTextDiff(originalDocument: zyraxoncode.TextDocument, modifiedDocument: zyraxoncode.TextDocument, options?: zyraxoncode.TextDiffOptions, token?: zyraxoncode.CancellationToken): zyraxoncode.TextDiffResponse {
				checkProposedApiEnabled(extension, 'documentDiff');
				const proxy = rpcProtocol.getProxy(MainContext.MainThreadDocumentDiff);
				if (token?.isCancellationRequested) {
					const error = new errors.CancellationError();
					return {
						changes: AsyncIterableObject.EMPTY,
						complete: Promise.reject(error),
					};
				}
				const resultPromise = proxy.$computeDocumentDiff(
					originalDocument.uri,
					modifiedDocument.uri,
					options?.ignoreTrimWhitespace ?? false,
					options?.maxComputationTimeMs ?? 5000,
					options?.computeMoves ?? false,
				);
				const diffPromise = token ? raceCancellationError(resultPromise, token) : resultPromise;
				const mappedPromise = diffPromise.then(result => {
					if (!result) {
						throw new Error('Could not compute diff. Make sure both documents are available.');
					}
					return result;
				});

				const mapChange = (c: IDocumentDiffLineChangeDto) => ({
					originalRange: typeConverters.Range.to(c.originalRange),
					modifiedRange: typeConverters.Range.to(c.modifiedRange),
					innerChanges: c.innerChanges?.map(ic => ({
						originalRange: typeConverters.Range.to(ic.originalRange),
						modifiedRange: typeConverters.Range.to(ic.modifiedRange),
					})),
				});

				// TODO@API currently the diff is computed in one shot and all changes are emitted at once.
				// In the future, we may want to stream changes incrementally as they are computed
				// (e.g. by having the worker yield partial results).
				return {
					changes: new AsyncIterableObject<zyraxoncode.TextDiffChange>(async emitter => {
						const result = await mappedPromise;
						emitter.emitMany(result.changes.map(mapChange));
					}),
					complete: mappedPromise.then(result => ({
						identical: result.identical,
						mayBeIncomplete: result.quitEarly,
						moves: result.moves.map(m => ({
							originalRange: typeConverters.Range.to(m.originalRange),
							modifiedRange: typeConverters.Range.to(m.modifiedRange),
							changes: m.changes.map(mapChange),
						})),
					})),
				};
			},
			save: (uri) => {
				return extHostWorkspace.save(uri);
			},
			saveAs: (uri) => {
				return extHostWorkspace.saveAs(uri);
			},
			saveAll: (includeUntitled?) => {
				return extHostWorkspace.saveAll(includeUntitled);
			},
			applyEdit(edit: zyraxoncode.WorkspaceEdit, metadata?: zyraxoncode.WorkspaceEditMetadata): Thenable<boolean> {
				return extHostBulkEdits.applyWorkspaceEdit(edit, extension, metadata);
			},
			createFileSystemWatcher: (pattern, optionsOrIgnoreCreate, ignoreChange?, ignoreDelete?): zyraxoncode.FileSystemWatcher => {
				const options: FileSystemWatcherCreateOptions = {
					ignoreCreateEvents: Boolean(optionsOrIgnoreCreate),
					ignoreChangeEvents: Boolean(ignoreChange),
					ignoreDeleteEvents: Boolean(ignoreDelete),
				};

				return extHostFileSystemEvent.createFileSystemWatcher(extHostWorkspace, configProvider, extHostFileSystemInfo, extension, pattern, options);
			},
			get textDocuments() {
				return extHostDocuments.getAllDocumentData().map(data => data.document);
			},
			set textDocuments(value) {
				throw new errors.ReadonlyError('textDocuments');
			},
			openTextDocument(uriOrFileNameOrOptions?: zyraxoncode.Uri | string | { language?: string; content?: string; encoding?: string }, options?: { encoding?: string }) {
				let uriPromise: Thenable<URI>;

				options = (options ?? uriOrFileNameOrOptions) as ({ language?: string; content?: string; encoding?: string } | undefined);

				if (typeof uriOrFileNameOrOptions === 'string') {
					uriPromise = Promise.resolve(URI.file(uriOrFileNameOrOptions));
				} else if (URI.isUri(uriOrFileNameOrOptions)) {
					uriPromise = Promise.resolve(uriOrFileNameOrOptions);
				} else if (!options || typeof options === 'object') {
					uriPromise = extHostDocuments.createDocumentData(options);
				} else {
					throw new Error('illegal argument - uriOrFileNameOrOptions');
				}

				return uriPromise.then(uri => {
					extHostLogService.trace(`openTextDocument from ${extension.identifier}`);
					if (uri.scheme === Schemas.zyraxoncodeRemote && !uri.authority) {
						extHostApiDeprecation.report('workspace.openTextDocument', extension, `A URI of 'zyraxoncode-remote' scheme requires an authority.`);
					}
					return extHostDocuments.ensureDocumentData(uri, options).then(documentData => {
						return documentData.document;
					});
				});
			},
			onDidOpenTextDocument: (listener, thisArgs?, disposables?) => {
				return _asExtensionEvent(extHostDocuments.onDidAddDocument)(listener, thisArgs, disposables);
			},
			onDidCloseTextDocument: (listener, thisArgs?, disposables?) => {
				return _asExtensionEvent(extHostDocuments.onDidRemoveDocument)(listener, thisArgs, disposables);
			},
			onDidChangeTextDocument: (listener, thisArgs?, disposables?) => {
				if (isProposedApiEnabled(extension, 'textDocumentChangeReason')) {
					return _asExtensionEvent(extHostDocuments.onDidChangeDocumentWithReason)(listener, thisArgs, disposables);
				}
				return _asExtensionEvent(extHostDocuments.onDidChangeDocument)(listener, thisArgs, disposables);
			},
			onDidSaveTextDocument: (listener, thisArgs?, disposables?) => {
				return _asExtensionEvent(extHostDocuments.onDidSaveDocument)(listener, thisArgs, disposables);
			},
			onWillSaveTextDocument: (listener, thisArgs?, disposables?) => {
				return _asExtensionEvent(extHostDocumentSaveParticipant.getOnWillSaveTextDocumentEvent(extension))(listener, thisArgs, disposables);
			},
			get notebookDocuments(): zyraxoncode.NotebookDocument[] {
				return extHostNotebook.notebookDocuments.map(d => d.apiNotebook);
			},
			async openNotebookDocument(uriOrType?: URI | string, content?: zyraxoncode.NotebookData) {
				let uri: URI;
				if (URI.isUri(uriOrType)) {
					uri = uriOrType;
					await extHostNotebook.openNotebookDocument(uriOrType);
				} else if (typeof uriOrType === 'string') {
					uri = URI.revive(await extHostNotebook.createNotebookDocument({ viewType: uriOrType, content }));
				} else {
					throw new Error('Invalid arguments');
				}
				return extHostNotebook.getNotebookDocument(uri).apiNotebook;
			},
			onDidSaveNotebookDocument(listener, thisArg, disposables) {
				return _asExtensionEvent(extHostNotebookDocuments.onDidSaveNotebookDocument)(listener, thisArg, disposables);
			},
			onDidChangeNotebookDocument(listener, thisArg, disposables) {
				return _asExtensionEvent(extHostNotebookDocuments.onDidChangeNotebookDocument)(listener, thisArg, disposables);
			},
			onWillSaveNotebookDocument(listener, thisArg, disposables) {
				return _asExtensionEvent(extHostNotebookDocumentSaveParticipant.getOnWillSaveNotebookDocumentEvent(extension))(listener, thisArg, disposables);
			},
			get onDidOpenNotebookDocument() {
				return _asExtensionEvent(extHostNotebook.onDidOpenNotebookDocument);
			},
			get onDidCloseNotebookDocument() {
				return _asExtensionEvent(extHostNotebook.onDidCloseNotebookDocument);
			},
			registerNotebookSerializer(viewType: string, serializer: zyraxoncode.NotebookSerializer, options?: zyraxoncode.NotebookDocumentContentOptions, registration?: zyraxoncode.NotebookRegistrationData) {
				return extHostNotebook.registerNotebookSerializer(extension, viewType, serializer, options, isProposedApiEnabled(extension, 'notebookLiveShare') ? registration : undefined);
			},
			onDidChangeConfiguration: (listener: (_: any) => any, thisArgs?: any, disposables?: extHostTypes.Disposable[]) => {
				return _asExtensionEvent(configProvider.onDidChangeConfiguration)(listener, thisArgs, disposables);
			},
			getConfiguration(section?: string, scope?: zyraxoncode.ConfigurationScope | null): zyraxoncode.WorkspaceConfiguration {
				scope = arguments.length === 1 ? undefined : scope;
				return configProvider.getConfiguration(section, scope, extension);
			},
			registerTextDocumentContentProvider(scheme: string, provider: zyraxoncode.TextDocumentContentProvider) {
				return extHostDocumentContentProviders.registerTextDocumentContentProvider(scheme, provider);
			},
			registerTaskProvider: (type: string, provider: zyraxoncode.TaskProvider) => {
				extHostApiDeprecation.report('window.registerTaskProvider', extension,
					`Use the corresponding function on the 'tasks' namespace instead`);

				return extHostTask.registerTaskProvider(extension, type, provider);
			},
			registerFileSystemProvider(scheme, provider, options) {
				return combinedDisposable(
					extHostFileSystem.registerFileSystemProvider(extension, scheme, provider, options),
					extHostConsumerFileSystem.addFileSystemProvider(scheme, provider, options)
				);
			},
			get fs() {
				return extHostConsumerFileSystem.value;
			},
			registerFileSearchProvider: (scheme: string, provider: zyraxoncode.FileSearchProvider) => {
				checkProposedApiEnabled(extension, 'fileSearchProvider');
				return extHostSearch.registerFileSearchProviderOld(scheme, provider);
			},
			registerTextSearchProvider: (scheme: string, provider: zyraxoncode.TextSearchProvider) => {
				checkProposedApiEnabled(extension, 'textSearchProvider');
				return extHostSearch.registerTextSearchProviderOld(scheme, provider);
			},
			registerAITextSearchProvider: (scheme: string, provider: zyraxoncode.AITextSearchProvider) => {
				// there are some dependencies on textSearchProvider, so we need to check for both
				checkProposedApiEnabled(extension, 'aiTextSearchProvider');
				checkProposedApiEnabled(extension, 'textSearchProvider2');
				return extHostSearch.registerAITextSearchProvider(scheme, provider);
			},
			registerFileSearchProvider2: (scheme: string, provider: zyraxoncode.FileSearchProvider2) => {
				checkProposedApiEnabled(extension, 'fileSearchProvider2');
				return extHostSearch.registerFileSearchProvider(scheme, provider);
			},
			registerTextSearchProvider2: (scheme: string, provider: zyraxoncode.TextSearchProvider2) => {
				checkProposedApiEnabled(extension, 'textSearchProvider2');
				return extHostSearch.registerTextSearchProvider(scheme, provider);
			},
			registerRemoteAuthorityResolver: (authorityPrefix: string, resolver: zyraxoncode.RemoteAuthorityResolver) => {
				checkProposedApiEnabled(extension, 'resolvers');
				return extensionService.registerRemoteAuthorityResolver(authorityPrefix, resolver);
			},
			registerResourceLabelFormatter: (formatter: zyraxoncode.ResourceLabelFormatter) => {
				checkProposedApiEnabled(extension, 'resolvers');
				return extHostLabelService.$registerResourceLabelFormatter(formatter);
			},
			getRemoteExecServer: (authority: string) => {
				checkProposedApiEnabled(extension, 'resolvers');
				return extensionService.getRemoteExecServer(authority);
			},
			onDidCreateFiles: (listener, thisArg, disposables) => {
				return _asExtensionEvent(extHostFileSystemEvent.onDidCreateFile)(listener, thisArg, disposables);
			},
			onDidDeleteFiles: (listener, thisArg, disposables) => {
				return _asExtensionEvent(extHostFileSystemEvent.onDidDeleteFile)(listener, thisArg, disposables);
			},
			onDidRenameFiles: (listener, thisArg, disposables) => {
				return _asExtensionEvent(extHostFileSystemEvent.onDidRenameFile)(listener, thisArg, disposables);
			},
			onWillCreateFiles: (listener: (e: zyraxoncode.FileWillCreateEvent) => any, thisArg?: unknown, disposables?: zyraxoncode.Disposable[]) => {
				return _asExtensionEvent(extHostFileSystemEvent.getOnWillCreateFileEvent(extension))(listener, thisArg, disposables);
			},
			onWillDeleteFiles: (listener: (e: zyraxoncode.FileWillDeleteEvent) => any, thisArg?: unknown, disposables?: zyraxoncode.Disposable[]) => {
				return _asExtensionEvent(extHostFileSystemEvent.getOnWillDeleteFileEvent(extension))(listener, thisArg, disposables);
			},
			onWillRenameFiles: (listener: (e: zyraxoncode.FileWillRenameEvent) => any, thisArg?: unknown, disposables?: zyraxoncode.Disposable[]) => {
				return _asExtensionEvent(extHostFileSystemEvent.getOnWillRenameFileEvent(extension))(listener, thisArg, disposables);
			},
			openTunnel: (forward: zyraxoncode.TunnelOptions) => {
				checkProposedApiEnabled(extension, 'tunnels');
				return extHostTunnelService.openTunnel(extension, forward).then(value => {
					if (!value) {
						throw new Error('cannot open tunnel');
					}
					return value;
				});
			},
			get tunnels() {
				checkProposedApiEnabled(extension, 'tunnels');
				return extHostTunnelService.getTunnels();
			},
			onDidChangeTunnels: (listener, thisArg?, disposables?) => {
				checkProposedApiEnabled(extension, 'tunnels');
				return _asExtensionEvent(extHostTunnelService.onDidChangeTunnels)(listener, thisArg, disposables);
			},
			registerPortAttributesProvider: (portSelector: zyraxoncode.PortAttributesSelector, provider: zyraxoncode.PortAttributesProvider) => {
				checkProposedApiEnabled(extension, 'portsAttributes');
				return extHostTunnelService.registerPortsAttributesProvider(portSelector, provider);
			},
			registerTunnelProvider: (tunnelProvider: zyraxoncode.TunnelProvider, information: zyraxoncode.TunnelInformation) => {
				checkProposedApiEnabled(extension, 'tunnelFactory');
				return extHostTunnelService.registerTunnelProvider(tunnelProvider, information);
			},
			registerTimelineProvider: (scheme: string | string[], provider: zyraxoncode.TimelineProvider) => {
				checkProposedApiEnabled(extension, 'timeline');
				return extHostTimeline.registerTimelineProvider(scheme, provider, extension.identifier, extHostCommands.converter);
			},
			get isTrusted() {
				return extHostWorkspace.trusted;
			},
			requestResourceTrust: (options: zyraxoncode.ResourceTrustRequestOptions) => {
				checkProposedApiEnabled(extension, 'workspaceTrust');
				return extHostWorkspace.requestResourceTrust(options);
			},
			requestWorkspaceTrust: (options?: zyraxoncode.WorkspaceTrustRequestOptions) => {
				checkProposedApiEnabled(extension, 'workspaceTrust');
				return extHostWorkspace.requestWorkspaceTrust(options);
			},
			isResourceTrusted: (resource: zyraxoncode.Uri) => {
				checkProposedApiEnabled(extension, 'workspaceTrust');
				return extHostWorkspace.isResourceTrusted(resource);
			},
			onDidChangeWorkspaceTrustedFolders: (listener, thisArgs?, disposables?) => {
				checkProposedApiEnabled(extension, 'workspaceTrust');
				return _asExtensionEvent(extHostWorkspace.onDidChangeWorkspaceTrustedFolders)(listener, thisArgs, disposables);
			},
			onDidGrantWorkspaceTrust: (listener, thisArgs?, disposables?) => {
				return _asExtensionEvent(extHostWorkspace.onDidGrantWorkspaceTrust)(listener, thisArgs, disposables);
			},
			registerEditSessionIdentityProvider: (scheme: string, provider: zyraxoncode.EditSessionIdentityProvider) => {
				checkProposedApiEnabled(extension, 'editSessionIdentityProvider');
				return extHostWorkspace.registerEditSessionIdentityProvider(scheme, provider);
			},
			onWillCreateEditSessionIdentity: (listener, thisArgs?, disposables?) => {
				checkProposedApiEnabled(extension, 'editSessionIdentityProvider');
				return _asExtensionEvent(extHostWorkspace.getOnWillCreateEditSessionIdentityEvent(extension))(listener, thisArgs, disposables);
			},
			registerCanonicalUriProvider: (scheme: string, provider: zyraxoncode.CanonicalUriProvider) => {
				checkProposedApiEnabled(extension, 'canonicalUriProvider');
				return extHostWorkspace.registerCanonicalUriProvider(scheme, provider);
			},
			getCanonicalUri: (uri: zyraxoncode.Uri, options: zyraxoncode.CanonicalUriRequestOptions, token: zyraxoncode.CancellationToken) => {
				checkProposedApiEnabled(extension, 'canonicalUriProvider');
				return extHostWorkspace.provideCanonicalUri(uri, options, token);
			},
			decode(content: Uint8Array, options?: { uri?: zyraxoncode.Uri; encoding?: string }) {
				return extHostWorkspace.decode(content, options);
			},
			encode(content: string, options?: { uri?: zyraxoncode.Uri; encoding?: string }) {
				return extHostWorkspace.encode(content, options);
			},
		};

		// namespace: scm
		const scm: typeof zyraxoncode.scm = {
			get inputBox() {
				extHostApiDeprecation.report('scm.inputBox', extension,
					`Use 'SourceControl.inputBox' instead`);

				return extHostSCM.getLastInputBox(extension)!; // Strict null override - Deprecated api
			},
			createSourceControl(id: string, label: string, rootUri?: zyraxoncode.Uri, iconPath?: zyraxoncode.IconPath, isHidden?: boolean, parent?: zyraxoncode.SourceControl): zyraxoncode.SourceControl {
				if (iconPath || isHidden || parent) {
					checkProposedApiEnabled(extension, 'scmProviderOptions');
				}
				return extHostSCM.createSourceControl(extension, id, label, rootUri, iconPath, isHidden, parent);
			}
		};

		// namespace: comments
		const comments: typeof zyraxoncode.comments = {
			createCommentController(id: string, label: string) {
				return extHostComment.createCommentController(extension, id, label);
			}
		};

		// namespace: debug
		const debug: typeof zyraxoncode.debug = {
			get activeDebugSession() {
				return extHostDebugService.activeDebugSession;
			},
			get activeDebugConsole() {
				return extHostDebugService.activeDebugConsole;
			},
			get breakpoints() {
				return extHostDebugService.breakpoints;
			},
			get activeStackItem() {
				return extHostDebugService.activeStackItem;
			},
			registerDebugVisualizationProvider(id, provider) {
				checkProposedApiEnabled(extension, 'debugVisualization');
				return extHostDebugService.registerDebugVisualizationProvider(extension, id, provider);
			},
			registerDebugVisualizationTreeProvider(id, provider) {
				checkProposedApiEnabled(extension, 'debugVisualization');
				return extHostDebugService.registerDebugVisualizationTree(extension, id, provider);
			},
			onDidStartDebugSession(listener, thisArg?, disposables?) {
				return _asExtensionEvent(extHostDebugService.onDidStartDebugSession)(listener, thisArg, disposables);
			},
			onDidTerminateDebugSession(listener, thisArg?, disposables?) {
				return _asExtensionEvent(extHostDebugService.onDidTerminateDebugSession)(listener, thisArg, disposables);
			},
			onDidChangeActiveDebugSession(listener, thisArg?, disposables?) {
				return _asExtensionEvent(extHostDebugService.onDidChangeActiveDebugSession)(listener, thisArg, disposables);
			},
			onDidReceiveDebugSessionCustomEvent(listener, thisArg?, disposables?) {
				return _asExtensionEvent(extHostDebugService.onDidReceiveDebugSessionCustomEvent)(listener, thisArg, disposables);
			},
			onDidChangeBreakpoints(listener, thisArgs?, disposables?) {
				return _asExtensionEvent(extHostDebugService.onDidChangeBreakpoints)(listener, thisArgs, disposables);
			},
			onDidChangeActiveStackItem(listener, thisArg?, disposables?) {
				return _asExtensionEvent(extHostDebugService.onDidChangeActiveStackItem)(listener, thisArg, disposables);
			},
			registerDebugConfigurationProvider(debugType: string, provider: zyraxoncode.DebugConfigurationProvider, triggerKind?: zyraxoncode.DebugConfigurationProviderTriggerKind) {
				return extHostDebugService.registerDebugConfigurationProvider(debugType, provider, triggerKind || DebugConfigurationProviderTriggerKind.Initial);
			},
			registerDebugAdapterDescriptorFactory(debugType: string, factory: zyraxoncode.DebugAdapterDescriptorFactory) {
				return extHostDebugService.registerDebugAdapterDescriptorFactory(extension, debugType, factory);
			},
			registerDebugAdapterTrackerFactory(debugType: string, factory: zyraxoncode.DebugAdapterTrackerFactory) {
				return extHostDebugService.registerDebugAdapterTrackerFactory(debugType, factory);
			},
			startDebugging(folder: zyraxoncode.WorkspaceFolder | undefined, nameOrConfig: string | zyraxoncode.DebugConfiguration, parentSessionOrOptions?: zyraxoncode.DebugSession | zyraxoncode.DebugSessionOptions) {
				if (!parentSessionOrOptions || (typeof parentSessionOrOptions === 'object' && 'configuration' in parentSessionOrOptions)) {
					return extHostDebugService.startDebugging(folder, nameOrConfig, { parentSession: parentSessionOrOptions });
				}
				return extHostDebugService.startDebugging(folder, nameOrConfig, parentSessionOrOptions || {});
			},
			stopDebugging(session?: zyraxoncode.DebugSession) {
				return extHostDebugService.stopDebugging(session);
			},
			addBreakpoints(breakpoints: readonly zyraxoncode.Breakpoint[]) {
				return extHostDebugService.addBreakpoints(breakpoints);
			},
			removeBreakpoints(breakpoints: readonly zyraxoncode.Breakpoint[]) {
				return extHostDebugService.removeBreakpoints(breakpoints);
			},
			asDebugSourceUri(source: zyraxoncode.DebugProtocolSource, session?: zyraxoncode.DebugSession): zyraxoncode.Uri {
				return extHostDebugService.asDebugSourceUri(source, session);
			}
		};

		const tasks: typeof zyraxoncode.tasks = {
			registerTaskProvider: (type: string, provider: zyraxoncode.TaskProvider) => {
				return extHostTask.registerTaskProvider(extension, type, provider);
			},
			fetchTasks: (filter?: zyraxoncode.TaskFilter): Thenable<zyraxoncode.Task[]> => {
				return extHostTask.fetchTasks(filter);
			},
			executeTask: (task: zyraxoncode.Task): Thenable<zyraxoncode.TaskExecution> => {
				return extHostTask.executeTask(extension, task);
			},
			get taskExecutions(): zyraxoncode.TaskExecution[] {
				return extHostTask.taskExecutions;
			},
			onDidStartTask: (listener: (e: zyraxoncode.TaskStartEvent) => any, thisArgs?: any, disposables?) => {
				const wrappedListener = (event: zyraxoncode.TaskStartEvent) => {
					if (!isProposedApiEnabled(extension, 'taskExecutionTerminal')) {
						if (event?.execution?.terminal !== undefined) {
							event.execution.terminal = undefined;
						}
					}
					const eventWithExecution = {
						...event,
						execution: event.execution
					};
					return listener.call(thisArgs, eventWithExecution);
				};
				return _asExtensionEvent(extHostTask.onDidStartTask)(wrappedListener, thisArgs, disposables);
			},
			onDidEndTask: (listeners, thisArgs?, disposables?) => {
				return _asExtensionEvent(extHostTask.onDidEndTask)(listeners, thisArgs, disposables);
			},
			onDidStartTaskProcess: (listeners, thisArgs?, disposables?) => {
				return _asExtensionEvent(extHostTask.onDidStartTaskProcess)(listeners, thisArgs, disposables);
			},
			onDidEndTaskProcess: (listeners, thisArgs?, disposables?) => {
				return _asExtensionEvent(extHostTask.onDidEndTaskProcess)(listeners, thisArgs, disposables);
			},
			onDidStartTaskProblemMatchers: (listeners, thisArgs?, disposables?) => {
				checkProposedApiEnabled(extension, 'taskProblemMatcherStatus');
				return _asExtensionEvent(extHostTask.onDidStartTaskProblemMatchers)(listeners, thisArgs, disposables);
			},
			onDidEndTaskProblemMatchers: (listeners, thisArgs?, disposables?) => {
				checkProposedApiEnabled(extension, 'taskProblemMatcherStatus');
				return _asExtensionEvent(extHostTask.onDidEndTaskProblemMatchers)(listeners, thisArgs, disposables);
			}
		};

		// namespace: notebook
		const notebooks: typeof zyraxoncode.notebooks = {
			createNotebookController(id: string, notebookType: string, label: string, handler?, rendererScripts?: zyraxoncode.NotebookRendererScript[]) {
				return extHostNotebookKernels.createNotebookController(extension, id, notebookType, label, handler, isProposedApiEnabled(extension, 'notebookMessaging') ? rendererScripts : undefined);
			},
			registerNotebookCellStatusBarItemProvider: (notebookType: string, provider: zyraxoncode.NotebookCellStatusBarItemProvider) => {
				return extHostNotebook.registerNotebookCellStatusBarItemProvider(extension, notebookType, provider);
			},
			createRendererMessaging(rendererId) {
				return extHostNotebookRenderers.createRendererMessaging(extension, rendererId);
			},
			createNotebookControllerDetectionTask(notebookType: string) {
				checkProposedApiEnabled(extension, 'notebookKernelSource');
				return extHostNotebookKernels.createNotebookControllerDetectionTask(extension, notebookType);
			},
			registerKernelSourceActionProvider(notebookType: string, provider: zyraxoncode.NotebookKernelSourceActionProvider) {
				checkProposedApiEnabled(extension, 'notebookKernelSource');
				return extHostNotebookKernels.registerKernelSourceActionProvider(extension, notebookType, provider);
			},
		};

		// namespace: l10n
		const l10n: typeof zyraxoncode.l10n = {
			t(...params: [message: string, ...args: Array<string | number | boolean>] | [message: string, args: Record<string, any>] | [{ message: string; args?: Array<string | number | boolean> | Record<string, any>; comment: string | string[] }]): string {
				if (typeof params[0] === 'string') {
					const key = params.shift() as string;

					// We have either rest args which are Array<string | number | boolean> or an array with a single Record<string, any>.
					// This ensures we get a Record<string | number, any> which will be formatted correctly.
					const argsFormatted = !params || typeof params[0] !== 'object' ? params : params[0];
					return extHostLocalization.getMessage(extension.identifier.value, { message: key, args: argsFormatted as Record<string | number, any> | undefined });
				}

				return extHostLocalization.getMessage(extension.identifier.value, params[0]);
			},
			get bundle() {
				return extHostLocalization.getBundle(extension.identifier.value);
			},
			get uri() {
				return extHostLocalization.getBundleUri(extension.identifier.value);
			}
		};

		// namespace: interactive
		const interactive: typeof zyraxoncode.interactive = {
			transferActiveChat(toWorkspace: zyraxoncode.Uri): Thenable<void> {
				checkProposedApiEnabled(extension, 'interactive');
				return extHostChatAgents2.transferActiveChat(toWorkspace);
			}
		};

		// namespace: ai
		const ai: typeof zyraxoncode.ai = {
			getRelatedInformation(query: string, types: zyraxoncode.RelatedInformationType[]): Thenable<zyraxoncode.RelatedInformationResult[]> {
				checkProposedApiEnabled(extension, 'aiRelatedInformation');
				return extHostAiRelatedInformation.getRelatedInformation(extension, query, types);
			},
			registerRelatedInformationProvider(type: zyraxoncode.RelatedInformationType, provider: zyraxoncode.RelatedInformationProvider) {
				checkProposedApiEnabled(extension, 'aiRelatedInformation');
				return extHostAiRelatedInformation.registerRelatedInformationProvider(extension, type, provider);
			},
			registerEmbeddingVectorProvider(model: string, provider: zyraxoncode.EmbeddingVectorProvider) {
				checkProposedApiEnabled(extension, 'aiRelatedInformation');
				return extHostAiEmbeddingVector.registerEmbeddingVectorProvider(extension, model, provider);
			},
			registerSettingsSearchProvider(provider: zyraxoncode.SettingsSearchProvider) {
				checkProposedApiEnabled(extension, 'aiSettingsSearch');
				return extHostAiSettingsSearch.registerSettingsSearchProvider(extension, provider);
			}
		};

		// namespace: chatregisterMcpServerDefinitionProvider
		const chat: typeof zyraxoncode.chat = {
			registerMappedEditsProvider(_selector: zyraxoncode.DocumentSelector, _provider: zyraxoncode.MappedEditsProvider) {
				checkProposedApiEnabled(extension, 'mappedEditsProvider');
				// no longer supported
				return { dispose() { } };
			},
			registerMappedEditsProvider2(provider: zyraxoncode.MappedEditsProvider2) {
				checkProposedApiEnabled(extension, 'mappedEditsProvider');
				return extHostCodeMapper.registerMappedEditsProvider(extension, provider);
			},
			createChatParticipant(id: string, handler: zyraxoncode.ChatExtendedRequestHandler) {
				return extHostChatAgents2.createChatAgent(extension, id, handler);
			},
			createDynamicChatParticipant(id: string, dynamicProps: zyraxoncode.DynamicChatParticipantProps, handler: zyraxoncode.ChatExtendedRequestHandler): zyraxoncode.ChatParticipant {
				checkProposedApiEnabled(extension, 'chatParticipantPrivate');
				return extHostChatAgents2.createDynamicChatAgent(extension, id, dynamicProps, handler);
			},
			registerChatParticipantDetectionProvider(provider: zyraxoncode.ChatParticipantDetectionProvider) {
				checkProposedApiEnabled(extension, 'chatParticipantPrivate');
				return extHostChatAgents2.registerChatParticipantDetectionProvider(extension, provider);
			},
			onDidDisposeChatSession: (listeners, thisArgs?, disposables?) => {
				checkProposedApiEnabled(extension, 'chatParticipantPrivate');
				return _asExtensionEvent(extHostChatAgents2.onDidDisposeChatSession)(listeners, thisArgs, disposables);
			},
			updateQuotas: (quotas: zyraxoncode.ChatQuotaSnapshots) => {
				checkProposedApiEnabled(extension, 'chatParticipantPrivate');
				extHostChatQuota.updateQuotas(quotas);
			},
			registerChatSessionItemProvider: (chatSessionType: string, provider: zyraxoncode.ChatSessionItemProvider) => {
				checkProposedApiEnabled(extension, 'chatSessionsProvider');
				extHostApiDeprecation.report('chat.registerChatSessionItemProvider', extension, `Please migrate to the new chat session controller API`, {
					usageId: chatSessionType
				});
				return extHostChatSessions.registerChatSessionItemProvider(extension, chatSessionType, provider);
			},
			createChatSessionItemController: (chatSessionType: string, refreshHandler: (token: zyraxoncode.CancellationToken) => Thenable<void>) => {
				checkProposedApiEnabled(extension, 'chatSessionsProvider');
				return extHostChatSessions.createChatSessionItemController(extension, chatSessionType, refreshHandler);
			},
			registerChatSessionContentProvider(scheme: string, provider: zyraxoncode.ChatSessionContentProvider, chatParticipant: zyraxoncode.ChatParticipant, capabilities?: zyraxoncode.ChatSessionCapabilities) {
				checkProposedApiEnabled(extension, 'chatSessionsProvider');
				return extHostChatSessions.registerChatSessionContentProvider(extension, scheme, chatParticipant, provider, capabilities);
			},
			registerChatOutputRenderer: (viewType: string, renderer: zyraxoncode.ChatOutputRenderer) => {
				checkProposedApiEnabled(extension, 'chatOutputRenderer');
				return extHostChatOutputRenderer.registerChatOutputRenderer(extension, viewType, renderer);
			},
			registerChatWorkspaceContextProvider(id: string, provider: zyraxoncode.ChatWorkspaceContextProvider): zyraxoncode.Disposable {
				checkProposedApiEnabled(extension, 'chatContextProvider');
				return extHostChatContext.registerChatWorkspaceContextProvider(`${extension.id}-${id}`, provider);
			},
			registerChatAttachContextProvider(id: string, provider: zyraxoncode.ChatAttachContextProvider): zyraxoncode.Disposable {
				checkProposedApiEnabled(extension, 'chatContextProvider');
				return extHostChatContext.registerChatAttachContextProvider(`${extension.id}-${id}`, provider);
			},
			registerChatTabContextProvider(selector: zyraxoncode.TabSelector, id: string, provider: zyraxoncode.ChatTabContextProvider): zyraxoncode.Disposable {
				checkProposedApiEnabled(extension, 'chatContextProvider');
				return extHostChatContext.registerChatTabContextProvider(selector, `${extension.id}-${id}`, provider);
			},
			registerChatExplicitContextProvider(_id: string, _provider: zyraxoncode.ChatAttachContextProvider): zyraxoncode.Disposable {
				checkProposedApiEnabled(extension, 'chatContextProvider');
				return { dispose: () => { } };
			},
			registerChatResourceContextProvider(_selector: zyraxoncode.DocumentSelector, _id: string, _provider: zyraxoncode.ChatTabContextProvider): zyraxoncode.Disposable {
				checkProposedApiEnabled(extension, 'chatContextProvider');
				return { dispose: () => { } };
			},
			registerCustomAgentProvider(provider: zyraxoncode.ChatCustomAgentProvider): zyraxoncode.Disposable {
				checkProposedApiEnabled(extension, 'chatPromptFiles');
				return extHostChatAgents2.registerPromptFileProvider(extension, PromptsType.agent, provider);
			},
			registerInstructionsProvider(provider: zyraxoncode.ChatInstructionsProvider): zyraxoncode.Disposable {
				checkProposedApiEnabled(extension, 'chatPromptFiles');
				return extHostChatAgents2.registerPromptFileProvider(extension, PromptsType.instructions, provider);
			},
			registerPromptFileProvider(provider: zyraxoncode.ChatPromptFileProvider): zyraxoncode.Disposable {
				checkProposedApiEnabled(extension, 'chatPromptFiles');
				return extHostChatAgents2.registerPromptFileProvider(extension, PromptsType.prompt, provider);
			},
			registerSkillProvider(provider: zyraxoncode.ChatSkillProvider): zyraxoncode.Disposable {
				checkProposedApiEnabled(extension, 'chatPromptFiles');
				return extHostChatAgents2.registerPromptFileProvider(extension, PromptsType.skill, provider);
			},
			registerHookProvider(provider: zyraxoncode.ChatHookProvider): zyraxoncode.Disposable {
				checkProposedApiEnabled(extension, 'chatPromptFiles');
				return extHostChatAgents2.registerPromptFileProvider(extension, PromptsType.hook, provider);
			},
			registerChatDebugLogProvider(provider: zyraxoncode.ChatDebugLogProvider): zyraxoncode.Disposable {
				checkProposedApiEnabled(extension, 'chatDebug');
				return extHostChatDebug.registerChatDebugLogProvider(provider);
			},
			onDidReceiveChatDebugEvent: (listener, thisArgs?, disposables?) => {
				checkProposedApiEnabled(extension, 'chatDebug');
				return extHostChatDebug.onDidAddCoreEvent(listener, thisArgs, disposables);
			},
			getCustomAgents(token: zyraxoncode.CancellationToken) {
				checkProposedApiEnabled(extension, 'chatPromptFiles');
				return extHostChatAgents2.provideCustomAgents(token) as Thenable<readonly zyraxoncode.ChatCustomAgent[]>;
			},
			onDidChangeCustomAgents: (listener, thisArgs?, disposables?) => {
				checkProposedApiEnabled(extension, 'chatPromptFiles');
				return extHostChatAgents2.onDidChangeCustomAgents(listener, thisArgs, disposables);
			},
			getInstructions(token: zyraxoncode.CancellationToken) {
				checkProposedApiEnabled(extension, 'chatPromptFiles');
				return extHostChatAgents2.provideInstructions(token) as Thenable<readonly zyraxoncode.ChatInstruction[]>;
			},
			onDidChangeInstructions: (listener, thisArgs?, disposables?) => {
				checkProposedApiEnabled(extension, 'chatPromptFiles');
				return extHostChatAgents2.onDidChangeInstructions(listener, thisArgs, disposables);
			},
			getSkills(token: zyraxoncode.CancellationToken) {
				checkProposedApiEnabled(extension, 'chatPromptFiles');
				return extHostChatAgents2.provideSkills(token) as Thenable<readonly zyraxoncode.ChatSkill[]>;
			},
			onDidChangeSkills: (listener, thisArgs?, disposables?) => {
				checkProposedApiEnabled(extension, 'chatPromptFiles');
				return extHostChatAgents2.onDidChangeSkills(listener, thisArgs, disposables);
			},
			getSlashCommands(token: zyraxoncode.CancellationToken) {
				checkProposedApiEnabled(extension, 'chatPromptFiles');
				return extHostChatAgents2.provideSlashCommands(token) as Thenable<readonly zyraxoncode.ChatSlashCommand[]>;
			},
			onDidChangeSlashCommands: (listener, thisArgs?, disposables?) => {
				checkProposedApiEnabled(extension, 'chatPromptFiles');
				return extHostChatAgents2.onDidChangeSlashCommands(listener, thisArgs, disposables);
			},
			getHooks(token: zyraxoncode.CancellationToken) {
				checkProposedApiEnabled(extension, 'chatPromptFiles');
				return extHostChatAgents2.provideHooks(token) as Thenable<readonly zyraxoncode.ChatHook[]>;
			},
			onDidChangeHooks: (listener, thisArgs?, disposables?) => {
				checkProposedApiEnabled(extension, 'chatPromptFiles');
				return extHostChatAgents2.onDidChangeHooks(listener, thisArgs, disposables);
			},
			getPlugins(token: zyraxoncode.CancellationToken) {
				checkProposedApiEnabled(extension, 'chatPromptFiles');
				return extHostChatAgents2.providePlugins(token) as Thenable<readonly zyraxoncode.ChatPlugin[]>;
			},
			onDidChangePlugins: (listener, thisArgs?, disposables?) => {
				checkProposedApiEnabled(extension, 'chatPromptFiles');
				return extHostChatAgents2.onDidChangePlugins(listener, thisArgs, disposables);
			},
			registerChatSessionCustomizationProvider(chatSessionType: string, metadata: zyraxoncode.ChatSessionCustomizationProviderMetadata, provider: zyraxoncode.ChatSessionCustomizationProvider): zyraxoncode.Disposable {
				checkProposedApiEnabled(extension, 'chatSessionCustomizationProvider');
				return extHostChatAgents2.registerChatSessionCustomizationProvider(extension, chatSessionType, metadata, provider);
			},
			createInputNotification(id: string): zyraxoncode.ChatInputNotification {
				checkProposedApiEnabled(extension, 'chatInputNotification');
				return extHostChatInputNotification.createInputNotification(extension, id);
			},
		};

		// namespace: lm
		const lm: typeof zyraxoncode.lm = {
			selectChatModels: (selector) => {
				return extHostLanguageModels.selectLanguageModels(extension, selector ?? {});
			},
			onDidChangeChatModels: (listener, thisArgs?, disposables?) => {
				return extHostLanguageModels.onDidChangeProviders(listener, thisArgs, disposables);
			},
			registerLanguageModelChatProvider: (vendor, provider) => {
				return extHostLanguageModels.registerLanguageModelChatProvider(extension, vendor, provider);
			},
			get isModelProxyAvailable() {
				checkProposedApiEnabled(extension, 'languageModelProxy');
				return extHostLanguageModels.isModelProxyAvailable;
			},
			onDidChangeModelProxyAvailability: (listener, thisArgs?, disposables?) => {
				checkProposedApiEnabled(extension, 'languageModelProxy');
				return extHostLanguageModels.onDidChangeModelProxyAvailability(listener, thisArgs, disposables);
			},
			getModelProxy: () => {
				checkProposedApiEnabled(extension, 'languageModelProxy');
				return extHostLanguageModels.getModelProxy(extension);
			},
			registerLanguageModelProxyProvider: (provider) => {
				checkProposedApiEnabled(extension, 'chatParticipantPrivate');
				return extHostLanguageModels.registerLanguageModelProxyProvider(extension, provider);
			},
			// --- embeddings
			get embeddingModels() {
				checkProposedApiEnabled(extension, 'embeddings');
				return extHostEmbeddings.embeddingsModels;
			},
			onDidChangeEmbeddingModels: (listener, thisArgs?, disposables?) => {
				checkProposedApiEnabled(extension, 'embeddings');
				return extHostEmbeddings.onDidChange(listener, thisArgs, disposables);
			},
			registerEmbeddingsProvider(embeddingsModel, provider) {
				checkProposedApiEnabled(extension, 'embeddings');
				return extHostEmbeddings.registerEmbeddingsProvider(extension, embeddingsModel, provider);
			},
			async computeEmbeddings(embeddingsModel, input, token?): Promise<any> {
				checkProposedApiEnabled(extension, 'embeddings');
				if (typeof input === 'string') {
					return extHostEmbeddings.computeEmbeddings(embeddingsModel, input, token);
				} else {
					return extHostEmbeddings.computeEmbeddings(embeddingsModel, input, token);
				}
			},
			registerTool<T>(name: string, tool: zyraxoncode.LanguageModelTool<T>) {
				return extHostLanguageModelTools.registerTool(extension, name, tool);
			},
			registerToolDefinition<T>(definition: zyraxoncode.LanguageModelToolDefinition, tool: zyraxoncode.LanguageModelTool<T>) {
				return extHostLanguageModelTools.registerToolDefinition(extension, definition, tool);
			},
			invokeTool<T>(nameOrInfo: string | zyraxoncode.LanguageModelToolInformation, parameters: zyraxoncode.LanguageModelToolInvocationOptions<T>, token?: zyraxoncode.CancellationToken) {
				if (typeof nameOrInfo !== 'string') {
					checkProposedApiEnabled(extension, 'chatParticipantAdditions');
				}
				return extHostLanguageModelTools.invokeTool(extension, nameOrInfo, parameters, token);
			},
			get tools() {
				return extHostLanguageModelTools.getTools(extension);
			},
			fileIsIgnored(uri: zyraxoncode.Uri, token?: zyraxoncode.CancellationToken) {
				return extHostLanguageModels.fileIsIgnored(extension, uri, token);
			},
			registerIgnoredFileProvider(provider: zyraxoncode.LanguageModelIgnoredFileProvider) {
				return extHostLanguageModels.registerIgnoredFileProvider(extension, provider);
			},
			registerMcpServerDefinitionProvider(id, provider) {
				return extHostMcp.registerMcpConfigurationProvider(extension, id, provider);
			},
			onDidChangeMcpServerDefinitions: (...args) => {
				checkProposedApiEnabled(extension, 'mcpServerDefinitions');
				return _asExtensionEvent(extHostMcp.onDidChangeMcpServerDefinitions)(...args);
			},
			get mcpServerDefinitions() {
				checkProposedApiEnabled(extension, 'mcpServerDefinitions');
				return extHostMcp.mcpServerDefinitions;
			},
			startMcpGateway(chatSessionResource?: URI) {
				checkProposedApiEnabled(extension, 'mcpServerDefinitions');
				return extHostMcp.startMcpGateway(chatSessionResource);
			},
			onDidChangeChatRequestTools(...args) {
				checkProposedApiEnabled(extension, 'chatParticipantAdditions');
				return _asExtensionEvent(extHostChatAgents2.onDidChangeChatRequestTools)(...args);
			}
		};

		// namespace: speech
		const speech: typeof zyraxoncode.speech = {
			registerSpeechProvider(id: string, provider: zyraxoncode.SpeechProvider) {
				checkProposedApiEnabled(extension, 'speech');
				return extHostSpeech.registerProvider(extension.identifier, id, provider);
			}
		};

		// eslint-disable-next-line local/code-no-dangerous-type-assertions
		return <typeof zyraxoncode>{
			version: initData.version,
			// namespaces
			ai,
			authentication,
			commands,
			comments,
			chat,
			debug,
			env,
			extensions,
			interactive,
			l10n,
			languages,
			lm,
			notebooks,
			scm,
			speech,
			tasks,
			tests,
			window,
			workspace,
			// types
			Breakpoint: extHostTypes.Breakpoint,
			TerminalOutputAnchor: extHostTypes.TerminalOutputAnchor,
			ChatResultFeedbackKind: extHostTypes.ChatResultFeedbackKind,
			ChatVariableLevel: extHostTypes.ChatVariableLevel,
			ChatCompletionItem: extHostTypes.ChatCompletionItem,
			ChatReferenceDiagnostic: extHostTypes.ChatReferenceDiagnostic,
			CallHierarchyIncomingCall: extHostTypes.CallHierarchyIncomingCall,
			CallHierarchyItem: extHostTypes.CallHierarchyItem,
			CallHierarchyOutgoingCall: extHostTypes.CallHierarchyOutgoingCall,
			CancellationError: errors.CancellationError,
			CancellationTokenSource: CancellationTokenSource,
			CandidatePortSource: CandidatePortSource,
			CodeAction: extHostTypes.CodeAction,
			CodeActionKind: extHostTypes.CodeActionKind,
			CodeActionTriggerKind: extHostTypes.CodeActionTriggerKind,
			CodeLens: extHostTypes.CodeLens,
			Color: extHostTypes.Color,
			ColorInformation: extHostTypes.ColorInformation,
			ColorPresentation: extHostTypes.ColorPresentation,
			ColorThemeKind: extHostTypes.ColorThemeKind,
			CommentMode: extHostTypes.CommentMode,
			CommentState: extHostTypes.CommentState,
			CommentThreadCollapsibleState: extHostTypes.CommentThreadCollapsibleState,
			CommentThreadState: extHostTypes.CommentThreadState,
			CommentThreadApplicability: extHostTypes.CommentThreadApplicability,
			CommentThreadFocus: extHostTypes.CommentThreadFocus,
			CompletionItem: extHostTypes.CompletionItem,
			CompletionItemKind: extHostTypes.CompletionItemKind,
			CompletionItemTag: extHostTypes.CompletionItemTag,
			CompletionList: extHostTypes.CompletionList,
			CompletionTriggerKind: extHostTypes.CompletionTriggerKind,
			ConfigurationTarget: extHostTypes.ConfigurationTarget,
			CustomExecution: extHostTypes.CustomExecution,
			DebugAdapterExecutable: extHostTypes.DebugAdapterExecutable,
			DebugAdapterInlineImplementation: extHostTypes.DebugAdapterInlineImplementation,
			DebugAdapterNamedPipeServer: extHostTypes.DebugAdapterNamedPipeServer,
			DebugAdapterServer: extHostTypes.DebugAdapterServer,
			DebugConfigurationProviderTriggerKind: DebugConfigurationProviderTriggerKind,
			DebugConsoleMode: extHostTypes.DebugConsoleMode,
			DebugVisualization: extHostTypes.DebugVisualization,
			DecorationRangeBehavior: extHostTypes.DecorationRangeBehavior,
			Diagnostic: extHostTypes.Diagnostic,
			DiagnosticRelatedInformation: extHostTypes.DiagnosticRelatedInformation,
			DiagnosticSeverity: extHostTypes.DiagnosticSeverity,
			DiagnosticTag: extHostTypes.DiagnosticTag,
			Disposable: extHostTypes.Disposable,
			DocumentHighlight: extHostTypes.DocumentHighlight,
			DocumentHighlightKind: extHostTypes.DocumentHighlightKind,
			MultiDocumentHighlight: extHostTypes.MultiDocumentHighlight,
			DocumentLink: extHostTypes.DocumentLink,
			DocumentSymbol: extHostTypes.DocumentSymbol,
			EndOfLine: extHostTypes.EndOfLine,
			EnvironmentVariableMutatorType: extHostTypes.EnvironmentVariableMutatorType,
			EvaluatableExpression: extHostTypes.EvaluatableExpression,
			InlineValueText: extHostTypes.InlineValueText,
			InlineValueVariableLookup: extHostTypes.InlineValueVariableLookup,
			InlineValueEvaluatableExpression: extHostTypes.InlineValueEvaluatableExpression,
			InlineCompletionTriggerKind: extHostTypes.InlineCompletionTriggerKind,
			InlineCompletionsDisposeReasonKind: extHostTypes.InlineCompletionsDisposeReasonKind,
			EventEmitter: Emitter,
			ExtensionKind: extHostTypes.ExtensionKind,
			ExtensionMode: extHostTypes.ExtensionMode,
			ExternalUriOpenerPriority: extHostTypes.ExternalUriOpenerPriority,
			FileChangeType: extHostTypes.FileChangeType,
			FileDecoration: extHostTypes.FileDecoration,
			FileDecoration2: extHostTypes.FileDecoration,
			FileSystemError: extHostTypes.FileSystemError,
			FileType: files.FileType,
			FilePermission: files.FilePermission,
			FoldingRange: extHostTypes.FoldingRange,
			FoldingRangeKind: extHostTypes.FoldingRangeKind,
			FunctionBreakpoint: extHostTypes.FunctionBreakpoint,
			InlineCompletionItem: extHostTypes.InlineSuggestion,
			InlineCompletionList: extHostTypes.InlineSuggestionList,
			Hover: extHostTypes.Hover,
			VerboseHover: extHostTypes.VerboseHover,
			HoverVerbosityAction: extHostTypes.HoverVerbosityAction,
			IndentAction: languageConfiguration.IndentAction,
			Location: extHostTypes.Location,
			MarkdownString: extHostTypes.MarkdownString,
			OverviewRulerLane: OverviewRulerLane,
			ParameterInformation: extHostTypes.ParameterInformation,
			PortAutoForwardAction: extHostTypes.PortAutoForwardAction,
			Position: extHostTypes.Position,
			ProcessExecution: extHostTypes.ProcessExecution,
			ProgressLocation: extHostTypes.ProgressLocation,
			QuickInputButtonLocation: extHostTypes.QuickInputButtonLocation,
			QuickInputButtons: extHostTypes.QuickInputButtons,
			Range: extHostTypes.Range,
			RelativePattern: extHostTypes.RelativePattern,
			Selection: extHostTypes.Selection,
			SelectionRange: extHostTypes.SelectionRange,
			SemanticTokens: extHostTypes.SemanticTokens,
			SemanticTokensBuilder: extHostTypes.SemanticTokensBuilder,
			SemanticTokensEdit: extHostTypes.SemanticTokensEdit,
			SemanticTokensEdits: extHostTypes.SemanticTokensEdits,
			SemanticTokensLegend: extHostTypes.SemanticTokensLegend,
			ShellExecution: extHostTypes.ShellExecution,
			ShellQuoting: extHostTypes.ShellQuoting,
			SignatureHelp: extHostTypes.SignatureHelp,
			SignatureHelpTriggerKind: extHostTypes.SignatureHelpTriggerKind,
			SignatureInformation: extHostTypes.SignatureInformation,
			SnippetString: extHostTypes.SnippetString,
			SourceBreakpoint: extHostTypes.SourceBreakpoint,
			StandardTokenType: extHostTypes.StandardTokenType,
			SyntaxHighlightingTokenFontStyle: extHostTypes.SyntaxHighlightingTokenFontStyle,
			StatusBarAlignment: extHostTypes.StatusBarAlignment,
			SymbolInformation: extHostTypes.SymbolInformation,
			SymbolKind: extHostTypes.SymbolKind,
			SymbolTag: extHostTypes.SymbolTag,
			Task: extHostTypes.Task,
			TaskEventKind: extHostTypes.TaskEventKind,
			TaskGroup: extHostTypes.TaskGroup,
			TaskPanelKind: extHostTypes.TaskPanelKind,
			TaskRevealKind: extHostTypes.TaskRevealKind,
			TaskRunOn: extHostTypes.TaskRunOn,
			TaskScope: extHostTypes.TaskScope,
			TerminalLink: extHostTypes.TerminalLink,
			TerminalQuickFixTerminalCommand: extHostTypes.TerminalQuickFixCommand,
			TerminalQuickFixOpener: extHostTypes.TerminalQuickFixOpener,
			TerminalLocation: extHostTypes.TerminalLocation,
			TerminalProfile: extHostTypes.TerminalProfile,
			TerminalExitReason: extHostTypes.TerminalExitReason,
			TerminalShellExecutionCommandLineConfidence: extHostTypes.TerminalShellExecutionCommandLineConfidence,
			TerminalCompletionItem: extHostTypes.TerminalCompletionItem,
			TerminalCompletionItemKind: extHostTypes.TerminalCompletionItemKind,
			TerminalCompletionList: extHostTypes.TerminalCompletionList,
			TerminalShellType: extHostTypes.TerminalShellType,
			TextDocumentSaveReason: extHostTypes.TextDocumentSaveReason,
			TextEdit: extHostTypes.TextEdit,
			SnippetTextEdit: extHostTypes.SnippetTextEdit,
			TextEditorCursorStyle: TextEditorCursorStyle,
			TextEditorChangeKind: extHostTypes.TextEditorChangeKind,
			TextEditorLineNumbersStyle: extHostTypes.TextEditorLineNumbersStyle,
			TextEditorRevealType: extHostTypes.TextEditorRevealType,
			TextEditorSelectionChangeKind: extHostTypes.TextEditorSelectionChangeKind,
			SyntaxTokenType: extHostTypes.SyntaxTokenType,
			TextDocumentChangeReason: extHostTypes.TextDocumentChangeReason,
			ThemeColor: extHostTypes.ThemeColor,
			ThemeIcon: extHostTypes.ThemeIcon,
			TreeItem: extHostTypes.TreeItem,
			TreeItemCheckboxState: extHostTypes.TreeItemCheckboxState,
			TreeItemCollapsibleState: extHostTypes.TreeItemCollapsibleState,
			TypeHierarchyItem: extHostTypes.TypeHierarchyItem,
			UIKind: UIKind,
			Uri: URI,
			ViewColumn: extHostTypes.ViewColumn,
			WorkspaceEdit: extHostTypes.WorkspaceEdit,
			// proposed api types
			DocumentPasteTriggerKind: extHostTypes.DocumentPasteTriggerKind,
			DocumentDropEdit: extHostTypes.DocumentDropEdit,
			DocumentDropOrPasteEditKind: extHostTypes.DocumentDropOrPasteEditKind,
			DocumentPasteEdit: extHostTypes.DocumentPasteEdit,
			InlayHint: extHostTypes.InlayHint,
			InlayHintLabelPart: extHostTypes.InlayHintLabelPart,
			InlayHintKind: extHostTypes.InlayHintKind,
			RemoteAuthorityResolverError: extHostTypes.RemoteAuthorityResolverError,
			ResolvedAuthority: extHostTypes.ResolvedAuthority,
			ManagedResolvedAuthority: extHostTypes.ManagedResolvedAuthority,
			SourceControlInputBoxValidationType: extHostTypes.SourceControlInputBoxValidationType,
			ExtensionRuntime: extHostTypes.ExtensionRuntime,
			TimelineItem: extHostTypes.TimelineItem,
			NotebookRange: extHostTypes.NotebookRange,
			NotebookCellKind: extHostTypes.NotebookCellKind,
			NotebookCellExecutionState: extHostTypes.NotebookCellExecutionState,
			NotebookCellData: extHostTypes.NotebookCellData,
			NotebookData: extHostTypes.NotebookData,
			NotebookRendererScript: extHostTypes.NotebookRendererScript,
			NotebookCellStatusBarAlignment: extHostTypes.NotebookCellStatusBarAlignment,
			NotebookEditorRevealType: extHostTypes.NotebookEditorRevealType,
			NotebookCellOutput: extHostTypes.NotebookCellOutput,
			NotebookCellOutputItem: extHostTypes.NotebookCellOutputItem,
			CellErrorStackFrame: extHostTypes.CellErrorStackFrame,
			NotebookCellStatusBarItem: extHostTypes.NotebookCellStatusBarItem,
			NotebookControllerAffinity: extHostTypes.NotebookControllerAffinity,
			NotebookControllerAffinity2: extHostTypes.NotebookControllerAffinity2,
			NotebookEdit: extHostTypes.NotebookEdit,
			NotebookKernelSourceAction: extHostTypes.NotebookKernelSourceAction,
			NotebookVariablesRequestKind: extHostTypes.NotebookVariablesRequestKind,
			PortAttributes: extHostTypes.PortAttributes,
			LinkedEditingRanges: extHostTypes.LinkedEditingRanges,
			TestResultState: extHostTypes.TestResultState,
			TestRunRequest: extHostTypes.TestRunRequest,
			TestMessage: extHostTypes.TestMessage,
			TestMessageStackFrame: extHostTypes.TestMessageStackFrame,
			TestTag: extHostTypes.TestTag,
			TestRunProfileKind: extHostTypes.TestRunProfileKind,
			TextSearchCompleteMessageType: TextSearchCompleteMessageType,
			DataTransfer: extHostTypes.DataTransfer,
			DataTransferItem: extHostTypes.DataTransferItem,
			TestCoverageCount: extHostTypes.TestCoverageCount,
			FileCoverage: extHostTypes.FileCoverage,
			StatementCoverage: extHostTypes.StatementCoverage,
			BranchCoverage: extHostTypes.BranchCoverage,
			DeclarationCoverage: extHostTypes.DeclarationCoverage,
			WorkspaceTrustState: extHostTypes.WorkspaceTrustState,
			LanguageStatusSeverity: extHostTypes.LanguageStatusSeverity,
			QuickPickItemKind: extHostTypes.QuickPickItemKind,
			InputBoxValidationSeverity: extHostTypes.InputBoxValidationSeverity,
			TabInputText: extHostTypes.TextTabInput,
			TabInputTextDiff: extHostTypes.TextDiffTabInput,
			TabInputTextMerge: extHostTypes.TextMergeTabInput,
			TabInputCustom: extHostTypes.CustomEditorTabInput,
			TabInputNotebook: extHostTypes.NotebookEditorTabInput,
			TabInputNotebookDiff: extHostTypes.NotebookDiffEditorTabInput,
			TabInputWebview: extHostTypes.WebviewEditorTabInput,
			TabInputTerminal: extHostTypes.TerminalEditorTabInput,
			TabInputInteractiveWindow: extHostTypes.InteractiveWindowInput,
			TabInputChat: extHostTypes.ChatEditorTabInput,
			TabInputTextMultiDiff: extHostTypes.TextMultiDiffTabInput,
			TelemetryTrustedValue: TelemetryTrustedValue,
			LogLevel: LogLevel,
			EditSessionIdentityMatch: EditSessionIdentityMatch,
			InteractiveSessionVoteDirection: extHostTypes.InteractiveSessionVoteDirection,
			ChatCopyKind: extHostTypes.ChatCopyKind,
			ChatSessionChangedFile: extHostTypes.ChatSessionChangedFile,
			ChatEditingSessionActionOutcome: extHostTypes.ChatEditingSessionActionOutcome,
			InteractiveEditorResponseFeedbackKind: extHostTypes.InteractiveEditorResponseFeedbackKind,
			DebugStackFrame: extHostTypes.DebugStackFrame,
			DebugThread: extHostTypes.DebugThread,
			RelatedInformationType: extHostTypes.RelatedInformationType,
			SpeechToTextStatus: extHostTypes.SpeechToTextStatus,
			TextToSpeechStatus: extHostTypes.TextToSpeechStatus,
			PartialAcceptTriggerKind: extHostTypes.PartialAcceptTriggerKind,
			InlineCompletionEndOfLifeReasonKind: extHostTypes.InlineCompletionEndOfLifeReasonKind,
			InlineCompletionDisplayLocationKind: extHostTypes.InlineCompletionDisplayLocationKind,
			KeywordRecognitionStatus: extHostTypes.KeywordRecognitionStatus,
			ChatImageMimeType: extHostTypes.ChatImageMimeType,
			ChatResponseMarkdownPart: extHostTypes.ChatResponseMarkdownPart,
			ChatResponseFileTreePart: extHostTypes.ChatResponseFileTreePart,
			ChatResponseAnchorPart: extHostTypes.ChatResponseAnchorPart,
			ChatResponseProgressPart: extHostTypes.ChatResponseProgressPart,
			ChatResponseProgressPart2: extHostTypes.ChatResponseProgressPart2,
			ChatResponseThinkingProgressPart: extHostTypes.ChatResponseThinkingProgressPart,
			ChatResponseHookPart: extHostTypes.ChatResponseHookPart,
			ChatResponseVoiceProgressPart: extHostTypes.ChatResponseVoiceProgressPart,
			ChatResponseAutoModeResolutionPart: extHostTypes.ChatResponseAutoModeResolutionPart,
			ChatResponseReferencePart: extHostTypes.ChatResponseReferencePart,
			ChatResponseReferencePart2: extHostTypes.ChatResponseReferencePart,
			ChatResponseCodeCitationPart: extHostTypes.ChatResponseCodeCitationPart,
			ChatResponseCodeblockUriPart: extHostTypes.ChatResponseCodeblockUriPart,
			ChatResponseWarningPart: extHostTypes.ChatResponseWarningPart,
			ChatResponseInfoPart: extHostTypes.ChatResponseInfoPart,
			ChatResponseTextEditPart: extHostTypes.ChatResponseTextEditPart,
			ChatResponseNotebookEditPart: extHostTypes.ChatResponseNotebookEditPart,
			ChatResponseWorkspaceEditPart: extHostTypes.ChatResponseWorkspaceEditPart,
			ChatResponseMarkdownWithVulnerabilitiesPart: extHostTypes.ChatResponseMarkdownWithVulnerabilitiesPart,
			ChatResponseCommandButtonPart: extHostTypes.ChatResponseCommandButtonPart,
			ChatResponseConfirmationPart: extHostTypes.ChatResponseConfirmationPart,
			ChatQuestion: extHostTypes.ChatQuestion,
			ChatQuestionType: extHostTypes.ChatQuestionType,
			ChatResponseQuestionCarouselPart: extHostTypes.ChatResponseQuestionCarouselPart,
			ChatResponseMovePart: extHostTypes.ChatResponseMovePart,
			ChatResponseExtensionsPart: extHostTypes.ChatResponseExtensionsPart,
			ChatResponseExternalEditPart: extHostTypes.ChatResponseExternalEditPart,
			ChatResponsePullRequestPart: extHostTypes.ChatResponsePullRequestPart,
			ChatResponseMultiDiffPart: extHostTypes.ChatResponseMultiDiffPart,
			ChatResponseReferencePartStatusKind: extHostTypes.ChatResponseReferencePartStatusKind,
			ChatResponseClearToPreviousToolInvocationReason: extHostTypes.ChatResponseClearToPreviousToolInvocationReason,
			ChatRequestTurn: extHostTypes.ChatRequestTurn,
			ChatRequestTurn2: extHostTypes.ChatRequestTurn,
			ChatResponseTurn: extHostTypes.ChatResponseTurn,
			ChatResponseTurn2: extHostTypes.ChatResponseTurn2,
			ChatSubagentToolInvocationData: extHostTypes.ChatSubagentToolInvocationData,
			ChatToolInvocationPart: extHostTypes.ChatToolInvocationPart,
			ChatLocation: extHostTypes.ChatLocation,
			ChatSessionStatus: extHostTypes.ChatSessionStatus,
			ChatSessionCustomizationType: extHostTypes.ChatSessionCustomizationType,
			ChatDebugLogLevel: extHostTypes.ChatDebugLogLevel,
			ChatDebugToolCallResult: extHostTypes.ChatDebugToolCallResult,
			ChatDebugHookResult: extHostTypes.ChatDebugHookResult,
			ChatDebugToolCallEvent: extHostTypes.ChatDebugToolCallEvent,
			ChatDebugModelTurnEvent: extHostTypes.ChatDebugModelTurnEvent,
			ChatDebugGenericEvent: extHostTypes.ChatDebugGenericEvent,
			ChatDebugSubagentInvocationEvent: extHostTypes.ChatDebugSubagentInvocationEvent,
			ChatDebugUserMessageEvent: extHostTypes.ChatDebugUserMessageEvent,
			ChatDebugAgentResponseEvent: extHostTypes.ChatDebugAgentResponseEvent,
			ChatDebugMessageSection: extHostTypes.ChatDebugMessageSection,
			ChatDebugEventTextContent: extHostTypes.ChatDebugEventTextContent,
			ChatDebugMessageContentType: extHostTypes.ChatDebugMessageContentType,
			ChatDebugEventMessageContent: extHostTypes.ChatDebugEventMessageContent,
			ChatDebugEventToolCallContent: extHostTypes.ChatDebugEventToolCallContent,
			ChatDebugEventModelTurnContent: extHostTypes.ChatDebugEventModelTurnContent,
			ChatDebugEventHookContent: extHostTypes.ChatDebugEventHookContent,
			ChatRequestEditorData: extHostTypes.ChatRequestEditorData,
			ChatRequestNotebookData: extHostTypes.ChatRequestNotebookData,
			ChatReferenceBinaryData: extHostTypes.ChatReferenceBinaryData,
			ChatRequestEditedFileEventKind: extHostTypes.ChatRequestEditedFileEventKind,
			LanguageModelChatMessageRole: extHostTypes.LanguageModelChatMessageRole,
			LanguageModelChatMessage: extHostTypes.LanguageModelChatMessage,
			LanguageModelChatMessage2: extHostTypes.LanguageModelChatMessage2,
			LanguageModelToolResultPart: extHostTypes.LanguageModelToolResultPart,
			LanguageModelToolResultPart2: extHostTypes.LanguageModelToolResultPart,
			LanguageModelTextPart: extHostTypes.LanguageModelTextPart,
			LanguageModelTextPart2: extHostTypes.LanguageModelTextPart,
			LanguageModelPartAudience: extHostTypes.LanguageModelPartAudience,
			ToolResultAudience: extHostTypes.LanguageModelPartAudience, // back compat
			LanguageModelToolCallPart: extHostTypes.LanguageModelToolCallPart,
			LanguageModelThinkingPart: extHostTypes.LanguageModelThinkingPart,
			LanguageModelError: extHostTypes.LanguageModelError,
			LanguageModelToolResult: extHostTypes.LanguageModelToolResult,
			LanguageModelToolResult2: extHostTypes.LanguageModelToolResult2,
			LanguageModelDataPart: extHostTypes.LanguageModelDataPart,
			LanguageModelDataPart2: extHostTypes.LanguageModelDataPart,
			LanguageModelToolExtensionSource: extHostTypes.LanguageModelToolExtensionSource,
			LanguageModelToolMCPSource: extHostTypes.LanguageModelToolMCPSource,
			ExtendedLanguageModelToolResult: extHostTypes.ExtendedLanguageModelToolResult,
			LanguageModelChatToolMode: extHostTypes.LanguageModelChatToolMode,
			LanguageModelPromptTsxPart: extHostTypes.LanguageModelPromptTsxPart,
			NewSymbolName: extHostTypes.NewSymbolName,
			NewSymbolNameTag: extHostTypes.NewSymbolNameTag,
			NewSymbolNameTriggerKind: extHostTypes.NewSymbolNameTriggerKind,
			ExcludeSettingOptions: ExcludeSettingOptions,
			TextSearchContext2: TextSearchContext2,
			TextSearchMatch2: TextSearchMatch2,
			AISearchKeyword: AISearchKeyword,
			TextSearchCompleteMessageTypeNew: TextSearchCompleteMessageType,
			ChatErrorLevel: extHostTypes.ChatErrorLevel,
			ChatInputNotificationSeverity: extHostTypes.ChatInputNotificationSeverity,
			McpHttpServerDefinition: extHostTypes.McpHttpServerDefinition,
			McpHttpServerDefinition2: extHostTypes.McpHttpServerDefinition,
			McpStdioServerDefinition: extHostTypes.McpStdioServerDefinition,
			McpStdioServerDefinition2: extHostTypes.McpStdioServerDefinition,
			McpToolAvailability: extHostTypes.McpToolAvailability,
			McpToolInvocationContentData: extHostTypes.McpToolInvocationContentData,
			SettingsSearchResultKind: extHostTypes.SettingsSearchResultKind,
			ChatTodoStatus: extHostTypes.ChatTodoStatus,
			ChatDebugSubagentStatus: extHostTypes.ChatDebugSubagentStatus,
		};
	};
}
