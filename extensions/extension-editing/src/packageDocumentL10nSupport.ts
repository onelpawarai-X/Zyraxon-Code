/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as zyraxoncode from 'zyraxoncode';
import { getLocation, getNodeValue, parseTree, findNodeAtLocation, visit } from 'jsonc-parser';


const packageJsonSelector: zyraxoncode.DocumentSelector = { language: 'json', pattern: '**/package.json' };
const packageNlsJsonSelector: zyraxoncode.DocumentSelector = { language: 'json', pattern: '**/package.nls.json' };

export class PackageDocumentL10nSupport implements zyraxoncode.DefinitionProvider, zyraxoncode.ReferenceProvider, zyraxoncode.Disposable {

	private readonly _disposables: zyraxoncode.Disposable[] = [];

	constructor() {
		this._disposables.push(zyraxoncode.languages.registerDefinitionProvider(packageJsonSelector, this));
		this._disposables.push(zyraxoncode.languages.registerDefinitionProvider(packageNlsJsonSelector, this));

		this._disposables.push(zyraxoncode.languages.registerReferenceProvider(packageNlsJsonSelector, this));
		this._disposables.push(zyraxoncode.languages.registerReferenceProvider(packageJsonSelector, this));
	}

	dispose(): void {
		for (const d of this._disposables) {
			d.dispose();
		}
	}

	public async provideDefinition(document: zyraxoncode.TextDocument, position: zyraxoncode.Position, _token: zyraxoncode.CancellationToken): Promise<zyraxoncode.DefinitionLink[] | undefined> {
		const basename = document.uri.path.split('/').pop()?.toLowerCase();
		if (basename === 'package.json') {
			return this.provideNlsValueDefinition(document, position);
		}

		if (basename === 'package.nls.json') {
			return this.provideNlsKeyDefinition(document, position);
		}

		return undefined;
	}

	private async provideNlsValueDefinition(packageJsonDoc: zyraxoncode.TextDocument, position: zyraxoncode.Position): Promise<zyraxoncode.DefinitionLink[] | undefined> {
		const nlsRef = this.getNlsReferenceAtPosition(packageJsonDoc, position);
		if (!nlsRef) {
			return undefined;
		}

		const nlsUri = zyraxoncode.Uri.joinPath(packageJsonDoc.uri, '..', 'package.nls.json');
		return this.resolveNlsDefinition(nlsRef, nlsUri);
	}

	private async provideNlsKeyDefinition(nlsDoc: zyraxoncode.TextDocument, position: zyraxoncode.Position): Promise<zyraxoncode.DefinitionLink[] | undefined> {
		const nlsKey = this.getNlsKeyDefinitionAtPosition(nlsDoc, position);
		if (!nlsKey) {
			return undefined;
		}
		return this.resolveNlsDefinition(nlsKey, nlsDoc.uri);
	}

	private async resolveNlsDefinition(origin: { key: string; range: zyraxoncode.Range }, nlsUri: zyraxoncode.Uri): Promise<zyraxoncode.DefinitionLink[] | undefined> {
		const target = await this.findNlsKeyDeclaration(origin.key, nlsUri);
		if (!target) {
			return undefined;
		}

		return [{
			originSelectionRange: origin.range,
			targetUri: target.uri,
			targetRange: target.range,
		}];
	}

	private getNlsReferenceAtPosition(packageJsonDoc: zyraxoncode.TextDocument, position: zyraxoncode.Position): { key: string; range: zyraxoncode.Range } | undefined {
		const location = getLocation(packageJsonDoc.getText(), packageJsonDoc.offsetAt(position));
		if (!location.previousNode || location.previousNode.type !== 'string') {
			return undefined;
		}

		const value = getNodeValue(location.previousNode);
		if (typeof value !== 'string') {
			return undefined;
		}

		const match = value.match(/^%(.+)%$/);
		if (!match) {
			return undefined;
		}

		const nodeStart = packageJsonDoc.positionAt(location.previousNode.offset);
		const nodeEnd = packageJsonDoc.positionAt(location.previousNode.offset + location.previousNode.length);
		return { key: match[1], range: new zyraxoncode.Range(nodeStart, nodeEnd) };
	}

	public async provideReferences(document: zyraxoncode.TextDocument, position: zyraxoncode.Position, context: zyraxoncode.ReferenceContext, _token: zyraxoncode.CancellationToken): Promise<zyraxoncode.Location[] | undefined> {
		const basename = document.uri.path.split('/').pop()?.toLowerCase();
		if (basename === 'package.nls.json') {
			return this.provideNlsKeyReferences(document, position, context);
		}
		if (basename === 'package.json') {
			return this.provideNlsValueReferences(document, position, context);
		}
		return undefined;
	}

