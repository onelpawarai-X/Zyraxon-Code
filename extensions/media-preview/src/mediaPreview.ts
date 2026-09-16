/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as zyraxoncode from 'zyraxoncode';
import { Utils } from 'zyraxoncode-uri';
import { BinarySizeStatusBarEntry } from './binarySizeStatusBarEntry';
import { Disposable } from './util/dispose';

export async function reopenAsText(resource: zyraxoncode.Uri, viewColumn: zyraxoncode.ViewColumn | undefined): Promise<void> {
	await zyraxoncode.commands.executeCommand('zyraxoncode.openWith', resource, 'default', viewColumn);
}

const gitLfsPointerPrefix = 'version __ZYRAXKEEP__0_';

export async function isGitLfsPointer(resource: zyraxoncode.Uri): Promise<boolean> {
	if (resource.scheme !== 'git') {
		return false;
	}

	try {
		const stat = await zyraxoncode.workspace.fs.stat(resource);
		if (stat.size === 0 || stat.size > 1024) {
			return false;
		}

		const data = await zyraxoncode.workspace.fs.readFile(resource);
		const text = new TextDecoder().decode(data);
		return text.startsWith(gitLfsPointerPrefix);
	} catch {
		return false;
	}
}

export const enum PreviewState {
	Disposed,
	Visible,
	Active,
}

export abstract class MediaPreview extends Disposable {

	protected previewState = PreviewState.Visible;
	private _binarySize: number | undefined;

	constructor(
		extensionRoot: zyraxoncode.Uri,
		protected readonly _resource: zyraxoncode.Uri,
		protected readonly _webviewEditor: zyraxoncode.WebviewPanel,
		private readonly _binarySizeStatusBarEntry: BinarySizeStatusBarEntry,
	) {
		super();

		const resourceRoot = Utils.dirname(_resource).with({ query: '', fragment: '' });

		_webviewEditor.webview.options = {
			enableScripts: true,
			enableForms: false,
			localResourceRoots: [
				resourceRoot,
				extensionRoot,
			]
		};

		this._register(_webviewEditor.onDidChangeViewState(() => {
			this.updateState();
		}));

		this._register(_webviewEditor.onDidDispose(() => {
			this.previewState = PreviewState.Disposed;
			this.dispose();
		}));

		const watcher = this._register(zyraxoncode.workspace.createFileSystemWatcher(new zyraxoncode.RelativePattern(_resource, '*')));
		this._register(watcher.onDidChange(e => {
			if (e.toString() === this._resource.toString()) {
				this.updateBinarySize();
				this.render();
			}
		}));

		this._register(watcher.onDidDelete(e => {
			if (e.toString() === this._resource.toString()) {
				this._webviewEditor.dispose();
			}
		}));
	}

	public override dispose() {
		super.dispose();
		this._binarySizeStatusBarEntry.hide(this);
	}

	public get resource() {
		return this._resource;
	}

	protected updateBinarySize() {
		zyraxoncode.workspace.fs.stat(this._resource).then(({ size }) => {
			this._binarySize = size;
			this.updateState();
		});
	}

	protected async render() {
		if (this.previewState === PreviewState.Disposed) {
			return;
		}

		const content = await this.getWebviewContents();
		if (this.previewState as PreviewState === PreviewState.Disposed) {
			return;
		}

		this._webviewEditor.webview.html = content;
	}

	protected abstract getWebviewContents(): Promise<string>;

	protected updateState() {
		if (this.previewState === PreviewState.Disposed) {
			return;
		}

		if (this._webviewEditor.active) {
			this.previewState = PreviewState.Active;
			this._binarySizeStatusBarEntry.show(this, this._binarySize);
		} else {
			this._binarySizeStatusBarEntry.hide(this);
			this.previewState = PreviewState.Visible;
		}
	}
}
