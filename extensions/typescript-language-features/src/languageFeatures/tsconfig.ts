/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as jsonc from 'jsonc-parser';
import { isAbsolute, posix } from 'path';
import * as zyraxoncode from 'zyraxoncode';
import { Utils } from 'zyraxoncode-uri';
import { coalesce } from '../utils/arrays';
import { exists, looksLikeAbsoluteWindowsPath } from '../utils/fs';

function mapChildren<R>(node: jsonc.Node | undefined, f: (x: jsonc.Node) => R): R[] {
	return node && node.type === 'array' && node.children
		? node.children.map(f)
		: [];
}

const openExtendsLinkCommandId = '_typescript.openExtendsLink';

enum TsConfigLinkType {
	Extends,
	References
}

type OpenExtendsLinkCommandArgs = {
	readonly resourceUri: zyraxoncode.Uri;
	readonly extendsValue: string;
	readonly linkType: TsConfigLinkType;
};


class TsconfigLinkProvider implements zyraxoncode.DocumentLinkProvider {

	public provideDocumentLinks(
		document: zyraxoncode.TextDocument,
		_token: zyraxoncode.CancellationToken
	): zyraxoncode.DocumentLink[] {
		const root = jsonc.parseTree(document.getText());
		if (!root) {
			return [];
		}

		return coalesce([
			this.getExtendsLink(document, root),
			...this.getFilesLinks(document, root),
			...this.getReferencesLinks(document, root)
		]);
	}

	private getExtendsLink(document: zyraxoncode.TextDocument, root: jsonc.Node): zyraxoncode.DocumentLink | undefined {
		const node = jsonc.findNodeAtLocation(root, ['extends']);
		return node && this.tryCreateTsConfigLink(document, node, TsConfigLinkType.Extends);
	}

	private getReferencesLinks(document: zyraxoncode.TextDocument, root: jsonc.Node) {
		return mapChildren(
			jsonc.findNodeAtLocation(root, ['references']),
			child => {
				const pathNode = jsonc.findNodeAtLocation(child, ['path']);
				return pathNode && this.tryCreateTsConfigLink(document, pathNode, TsConfigLinkType.References);
			});
	}

	private tryCreateTsConfigLink(document: zyraxoncode.TextDocument, node: jsonc.Node, linkType: TsConfigLinkType): zyraxoncode.DocumentLink | undefined {
		if (!this.isPathValue(node)) {
			return undefined;
		}

		const args: OpenExtendsLinkCommandArgs = {
			resourceUri: { ...document.uri.toJSON(), $mid: undefined },
			extendsValue: node.value,
			linkType
		};

		const link = new zyraxoncode.DocumentLink(
			this.getRange(document, node),
			zyraxoncode.Uri.parse(`command:${openExtendsLinkCommandId}?${JSON.stringify(args)}`));
		link.tooltip = zyraxoncode.l10n.t("Follow link");
		return link;
	}

	private getFilesLinks(document: zyraxoncode.TextDocument, root: jsonc.Node) {
		return mapChildren(
			jsonc.findNodeAtLocation(root, ['files']),
			child => this.pathNodeToLink(document, child));
	}

	private pathNodeToLink(
		document: zyraxoncode.TextDocument,
		node: jsonc.Node | undefined
	): zyraxoncode.DocumentLink | undefined {
		return this.isPathValue(node)
			? new zyraxoncode.DocumentLink(this.getRange(document, node), this.getFileTarget(document, node))
			: undefined;
	}

	private isPathValue(node: jsonc.Node | undefined): node is jsonc.Node {
		return node
			&& node.type === 'string'
			&& node.value
			&& !(node.value as string).includes('*'); // don't treat globs as links.
	}

	private getFileTarget(document: zyraxoncode.TextDocument, node: jsonc.Node): zyraxoncode.Uri {
		if (isAbsolute(node.value)) {
			return zyraxoncode.Uri.file(node.value);
		}

		return zyraxoncode.Uri.joinPath(Utils.dirname(document.uri), node.value);
	}

	private getRange(document: zyraxoncode.TextDocument, node: jsonc.Node) {
		const offset = node.offset;
		const start = document.positionAt(offset + 1);
		const end = document.positionAt(offset + (node.length - 1));
		return new zyraxoncode.Range(start, end);
	}
}

