/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type * as zyraxoncode from 'zyraxoncode';
import { createServiceIdentifier } from '../../../util/common/services';


export const ILanguageFeaturesService = createServiceIdentifier<ILanguageFeaturesService>('ILanguageFeaturesService');

export interface ILanguageFeaturesService {
	_serviceBrand: undefined;
	getDefinitions(uri: zyraxoncode.Uri, position: zyraxoncode.Position): Promise<(zyraxoncode.LocationLink | zyraxoncode.Location)[]>;
	getImplementations(uri: zyraxoncode.Uri, position: zyraxoncode.Position): Promise<(zyraxoncode.LocationLink | zyraxoncode.Location)[]>;
	getReferences(uri: zyraxoncode.Uri, position: zyraxoncode.Position): Promise<zyraxoncode.Location[]>;
	getWorkspaceSymbols(query: string): Promise<zyraxoncode.SymbolInformation[]>;
	getDocumentSymbols(uri: zyraxoncode.Uri): Promise<zyraxoncode.DocumentSymbol[]>;
	getDiagnostics(uri: zyraxoncode.Uri): zyraxoncode.Diagnostic[];
}

export class NoopLanguageFeaturesService implements ILanguageFeaturesService {
	_serviceBrand: undefined;
	getDocumentSymbols(uri: zyraxoncode.Uri): Promise<zyraxoncode.DocumentSymbol[]> {
		return Promise.resolve([]);
	}
	getDefinitions(uri: zyraxoncode.Uri, position: zyraxoncode.Position): Promise<(zyraxoncode.LocationLink | zyraxoncode.Location)[]> {
		return Promise.resolve([]);
	}
	getImplementations(uri: zyraxoncode.Uri, position: zyraxoncode.Position): Promise<(zyraxoncode.LocationLink | zyraxoncode.Location)[]> {
		return Promise.resolve([]);
	}
	getReferences(uri: zyraxoncode.Uri, position: zyraxoncode.Position): Promise<zyraxoncode.Location[]> {
		return Promise.resolve([]);
	}
	getWorkspaceSymbols(query: string): Promise<zyraxoncode.SymbolInformation[]> {
		return Promise.resolve([]);
	}
	getDiagnostics(uri: zyraxoncode.Uri): zyraxoncode.Diagnostic[] {
		return [];
	}
}

export function isLocationLink(thing: unknown): thing is zyraxoncode.LocationLink {
	return typeof thing === 'object' && thing !== null && 'targetUri' in thing;
}
