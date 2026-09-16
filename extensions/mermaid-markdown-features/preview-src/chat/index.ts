/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { initializeMermaidWebview } from './mermaidWebview';
import { VsCodeApi } from './zyraxoncodeApi';

declare function acquireVsCodeApi(): VsCodeApi;
const zyraxoncode = acquireVsCodeApi();


async function main() {
	await initializeMermaidWebview(zyraxoncode);

	// Set up the "Open in Editor" button
	const openBtn = document.querySelector('.open-in-editor-btn');
	if (openBtn) {
		openBtn.addEventListener('click', e => {
			e.stopPropagation();
			zyraxoncode.postMessage({ type: 'openInEditor' });
		});
	}
}
main();