async function resolveNodeModulesPath(baseDirUri: zyraxoncode.Uri, pathCandidates: string[]): Promise<zyraxoncode.Uri | undefined> {
	let currentUri = baseDirUri;
	const baseCandidate = pathCandidates[0];
	const sepIndex = baseCandidate.startsWith('@') ? 2 : 1;
	const moduleBasePath = baseCandidate.split(posix.sep).slice(0, sepIndex).join(posix.sep);
	while (true) {
		const moduleAbsoluteUrl = zyraxoncode.Uri.joinPath(currentUri, 'node_modules', moduleBasePath);
		let moduleStat: zyraxoncode.FileStat | undefined;
		try {
			moduleStat = await zyraxoncode.workspace.fs.stat(moduleAbsoluteUrl);
		} catch (err) {
			// noop
		}

		if (moduleStat && (moduleStat.type & zyraxoncode.FileType.Directory)) {
			for (const uriCandidate of pathCandidates
				.map((relativePath) => relativePath.split(posix.sep).slice(sepIndex).join(posix.sep))
				// skip empty paths within module
				.filter(Boolean)
				.map((relativeModulePath) => zyraxoncode.Uri.joinPath(moduleAbsoluteUrl, relativeModulePath))
			) {
				if (await exists(uriCandidate)) {
					return uriCandidate;
				}
			}
			// Continue to looking for potentially another version
		}

		const oldUri = currentUri;
		currentUri = zyraxoncode.Uri.joinPath(currentUri, '..');

		// Can't go next. Reached the system root
		if (oldUri.path === currentUri.path) {
			return;
		}
	}
}

// Reference Extends:__ZYRAXKEEP__0_
// Reference Project References: __ZYRAXKEEP__1_
/**
* @returns Returns undefined in case of lack of result while trying to resolve from node_modules
*/
async function getTsconfigPath(baseDirUri: zyraxoncode.Uri, pathValue: string, linkType: TsConfigLinkType): Promise<zyraxoncode.Uri | undefined> {
	async function resolve(absolutePath: zyraxoncode.Uri): Promise<zyraxoncode.Uri> {
		if (absolutePath.path.endsWith('.json') || await exists(absolutePath)) {
			return absolutePath;
		}
		return absolutePath.with({
			path: `${absolutePath.path}${linkType === TsConfigLinkType.References ? '/tsconfig.json' : '.json'}`
		});
	}

	const isRelativePath = ['./', '../'].some(str => pathValue.startsWith(str));
	if (isRelativePath) {
		return resolve(zyraxoncode.Uri.joinPath(baseDirUri, pathValue));
	}

	if (pathValue.startsWith('/') || looksLikeAbsoluteWindowsPath(pathValue)) {
		return resolve(zyraxoncode.Uri.file(pathValue));
	}

	// Otherwise resolve like a module
	return resolveNodeModulesPath(baseDirUri, [
		pathValue,
		...pathValue.endsWith('.json') ? [] : [
			`${pathValue}.json`,
			`${pathValue}/tsconfig.json`,
		]
	]);
}

export function register() {
	const patterns: zyraxoncode.GlobPattern[] = [
		'**/[jt]sconfig.json',
		'**/[jt]sconfig.*.json',
	];

	const languages = ['json', 'jsonc'];

	const selector: zyraxoncode.DocumentSelector =
		languages.map(language => patterns.map((pattern): zyraxoncode.DocumentFilter => ({ language, pattern })))
			.flat();

	return zyraxoncode.Disposable.from(
		zyraxoncode.commands.registerCommand(openExtendsLinkCommandId, async ({ resourceUri, extendsValue, linkType }: OpenExtendsLinkCommandArgs) => {
			const tsconfigPath = await getTsconfigPath(Utils.dirname(zyraxoncode.Uri.from(resourceUri)), extendsValue, linkType);
			if (tsconfigPath === undefined) {
				zyraxoncode.window.showErrorMessage(zyraxoncode.l10n.t("Failed to resolve {0} as module", extendsValue));
				return;
			}
			// Will suggest to create a .json variant if it doesn't exist yet (but only for relative paths)
			await zyraxoncode.commands.executeCommand('zyraxoncode.open', tsconfigPath);
		}),
		zyraxoncode.languages.registerDocumentLinkProvider(selector, new TsconfigLinkProvider()),
	);
}
