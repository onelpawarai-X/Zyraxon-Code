import { Disposable, DisposableStore } from '../../base/common/lifecycle.js';
import { IConfigurationService } from '../configuration/common/configuration.js';
import { IStorageService } from '../storage/common/storage.js';
import { ILogService } from '../log/common/log.js';
import { Event, Emitter } from '../../base/common/event.js';
import { BUILTIN_PROVIDERS, ProviderInfo, ProviderConfiguration, ModelInfo, ChatRequest, ChatResponse, ChatMessage, EmbeddingRequest, EmbeddingResponse } from './aiProviderTypes.js';

export interface IAiProviderService {
	readonly _serviceBrand: undefined;
	getProviders(): ProviderInfo[];
	getProvider(providerId: string): ProviderInfo | undefined;
	getConfigurations(): ProviderConfiguration[];
	getConfiguration(providerId: string): ProviderConfiguration | undefined;
	setConfiguration(config: ProviderConfiguration): void;
	removeConfiguration(providerId: string): void;
	getDefaultProvider(): ProviderInfo | undefined;
	setDefaultProvider(providerId: string): void;
	chat(request: ChatRequest): Promise<ChatResponse>;
	chatStream(request: ChatRequest): AsyncIterable<ChatResponse>;
	embeddings(request: EmbeddingRequest): Promise<EmbeddingResponse>;
	readonly onConfigurationChange: Event<ProviderConfiguration>;
	readonly onDefaultProviderChange: Event<string>;
}

const AI_PROVIDER_CONFIG_KEY = 'zyraxon.ai.providers';
const AI_DEFAULT_PROVIDER_KEY = 'zyraxon.ai.defaultProvider';

export class AiProviderService extends Disposable implements IAiProviderService {
	declare readonly _serviceBrand: undefined;

	private readonly _store = this._register(new DisposableStore());
	private readonly _onConfigurationChange = this._register(new Emitter<ProviderConfiguration>());
	private readonly _onDefaultProviderChange = this._register(new Emitter<string>());

	private _configurations: Map<string, ProviderConfiguration> = new Map();
	private _defaultProviderId: string = 'openai';

	constructor(
		@IConfigurationService private readonly _configurationService: IConfigurationService,
		@IStorageService private readonly _storageService: IStorageService,
		@ILogService private readonly _logService: ILogService
	) {
		super();
		this._loadConfigurations();
		this._registerConfigurationListener();
	}

	readonly onConfigurationChange = this._onConfigurationChange.event;
	readonly onDefaultProviderChange = this._onDefaultProviderChange.event;

	getProviders(): ProviderInfo[] {
		return BUILTIN_PROVIDERS;
	}

	getProvider(providerId: string): ProviderInfo | undefined {
		return BUILTIN_PROVIDERS.find(p => p.id === providerId);
	}

	getConfigurations(): ProviderConfiguration[] {
		return Array.from(this._configurations.values());
	}

	getConfiguration(providerId: string): ProviderConfiguration | undefined {
		return this._configurations.get(providerId);
	}

	setConfiguration(config: ProviderConfiguration): void {
		this._configurations.set(config.providerId, config);
		this._saveConfigurations();
		this._onConfigurationChange.fire(config);
		this._logService.info(`AI Provider configuration updated: ${config.providerId}`);
	}

	removeConfiguration(providerId: string): void {
		this._configurations.delete(providerId);
		this._saveConfigurations();
		this._logService.info(`AI Provider configuration removed: ${providerId}`);
	}

	getDefaultProvider(): ProviderInfo | undefined {
		return this.getProvider(this._defaultProviderId);
	}

	setDefaultProvider(providerId: string): void {
		const provider = this.getProvider(providerId);
		if (!provider) {
			throw new Error(`Provider ${providerId} not found`);
		}
		this._defaultProviderId = providerId;
		this._storageService.store(AI_DEFAULT_PROVIDER_KEY, providerId, 0, 0);
		this._onDefaultProviderChange.fire(providerId);
		this._logService.info(`Default AI provider changed to: ${providerId}`);
	}

	async chat(request: ChatRequest): Promise<ChatResponse> {
		const provider = this.getProviderConfigForModel(request.model);
		if (!provider) {
			throw new Error(`No provider configured for model: ${request.model}`);
		}

		return this._makeChatRequest(provider, request);
	}

	async *chatStream(request: ChatRequest): AsyncIterable<ChatResponse> {
		const provider = this.getProviderConfigForModel(request.model);
		if (!provider) {
			throw new Error(`No provider configured for model: ${request.model}`);
		}

		const stream = this._makeChatStreamRequest(provider, request);
		for await (const chunk of stream) {
			yield chunk;
		}
	}

	async embeddings(request: EmbeddingRequest): Promise<EmbeddingResponse> {
		const provider = this.getProviderConfigForModel(request.model);
		if (!provider) {
			throw new Error(`No provider configured for model: ${request.model}`);
		}

		return this._makeEmbeddingsRequest(provider, request);
	}

	private getProviderConfigForModel(modelId: string): ProviderConfiguration | undefined {
		for (const [, config] of this._configurations) {
			if (!config.enabled) continue;
			const provider = this.getProvider(config.providerId);
			if (provider && provider.models.some(m => m.id === modelId)) {
				return config;
			}
		}

		const defaultProvider = this.getDefaultProvider();
		if (defaultProvider && defaultProvider.models.some(m => m.id === modelId)) {
			return this._configurations.get(defaultProvider.id);
		}

		return undefined;
	}

