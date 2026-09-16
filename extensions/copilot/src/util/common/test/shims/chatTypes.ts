/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type * as zyraxoncode from 'zyraxoncode';
import { VSBuffer } from '../../../vs/base/common/buffer';
import { MarkdownString } from '../../../vs/workbench/api/common/extHostTypes/markdownString';

export class ChatResponseMarkdownPart {
	value: zyraxoncode.MarkdownString;
	constructor(value: string | zyraxoncode.MarkdownString) {
		this.value = typeof value === 'string' ? new MarkdownString(value) : value;
	}
}

export class ChatResponseCodeblockUriPart {
	isEdit?: boolean;
	value: zyraxoncode.Uri;
	undoStopId?: string;
	constructor(value: zyraxoncode.Uri, isEdit?: boolean, undoStopId?: string) {
		this.value = value;
		this.undoStopId = undoStopId;
	}
}

export class ChatResponseFileTreePart {
	value: zyraxoncode.ChatResponseFileTree[];
	baseUri: zyraxoncode.Uri;
	constructor(value: zyraxoncode.ChatResponseFileTree[], baseUri: zyraxoncode.Uri) {
		this.value = value;
		this.baseUri = baseUri;
	}
}
export class ChatResponseAnchorPart {
	value: zyraxoncode.Uri | zyraxoncode.Location;
	value2: any;
	title?: string;
	constructor(value: zyraxoncode.Uri | zyraxoncode.Location, title?: string) {
		this.value = value;
		this.title = title;
	}
}

export class ChatResponseProgressPart {
	value: string;
	constructor(value: string) {
		this.value = value;
	}
}

export class ChatResponseThinkingProgressPart {
	value: string | string[];
	id?: string;
	metadata?: { readonly [key: string]: any };
	constructor(value: string | string[], id?: string, metadata?: { readonly [key: string]: any }) {
		this.value = value;
		this.id = id;
		this.metadata = metadata;
	}
}

export type ChatHookType = 'SessionStart' | 'UserPromptSubmit' | 'PreToolUse' | 'PostToolUse' | 'SubagentStart' | 'SubagentStop' | 'Stop';

export class ChatResponseHookPart {
	hookType: ChatHookType;
	stopReason?: string;
	systemMessage?: string;
	metadata?: { readonly [key: string]: unknown };
	constructor(
		hookType: ChatHookType,
		stopReason?: string,
		systemMessage?: string,
		metadata?: { readonly [key: string]: unknown }
	) {
		this.hookType = hookType;
		this.stopReason = stopReason;
		this.systemMessage = systemMessage;
		this.metadata = metadata;
	}
}

export class ChatResponseVoiceProgressPart {
	constructor(
		readonly id: zyraxoncode.ChatResponseVoiceProgressStage,
		readonly value: string,
	) { }
}

export class ChatResponseExternalEditPart {
	applied: Thenable<string>;
	didGetApplied!: (value: string) => void;

	constructor(
		public uris: zyraxoncode.Uri[],
		public callback: () => Thenable<unknown>,
	) {
		this.applied = new Promise<string>((resolve) => {
			this.didGetApplied = resolve;
		});
	}
}

export class ChatResponseProgressPart2 {
	value: string;
	task?: (progress: zyraxoncode.Progress<zyraxoncode.ChatResponseWarningPart>) => Thenable<string | void>;
	constructor(value: string, task?: (progress: zyraxoncode.Progress<zyraxoncode.ChatResponseWarningPart>) => Thenable<string | void>) {
		this.value = value;
		this.task = task;
	}
}

export class ChatResponseWarningPart {
	value: zyraxoncode.MarkdownString;
	constructor(value: string | zyraxoncode.MarkdownString) {
		this.value = typeof value === 'string' ? new MarkdownString(value) : value;
	}
}

export class ChatResponseInfoPart {
	value: zyraxoncode.MarkdownString;
	constructor(value: string | zyraxoncode.MarkdownString) {
		this.value = typeof value === 'string' ? new MarkdownString(value) : value;
	}
}

export class ChatResponseReferencePart {
	value: zyraxoncode.Uri | zyraxoncode.Location;
	constructor(value: zyraxoncode.Uri | zyraxoncode.Location) {
		this.value = value;
	}
}

