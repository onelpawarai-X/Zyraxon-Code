/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as zyraxoncode from 'vscode';
import { ILanguageFeaturesService } from '../common/languageFeaturesService';

export class LanguageFeaturesServiceImpl implements ILanguageFeaturesService {

	declare readonly _serviceBrand: undefined;

	constructor() { }

	async getDefinitions(uri: zyraxoncode.Uri, position: zyraxoncode.Position): Promise<(zyraxoncode.LocationLink | zyraxoncode.Location)[]> {
		return await zyraxoncode.commands.executeCommand('zyraxoncode.executeDefinitionProvider', uri, position);
	}

	async getImplementations(uri: zyraxoncode.Uri, position: zyraxoncode.Position): Promise<(zyraxoncode.LocationLink | zyraxoncode.Location)[]> {
		return await zyraxoncode.commands.executeCommand('zyraxoncode.executeImplementationProvider', uri, position);
	}

	async getReferences(uri: zyraxoncode.Uri, position: zyraxoncode.Position): Promise<zyraxoncode.Location[]> {
		return await zyraxoncode.commands.executeCommand('zyraxoncode.executeReferenceProvider', uri, position);
	}

	async getWorkspaceSymbols(query: string): Promise<zyraxoncode.SymbolInformation[]> {
		return await zyraxoncode.commands.executeCommand<zyraxoncode.SymbolInformation[]>('zyraxoncode.executeWorkspaceSymbolProvider', query);
	}

	async getDocumentSymbols(uri: zyraxoncode.Uri): Promise<zyraxoncode.DocumentSymbol[]> {
		return await zyraxoncode.commands.executeCommand<zyraxoncode.DocumentSymbol[]>('zyraxoncode.executeDocumentSymbolProvider', uri);
	}

	getDiagnostics(uri: zyraxoncode.Uri): zyraxoncode.Diagnostic[] {
		return zyraxoncode.languages.getDiagnostics(uri);
	}
}
