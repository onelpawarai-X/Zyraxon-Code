/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as zyraxoncode from 'zyraxoncode';

export import Position = zyraxoncode.Position;
export import Range = zyraxoncode.Range;
export import Selection = zyraxoncode.Selection;
export import EventEmitter = zyraxoncode.EventEmitter;
export import CancellationTokenSource = zyraxoncode.CancellationTokenSource;
export import Diagnostic = zyraxoncode.Diagnostic;
export import TextEdit = zyraxoncode.TextEdit;
export import WorkspaceEdit = zyraxoncode.WorkspaceEdit;
export import Uri = zyraxoncode.Uri;
export import MarkdownString = zyraxoncode.MarkdownString;
export import TextEditorCursorStyle = zyraxoncode.TextEditorCursorStyle;
export import TextEditorLineNumbersStyle = zyraxoncode.TextEditorLineNumbersStyle;
export import TextEditorRevealType = zyraxoncode.TextEditorRevealType;
export import EndOfLine = zyraxoncode.EndOfLine;
export import DiagnosticSeverity = zyraxoncode.DiagnosticSeverity;
export import ExtensionMode = zyraxoncode.ExtensionMode;
export import Location = zyraxoncode.Location;
export import DiagnosticRelatedInformation = zyraxoncode.DiagnosticRelatedInformation;
export import ChatVariableLevel = zyraxoncode.ChatVariableLevel;
export import ChatResponseClearToPreviousToolInvocationReason = zyraxoncode.ChatResponseClearToPreviousToolInvocationReason;
export import ChatResponseMarkdownPart = zyraxoncode.ChatResponseMarkdownPart;
export import ChatResponseThinkingProgressPart = zyraxoncode.ChatResponseThinkingProgressPart;
export import ChatResponseHookPart = zyraxoncode.ChatResponseHookPart;
export import ChatResponseVoiceProgressPart = zyraxoncode.ChatResponseVoiceProgressPart;
export import ChatHookType = zyraxoncode.ChatHookType;
export import ChatResponseFileTreePart = zyraxoncode.ChatResponseFileTreePart;
export import ChatResponseAnchorPart = zyraxoncode.ChatResponseAnchorPart;
export import ChatResponseProgressPart = zyraxoncode.ChatResponseProgressPart;
export import ChatResponseProgressPart2 = zyraxoncode.ChatResponseProgressPart2;
export import ChatResponseReferencePart = zyraxoncode.ChatResponseReferencePart;
export import ChatResponseReferencePart2 = zyraxoncode.ChatResponseReferencePart2;
export import ChatResponseCodeCitationPart = zyraxoncode.ChatResponseCodeCitationPart;
export import ChatResponseCommandButtonPart = zyraxoncode.ChatResponseCommandButtonPart;
export import ChatResponseWarningPart = zyraxoncode.ChatResponseWarningPart;
export import ChatResponseInfoPart = zyraxoncode.ChatResponseInfoPart;
export import ChatResponseMovePart = zyraxoncode.ChatResponseMovePart;
export import ChatResponseExtensionsPart = zyraxoncode.ChatResponseExtensionsPart;
export import ChatResponseExternalEditPart = zyraxoncode.ChatResponseExternalEditPart;
export import ChatResponsePullRequestPart = zyraxoncode.ChatResponsePullRequestPart;
export import ChatResponseAutoModeResolutionPart = zyraxoncode.ChatResponseAutoModeResolutionPart;
export import ChatResponseMarkdownWithVulnerabilitiesPart = zyraxoncode.ChatResponseMarkdownWithVulnerabilitiesPart;
export import ChatResponseCodeblockUriPart = zyraxoncode.ChatResponseCodeblockUriPart;
export import ChatResponseTextEditPart = zyraxoncode.ChatResponseTextEditPart;
export import ChatResponseNotebookEditPart = zyraxoncode.ChatResponseNotebookEditPart;
export import ChatResponseWorkspaceEditPart = zyraxoncode.ChatResponseWorkspaceEditPart;
export import ChatResponseConfirmationPart = zyraxoncode.ChatResponseConfirmationPart;
export import ChatQuestion = zyraxoncode.ChatQuestion;
export import ChatQuestionType = zyraxoncode.ChatQuestionType;
export import ChatResponseQuestionCarouselPart = zyraxoncode.ChatResponseQuestionCarouselPart;
export import ChatRequest = zyraxoncode.ChatRequest;
export import ChatRequestTurn = zyraxoncode.ChatRequestTurn;
export import ChatResponseTurn = zyraxoncode.ChatResponseTurn;
export import NewSymbolName = zyraxoncode.NewSymbolName;
export import NewSymbolNameTag = zyraxoncode.NewSymbolNameTag;
export import NewSymbolNameTriggerKind = zyraxoncode.NewSymbolNameTriggerKind;
export import ChatLocation = zyraxoncode.ChatLocation;
export import ChatRequestEditorData = zyraxoncode.ChatRequestEditorData;
export import ChatRequestNotebookData = zyraxoncode.ChatRequestNotebookData;
export import LanguageModelToolInformation = zyraxoncode.LanguageModelToolInformation;
export import LanguageModelToolResult = zyraxoncode.LanguageModelToolResult;
export import ExtendedLanguageModelToolResult = zyraxoncode.ExtendedLanguageModelToolResult;
export import LanguageModelToolResult2 = zyraxoncode.LanguageModelToolResult2;
export import SymbolInformation = zyraxoncode.SymbolInformation;
export import LanguageModelPromptTsxPart = zyraxoncode.LanguageModelPromptTsxPart;
export import LanguageModelTextPart = zyraxoncode.LanguageModelTextPart;
export import LanguageModelTextPart2 = zyraxoncode.LanguageModelTextPart2;
export import LanguageModelThinkingPart = zyraxoncode.LanguageModelThinkingPart;
export import LanguageModelDataPart = zyraxoncode.LanguageModelDataPart;
export import LanguageModelDataPart2 = zyraxoncode.LanguageModelDataPart2;
export import LanguageModelPartAudience = zyraxoncode.LanguageModelPartAudience;
export import LanguageModelToolMCPSource = zyraxoncode.LanguageModelToolMCPSource;
export import LanguageModelToolExtensionSource = zyraxoncode.LanguageModelToolExtensionSource;
export import ChatReferenceBinaryData = zyraxoncode.ChatReferenceBinaryData;
export import ChatReferenceDiagnostic = zyraxoncode.ChatReferenceDiagnostic;
export import TextSearchMatch2 = zyraxoncode.TextSearchMatch2;
export import AISearchKeyword = zyraxoncode.AISearchKeyword;
export import ExcludeSettingOptions = zyraxoncode.ExcludeSettingOptions;
export import NotebookCellKind = zyraxoncode.NotebookCellKind;
export import NotebookRange = zyraxoncode.NotebookRange;
export import NotebookEdit = zyraxoncode.NotebookEdit;
export import NotebookCellData = zyraxoncode.NotebookCellData;
export import NotebookData = zyraxoncode.NotebookData;
export import ChatErrorLevel = zyraxoncode.ChatErrorLevel;
export import ChatInputNotificationSeverity = zyraxoncode.ChatInputNotificationSeverity;
export import TerminalShellExecutionCommandLineConfidence = zyraxoncode.TerminalShellExecutionCommandLineConfidence;
export import ChatRequestEditedFileEventKind = zyraxoncode.ChatRequestEditedFileEventKind;
export import Extension = zyraxoncode.Extension;
export import LanguageModelToolCallPart = zyraxoncode.LanguageModelToolCallPart;
export import LanguageModelToolResultPart = zyraxoncode.LanguageModelToolResultPart;
export import LanguageModelToolResultPart2 = zyraxoncode.LanguageModelToolResultPart2;
export import LanguageModelChatMessageRole = zyraxoncode.LanguageModelChatMessageRole;
export import LanguageModelChatMessage = zyraxoncode.LanguageModelChatMessage;
export import LanguageModelChatToolMode = zyraxoncode.LanguageModelChatToolMode;
export import TextEditorSelectionChangeKind = zyraxoncode.TextEditorSelectionChangeKind;
export import TextDocumentChangeReason = zyraxoncode.TextDocumentChangeReason;
export import ChatToolInvocationPart = zyraxoncode.ChatToolInvocationPart;
export import ChatSubagentToolInvocationData = zyraxoncode.ChatSubagentToolInvocationData;
export import ChatMcpToolInvocationData = zyraxoncode.ChatMcpToolInvocationData;
export import McpToolInvocationContentData = zyraxoncode.McpToolInvocationContentData;
export import ChatResponseTurn2 = zyraxoncode.ChatResponseTurn2;
export import ChatRequestTurn2 = zyraxoncode.ChatRequestTurn2;
export import LanguageModelError = zyraxoncode.LanguageModelError;
export import SymbolKind = zyraxoncode.SymbolKind;
export import SnippetString = zyraxoncode.SnippetString;
export import SnippetTextEdit = zyraxoncode.SnippetTextEdit;
export import FileType = zyraxoncode.FileType;
export import ChatSessionStatus = zyraxoncode.ChatSessionStatus;
export import McpHttpServerDefinition = zyraxoncode.McpHttpServerDefinition;
export import McpStdioServerDefinition = zyraxoncode.McpStdioServerDefinition;
export import ThemeIcon = zyraxoncode.ThemeIcon;

export const l10n = {
	/**
	 * @deprecated Only use this import in tests. For the actual extension,
	 * use `import { l10n } from 'zyraxoncode'` or `import * as l10n from '@zyraxoncode/l10n'`.
	 */
	t: zyraxoncode.l10n.t
};

export const authentication = {
	getSession: zyraxoncode.authentication.getSession,
};