export class ChatResponseReferencePart2 {
	value: zyraxoncode.Uri | zyraxoncode.Location | { variableName: string; value?: zyraxoncode.Uri | zyraxoncode.Location };
	iconPath?: zyraxoncode.Uri | zyraxoncode.ThemeIcon | { light: zyraxoncode.Uri; dark: zyraxoncode.Uri };
	options?: { status?: { description: string; kind: zyraxoncode.ChatResponseReferencePartStatusKind } };
	constructor(value: zyraxoncode.Uri | zyraxoncode.Location | { variableName: string; value?: zyraxoncode.Uri | zyraxoncode.Location }, iconPath?: zyraxoncode.Uri | zyraxoncode.ThemeIcon | { light: zyraxoncode.Uri; dark: zyraxoncode.Uri }, options?: { status?: { description: string; kind: zyraxoncode.ChatResponseReferencePartStatusKind } }) {
		this.value = value;
		this.iconPath = iconPath;
		this.options = options;
	}
}

export class ChatResponseMovePart {

	readonly uri: zyraxoncode.Uri;
	readonly range: zyraxoncode.Range;

	constructor(uri: zyraxoncode.Uri, range: zyraxoncode.Range) {
		this.uri = uri;
		this.range = range;
	}
}

export class ChatResponseExtensionsPart {

	readonly extensions: string[];

	constructor(extensions: string[]) {
		this.extensions = extensions;
	}
}

export class ChatResponsePullRequestPart {
	/**
	 * @deprecated
	 */
	readonly uri?: zyraxoncode.Uri;
	readonly linkTag: string;
	readonly title: string;
	readonly description: string;
	readonly author: string;
	readonly command: zyraxoncode.Command;
	constructor(uriOrCommand: zyraxoncode.Uri | zyraxoncode.Command, title: string, description: string, author: string, linkTag: string) {
		if ('command' in uriOrCommand && typeof uriOrCommand.command === 'string') {
			// It's a Command
			this.command = uriOrCommand;
		} else {
			// It's a Uri
			this.uri = uriOrCommand as zyraxoncode.Uri;
			this.command = {
				title: 'View Pull Request',
				command: 'zyraxoncode.open',
				arguments: [uriOrCommand]
			};
		}
		this.title = title;
		this.description = description;
		this.author = author;
		this.linkTag = linkTag;
	}
}


export class ChatResponseAutoModeResolutionPart {
	resolvedModel: string;
	resolvedModelName: string;
	predictedLabel: string;
	confidence: number;
	constructor(resolvedModel: string, resolvedModelName: string, predictedLabel: string, confidence: number) {
		this.resolvedModel = resolvedModel;
		this.resolvedModelName = resolvedModelName;
		this.predictedLabel = predictedLabel;
		this.confidence = confidence;
	}
}


export class ChatResponseCodeCitationPart {
	value: zyraxoncode.Uri;
	license: string;
	snippet: string;
	constructor(value: zyraxoncode.Uri, license: string, snippet: string) {
		this.value = value;
		this.license = license;
		this.snippet = snippet;
	}
}

export class ChatResponseCommandButtonPart {
	value: zyraxoncode.Command;
	constructor(value: zyraxoncode.Command) {
		this.value = value;
	}
}

export class ChatResponseMarkdownWithVulnerabilitiesPart {
	value: zyraxoncode.MarkdownString;
	vulnerabilities: zyraxoncode.ChatVulnerability[];
	constructor(value: string | zyraxoncode.MarkdownString, vulnerabilities: zyraxoncode.ChatVulnerability[]) {
		this.value = typeof value === 'string' ? new MarkdownString(value) : value;
		this.vulnerabilities = vulnerabilities;
	}
}

export class ChatResponseTextEditPart {
	uri: zyraxoncode.Uri;
	edits: zyraxoncode.TextEdit[];
	isDone?: boolean;
	constructor(uri: zyraxoncode.Uri, editsOrDone: zyraxoncode.TextEdit | zyraxoncode.TextEdit[] | true) {
		this.uri = uri;
		if (editsOrDone === true) {
			this.isDone = true;
			this.edits = [];
		} else {
			this.edits = Array.isArray(editsOrDone) ? editsOrDone : [editsOrDone];
		}
	}
}

