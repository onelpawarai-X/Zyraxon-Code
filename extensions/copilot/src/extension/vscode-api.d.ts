/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/// <reference path="../../../../src/typings/thenable.d.ts" />
/// <reference path="../../../../src/vscode-dts/zyraxoncode.d.ts" />

// List of all API proposals we depend on
/// <reference path="../../../../src/vscode-dts/zyraxoncode.proposed.activeComment.d.ts" />
/// <reference path="../../../../src/vscode-dts/zyraxoncode.proposed.agentSessionsWorkspace.d.ts" />
/// <reference path="../../../../src/vscode-dts/zyraxoncode.proposed.aiRelatedInformation.d.ts" />
/// <reference path="../../../../src/vscode-dts/zyraxoncode.proposed.aiSettingsSearch.d.ts" />
/// <reference path="../../../../src/vscode-dts/zyraxoncode.proposed.aiTextSearchProvider.d.ts" />
/// <reference path="../../../../src/vscode-dts/zyraxoncode.proposed.authLearnMore.d.ts" />
/// <reference path="../../../../src/vscode-dts/zyraxoncode.proposed.chatDebug.d.ts" />
/// <reference path="../../../../src/vscode-dts/zyraxoncode.proposed.chatHooks.d.ts" />
/// <reference path="../../../../src/vscode-dts/zyraxoncode.proposed.chatInputNotification.d.ts" />
/// <reference path="../../../../src/vscode-dts/zyraxoncode.proposed.chatParticipantAdditions.d.ts" />
/// <reference path="../../../../src/vscode-dts/zyraxoncode.proposed.chatParticipantPrivate.d.ts" />
/// <reference path="../../../../src/vscode-dts/zyraxoncode.proposed.chatPromptFiles.d.ts" />
/// <reference path="../../../../src/vscode-dts/zyraxoncode.proposed.chatProvider.d.ts" />
/// <reference path="../../../../src/vscode-dts/zyraxoncode.proposed.languageModelPricing.d.ts" />
/// <reference path="../../../../src/vscode-dts/zyraxoncode.proposed.chatReferenceBinaryData.d.ts" />
/// <reference path="../../../../src/vscode-dts/zyraxoncode.proposed.chatReferenceDiagnostic.d.ts" />
/// <reference path="../../../../src/vscode-dts/zyraxoncode.proposed.chatSessionCustomizationProvider.d.ts" />
/// <reference path="../../../../src/vscode-dts/zyraxoncode.proposed.chatSessionsProvider.d.ts" />
/// <reference path="../../../../src/vscode-dts/zyraxoncode.proposed.chatStatusItem.d.ts" />
/// <reference path="../../../../src/vscode-dts/zyraxoncode.proposed.codeActionAI.d.ts" />
/// <reference path="../../../../src/vscode-dts/zyraxoncode.proposed.commentReveal.d.ts" />
/// <reference path="../../../../src/vscode-dts/zyraxoncode.proposed.contribChatEditorInlineGutterMenu.d.ts" />
/// <reference path="../../../../src/vscode-dts/zyraxoncode.proposed.contribCommentThreadAdditionalMenu.d.ts" />
/// <reference path="../../../../src/vscode-dts/zyraxoncode.proposed.contribCommentsViewThreadMenus.d.ts" />
/// <reference path="../../../../src/vscode-dts/zyraxoncode.proposed.contribDebugCreateConfiguration.d.ts" />
/// <reference path="../../../../src/vscode-dts/zyraxoncode.proposed.contribEditorContentMenu.d.ts" />
/// <reference path="../../../../src/vscode-dts/zyraxoncode.proposed.contribLanguageModelToolSets.d.ts" />
/// <reference path="../../../../src/vscode-dts/zyraxoncode.proposed.contribSourceControlInputBoxMenu.d.ts" />
/// <reference path="../../../../src/vscode-dts/zyraxoncode.proposed.dataChannels.d.ts" />
/// <reference path="../../../../src/vscode-dts/zyraxoncode.proposed.defaultChatParticipant.d.ts" />
/// <reference path="../../../../src/vscode-dts/zyraxoncode.proposed.devDeviceId.d.ts" />
/// <reference path="../../../../src/vscode-dts/zyraxoncode.proposed.documentFiltersExclusive.d.ts" />
/// <reference path="../../../../src/vscode-dts/zyraxoncode.proposed.embeddings.d.ts" />
/// <reference path="../../../../src/vscode-dts/zyraxoncode.proposed.environmentPower.d.ts" />
/// <reference path="../../../../src/vscode-dts/zyraxoncode.proposed.extensionsAny.d.ts" />
/// <reference path="../../../../src/vscode-dts/zyraxoncode.proposed.findFiles2.d.ts" />
/// <reference path="../../../../src/vscode-dts/zyraxoncode.proposed.findTextInFiles.d.ts" />
/// <reference path="../../../../src/vscode-dts/zyraxoncode.proposed.findTextInFiles2.d.ts" />
/// <reference path="../../../../src/vscode-dts/zyraxoncode.proposed.inlineCompletionsAdditions.d.ts" />
/// <reference path="../../../../src/vscode-dts/zyraxoncode.proposed.interactive.d.ts" />
/// <reference path="../../../../src/vscode-dts/zyraxoncode.proposed.languageModelCapabilities.d.ts" />
/// <reference path="../../../../src/vscode-dts/zyraxoncode.proposed.languageModelSystem.d.ts" />
/// <reference path="../../../../src/vscode-dts/zyraxoncode.proposed.languageModelThinkingPart.d.ts" />
/// <reference path="../../../../src/vscode-dts/zyraxoncode.proposed.languageModelToolResultAudience.d.ts" />
/// <reference path="../../../../src/vscode-dts/zyraxoncode.proposed.languageModelToolSupportsModel.d.ts" />
/// <reference path="../../../../src/vscode-dts/zyraxoncode.proposed.mappedEditsProvider.d.ts" />
/// <reference path="../../../../src/vscode-dts/zyraxoncode.proposed.mcpServerDefinitions.d.ts" />
/// <reference path="../../../../src/vscode-dts/zyraxoncode.proposed.newSymbolNamesProvider.d.ts" />
/// <reference path="../../../../src/vscode-dts/zyraxoncode.proposed.resolvers.d.ts" />
/// <reference path="../../../../src/vscode-dts/zyraxoncode.proposed.tabInputMultiDiff.d.ts" />
/// <reference path="../../../../src/vscode-dts/zyraxoncode.proposed.taskExecutionTerminal.d.ts" />
/// <reference path="../../../../src/vscode-dts/zyraxoncode.proposed.taskProblemMatcherStatus.d.ts" />
/// <reference path="../../../../src/vscode-dts/zyraxoncode.proposed.terminalDataWriteEvent.d.ts" />
/// <reference path="../../../../src/vscode-dts/zyraxoncode.proposed.terminalExecuteCommandEvent.d.ts" />
/// <reference path="../../../../src/vscode-dts/zyraxoncode.proposed.terminalQuickFixProvider.d.ts" />
/// <reference path="../../../../src/vscode-dts/zyraxoncode.proposed.terminalSelection.d.ts" />
/// <reference path="../../../../src/vscode-dts/zyraxoncode.proposed.terminalTitle.d.ts" />
/// <reference path="../../../../src/vscode-dts/zyraxoncode.proposed.testObserver.d.ts" />
/// <reference path="../../../../src/vscode-dts/zyraxoncode.proposed.textDocumentChangeReason.d.ts" />
/// <reference path="../../../../src/vscode-dts/zyraxoncode.proposed.textSearchProvider.d.ts" />
/// <reference path="../../../../src/vscode-dts/zyraxoncode.proposed.textSearchProvider2.d.ts" />
/// <reference path="../../../../src/vscode-dts/zyraxoncode.proposed.toolInvocationApproveCombination.d.ts" />
/// <reference path="../../../../src/vscode-dts/zyraxoncode.proposed.workspaceTrust.d.ts" />
