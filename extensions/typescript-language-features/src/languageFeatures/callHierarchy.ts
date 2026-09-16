/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as zyraxoncode from 'zyraxoncode';
import { DocumentSelector } from '../configuration/documentSelector';
import { API } from '../tsServer/api';
import { parseKindModifier } from '../tsServer/protocol/modifiers';
import type * as Proto from '../tsServer/protocol/protocol';
import * as PConst from '../tsServer/protocol/protocol.const';
import * as typeConverters from '../typeConverters';
import { ClientCapability, ITypeScriptServiceClient } from '../typescriptService';
import { conditionalRegistration, requireMinVersion, requireSomeCapability } from './util/dependentRegistration';

class TypeScriptCallHierarchySupport implements zyraxoncode.CallHierarchyProvider {
	public static readonly minVersion = API.v380;

	public constructor(
		private readonly client: ITypeScriptServiceClient
	) { }

	public async prepareCallHierarchy(
		document: zyraxoncode.TextDocument,
		position: zyraxoncode.Position,
		token: zyraxoncode.CancellationToken
	): Promise<zyraxoncode.CallHierarchyItem | zyraxoncode.CallHierarchyItem[] | undefined> {
		const filepath = this.client.toOpenTsFilePath(document);
		if (!filepath) {
			return undefined;
		}

		const args = typeConverters.Position.toFileLocationRequestArgs(filepath, position);
		const response = await this.client.execute('prepareCallHierarchy', args, token);
		if (response.type !== 'response' || !response.body) {
			return undefined;
		}

		return Array.isArray(response.body)
			? response.body.map(fromProtocolCallHierarchyItem)
			: fromProtocolCallHierarchyItem(response.body);
	}

	public async provideCallHierarchyIncomingCalls(item: zyraxoncode.CallHierarchyItem, token: zyraxoncode.CancellationToken): Promise<zyraxoncode.CallHierarchyIncomingCall[] | undefined> {
		const filepath = this.client.toTsFilePath(item.uri);
		if (!filepath) {
			return undefined;
		}

		const args = typeConverters.Position.toFileLocationRequestArgs(filepath, item.selectionRange.start);
		const response = await this.client.execute('provideCallHierarchyIncomingCalls', args, token);
		if (response.type !== 'response' || !response.body) {
			return undefined;
		}

		return response.body.map(fromProtocolCallHierarchyIncomingCall);
	}

	public async provideCallHierarchyOutgoingCalls(item: zyraxoncode.CallHierarchyItem, token: zyraxoncode.CancellationToken): Promise<zyraxoncode.CallHierarchyOutgoingCall[] | undefined> {
		const filepath = this.client.toTsFilePath(item.uri);
		if (!filepath) {
			return undefined;
		}

		const args = typeConverters.Position.toFileLocationRequestArgs(filepath, item.selectionRange.start);
		const response = await this.client.execute('provideCallHierarchyOutgoingCalls', args, token);
		if (response.type !== 'response' || !response.body) {
			return undefined;
		}

		return response.body.map(fromProtocolCallHierarchyOutgoingCall);
	}
}

function isSourceFileItem(item: Proto.CallHierarchyItem) {
	return item.kind === PConst.Kind.script || item.kind === PConst.Kind.module && item.selectionSpan.start.line === 1 && item.selectionSpan.start.offset === 1;
}

function fromProtocolCallHierarchyItem(item: Proto.CallHierarchyItem): zyraxoncode.CallHierarchyItem {
	const useFileName = isSourceFileItem(item);
	const name = useFileName ? path.basename(item.file) : item.name;
	const detail = useFileName ? zyraxoncode.workspace.asRelativePath(path.dirname(item.file)) : item.containerName ?? '';
	const result = new zyraxoncode.CallHierarchyItem(
		typeConverters.SymbolKind.fromProtocolScriptElementKind(item.kind),
		name,
		detail,
		zyraxoncode.Uri.file(item.file),
		typeConverters.Range.fromTextSpan(item.span),
		typeConverters.Range.fromTextSpan(item.selectionSpan)
	);

	const kindModifiers = item.kindModifiers ? parseKindModifier(item.kindModifiers) : undefined;
	if (kindModifiers?.has(PConst.KindModifiers.deprecated)) {
		result.tags = [zyraxoncode.SymbolTag.Deprecated];
	}
	return result;
}

function fromProtocolCallHierarchyIncomingCall(item: Proto.CallHierarchyIncomingCall): zyraxoncode.CallHierarchyIncomingCall {
	return new zyraxoncode.CallHierarchyIncomingCall(
		fromProtocolCallHierarchyItem(item.from),
		item.fromSpans.map(typeConverters.Range.fromTextSpan)
	);
}

function fromProtocolCallHierarchyOutgoingCall(item: Proto.CallHierarchyOutgoingCall): zyraxoncode.CallHierarchyOutgoingCall {
	return new zyraxoncode.CallHierarchyOutgoingCall(
		fromProtocolCallHierarchyItem(item.to),
		item.fromSpans.map(typeConverters.Range.fromTextSpan)
	);
}

export function register(
	selector: DocumentSelector,
	client: ITypeScriptServiceClient
) {
	return conditionalRegistration([
		requireMinVersion(client, TypeScriptCallHierarchySupport.minVersion),
		requireSomeCapability(client, ClientCapability.Semantic),
	], () => {
		return zyraxoncode.languages.registerCallHierarchyProvider(selector.semantic,
			new TypeScriptCallHierarchySupport(client));
	});
}