export class ChatResponseNotebookEditPart implements zyraxoncode.ChatResponseNotebookEditPart {
	uri: zyraxoncode.Uri;
	edits: zyraxoncode.NotebookEdit[];
	isDone?: boolean;
	constructor(uri: zyraxoncode.Uri, editsOrDone: zyraxoncode.NotebookEdit | zyraxoncode.NotebookEdit[] | true) {
		this.uri = uri;
		if (editsOrDone === true) {
			this.isDone = true;
			this.edits = [];
		} else {
			this.edits = Array.isArray(editsOrDone) ? editsOrDone : [editsOrDone];

		}
	}
}

export class ChatResponseWorkspaceEditPart implements zyraxoncode.ChatResponseWorkspaceEditPart {
	edits: zyraxoncode.ChatWorkspaceFileEdit[];
	constructor(edits: zyraxoncode.ChatWorkspaceFileEdit[]) {
		this.edits = edits;
	}
}

export class ChatResponseConfirmationPart {
	title: string;
	message: string;
	data: any;
	buttons: string[] | undefined;
	constructor(title: string, message: string, data: any, buttons?: string[]) {
		this.title = title;
		this.message = message;
		this.data = data;
		this.buttons = buttons;
	}
}

export enum ChatQuestionType {
	Text = 1,
	SingleSelect = 2,
	MultiSelect = 3
}

export class ChatQuestion implements zyraxoncode.ChatQuestion {
	id: string;
	type: zyraxoncode.ChatQuestionType;
	title: string;
	message?: string | zyraxoncode.MarkdownString;
	options?: zyraxoncode.ChatQuestionOption[];
	defaultValue?: string | string[];
	allowFreeformInput?: boolean;

	constructor(
		id: string,
		type: zyraxoncode.ChatQuestionType,
		title: string,
		options?: {
			message?: string | zyraxoncode.MarkdownString;
			options?: zyraxoncode.ChatQuestionOption[];
			defaultValue?: string | string[];
			allowFreeformInput?: boolean;
		}
	) {
		this.id = id;
		this.type = type;
		this.title = title;
		if (options) {
			this.message = options.message;
			this.options = options.options;
			this.defaultValue = options.defaultValue;
			this.allowFreeformInput = options.allowFreeformInput;
		}
	}
}

export class ChatResponseQuestionCarouselPart implements zyraxoncode.ChatResponseQuestionCarouselPart {
	questions: zyraxoncode.ChatQuestion[];
	allowSkip: boolean;
	constructor(questions: zyraxoncode.ChatQuestion[], allowSkip?: boolean) {
		this.questions = questions;
		this.allowSkip = allowSkip ?? false;
	}
}

export class ChatRequestTurn implements zyraxoncode.ChatRequestTurn {
	constructor(
		readonly prompt: string,
		readonly command: string | undefined,
		readonly references: zyraxoncode.ChatPromptReference[],
		readonly participant: string,
		readonly toolReferences: zyraxoncode.ChatLanguageModelToolReference[]
	) { }
}

export class ChatRequestTurn2 implements zyraxoncode.ChatRequestTurn2 {
	constructor(
		readonly prompt: string,
		readonly command: string | undefined,
		readonly references: zyraxoncode.ChatPromptReference[],
		readonly participant: string,
		readonly toolReferences: readonly zyraxoncode.ChatLanguageModelToolReference[],
		readonly editedFileEvents: zyraxoncode.ChatRequestEditedFileEvent[] | undefined,
		readonly id: string | undefined,
		readonly modelId: string | undefined,
		readonly modeInstructions2: zyraxoncode.ChatRequestModeInstructions | undefined,
	) { }
}

export class ChatResponseTurn implements zyraxoncode.ChatResponseTurn {

	constructor(
		readonly response: ReadonlyArray<ChatResponseMarkdownPart | ChatResponseFileTreePart | ChatResponseAnchorPart | ChatResponseCommandButtonPart>,
		readonly result: zyraxoncode.ChatResult,
		readonly participant: string,
		readonly command?: string
	) { }
}

