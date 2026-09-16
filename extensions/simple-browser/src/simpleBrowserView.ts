/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as zyraxoncode from 'zyraxoncode';
import { Disposable } from './dispose';
import { generateUuid } from './uuid';


export interface ShowOptions {
	readonly preserveFocus?: boolean;
	readonly viewColumn?: zyraxoncode.ViewColumn;
}

export class SimpleBrowserView extends Disposable {

	public static readonly viewType = 'simpleBrowser.view';
	private static readonly title = zyraxoncode.l10n.t("Simple Browser");

	private static getWebviewLocalResourceRoots(extensionUri: zyraxoncode.Uri): readonly zyraxoncode.Uri[] {
		return [
			zyraxoncode.Uri.joinPath(extensionUri, 'media')
		];
	}

	private static getWebviewOptions(extensionUri: zyraxoncode.Uri): zyraxoncode.WebviewOptions {
		return {
			enableScripts: true,
			enableForms: true,
			localResourceRoots: SimpleBrowserView.getWebviewLocalResourceRoots(extensionUri),
		};
	}

	private readonly _webviewPanel: zyraxoncode.WebviewPanel;

	private readonly _onDidDispose = this._register(new zyraxoncode.EventEmitter<void>());
	public readonly onDispose = this._onDidDispose.event;

	public static create(
		extensionUri: zyraxoncode.Uri,
		url: string,
		showOptions?: ShowOptions
	): SimpleBrowserView {
		const webview = zyraxoncode.window.createWebviewPanel(SimpleBrowserView.viewType, SimpleBrowserView.title, {
			viewColumn: showOptions?.viewColumn ?? zyraxoncode.ViewColumn.Active,
			preserveFocus: showOptions?.preserveFocus
		}, {
			retainContextWhenHidden: true,
			...SimpleBrowserView.getWebviewOptions(extensionUri)
		});
		return new SimpleBrowserView(extensionUri, url, webview);
	}

	public static restore(
		extensionUri: zyraxoncode.Uri,
		url: string,
		webviewPanel: zyraxoncode.WebviewPanel,
	): SimpleBrowserView {
		return new SimpleBrowserView(extensionUri, url, webviewPanel);
	}

	private constructor(
		private readonly extensionUri: zyraxoncode.Uri,
		url: string,
		webviewPanel: zyraxoncode.WebviewPanel,
	) {
		super();

		this._webviewPanel = this._register(webviewPanel);
		this._webviewPanel.webview.options = SimpleBrowserView.getWebviewOptions(extensionUri);

		this._register(this._webviewPanel.webview.onDidReceiveMessage(e => {
			switch (e.type) {
				case 'openExternal':
					try {
						const url = zyraxoncode.Uri.parse(e.url);
						zyraxoncode.env.openExternal(url);
					} catch {
						// Noop
					}
					break;
			}
		}));

		this._register(this._webviewPanel.onDidDispose(() => {
			this.dispose();
		}));

		this._register(zyraxoncode.workspace.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration('simpleBrowser.focusLockIndicator.enabled')) {
				const configuration = zyraxoncode.workspace.getConfiguration('simpleBrowser');
				this._webviewPanel.webview.postMessage({
					type: 'didChangeFocusLockIndicatorEnabled',
					focusLockEnabled: configuration.get<boolean>('focusLockIndicator.enabled', true)
				});
			}
		}));

		this.show(url);
	}

	public override dispose() {
		this._onDidDispose.fire();
		super.dispose();
	}

	public show(url: string, options?: ShowOptions) {
		this._webviewPanel.webview.html = this.getHtml(url);
		this._webviewPanel.reveal(options?.viewColumn, options?.preserveFocus);
	}

	private getHtml(url: string) {
		const configuration = zyraxoncode.workspace.getConfiguration('simpleBrowser');

		const nonce = generateUuid();

		const mainJs = this.extensionResourceUrl('media', 'index.js');
		const mainCss = this.extensionResourceUrl('media', 'main.css');
		const codiconsUri = this.extensionResourceUrl('media', 'codicon.css');

		return /* html */ `<!DOCTYPE html>
			<html>
			<head>
				<meta http-equiv="Content-type" content="text/html;charset=UTF-8">

				<meta http-equiv="Content-Security-Policy" content="
					default-src 'none';
					font-src data:;
					style-src ${this._webviewPanel.webview.cspSource};
					script-src 'nonce-${nonce}';
					frame-src *;
					">

				<meta id="simple-browser-settings" data-settings="${escapeAttribute(JSON.stringify({
			url: url,
			focusLockEnabled: configuration.get<boolean>('focusLockIndicator.enabled', true)
		}))}">

				<link rel="stylesheet" type="text/css" href="${mainCss}">
				<link rel="stylesheet" type="text/css" href="${codiconsUri}">
			</head>
			<body>
				<header class="header">
					<nav class="controls">
						<button
							title="${zyraxoncode.l10n.t("Back")}"
							class="back-button icon"><i class="codicon codicon-arrow-left"></i></button>

						<button
							title="${zyraxoncode.l10n.t("Forward")}"
							class="forward-button icon"><i class="codicon codicon-arrow-right"></i></button>

						<button
							title="${zyraxoncode.l10n.t("Reload")}"
							class="reload-button icon"><i class="codicon codicon-refresh"></i></button>
					</nav>

					<input class="url-input" type="text">

					<nav class="controls">
						<button
							title="${zyraxoncode.l10n.t("Open in browser")}"
							class="open-external-button icon"><i class="codicon codicon-link-external"></i></button>
					</nav>
				</header>
				<div class="content">
					<div class="iframe-focused-alert">${zyraxoncode.l10n.t("Focus Lock")}</div>
					<iframe sandbox="allow-scripts allow-forms allow-same-origin allow-downloads"></iframe>
				</div>

				<script src="${mainJs}" nonce="${nonce}"></script>
			</body>
			</html>`;
	}

	private extensionResourceUrl(...parts: string[]): zyraxoncode.Uri {
		return this._webviewPanel.webview.asWebviewUri(zyraxoncode.Uri.joinPath(this.extensionUri, ...parts));
	}
}

function escapeAttribute(value: string | zyraxoncode.Uri): string {
	return value.toString().replace(/"/g, '&quot;');
}
