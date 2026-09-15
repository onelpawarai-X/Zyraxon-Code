import { Disposable, DisposableStore } from '../../base/common/lifecycle.js';
import { IObservable, observableValue } from '../../base/common/observable.js';
import { URI } from '../../base/common/uri.js';
import { IAiProviderService, ProviderInfo, ModelInfo, ProviderConfiguration } from './aiProviderTypes.js';
import { AgentProvider, IAgentModelInfo, ConfigSchema, PolicyState } from '../agentHost/common/agentService.js';

export interface IAiProviderAgentBridge {
	readonly models: IObservable<readonly IAgentModelInfo[]>;
	readonly provider: AgentProvider;
}

export class AiProviderAgentBridge extends Disposable implements IAiProviderAgentBridge {
	private readonly _store = this._register(new DisposableStore());
	private readonly _models = this._register(observableValue<readonly IAgentModelInfo[]>(this, []));
	readonly models: IObservable<readonly IAgentModelInfo[]> = this._models;
	readonly provider: AgentProvider;

	constructor(
		private readonly _aiProviderService: IAiProviderService,
		providerId: string
	) {
		super();
		this.provider = this._mapProviderId(providerId);
		this._updateModels();
		this._register(_aiProviderService.onConfigurationChange(() => this._updateModels()));
		this._register(_aiProviderService.onDefaultProviderChange(() => this._updateModels()));
	}

	private _mapProviderId(providerId: string): AgentProvider {
		const providerMap: Record<string, AgentProvider> = {
			'openai': 'openai',
			'anthropic': 'anthropic',
			'google': 'google',
			'groq': 'groq',
			'openrouter': 'openrouter',
			'zyraxon': 'zyraxon'
		};
		return providerMap[providerId] || 'openai';
	}

	private _updateModels(): void {
		const configs = this._aiProviderService.getConfigurations();
		const allModels: IAgentModelInfo[] = [];

		for (const config of configs) {
			if (!config.enabled) continue;

			const providerInfo = this._aiProviderService.getProvider(config.providerId);
			if (!providerInfo) continue;

			for (const model of providerInfo.models) {
				if (config.selectedModel && config.selectedModel !== model.id) continue;

				allModels.push(this._convertToAgentModelInfo(model, config.providerId));
			}
		}

		this._models.set(allModels, undefined);
	}

	private _convertToAgentModelInfo(model: ModelInfo, providerId: string): IAgentModelInfo {
		return {
			provider: this.provider,
			id: model.id,
			name: model.name,
			maxContextWindow: model.contextWindow,
			maxOutputTokens: model.maxTokens,
			maxPromptTokens: model.contextWindow,
			supportsVision: model.capabilities.vision,
			configSchema: undefined,
			policyState: undefined,
			_meta: {
				providerId,
				capabilities: model.capabilities
			}
		};
	}

	override dispose(): void {
		this._store.dispose();
		super.dispose();
	}
}

export class AiProviderAgentBridgeRegistry extends Disposable {
	private readonly _bridges = new Map<string, AiProviderAgentBridge>();

	constructor(
		private readonly _aiProviderService: IAiProviderService
	) {
		super();
	}

	getBridge(providerId: string): AiProviderAgentBridge {
		let bridge = this._bridges.get(providerId);
		if (!bridge) {
			bridge = new AiProviderAgentBridge(this._aiProviderService, providerId);
			this._bridges.set(providerId, bridge);
			this._register(bridge);
		}
		return bridge;
	}

	getAllBridges(): readonly AiProviderAgentBridge[] {
		return Array.from(this._bridges.values());
	}

	getAllModels(): readonly IAgentModelInfo[] {
		const models: IAgentModelInfo[] = [];
		for (const bridge of this._bridges.values()) {
			models.push(...bridge.models.get());
		}
		return models;
	}

	override dispose(): void {
		super.dispose();
	}
}