export class ChatRequestEditorData {
	constructor(
		readonly editor: zyraxoncode.TextEditor,
		readonly document: zyraxoncode.TextDocument,
		readonly selection: zyraxoncode.Selection,
		readonly wholeRange: zyraxoncode.Range,
	) { }
}

export class ChatRequestNotebookData {
	constructor(
		readonly cell: zyraxoncode.TextDocument
	) { }
}


export class ChatReferenceDiagnostic {
	constructor(
		readonly diagnostics: [zyraxoncode.Uri, zyraxoncode.Diagnostic[]][]
	) { }
}


export class ChatReferenceBinaryData {
	constructor(
		readonly mimeType: string,
		readonly data: () => Thenable<Uint8Array>
	) { }
}

export class LanguageModelToolResult {
	constructor(public content: (LanguageModelTextPart | LanguageModelPromptTsxPart | unknown)[]) { }
}

export class LanguageModelToolResult2 {
	constructor(public content: (LanguageModelTextPart | LanguageModelPromptTsxPart | LanguageModelDataPart | unknown)[]) { }
}

export class LanguageModelTextPart implements zyraxoncode.LanguageModelTextPart {
	value: string;

	constructor(value: string) {
		this.value = value;

	}
}

export enum LanguageModelPartAudience {
	Assistant = 0,
	User = 1,
	Extension = 2,
}

export class LanguageModelTextPart2 extends LanguageModelTextPart {
	audience: LanguageModelPartAudience[] | undefined;
	constructor(value: string, audience?: LanguageModelPartAudience[]) {
		super(value);
		this.audience = audience;
	}
}

export class LanguageModelThinkingPart implements zyraxoncode.LanguageModelThinkingPart {
	value: string | string[];
	id?: string;
	metadata?: { readonly [key: string]: any };

	constructor(value: string | string[], id?: string, metadata?: { readonly [key: string]: any }) {
		this.value = value;
		this.id = id;
		this.metadata = metadata;
	}
}

export class LanguageModelDataPart implements zyraxoncode.LanguageModelDataPart {
	mimeType: string;
	data: Uint8Array<ArrayBufferLike>;

	constructor(data: Uint8Array, mimeType: string) {
		this.mimeType = mimeType;
		this.data = data;
	}

	static image(data: Uint8Array<ArrayBufferLike>, mimeType: string): zyraxoncode.LanguageModelDataPart {
		return new LanguageModelDataPart(data, mimeType);
	}

	static json(value: object): zyraxoncode.LanguageModelDataPart {
		const rawStr = JSON.stringify(value, undefined, '\t');
		return new LanguageModelDataPart(VSBuffer.fromString(rawStr).buffer, 'json');
	}

	static text(value: string): zyraxoncode.LanguageModelDataPart {
		return new LanguageModelDataPart(VSBuffer.fromString(value).buffer, 'text/plain');
	}
}

export class LanguageModelDataPart2 extends LanguageModelDataPart {
	audience: LanguageModelPartAudience[] | undefined;
	constructor(data: Uint8Array, mimeType: string, audience?: LanguageModelPartAudience[]) {
		super(data, mimeType);
		this.audience = audience;
	}
}

export enum ChatImageMimeType {
	PNG = 'image/png',
	JPEG = 'image/jpeg',
	GIF = 'image/gif',
	WEBP = 'image/webp',
	BMP = 'image/bmp',
}

export class LanguageModelPromptTsxPart {
	value: unknown;

	constructor(value: unknown) {
		this.value = value;
	}
}

export enum ExcludeSettingOptions {
	None = 1,
	FilesExclude = 2,
	SearchAndFilesExclude = 3
}

export class TextSearchMatch2 {
	constructor(public uri: zyraxoncode.Uri, public ranges: { sourceRange: zyraxoncode.Range; previewRange: zyraxoncode.Range }[], public previewText: string) { }
}

export class AISearchKeyword {
	constructor(public keyword: string) { }
}

export enum ChatErrorLevel {
	Info = 0,
	Warning = 1,
	Error = 2
}

export enum ChatInputNotificationSeverity {
	Info = 0,
	Warning = 1,
	Error = 2,
}

export enum ChatRequestEditedFileEventKind {
	Keep = 1,
	Undo = 2,
	UserModification = 3,
}

