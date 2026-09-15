export interface ModelInfo {
	id: string;
	name: string;
	providerId: string;
	capabilities: ModelCapabilities;
	maxTokens: number;
	contextWindow: number;
}

export interface ModelCapabilities {
	chat: boolean;
	completion: boolean;
	embedding: boolean;
	vision: boolean;
	tools: boolean;
	streaming: boolean;
}

export interface ProviderInfo {
	id: string;
	name: string;
	description: string;
	models: ModelInfo[];
	authType: 'apiKey' | 'oauth' | 'none';
	configSchema: ProviderConfigSchema;
}

export interface ProviderConfigSchema {
	apiKey?: string;
	baseUrl?: string;
	organization?: string;
	customHeaders?: Record<string, string>;
}

export interface ProviderConfiguration {
	providerId: string;
	config: ProviderConfigSchema;
	enabled: boolean;
	selectedModel?: string;
}

export interface ChatRequest {
	model: string;
	messages: ChatMessage[];
	temperature?: number;
	maxTokens?: number;
	stream?: boolean;
	tools?: ToolDefinition[];
}

export interface ChatMessage {
	role: 'system' | 'user' | 'assistant' | 'tool';
	content: string;
	toolCalls?: ToolCall[];
	toolCallId?: string;
}

export interface ToolDefinition {
	type: 'function';
	function: {
		name: string;
		description: string;
		parameters: Record<string, unknown>;
	};
}

export interface ToolCall {
	id: string;
	type: 'function';
	function: {
		name: string;
		arguments: string;
	};
}

export interface ChatResponse {
	id: string;
	model: string;
	choices: ChatChoice[];
	usage?: TokenUsage;
}

export interface ChatChoice {
	index: number;
	message: ChatMessage;
	finishReason: 'stop' | 'length' | 'tool_calls' | 'content_filter';
}

export interface TokenUsage {
	promptTokens: number;
	completionTokens: number;
	totalTokens: number;
}

export interface EmbeddingRequest {
	model: string;
	input: string | string[];
}

export interface EmbeddingResponse {
	data: EmbeddingData[];
	model: string;
	usage: TokenUsage;
}

export interface EmbeddingData {
	embedding: number[];
	index: number;
	object: 'embedding';
}

export const BUILTIN_PROVIDERS: ProviderInfo[] = [
	{
		id: 'openai',
		name: 'OpenAI',
		description: 'OpenAI GPT models',
		authType: 'apiKey',
		configSchema: {
			apiKey: 'string',
			baseUrl: 'string?',
			organization: 'string?'
		},
		models: [
			{ id: 'gpt-4o', name: 'GPT-4o', providerId: 'openai', capabilities: { chat: true, completion: true, embedding: false, vision: true, tools: true, streaming: true }, maxTokens: 4096, contextWindow: 128000 },
			{ id: 'gpt-4o-mini', name: 'GPT-4o Mini', providerId: 'openai', capabilities: { chat: true, completion: true, embedding: false, vision: true, tools: true, streaming: true }, maxTokens: 16384, contextWindow: 128000 },
			{ id: 'gpt-4-turbo', name: 'GPT-4 Turbo', providerId: 'openai', capabilities: { chat: true, completion: true, embedding: false, vision: true, tools: true, streaming: true }, maxTokens: 4096, contextWindow: 128000 },
			{ id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', providerId: 'openai', capabilities: { chat: true, completion: true, embedding: false, vision: false, tools: true, streaming: true }, maxTokens: 4096, contextWindow: 16385 }
		]
	},
	{
		id: 'anthropic',
		name: 'Anthropic',
		description: 'Anthropic Claude models',
		authType: 'apiKey',
		configSchema: {
			apiKey: 'string',
			baseUrl: 'string?'
		},
		models: [
			{ id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', providerId: 'anthropic', capabilities: { chat: true, completion: true, embedding: false, vision: true, tools: true, streaming: true }, maxTokens: 8192, contextWindow: 200000 },
			{ id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', providerId: 'anthropic', capabilities: { chat: true, completion: true, embedding: false, vision: true, tools: true, streaming: true }, maxTokens: 8192, contextWindow: 200000 },
			{ id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', providerId: 'anthropic', capabilities: { chat: true, completion: true, embedding: false, vision: true, tools: true, streaming: true }, maxTokens: 4096, contextWindow: 200000 }
		]
	},
	{
		id: 'google',
		name: 'Google',
		description: 'Google Gemini models',
		authType: 'apiKey',
		configSchema: {
			apiKey: 'string',
			baseUrl: 'string?'
		},
		models: [
			{ id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', providerId: 'google', capabilities: { chat: true, completion: true, embedding: false, vision: true, tools: true, streaming: true }, maxTokens: 8192, contextWindow: 2000000 },
			{ id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', providerId: 'google', capabilities: { chat: true, completion: true, embedding: false, vision: true, tools: true, streaming: true }, maxTokens: 8192, contextWindow: 1000000 },
			{ id: 'gemini-1.0-pro', name: 'Gemini 1.0 Pro', providerId: 'google', capabilities: { chat: true, completion: true, embedding: false, vision: false, tools: true, streaming: true }, maxTokens: 2048, contextWindow: 32768 }
		]
	},
	{
		id: 'groq',
		name: 'Groq',
		description: 'Groq fast inference models',
		authType: 'apiKey',
		configSchema: {
			apiKey: 'string',
			baseUrl: 'string?'
		},
		models: [
			{ id: 'llama-3.1-70b-versatile', name: 'Llama 3.1 70B', providerId: 'groq', capabilities: { chat: true, completion: true, embedding: false, vision: false, tools: true, streaming: true }, maxTokens: 8192, contextWindow: 131072 },
			{ id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B', providerId: 'groq', capabilities: { chat: true, completion: true, embedding: false, vision: false, tools: true, streaming: true }, maxTokens: 8192, contextWindow: 131072 },
			{ id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B', providerId: 'groq', capabilities: { chat: true, completion: true, embedding: false, vision: false, tools: true, streaming: true }, maxTokens: 8192, contextWindow: 32768 }
		]
	},
	{
		id: 'openrouter',
		name: 'OpenRouter',
		description: 'OpenRouter unified API',
		authType: 'apiKey',
		configSchema: {
			apiKey: 'string',
			baseUrl: 'string?'
		},
		models: [
			{ id: 'openrouter/auto', name: 'Auto (Best Model)', providerId: 'openrouter', capabilities: { chat: true, completion: true, embedding: false, vision: true, tools: true, streaming: true }, maxTokens: 4096, contextWindow: 128000 },
			{ id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet (via OpenRouter)', providerId: 'openrouter', capabilities: { chat: true, completion: true, embedding: false, vision: true, tools: true, streaming: true }, maxTokens: 8192, contextWindow: 200000 },
			{ id: 'google/gemini-pro-1.5', name: 'Gemini Pro 1.5 (via OpenRouter)', providerId: 'openrouter', capabilities: { chat: true, completion: true, embedding: false, vision: true, tools: true, streaming: true }, maxTokens: 8192, contextWindow: 2000000 }
		]
	}
];