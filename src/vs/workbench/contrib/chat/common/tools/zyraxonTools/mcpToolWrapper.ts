/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken } from '../../../../../../../base/common/cancellation.js';
import { IJSONSchema } from '../../../../../../../base/common/jsonSchema.js';
import { ThemeIcon } from '../../../../../../../base/common/themables.js';
import { ToolDataSource, IToolData, IToolImpl, IToolInvocation, IToolResult, CountTokensCallback, ToolProgress } from '../languageModelToolsService.js';

/**
 * Matches ZYRAXON-AI MCP tool result shape: {success, output, error, details?}
 */
export interface McpToolResult {
	success: boolean;
	output: string;
	error?: string;
	details?: Record<string, any>;
}

/**
 * Matches ZYRAXON-AI MCP tool function shape: (args) => Promise<McpToolResult>
 */
export type McpToolFunction = (args: any) => Promise<McpToolResult>;

/**
 * Defines a ZYRAXON-AI MCP tool for wrapping into Zyraxon-Code's IToolData/IToolImpl.
 */
export interface McpToolDef {
	id: string;
	name: string;
	description: string;
	parameters: Record<string, { type: string; description: string; required?: boolean }>;
	category: string;
	execute: McpToolFunction;
}

/**
 * Build a Zyraxon-Code IToolData from an MCP tool definition.
 */
export function buildToolDataFromMcpDef(tool: McpToolDef): IToolData {
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
		tags: [tool.category, 'zyraxon-mcp'],
		canBeReferencedInPrompt: true,
		runsInWorkspace: false,
	};
}

/**
 * Wraps a ZYRAXON-AI MCP tool's execute() into a Zyraxon-Code IToolImpl.
 * Converts {success, output, error, details?} → IToolResult.
 */
export class McpToolImpl implements IToolImpl {
	constructor(private readonly _tool: McpToolDef) { }

	async invoke(
		invocation: IToolInvocation,
		_countTokens: CountTokensCallback,
		progress: ToolProgress,
		token: CancellationToken
	): Promise<IToolResult> {
		const result = await this._tool.execute(invocation.parameters);

		if (!result.success) {
			return {
				content: [{
					kind: 'text',
					value: `Tool execution failed: ${result.error || result.output || 'Unknown error'}`
				}],
				toolResultError: result.error || result.output || 'Unknown error',
			};
		}

		let outputStr = result.output || '';
		if (result.details) {
			outputStr += '\n\n--- Details ---\n' + JSON.stringify(result.details, null, 2);
		}

		return {
			content: [{
				kind: 'text',
				value: outputStr
			}],
		};
	}
}

/**
 * Create a full tool registration pair from an MCP tool definition.
 */
export function createToolRegistrationFromMcpDef(tool: McpToolDef): [IToolData, McpToolImpl] {
	const data = buildToolDataFromMcpDef(tool);
	const impl = new McpToolImpl(tool);
	return [data, impl];
}