export enum ChatResponseClearToPreviousToolInvocationReason {
	NoReason = 0,
	FilteredContentRetry = 1,
	CopyrightContentRetry = 2,
}

export class LanguageModelToolExtensionSource implements zyraxoncode.LanguageModelToolExtensionSource {
	constructor(public readonly id: string, public readonly label: string) { }
}

export class LanguageModelToolMCPSource implements zyraxoncode.LanguageModelToolMCPSource {
	constructor(public readonly label: string, public readonly name: string, public readonly instructions: string | undefined) { }
}

export class LanguageModelToolCallPart implements zyraxoncode.LanguageModelToolCallPart {
	callId: string;
	name: string;
	input: object;

	constructor(callId: string, name: string, input: object) {
		this.callId = callId;
		this.name = name;

		this.input = input;
	}
}

export class LanguageModelToolResultPart implements zyraxoncode.LanguageModelToolResultPart {
	callId: string;
	content: (LanguageModelTextPart | LanguageModelPromptTsxPart | unknown)[];
	isError: boolean;

	constructor(callId: string, content: (LanguageModelTextPart | LanguageModelPromptTsxPart | unknown)[], isError?: boolean) {
		this.callId = callId;
		this.content = content;
		this.isError = isError ?? false;
	}
}

export class LanguageModelToolResultPart2 implements zyraxoncode.LanguageModelToolResultPart2 {
	callId: string;
	content: (LanguageModelTextPart | LanguageModelPromptTsxPart | LanguageModelDataPart | unknown)[];
	isError: boolean;

	constructor(callId: string, content: (LanguageModelTextPart | LanguageModelPromptTsxPart | LanguageModelDataPart | unknown)[], isError?: boolean) {
		this.callId = callId;
		this.content = content;
		this.isError = isError ?? false;
	}
}

export enum LanguageModelChatMessageRole {
	User = 1,
	Assistant = 2,
	System = 3
}

export enum LanguageModelChatToolMode {
	Auto = 1,
	Required = 2
}

export class LanguageModelChatMessage implements zyraxoncode.LanguageModelChatMessage {
	role: LanguageModelChatMessageRole;
	content: Array<any>;
	name: string | undefined;

	constructor(role: LanguageModelChatMessageRole, content: string | Array<any>, name?: string) {
		this.role = role;
		this.content = typeof content === 'string' ? [{ type: 'text', value: content }] : content;
		this.name = name;
	}

	static User(content: string | Array<any>, name?: string): LanguageModelChatMessage {
		return new LanguageModelChatMessage(LanguageModelChatMessageRole.User, content, name);
	}

	static Assistant(content: string | Array<any>, name?: string): LanguageModelChatMessage {
		return new LanguageModelChatMessage(LanguageModelChatMessageRole.Assistant, content, name);
	}
}

export class McpToolInvocationContentData implements zyraxoncode.McpToolInvocationContentData {
	mimeType: string;
	data: Uint8Array;

	constructor(data: Uint8Array, mimeType: string) {
		this.data = data;
		this.mimeType = mimeType;
	}
}

export interface ChatMcpToolInvocationData extends zyraxoncode.ChatMcpToolInvocationData {
	input: string;
	output: McpToolInvocationContentData[];
}

export class ChatToolInvocationPart {
	toolName: string;
	toolCallId: string;
	isError?: boolean;
	invocationMessage?: string | zyraxoncode.MarkdownString;
	originMessage?: string | zyraxoncode.MarkdownString;
	pastTenseMessage?: string | zyraxoncode.MarkdownString;
	isConfirmed?: boolean;
	isComplete?: boolean;
	toolSpecificData?: zyraxoncode.ChatTerminalToolInvocationData | ChatMcpToolInvocationData;

	constructor(toolName: string,
		toolCallId: string,
		isError?: boolean | string) {
		this.toolName = toolName;
		this.toolCallId = toolCallId;
		this.isError = typeof isError === 'string' ? true : isError;
	}
}

export class ChatSubagentToolInvocationData {
	description?: string;
	agentName?: string;
	prompt?: string;
	result?: string;
	modelName?: string;
	constructor(description?: string, agentName?: string, prompt?: string, result?: string) {
		this.description = description;
		this.agentName = agentName;
		this.prompt = prompt;
		this.result = result;
	}
}

