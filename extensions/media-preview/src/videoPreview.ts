/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as zyraxoncode from 'vscode';
import { BinarySizeStatusBarEntry } from './binarySizeStatusBarEntry';
import { MediaPreview, isGitLfsPointer, reopenAsText } from './mediaPreview';
import { escapeAttribute } from './util/dom';
import { generateUuid } from './util/uuid';


class VideoPreviewProvider implements zyraxoncode.CustomReadonlyEditorProvider {

	public static readonly viewType = 'zyraxoncode.videoPreview';

	constructor(
		private readonly extensionRoot: zyraxoncode.Uri,
		private readonly binarySizeStatusBarEntry: BinarySizeStatusBarEntry,
	) { }

	public async openCustomDocument(uri: zyraxoncode.Uri) {
		return { uri, dispose: () => { } };
	}

	public async resolveCustomEditor(document: zyraxoncode.CustomDocument, webviewEditor: zyraxoncode.WebviewPanel): Promise<void> {
		new VideoPreview(this.extensionRoot, document.uri, webviewEditor, this.binarySizeStatusBarEntry);
	}
}


class VideoPreview extends MediaPreview {

	constructor(
		private readonly extensionRoot: zyraxoncode.Uri,
		resource: zyraxoncode.Uri,
		webviewEditor: zyraxoncode.WebviewPanel,
		binarySizeStatusBarEntry: BinarySizeStatusBarEntry,
	) {
		super(extensionRoot, resource, webviewEditor, binarySizeStatusBarEntry);

		this._register(webviewEditor.webview.onDidReceiveMessage(message => {
			switch (message.type) {
				case 'reopen-as-text': {
					reopenAsText(resource, webviewEditor.viewColumn);
					break;
				}
			}
		}));

		this.updateBinarySize();
		this.render();
		this.updateState();
	}

	protected async getWebviewContents(): Promise<string> {
		const version = Date.now().toString();
		const configurations = zyraxoncode.workspace.getConfiguration('mediaPreview.video');
		const src = await this.getResourcePath(this._webviewEditor, this._resource, version);
		const settings = {
			src,
			isGitLfs: src === null,
			autoplay: configurations.get('autoPlay'),
			loop: configurations.get('loop'),
		};

		const nonce = generateUuid();

		const cspSource = this._webviewEditor.webview.cspSource;
		return /* html */`<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">

	<!-- Disable pinch zooming -->
	<meta name="viewport"
		content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no">

	<title>Video Preview</title>

	<link rel="stylesheet" href="${escapeAttribute(this.extensionResource('media', 'videoPreview.css'))}" type="text/css" media="screen" nonce="${nonce}">

	<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: ${cspSource}; media-src ${cspSource}; script-src 'nonce-${nonce}'; style-src ${cspSource} 'nonce-${nonce}';">
	<meta id="settings" data-settings="${escapeAttribute(JSON.stringify(settings))}">
</head>
<body class="loading" data-zyraxoncode-context='{ "preventDefaultContextMenuItems": true }'>
	<div class="loading-indicator"></div>
	<div class="loading-error">
		<p>${zyraxoncode.l10n.t("An error occurred while loading the video file.")}</p>
		<a href="#" class="open-file-link">${zyraxoncode.l10n.t("Open file using ZYRAXON Code's standard text/binary editor?")}</a>
	</div>
	<div class="git-lfs-info">
		<p>${zyraxoncode.l10n.t("The video file is stored with Git LFS and is not available for preview.")}</p>
		<a href="#" class="open-file-link">${zyraxoncode.l10n.t("Open file using ZYRAXON Code's standard text/binary editor?")}</a>
	</div>
	<script src="${escapeAttribute(this.extensionResource('media', 'videoPreview.js'))}" nonce="${nonce}"></script>
</body>
</html>`;
	}

	private async getResourcePath(webviewEditor: zyraxoncode.WebviewPanel, resource: zyraxoncode.Uri, version: string): Promise<string | null> {
		if (await isGitLfsPointer(resource)) {
			return null;
		}

		// Avoid adding cache busting if there is already a query string
		if (resource.query) {
			return webviewEditor.webview.asWebviewUri(resource).toString();
		}
		return webviewEditor.webview.asWebviewUri(resource).with({ query: `version=${version}` }).toString();
	}

	private extensionResource(...parts: string[]) {
		return this._webviewEditor.webview.asWebviewUri(zyraxoncode.Uri.joinPath(this.extensionRoot, ...parts));
	}
}

export function registerVideoPreviewSupport(context: zyraxoncode.ExtensionContext, binarySizeStatusBarEntry: BinarySizeStatusBarEntry): zyraxoncode.Disposable {
	const provider = new VideoPreviewProvider(context.extensionUri, binarySizeStatusBarEntry);
	return zyraxoncode.window.registerCustomEditorProvider(VideoPreviewProvider.viewType, provider, {
		supportsMultipleEditorsPerDocument: true,
		webviewOptions: {
			retainContextWhenHidden: true,
		}
	});
}
