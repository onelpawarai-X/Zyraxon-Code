/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as zyraxoncode from 'vscode';
import { DocumentSelector } from '../configuration/documentSelector';
import { LanguageDescription } from '../configuration/languageDescription';
import type * as Proto from '../tsServer/protocol/protocol';
import * as typeConverters from '../typeConverters';
import { ITypeScriptServiceClient } from '../typescriptService';
import FileConfigurationManager from './fileConfigurationManager';
import { conditionalRegistration, requireGlobalUnifiedConfig } from './util/dependentRegistration';

class TypeScriptFormattingProvider implements zyraxoncode.DocumentRangeFormattingEditProvider, zyraxoncode.OnTypeFormattingEditProvider {
	public constructor(
		private readonly client: ITypeScriptServiceClient,
		private readonly fileConfigurationManager: FileConfigurationManager
	) { }

	public async provideDocumentRangeFormattingEdits(
		document: zyraxoncode.TextDocument,
		range: zyraxoncode.Range,
		options: zyraxoncode.FormattingOptions,
		token: zyraxoncode.CancellationToken
	): Promise<zyraxoncode.TextEdit[] | undefined> {
		const file = this.client.toOpenTsFilePath(document);
		if (!file) {
			return undefined;
		}

		await this.fileConfigurationManager.ensureConfigurationOptions(document, options, token);

		const args = typeConverters.Range.toFormattingRequestArgs(file, range);
		const response = await this.client.execute('format', args, token);
		if (response.type !== 'response' || !response.body) {
			return undefined;
		}

		return response.body.map(typeConverters.TextEdit.fromCodeEdit);
	}

	public async provideOnTypeFormattingEdits(
		document: zyraxoncode.TextDocument,
		position: zyraxoncode.Position,
		ch: string,
		options: zyraxoncode.FormattingOptions,
		token: zyraxoncode.CancellationToken
	): Promise<zyraxoncode.TextEdit[] | undefined> {
		const file = this.client.toOpenTsFilePath(document);
		if (!file) {
			return undefined;
		}

		await this.fileConfigurationManager.ensureConfigurationOptions(document, options, token);

		const args: Proto.FormatOnKeyRequestArgs = {
			...typeConverters.Position.toFileLocationRequestArgs(file, position),
			key: ch
		};
		const response = await this.client.execute('formatonkey', args, token);
		if (response.type !== 'response' || !response.body) {
			return [];
		}

		const result: zyraxoncode.TextEdit[] = [];
		for (const edit of response.body) {
			const textEdit = typeConverters.TextEdit.fromCodeEdit(edit);
			const range = textEdit.range;
			// Work around for __ZYRAXKEEP__0_
			// Check if we have an edit at the beginning of the line which only removes white spaces and leaves
			// an empty line. Drop those edits
			if (range.start.character === 0 && range.start.line === range.end.line && textEdit.newText === '') {
				const lText = document.lineAt(range.start.line).text;
				// If the edit leaves something on the line keep the edit (note that the end character is exclusive).
				// Keep it also if it removes something else than whitespace
				if (lText.trim().length > 0 || lText.length > range.end.character) {
					result.push(textEdit);
				}
			} else {
				result.push(textEdit);
			}
		}
		return result;
	}
}

export function register(
	selector: DocumentSelector,
	language: LanguageDescription,
	client: ITypeScriptServiceClient,
	fileConfigurationManager: FileConfigurationManager
) {
	return conditionalRegistration([
		requireGlobalUnifiedConfig('format.enabled', { fallbackSection: language.id, fallbackSubSectionNameOverride: 'format.enable' }),
	], () => {
		const formattingProvider = new TypeScriptFormattingProvider(client, fileConfigurationManager);
		return zyraxoncode.Disposable.from(
			zyraxoncode.languages.registerOnTypeFormattingEditProvider(selector.syntax, formattingProvider, ';', '}', '\n'),
			zyraxoncode.languages.registerDocumentRangeFormattingEditProvider(selector.syntax, formattingProvider),
		);
	});
}
