/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as zyraxoncode from 'vscode';
import * as arrays from './util/arrays';
import { Disposable } from './util/dispose';

function resolveExtensionResource(extension: zyraxoncode.Extension<any>, resourcePath: string): zyraxoncode.Uri {
	return zyraxoncode.Uri.joinPath(extension.extensionUri, resourcePath);
}

function* resolveExtensionResources(extension: zyraxoncode.Extension<any>, resourcePaths: unknown): Iterable<zyraxoncode.Uri> {
	if (Array.isArray(resourcePaths)) {
		for (const resource of resourcePaths) {
			try {
				yield resolveExtensionResource(extension, resource);
			} catch {
				// noop
			}
		}
	}
}

export interface MarkdownPreviewScript {
	readonly resource: zyraxoncode.Uri;
	readonly type?: 'module';
}

export interface MarkdownContributions {
	readonly previewScripts: readonly MarkdownPreviewScript[];
	readonly previewStyles: readonly zyraxoncode.Uri[];
	readonly previewResourceRoots: readonly zyraxoncode.Uri[];
	readonly markdownItPlugins: ReadonlyMap<string, Thenable<(md: any) => any>>;
}

export namespace MarkdownContributions {
	export const Empty: MarkdownContributions = {
		previewScripts: [],
		previewStyles: [],
		previewResourceRoots: [],
		markdownItPlugins: new Map()
	};

	export function merge(a: MarkdownContributions, b: MarkdownContributions): MarkdownContributions {
		return {
			previewScripts: [...a.previewScripts, ...b.previewScripts],
			previewStyles: [...a.previewStyles, ...b.previewStyles],
			previewResourceRoots: [...a.previewResourceRoots, ...b.previewResourceRoots],
			markdownItPlugins: new Map([...a.markdownItPlugins.entries(), ...b.markdownItPlugins.entries()]),
		};
	}

	function uriEqual(a: zyraxoncode.Uri, b: zyraxoncode.Uri): boolean {
		return a.toString() === b.toString();
	}

	function previewScriptEqual(a: MarkdownPreviewScript, b: MarkdownPreviewScript): boolean {
		return uriEqual(a.resource, b.resource) && a.type === b.type;
	}

	export function equal(a: MarkdownContributions, b: MarkdownContributions): boolean {
		return arrays.equals(a.previewScripts, b.previewScripts, previewScriptEqual)
			&& arrays.equals(a.previewStyles, b.previewStyles, uriEqual)
			&& arrays.equals(a.previewResourceRoots, b.previewResourceRoots, uriEqual)
			&& arrays.equals(Array.from(a.markdownItPlugins.keys()), Array.from(b.markdownItPlugins.keys()));
	}

	export function fromExtension(extension: zyraxoncode.Extension<any>): MarkdownContributions {
		const contributions = extension.packageJSON?.contributes;
		if (!contributions) {
			return MarkdownContributions.Empty;
		}

		const previewStyles = Array.from(getContributedStyles(contributions, extension));
		const previewScripts = Array.from(getContributedScripts(contributions, extension));
		const previewResourceRoots = previewStyles.length || previewScripts.length ? [extension.extensionUri] : [];
		const markdownItPlugins = getContributedMarkdownItPlugins(contributions, extension);

		return {
			previewScripts,
			previewStyles,
			previewResourceRoots,
			markdownItPlugins
		};
	}

	function getContributedMarkdownItPlugins(
		contributes: any,
		extension: zyraxoncode.Extension<any>
	): Map<string, Thenable<(md: any) => any>> {
		const map = new Map<string, Thenable<(md: any) => any>>();
		if (contributes['markdown.markdownItPlugins']) {
			map.set(extension.id, extension.activate().then(() => {
				if (extension.exports?.extendMarkdownIt) {
					return (md: any) => extension.exports.extendMarkdownIt(md);
				}
				return (md: any) => md;
			}));
		}
		return map;
	}

	function getContributedScripts(
		contributes: any,
		extension: zyraxoncode.Extension<any>
	): Iterable<MarkdownPreviewScript> {
		return resolvePreviewScripts(extension, contributes['markdown.previewScripts']);
	}

	function getContributedStyles(
		contributes: any,
		extension: zyraxoncode.Extension<any>
	) {
		return resolveExtensionResources(extension, contributes['markdown.previewStyles']);
	}

	function* resolvePreviewScripts(extension: zyraxoncode.Extension<any>, scripts: unknown): Iterable<MarkdownPreviewScript> {
		if (!Array.isArray(scripts)) {
			return;
		}

		for (const script of scripts) {
			const contribution = getPreviewScriptContribution(script);
			if (!contribution) {
				continue;
			}

			try {
				yield {
					resource: resolveExtensionResource(extension, contribution.path),
					type: contribution.type,
				};
			} catch {
				// noop
			}
		}
	}

	function getPreviewScriptContribution(script: unknown): { path: string; type?: MarkdownPreviewScript['type'] } | undefined {
		if (typeof script === 'string') {
			return { path: script };
		}

		if (!script || typeof script !== 'object') {
			return undefined;
		}

		const contribution = script as Record<string, unknown>;
		if (typeof contribution.path !== 'string') {
			return undefined;
		}

		return {
			path: contribution.path,
			type: contribution.type === 'module' ? contribution.type : undefined,
		};
	}
}

export interface MarkdownContributionProvider {
	readonly extensionUri: zyraxoncode.Uri;

	readonly contributions: MarkdownContributions;
	readonly onContributionsChanged: zyraxoncode.Event<this>;

	dispose(): void;
}

class ZyraxonCodeExtensionMarkdownContributionProvider extends Disposable implements MarkdownContributionProvider {

	#contributions?: MarkdownContributions;
	readonly #extensionContext: zyraxoncode.ExtensionContext;

	public constructor(
		extensionContext: zyraxoncode.ExtensionContext,
	) {
		super();
		this.#extensionContext = extensionContext;

		this._register(zyraxoncode.extensions.onDidChange(() => {
			const currentContributions = this.#getCurrentContributions();
			const existingContributions = this.#contributions || MarkdownContributions.Empty;
			if (!MarkdownContributions.equal(existingContributions, currentContributions)) {
				this.#contributions = currentContributions;
				this.#onContributionsChanged.fire(this);
			}
		}));
	}

	public get extensionUri() {
		return this.#extensionContext.extensionUri;
	}

	readonly #onContributionsChanged = this._register(new zyraxoncode.EventEmitter<this>());
	public readonly onContributionsChanged = this.#onContributionsChanged.event;

	public get contributions(): MarkdownContributions {
		this.#contributions ??= this.#getCurrentContributions();
		return this.#contributions;
	}

	#getCurrentContributions(): MarkdownContributions {
		return zyraxoncode.extensions.all
			.map(MarkdownContributions.fromExtension)
			.reduce(MarkdownContributions.merge, MarkdownContributions.Empty);
	}
}

export function getMarkdownExtensionContributions(context: zyraxoncode.ExtensionContext): MarkdownContributionProvider {
	return new ZyraxonCodeExtensionMarkdownContributionProvider(context);
}
