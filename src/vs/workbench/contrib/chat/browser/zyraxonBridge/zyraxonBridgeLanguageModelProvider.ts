/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// OpenCode Zen integration v1.18.31

import { CancellationToken } from '../../../../../base/common/cancellation.js';
import { Emitter } from '../../../../../base/common/event.js';
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { IConfigurationChangeEvent, IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { ILogService } from '../../../../../platform/log/common/log.js';
import { IWorkspaceContextService } from '../../../../../platform/workspace/common/workspace.js';
import { nullExtensionDescription } from '../../../../services/extensions/common/extensions.js';
import { ILanguageModelChatMetadataAndIdentifier, ILanguageModelChatProvider, IChatMessage, ILanguageModelChatResponse, IChatResponseTextPart, IChatResponseThinkingPart } from '../../common/languageModels.js';
import { ZYRAXON_PROMPTS } from './zyraxonPrompts.js';

/**
 * Base URL of the local OpenCode-compatible bridge. The bridge owns the
 * server-side model catalogue and remains overridable through the
 * `chat.zyraxon.bridgeUrl` setting for a self-hosted endpoint.
 */
export const ZYRAXON_BRIDGE_URL_SETTING = 'chat.zyraxon.bridgeUrl';
export const DEFAULT_ZYRAXON_BRIDGE_URL = 'https://opencode.ai/zen';
export const ZYRAXON_MODE_SETTING = 'zyraxon.mode';
export const DEFAULT_ZYRAXON_MODE = 'auto';

/**
 * The nine native Zyraxon modes. Each mode carries the name of the prompt
 * text file shipped under `resources/zyraxon/prompts/` that is injected as
 * the leading system message on every chat request.
 */
export const ZYRAXON_MODES = [
	{ id: 'auto', name: 'AUTO ORCHESTRATOR', promptFile: 'auto.txt', description: 'Supreme coordination intelligence. Delegates to the right agents and coordinates their work.' },
	{ id: 'build', name: 'BUILD MODE', promptFile: 'build.txt', description: 'Supreme engineering intelligence with codebase DNA sequencing and precision surgical edits.' },
	{ id: 'plan', name: 'PLAN MODE', promptFile: 'plan.txt', description: 'Strategic planning intelligence. Maps architecture before execution.' },
	{ id: 'beast', name: 'BEAST MODE', promptFile: 'beast.txt', description: 'Maximum raw power. Aggressive execution with zero hesitation.' },
	{ id: 'pro', name: 'PRO MODE', promptFile: 'pro.txt', description: 'Professional-grade engineering with best practices baked in.' },
	{ id: 'apex', name: 'APEX PREDATOR', promptFile: 'apex.txt', description: 'Top-of-the-food-chain intelligence. Ruthless optimization.' },
	{ id: 'dark-emperor', name: 'DARK EMPEROR', promptFile: 'dark-emperor.txt', description: 'Supreme sovereign intelligence. Commands an empire of subagents.' },
	{ id: 'pro-builder', name: 'PRO BUILDER', promptFile: 'pro-builder.txt', description: 'Production-grade builder. Ships complete, polished features.' },
	{ id: 'vision', name: 'VISION MODE', promptFile: 'vision.txt', description: 'Visual intelligence. Reads screenshots, designs, and diagrams.' },
] as const;

/**
 * Model ids advertised by the bridge usually carry a `providerID/modelID`
 * shape (e.g. `google/gemini-3-flash`). OpenCode Zen publishes bare model
 * ids (e.g. `deepseek-v4-flash-free`), which belong to the OpenCode vendor.
 */
function splitModelId(modelId: string): { provider: string; id: string } | undefined {
	const slash = modelId.indexOf('/');
	if (slash === -1) {
		return modelId.length > 0 ? { provider: 'opencode', id: modelId } : undefined;
	}
	if (slash <= 0 || slash === modelId.length - 1) {
		return undefined;
	}
	return { provider: modelId.slice(0, slash), id: modelId.slice(slash + 1) };
}

interface BridgeModel {
	readonly id: string;
}

/**
 * Exposes models served by the local OpenCode-compatible bridge as selectable
 * language models in the editor's chat model picker. Chat requests are routed
 * to its OpenAI-compatible streaming endpoint without editor login.
 */
export class ZyraxonBridgeLanguageModelProvider extends Disposable implements ILanguageModelChatProvider {
	private readonly _onDidChange = this._register(new Emitter<void>());
	readonly onDidChange = this._onDidChange.event;

	private _models: BridgeModel[] = [];
	private _bridgeUrl: string;
	private _mode: string;

	constructor(
		@IConfigurationService private readonly _configurationService: IConfigurationService,
		@ILogService private readonly _logService: ILogService,
		@IWorkspaceContextService private readonly _workspaceContextService: IWorkspaceContextService,
	) {
		super();
		this._bridgeUrl = this._readBridgeUrl();
		this._mode = this._readMode();

		this._register(this._configurationService.onDidChangeConfiguration((e: IConfigurationChangeEvent) => {
			if (e.affectsConfiguration(ZYRAXON_BRIDGE_URL_SETTING)) {
				this._bridgeUrl = this._readBridgeUrl();
				this._refresh();
			}
			if (e.affectsConfiguration(ZYRAXON_MODE_SETTING)) {
				this._mode = this._readMode();
			}
		}));
	}

	private _readMode(): string {
		const value = this._configurationService.getValue<string>(ZYRAXON_MODE_SETTING);
		if (typeof value === 'string' && value.length > 0 && ZYRAXON_MODES.some(m => m.id === value)) {
			return value;
		}
		return DEFAULT_ZYRAXON_MODE;
	}

	/**
	 * Resolves the mode prompt shipped for the active mode. Falls back to a
	 * compact built-in directive so chat still works if a prompt file is
	 * missing from the generated prompt bundle.
	 */
	private _modePrompt(modeId: string): string {
		const bundled = ZYRAXON_PROMPTS[modeId];
		if (typeof bundled === 'string' && bundled.length > 0) {
			return bundled;
		}
		const mode = ZYRAXON_MODES.find(m => m.id === modeId);
		return `You are ZYRAXON AI in ${mode?.name ?? modeId.toUpperCase()} MODE. ${mode?.description ?? ''} Execute the user's request directly and completely.`;
	}

	private _readBridgeUrl(): string {
		const value = this._configurationService.getValue<string>(ZYRAXON_BRIDGE_URL_SETTING);
		if (typeof value === 'string' && value.length > 0) {
			return value;
		}
		return DEFAULT_ZYRAXON_BRIDGE_URL;
	}

	/**
	 * Re-fetches the model list from the bridge and fires {@link onDidChange}
	 * so the model picker refreshes. Called when the bridge URL changes and
	 * from the contributing workbench contribution on a configurable poll.
	 */
	async _refresh(): Promise<void> {
		const url = `${this._bridgeUrl.replace(/\/$/, '')}/v1/models`;
		try {
			const response = await fetch(url, {
				method: 'GET',
				headers: { 'Accept': 'application/json', 'User-Agent': 'opencode/1.18.31' },
				cache: 'no-store',
			});
			if (!response.ok) {
				this._logService.warn(`[zyraxon-bridge] models request failed: ${response.status}`);
				return;
			}
			const payload = await response.json();
			const data = Array.isArray(payload?.data) ? payload.data as BridgeModel[] : [];
			const nextModels = data.filter((m) => splitModelId(m.id) !== undefined);
			const previousIds = this._models.map(model => model.id).join('\n');
			const nextIds = nextModels.map(model => model.id).join('\n');
			this._models = nextModels;
			if (previousIds !== nextIds) {
				this._onDidChange.fire();
			}
		} catch (err) {
			this._logService.warn('[zyraxon-bridge] models request errored', err);
		}
	}

	async provideLanguageModelChatInfo(_options: unknown, _token: CancellationToken): Promise<ILanguageModelChatMetadataAndIdentifier[]> {
		return this._models.map((m) => {
			const split = splitModelId(m.id)!;
			return {
				identifier: `opencode:${m.id}`,
				metadata: {
					extension: nullExtensionDescription.identifier,
					name: split.id,
					id: m.id,
					vendor: 'opencode',
					version: '1.18.31',
					family: split.provider,
					maxInputTokens: 128000,
					maxOutputTokens: 8192,
					isDefaultForLocation: {},
					isUserSelectable: true,
					capabilities: {
						vision: false,
						toolCalling: false,
						agentMode: false,
					},
				},
			};
		});
	}

	async sendChatRequest(modelId: string, messages: IChatMessage[], _from: unknown, _options: unknown, _token: CancellationToken): Promise<ILanguageModelChatResponse> {
		const url = `${this._bridgeUrl.replace(/\/$/, '')}/v1/chat/completions`;
		const bridgeModelId = modelId.includes(':') ? modelId.slice(modelId.indexOf(':') + 1) : modelId;

		// Inject the active Zyraxon mode prompt as the leading system message
		// so every chat request is guided by the selected mode persona.
		const modePrompt = this._modePrompt(this._mode);

		const body = {
			model: bridgeModelId,
			stream: true,
			messages: [
				{ role: 'system', content: modePrompt },
				...messages.map((m) => ({
					role: m.role,
					content: m.content.filter((p) => p.type === 'text').map((p) => p.value).join(' '),
				})),
			],
		};

		const headers: Record<string, string> = {
			'Content-Type': 'application/json',
			'Accept': 'text/event-stream',
			'User-Agent': 'opencode/1.18.31',
		};
		const workspaceFolders = this._workspaceContextService.getWorkspace().folders;
		if (workspaceFolders.length > 0) {
			headers['x-zyraxon-directory'] = workspaceFolders[0].uri.fsPath;
		}

		const controller = new AbortController();
		if (_token) {
			_token.onCancellationRequested(() => controller.abort());
		}

		let stream: AsyncIterable<IChatResponseTextPart | IChatResponseThinkingPart | (IChatResponseTextPart | IChatResponseThinkingPart)[]> = (async function* () { })();
		try {
			const response = await fetch(url, {
				method: 'POST',
				headers,
				body: JSON.stringify(body),
				cache: 'no-store',
				signal: controller.signal,
			});
			if (!response.ok) {
				const detail = await response.text().catch(() => '');
				return {
					stream: (async function* () {
						yield { type: 'text' as const, value: `[zyraxon-bridge] chat request failed (${response.status}) ${detail}`.trim() };
					})(),
					result: Promise.resolve(),
				};
			}

			if (!response.body) {
				return { stream: (async function* () { })(), result: Promise.resolve() };
			}

			const reader = response.body.getReader();
			const decoder = new TextDecoder();

			const parseStream = async function* () {
				let pending = '';
				for (;;) {
					const { done, value } = await reader.read();
					if (done) {
						break;
					}
					pending += decoder.decode(value, { stream: true });
					const events = pending.split('\n\n');
					pending = events.pop() ?? '';
					for (const event of events) {
						const line = event.split('\n').find((l) => l.startsWith('data:'));
						if (!line) {
							continue;
						}
						const data = line.slice(5).trim();
						if (data === '[DONE]') {
							return;
						}
						try {
							const parsed = JSON.parse(data);
							const delta = parsed?.choices?.[0]?.delta;
							const content = typeof delta?.content === 'string' ? delta.content : '';
							if (content) {
								yield { type: 'text' as const, value: content };
							}
						} catch {
							// Ignore malformed SSE frames.
						}
					}
				}
			};

			stream = parseStream();
		} catch (err) {
			this._logService.warn('[zyraxon-bridge] chat request errored', err);
			stream = (async function* () {
				yield { type: 'text' as const, value: `[zyraxon-bridge] chat request errored` };
			})();
		}

		return {
			stream,
			result: Promise.resolve(),
		};
	}

	async provideTokenCount(_modelId: string, _message: string | IChatMessage, _token: CancellationToken): Promise<number> {
		return 0;
	}
}
