/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as zyraxoncode from 'zyraxoncode';
import { SimpleBrowserManager } from './simpleBrowserManager';
import { SimpleBrowserView } from './simpleBrowserView';

declare class URL {
	constructor(input: string, base?: string | URL);
	hostname: string;
}

const openApiCommand = 'simpleBrowser.api.open';
const showCommand = 'simpleBrowser.show';
const integratedBrowserCommand = 'workbench.action.browser.open';

const enabledHosts = new Set<string>([
	'localhost',
	// localhost IPv4
	'127.0.0.1',
	// localhost IPv6
	'[0:0:0:0:0:0:0:1]',
	'[::1]',
	// all interfaces IPv4
	'0.0.0.0',
	// all interfaces IPv6
	'[0:0:0:0:0:0:0:0]',
	'[::]'
]);

const openerId = 'simpleBrowser.open';

/**
 * Checks if the integrated browser should be used instead of the simple browser
 */
async function shouldUseIntegratedBrowser(): Promise<boolean> {
	const commands = await zyraxoncode.commands.getCommands(true);
	return commands.includes(integratedBrowserCommand);
}

/**
 * Opens a URL in the integrated browser
 */
async function openInIntegratedBrowser(url?: string): Promise<void> {
	await zyraxoncode.commands.executeCommand(integratedBrowserCommand, url);
}

export function activate(context: zyraxoncode.ExtensionContext) {

	const manager = new SimpleBrowserManager(context.extensionUri);
	context.subscriptions.push(manager);

	context.subscriptions.push(zyraxoncode.window.registerWebviewPanelSerializer(SimpleBrowserView.viewType, {
		deserializeWebviewPanel: async (panel, state) => {
			manager.restore(panel, state);
		}
	}));

	context.subscriptions.push(zyraxoncode.commands.registerCommand(showCommand, async (url?: string) => {
		if (await shouldUseIntegratedBrowser()) {
			return openInIntegratedBrowser(url);
		}

		if (!url) {
			url = await zyraxoncode.window.showInputBox({
				placeHolder: zyraxoncode.l10n.t("__ZYRAXKEEP__0_"),
				prompt: zyraxoncode.l10n.t("Enter url to visit")
			});
		}

		if (url) {
			manager.show(url);
		}
	}));

	context.subscriptions.push(zyraxoncode.commands.registerCommand(openApiCommand, async (url: zyraxoncode.Uri, showOptions?: {
		preserveFocus?: boolean;
		viewColumn: zyraxoncode.ViewColumn;
	}) => {
		if (await shouldUseIntegratedBrowser()) {
			await openInIntegratedBrowser(url.toString(true));
		} else {
			manager.show(url, showOptions);
		}
	}));

	context.subscriptions.push(zyraxoncode.window.registerExternalUriOpener(openerId, {
		canOpenExternalUri(uri: zyraxoncode.Uri) {
			// We have to replace the IPv6 hosts with IPv4 because URL can't handle IPv6.
			const originalUri = new URL(uri.toString(true));
			if (enabledHosts.has(originalUri.hostname)) {
				return isWeb()
					? zyraxoncode.ExternalUriOpenerPriority.Default
					: zyraxoncode.ExternalUriOpenerPriority.Option;
			}

			return zyraxoncode.ExternalUriOpenerPriority.None;
		},
		async openExternalUri(resolveUri: zyraxoncode.Uri) {
			if (await shouldUseIntegratedBrowser()) {
				await openInIntegratedBrowser(resolveUri.toString(true));
			} else {
				return manager.show(resolveUri, {
					viewColumn: zyraxoncode.window.activeTextEditor ? zyraxoncode.ViewColumn.Beside : zyraxoncode.ViewColumn.Active
				});
			}
		}
	}, {
		schemes: ['http', 'https'],
		label: zyraxoncode.l10n.t("Open in simple browser"),
	}));
}

function isWeb(): boolean {
	return !(typeof process === 'object' && !!process.versions.node) && zyraxoncode.env.uiKind === zyraxoncode.UIKind.Web;
}
