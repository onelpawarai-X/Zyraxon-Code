/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as l10n from '@zyraxoncode/l10n';
import type * as zyraxoncode from 'zyraxoncode';
import { CancellationToken } from '../../../util/vs/base/common/cancellation';
import { IInstantiationService } from '../../../util/vs/platform/instantiation/common/instantiation';
import { LanguageModelPromptTsxPart, LanguageModelToolResult } from '../../../zyraxoncodeTypes';
import { ZyraxonCodeAPIContextElement } from '../../context/node/resolvers/extensionApi';
import { renderPromptElementJSON } from '../../prompts/node/base/promptRenderer';
import { ToolName } from '../common/toolNames';
import { ToolRegistry } from '../common/toolsRegistry';

interface IZyraxonCodeAPIToolParams {
	query: string;
}

class ZyraxonCodeAPITool implements zyraxoncode.LanguageModelTool<IZyraxonCodeAPIToolParams> {
	public static readonly toolName = ToolName.ZyraxonCodeAPI;

	constructor(@IInstantiationService private readonly instantiationService: IInstantiationService) { }

	async invoke(options: zyraxoncode.LanguageModelToolInvocationOptions<IZyraxonCodeAPIToolParams>, token: CancellationToken) {

		return new LanguageModelToolResult([
			new LanguageModelPromptTsxPart(
				await renderPromptElementJSON(this.instantiationService, ZyraxonCodeAPIContextElement, { query: options.input.query }, options.tokenizationOptions, token))]);
	}

	prepareInvocation(options: zyraxoncode.LanguageModelToolInvocationPrepareOptions<IZyraxonCodeAPIToolParams>, token: zyraxoncode.CancellationToken): zyraxoncode.ProviderResult<zyraxoncode.PreparedToolInvocation> {
		const query = `"${options.input.query}"`;
		return {
			invocationMessage: l10n.t`Searching ZYRAXON Code API for ${query}`,
			pastTenseMessage: l10n.t`Searched ZYRAXON Code API for ${query}`
		};
	}
}

ToolRegistry.registerTool(ZyraxonCodeAPITool);