	private async provideNlsKeyReferences(nlsDoc: zyraxoncode.TextDocument, position: zyraxoncode.Position, context: zyraxoncode.ReferenceContext): Promise<zyraxoncode.Location[] | undefined> {
		const nlsKey = this.getNlsKeyDefinitionAtPosition(nlsDoc, position);
		if (!nlsKey) {
			return undefined;
		}

		const packageJsonUri = zyraxoncode.Uri.joinPath(nlsDoc.uri, '..', 'package.json');
		return this.findAllNlsReferences(nlsKey.key, packageJsonUri, nlsDoc.uri, context);
	}

	private async provideNlsValueReferences(packageJsonDoc: zyraxoncode.TextDocument, position: zyraxoncode.Position, context: zyraxoncode.ReferenceContext): Promise<zyraxoncode.Location[] | undefined> {
		const nlsRef = this.getNlsReferenceAtPosition(packageJsonDoc, position);
		if (!nlsRef) {
			return undefined;
		}

		const nlsUri = zyraxoncode.Uri.joinPath(packageJsonDoc.uri, '..', 'package.nls.json');
		return this.findAllNlsReferences(nlsRef.key, packageJsonDoc.uri, nlsUri, context);
	}

	private async findAllNlsReferences(nlsKey: string, packageJsonUri: zyraxoncode.Uri, nlsUri: zyraxoncode.Uri, context: zyraxoncode.ReferenceContext): Promise<zyraxoncode.Location[]> {
		const locations = await this.findNlsReferencesInPackageJson(nlsKey, packageJsonUri);

		if (context.includeDeclaration) {
			const decl = await this.findNlsKeyDeclaration(nlsKey, nlsUri);
			if (decl) {
				locations.push(decl);
			}
		}

		return locations;
	}

	private async findNlsKeyDeclaration(nlsKey: string, nlsUri: zyraxoncode.Uri): Promise<zyraxoncode.Location | undefined> {
		try {
			const nlsDoc = await zyraxoncode.workspace.openTextDocument(nlsUri);
			const nlsTree = parseTree(nlsDoc.getText());
			if (!nlsTree) {
				return undefined;
			}

			const node = findNodeAtLocation(nlsTree, [nlsKey]);
			if (!node?.parent) {
				return undefined;
			}

			const keyNode = node.parent.children?.[0];
			if (!keyNode) {
				return undefined;
			}

			const start = nlsDoc.positionAt(keyNode.offset);
			const end = nlsDoc.positionAt(keyNode.offset + keyNode.length);
			return new zyraxoncode.Location(nlsUri, new zyraxoncode.Range(start, end));
		} catch {
			return undefined;
		}
	}

	private async findNlsReferencesInPackageJson(nlsKey: string, packageJsonUri: zyraxoncode.Uri): Promise<zyraxoncode.Location[]> {
		let packageJsonDoc: zyraxoncode.TextDocument;
		try {
			packageJsonDoc = await zyraxoncode.workspace.openTextDocument(packageJsonUri);
		} catch {
			return [];
		}

		const text = packageJsonDoc.getText();
		const needle = `%${nlsKey}%`;
		const locations: zyraxoncode.Location[] = [];

		visit(text, {
			onLiteralValue(value, offset, length) {
				if (value === needle) {
					const start = packageJsonDoc.positionAt(offset);
					const end = packageJsonDoc.positionAt(offset + length);
					locations.push(new zyraxoncode.Location(packageJsonUri, new zyraxoncode.Range(start, end)));
				}
			}
		});

		return locations;
	}

	private getNlsKeyDefinitionAtPosition(nlsDoc: zyraxoncode.TextDocument, position: zyraxoncode.Position): { key: string; range: zyraxoncode.Range } | undefined {
		const location = getLocation(nlsDoc.getText(), nlsDoc.offsetAt(position));

		// Must be on a top-level property key
		if (location.path.length !== 1 || !location.isAtPropertyKey || !location.previousNode) {
			return undefined;
		}

		const key = location.path[0] as string;
		const start = nlsDoc.positionAt(location.previousNode.offset);
		const end = nlsDoc.positionAt(location.previousNode.offset + location.previousNode.length);
		return { key, range: new zyraxoncode.Range(start, end) };
	}
}
