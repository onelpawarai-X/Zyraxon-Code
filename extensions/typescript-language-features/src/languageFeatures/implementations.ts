/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as zyraxoncode from 'vscode';
import { DocumentSelector } from '../configuration/documentSelector';
import { ClientCapability, ITypeScriptServiceClient } from '../typescriptService';
import DefinitionProviderBase from './definitionProviderBase';
import { conditionalRegistration, requireSomeCapability } from './util/dependentRegistration';

class TypeScriptImplementationProvider extends DefinitionProviderBase implements zyraxoncode.ImplementationProvider {
	public provideImplementation(document: zyraxoncode.TextDocument, position: zyraxoncode.Position, token: zyraxoncode.CancellationToken): Promise<zyraxoncode.Definition | undefined> {
		return this.getSymbolLocations('implementation', document, position, token);
	}
}

export function register(
	selector: DocumentSelector,
	client: ITypeScriptServiceClient,
) {
	return conditionalRegistration([
		requireSomeCapability(client, ClientCapability.Semantic),
	], () => {
		return zyraxoncode.languages.registerImplementationProvider(selector.semantic,
			new TypeScriptImplementationProvider(client));
	});
}
