/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { OutputMode } from '@zyraxoncode/prompt-tsx';
import type * as zyraxoncode from 'zyraxoncode';
import { IEndpointProvider } from '../../../../platform/endpoint/common/endpointProvider';
import { IChatEndpoint, IEmbeddingsEndpoint } from '../../../../platform/networking/common/networking';
import { ITokenizer as IUtilTokenizer, TokenizerType } from '../../../../util/common/tokenizer';
import { Event } from '../../../../util/vs/base/common/event';

/**
 * Creates a mock tokenizer for testing
 */
function createMockTokenizer(): IUtilTokenizer {
	const mockTokenizer: IUtilTokenizer = {
		mode: OutputMode.Raw,
		tokenLength: async () => 0,
		countMessageTokens: async () => 0,
		countMessagesTokens: async () => 0,
		countToolTokens: async () => 0,
	};
	return mockTokenizer;
}

/**
 * Creates a mock endpoint provider for search tool tests
 */
export function createMockEndpointProvider(modelFamily: string): IEndpointProvider {
	return {
		_serviceBrand: undefined,
		onDidModelsRefresh: Event.None,
		getChatEndpoint: async () => ({
			family: modelFamily,
			model: 'test-model',
			maxOutputTokens: 1000,
			supportsToolCalls: true,
			supportsVision: true,
			supportsPrediction: true,
			showInModelPicker: true,
		} as IChatEndpoint),
		getAllChatEndpoints: async () => [],
		getAllCompletionModels: async () => [],
		getEmbeddingsEndpoint: async () => ({
			urlOrRequestMetadata: '__ZYRAXKEEP__0_',
			acquireTokenizer: createMockTokenizer,
			modelMaxPromptTokens: 1000,
			modelMaxOutputTokens: 1000,
			model: 'test-embeddings-model',
			family: modelFamily,
			showInModelPicker: true,
			embeddingDimensions: 768,
			maxBatchSize: 16,
			name: 'Test Embeddings Model',
			version: '1.0',
			tokenizer: TokenizerType.CL100K
		} as IEmbeddingsEndpoint),
	} as IEndpointProvider;
}

/**
 * Mock language model chat for testing search tools with model-specific behavior
 */
export const mockLanguageModelChat: zyraxoncode.LanguageModelChat = {
	name: 'test-model',
	id: 'test-id',
	vendor: 'test',
	family: 'test-family',
	version: 'test-version',
	maxInputTokens: 1000,
	maxOutputTokens: 1000,
	sendRequest: async () => ({
		text: (async function* () { yield ''; })(),
		stream: (async function* () { })()
	} as zyraxoncode.LanguageModelChatResponse),
	countTokens: async () => 0,
	capabilities: {
		supportsToolCalling: true,
		supportsImageToText: true
	},
} as zyraxoncode.LanguageModelChat;