	private async _makeChatRequest(config: ProviderConfiguration, request: ChatRequest): Promise<ChatResponse> {
		const provider = this.getProvider(config.config.providerId);
		if (!provider) {
			throw new Error(`Provider ${config.providerId} not found`);
		}

		const url = `${config.config.baseUrl || this._getDefaultBaseUrl(provider.id)}/chat/completions`;
		const headers = this._getHeaders(config);

		const response = await fetch(url, {
			method: 'POST',
			headers,
			body: JSON.stringify({
				model: request.model,
				messages: request.messages,
				temperature: request.temperature ?? 0.7,
				max_tokens: request.maxTokens,
				stream: false,
				tools: request.tools
			})
		});

		if (!response.ok) {
			const error = await response.text();
			throw new Error(`Chat request failed: ${response.status} ${error}`);
		}

		return response.json();
	}

	private async *_makeChatStreamRequest(config: ProviderConfiguration, request: ChatRequest): AsyncIterable<ChatResponse> {
		const provider = this.getProvider(config.providerId);
		if (!provider) {
			throw new Error(`Provider ${config.providerId} not found`);
		}

		const url = `${config.config.baseUrl || this._getDefaultBaseUrl(provider.id)}/chat/completions`;
		const headers = this._getHeaders(config);

		const response = await fetch(url, {
			method: 'POST',
			headers,
			body: JSON.stringify({
				model: request.model,
				messages: request.messages,
				temperature: request.temperature ?? 0.7,
				max_tokens: request.maxTokens,
				stream: true,
				tools: request.tools
			})
		});

		if (!response.ok) {
			const error = await response.text();
			throw new Error(`Chat stream request failed: ${response.status} ${error}`);
		}

		if (!response.body) {
			throw new Error('No response body');
		}

		const reader = response.body.getReader();
		const decoder = new TextDecoder();
		let buffer = '';

		try {
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;

				buffer += decoder.decode(value, { stream: true });
				const lines = buffer.split('\n');
				buffer = lines.pop() || '';

				for (const line of lines) {
					if (line.startsWith('data: ')) {
						const data = line.slice(6).trim();
						if (data === '[DONE]') return;
						try {
							const parsed = JSON.parse(data);
							yield parsed;
						} catch {
							// Ignore parse errors
						}
					}
				}
			}
		} finally {
			reader.releaseLock();
		}
	}

	private async _makeEmbeddingsRequest(config: ProviderConfiguration, request: EmbeddingRequest): Promise<EmbeddingResponse> {
		const provider = this.getProvider(config.providerId);
		if (!provider) {
			throw new Error(`Provider ${config.providerId} not found`);
		}

		const url = `${config.config.baseUrl || this._getDefaultBaseUrl(provider.id)}/embeddings`;
		const headers = this._getHeaders(config);

		const response = await fetch(url, {
			method: 'POST',
			headers,
			body: JSON.stringify({
				model: request.model,
				input: request.input
			})
		});

		if (!response.ok) {
			const error = await response.text();
			throw new Error(`Embeddings request failed: ${response.status} ${error}`);
		}

		return response.json();
	}

	private _getHeaders(config: ProviderConfiguration): Record<string, string> {
		const headers: Record<string, string> = {
			'Content-Type': 'application/json'
		};

		if (config.config.apiKey) {
			headers['Authorization'] = `Bearer ${config.config.apiKey}`;
		}

		if (config.config.organization) {
			headers['OpenAI-Organization'] = config.config.organization;
		}

		if (config.config.customHeaders) {
			Object.assign(headers, config.config.customHeaders);
		}

		return headers;
	}

	private _getDefaultBaseUrl(providerId: string): string {
		const defaults: Record<string, string> = {
			'openai': 'https://api.openai.com/v1',
			'anthropic': 'https://api.anthropic.com/v1',
			'google': 'https://generativelanguage.googleapis.com/v1beta',
			'groq': 'https://api.groq.com/openai/v1',
			'openrouter': 'https://openrouter.ai/api/v1'
		};
		return defaults[providerId] || 'https://api.openai.com/v1';
	}

	private _loadConfigurations(): void {
		try {
			const stored = this._storageService.get(AI_PROVIDER_CONFIG_KEY, 0);
			if (stored) {
				const configs = JSON.parse(stored) as ProviderConfiguration[];
				for (const config of configs) {
					this._configurations.set(config.providerId, config);
				}
			}

			const defaultProvider = this._storageService.get(AI_DEFAULT_PROVIDER_KEY, 0);
			if (defaultProvider) {
				this._defaultProviderId = defaultProvider;
			} else {
				const configDefault = this._configurationService.getValue<string>(AI_DEFAULT_PROVIDER_KEY);
				if (configDefault) {
					this._defaultProviderId = configDefault;
				}
			}
		} catch (e) {
			this._logService.error('Failed to load AI provider configurations', e);
		}
	}

	private _saveConfigurations(): void {
		try {
			const configs = Array.from(this._configurations.values());
			this._storageService.store(AI_PROVIDER_CONFIG_KEY, JSON.stringify(configs), 0, 0);
		} catch (e) {
			this._logService.error('Failed to save AI provider configurations', e);
		}
	}

	private _registerConfigurationListener(): void {
		this._register(this._configurationService.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration(AI_DEFAULT_PROVIDER_KEY)) {
				const newDefault = this._configurationService.getValue<string>(AI_DEFAULT_PROVIDER_KEY);
				if (newDefault && newDefault !== this._defaultProviderId) {
					this._defaultProviderId = newDefault;
					this._storageService.store(AI_DEFAULT_PROVIDER_KEY, newDefault, 0, 0);
					this._onDefaultProviderChange.fire(newDefault);
				}
			}
		}));
	}

	override dispose(): void {
		this._store.dispose();
		super.dispose();
	}
}