/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken } from '../../../../../../../base/common/cancellation.js';
import { IJSONSchema } from '../../../../../../../base/common/jsonSchema.js';
import { ThemeIcon } from '../../../../../../../base/common/themables.js';
import { localize } from '../../../../../../../nls.js';
import { ToolDataSource, IToolData, IToolImpl, IToolInvocation, IToolInvocationPreparationContext, IToolResult, IPreparedToolInvocation, CountTokensCallback, ToolProgress } from '../languageModelToolsService.js';

/**
 * Matches ZYRAXON-AI's XToolDef shape for execute() functions.
 */
export interface ZyraxonToolDef {
	id: string;
	name: string;
	description: string;
	parameters: Record<string, { type: string; description: string; required?: boolean }>;
	category: string;
	execute: (args: any) => Promise<{ ok: boolean; data?: any; error?: string }>;
}

/**
 * Build a Zyraxon-Code IToolData from a ZYRAXON-AI XToolDef.
 * Maps: id, displayName, modelDescription, source (Internal), inputSchema.
 */
export function buildToolDataFromXToolDef(tool: ZyraxonToolDef): IToolData {
	const properties: Record<string, any> = {};
	const required: string[] = [];

	for (const [key, param] of Object.entries(tool.parameters)) {
		properties[key] = {
			type: param.type,
			description: param.description,
		};
		if (param.required) {
			required.push(key);
		}
	}

	const inputSchema: IJSONSchema = {
		type: 'object',
		properties,
		...(required.length > 0 ? { required } : {}),
	};

	return {
		id: tool.id,
		displayName: tool.name,
		modelDescription: tool.description,
		source: ToolDataSource.Internal,
		inputSchema,
		tags: [tool.category],
		canBeReferencedInPrompt: true,
		runsInWorkspace: false,
	};
}

/**
 * Wraps a ZYRAXON-AI XToolDef's execute() into a Zyraxon-Code IToolImpl.
 * Converts {ok, data, error} → IToolResult with text content parts.
 */
export class ZyraxonToolImpl implements IToolImpl {
	constructor(private readonly _tool: ZyraxonToolDef) { }

	async invoke(
		invocation: IToolInvocation,
		_countTokens: CountTokensCallback,
		progress: ToolProgress,
		token: CancellationToken
	): Promise<IToolResult> {
		const result = await this._tool.execute(invocation.parameters);

		if (!result.ok) {
			return {
				content: [{
					kind: 'text',
					value: `Tool execution failed: ${result.error || 'Unknown error'}`
				}],
				toolResultError: result.error || 'Unknown error',
			};
		}

		const outputStr = typeof result.data === 'string'
			? result.data
			: JSON.stringify(result.data, null, 2);

		return {
			content: [{
				kind: 'text',
				value: outputStr
			}],
		};
	}
}

/**
 * Create a full tool registration pair (IToolData + IToolImpl) from a ZYRAXON-AI tool definition.
 * Returns [toolData, toolImpl] ready for ILanguageModelToolsService.registerTool().
 */
export function createToolRegistrationFromXToolDef(tool: ZyraxonToolDef): [IToolData, ZyraxonToolImpl] {
	const data = buildToolDataFromXToolDef(tool);
	const impl = new ZyraxonToolImpl(tool);
	return [data, impl];
}
