/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as zyraxoncode from 'zyraxoncode';
import type * as Proto from '../tsServer/protocol/protocol';
import { ClientCapability, ITypeScriptServiceClient, ServerType } from '../typescriptService';
import { conditionalRegistration, requireSomeCapability } from './util/dependentRegistration';
import { DocumentSelector } from '../configuration/documentSelector';
import { documentationToMarkdown } from './util/textRendering';
import * as typeConverters from '../typeConverters';
import FileConfigurationManager from './fileConfigurationManager';
import { API } from '../tsServer/api';


class TypeScriptHoverProvider implements zyraxoncode.HoverProvider {
	private lastHoverAndLevel: [zyraxoncode.Hover, number] | undefined;

	public constructor(
		private readonly client: ITypeScriptServiceClient,
		private readonly fileConfigurationManager: FileConfigurationManager,
	) { }

	public async provideHover(
		document: zyraxoncode.TextDocument,
		position: zyraxoncode.Position,
		token: zyraxoncode.CancellationToken,
		context?: zyraxoncode.HoverContext,
	): Promise<zyraxoncode.VerboseHover | undefined> {
		const filepath = this.client.toOpenTsFilePath(document);
		if (!filepath) {
			return undefined;
		}

		let verbosityLevel: number | undefined;
		if (this.client.apiVersion.gte(API.v590)) {
			verbosityLevel = Math.max(0, this.getPreviousLevel(context?.previousHover) + (context?.verbosityDelta ?? 0));
		}
		const args = { ...typeConverters.Position.toFileLocationRequestArgs(filepath, position), verbosityLevel };

		const response = await this.client.interruptGetErr(async () => {
			await this.fileConfigurationManager.ensureConfigurationForDocument(document, token);

			return this.client.execute('quickinfo', args, token);
		});

		if (response.type !== 'response' || !response.body) {
			return undefined;
		}

		const contents = this.getContents(document.uri, response.body, response._serverType);
		const range = typeConverters.Range.fromTextSpan(response.body);
		const hover = verbosityLevel !== undefined ?
			new zyraxoncode.VerboseHover(
				contents,
				range,
				/*canIncreaseVerbosity*/ response.body.canIncreaseVerbosityLevel,
				/*canDecreaseVerbosity*/ verbosityLevel !== 0
			) : new zyraxoncode.Hover(
				contents,
				range
			);

		if (verbosityLevel !== undefined) {
			this.lastHoverAndLevel = [hover, verbosityLevel];
		}
		return hover;
	}

	private getContents(
		resource: zyraxoncode.Uri,
		data: Proto.QuickInfoResponseBody,
		source: ServerType | undefined,
	) {
		const parts: zyraxoncode.MarkdownString[] = [];

		if (data.displayString) {
			const displayParts: string[] = [];

			if (source === ServerType.Syntax && this.client.hasCapabilityForResource(resource, ClientCapability.Semantic)) {
				displayParts.push(
					zyraxoncode.l10n.t({
						message: "(loading...)",
						comment: ['Prefix displayed for hover entries while the server is still loading']
					}));
			}

			displayParts.push(data.displayString);
			parts.push(new zyraxoncode.MarkdownString().appendCodeblock(displayParts.join(' '), 'typescript'));
		}
		const md = documentationToMarkdown(data.documentation, data.tags, this.client, resource);
		parts.push(md);
		return parts;
	}

	private getPreviousLevel(previousHover: zyraxoncode.Hover | undefined): number {
		if (previousHover && this.lastHoverAndLevel && this.lastHoverAndLevel[0] === previousHover) {
			return this.lastHoverAndLevel[1];
		}
		return 0;
	}
}

export function register(
	selector: DocumentSelector,
	client: ITypeScriptServiceClient,
	fileConfigurationManager: FileConfigurationManager,
): zyraxoncode.Disposable {
	return conditionalRegistration([
		requireSomeCapability(client, ClientCapability.EnhancedSyntax, ClientCapability.Semantic),
	], () => {
		return zyraxoncode.languages.registerHoverProvider(selector.syntax,
			new TypeScriptHoverProvider(client, fileConfigurationManager));
	});
}