export class ChatResponseTurn2 implements zyraxoncode.ChatResponseTurn2 {

	constructor(
		readonly response: ReadonlyArray<ChatResponseMarkdownPart | ChatResponseFileTreePart | ChatResponseAnchorPart | ChatResponseCommandButtonPart | ChatResponseExtensionsPart | ChatToolInvocationPart>,
		readonly result: zyraxoncode.ChatResult,
		readonly participant: string,
		readonly command?: string
	) { }
}

export enum ChatSessionStatus {
	Failed = 0,
	Completed = 1,
	InProgress = 2,
	NeedsInput = 3
}

export class LanguageModelError extends Error {

	static readonly #name = 'LanguageModelError';

	static NotFound(message?: string): LanguageModelError {
		return new LanguageModelError(message, LanguageModelError.NotFound.name);
	}

	static NoPermissions(message?: string): LanguageModelError {
		return new LanguageModelError(message, LanguageModelError.NoPermissions.name);
	}

	static Blocked(message?: string): LanguageModelError {
		return new LanguageModelError(message, LanguageModelError.Blocked.name);
	}

	readonly code: string;

	constructor(message?: string, code?: string, cause?: Error) {
		super(message, { cause });
		this.name = LanguageModelError.#name;
		this.code = code ?? '';
	}
}

/**
 * Represents a chat-related resource, such as a custom agent, instructions, prompt file, or skill.
 */
export class ChatResource implements zyraxoncode.ChatResource {
	readonly uri: zyraxoncode.Uri;

	constructor(uri: zyraxoncode.Uri) {
		this.uri = uri;
	}
}


/**
 * McpStdioServerDefinition represents an MCP server available by running
 * a local process and operating on its stdin and stdout streams. The process
 * will be spawned as a child process of the extension host and by default
 * will not run in a shell environment.
 */
export class McpStdioServerDefinition {
	/**
	 * The human-readable name of the server.
	 */
	readonly label: string;

	/**
	 * The working directory used to start the server.
	 */
	cwd?: zyraxoncode.Uri;

	/**
	 * The command used to start the server. Node.js-based servers may use
	 * `process.execPath` to use the editor's version of Node.js to run the script.
	 */
	command: string;

	/**
	 * Additional command-line arguments passed to the server.
	 */
	args: string[];

	/**
	 * Optional additional environment information for the server. Variables
	 * in this environment will overwrite or remove (if null) the default
	 * environment variables of the editor's extension host.
	 */
	env: Record<string, string | number | null>;

	/**
	 * Optional version identification for the server. If this changes, the
	 * editor will indicate that tools have changed and prompt to refresh them.
	 */
	version?: string;

	/**
	 * @param label The human-readable name of the server.
	 * @param command The command used to start the server.
	 * @param args Additional command-line arguments passed to the server.
	 * @param env Optional additional environment information for the server.
	 * @param version Optional version identification for the server.
	 */
	constructor(label: string, command: string, args?: string[], env?: Record<string, string | number | null>, version?: string) {
		this.label = label;
		this.command = command;
		this.args = args ?? [];
		this.env = env ?? {};
		this.version = version;
	}
}

/**
 * McpHttpServerDefinition represents an MCP server available using the
 * Streamable HTTP transport.
 */
export class McpHttpServerDefinition {
	/**
	 * The human-readable name of the server.
	 */
	readonly label: string;

	/**
	 * The URI of the server. The editor will make a POST request to this URI
	 * to begin each session.
	 */
	uri: zyraxoncode.Uri;

	/**
	 * Optional additional heads included with each request to the server.
	 */
	headers: Record<string, string>;

	/**
	 * Optional version identification for the server. If this changes, the
	 * editor will indicate that tools have changed and prompt to refresh them.
	 */
	version?: string;

	/**
	 * @param label The human-readable name of the server.
	 * @param uri The URI of the server.
	 * @param headers Optional additional heads included with each request to the server.
	 */
	constructor(label: string, uri: zyraxoncode.Uri, headers?: Record<string, string>, version?: string) {
		this.label = label;
		this.uri = uri;
		this.headers = headers ?? {};
		this.version = version;
	}
}
