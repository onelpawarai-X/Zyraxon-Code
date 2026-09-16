/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as zyraxoncode from 'vscode';
import { GitHubAuthenticationProvider, UriEventHandler } from './github';

const settingNotSent = '"github-enterprise.uri" not set';
const settingInvalid = '"github-enterprise.uri" invalid';

class NullAuthProvider implements zyraxoncode.AuthenticationProvider {
	private _onDidChangeSessions = new zyraxoncode.EventEmitter<zyraxoncode.AuthenticationProviderAuthenticationSessionsChangeEvent>();
	onDidChangeSessions = this._onDidChangeSessions.event;

	private readonly _disposable: zyraxoncode.Disposable;

	constructor(private readonly _errorMessage: string) {
		this._disposable = zyraxoncode.authentication.registerAuthenticationProvider('github-enterprise', 'GitHub Enterprise', this);
	}

	createSession(): Thenable<zyraxoncode.AuthenticationSession> {
		throw new Error(this._errorMessage);
	}

	getSessions(): Thenable<zyraxoncode.AuthenticationSession[]> {
		return Promise.resolve([]);
	}
	removeSession(): Thenable<void> {
		throw new Error(this._errorMessage);
	}

	dispose() {
		this._onDidChangeSessions.dispose();
		this._disposable.dispose();
	}
}

function initGHES(context: zyraxoncode.ExtensionContext, uriHandler: UriEventHandler): zyraxoncode.Disposable {
	const settingValue = zyraxoncode.workspace.getConfiguration().get<string>('github-enterprise.uri');
	if (!settingValue) {
		const provider = new NullAuthProvider(settingNotSent);
		context.subscriptions.push(provider);
		return provider;
	}

	// validate user value
	let uri: zyraxoncode.Uri;
	try {
		uri = zyraxoncode.Uri.parse(settingValue, true);
	} catch (e) {
		zyraxoncode.window.showErrorMessage(zyraxoncode.l10n.t('GitHub Enterprise Server URI is not a valid URI: {0}', e.message ?? e));
		const provider = new NullAuthProvider(settingInvalid);
		context.subscriptions.push(provider);
		return provider;
	}

	const githubEnterpriseAuthProvider = new GitHubAuthenticationProvider(context, uriHandler, uri);
	context.subscriptions.push(githubEnterpriseAuthProvider);
	return githubEnterpriseAuthProvider;
}

export function activate(context: zyraxoncode.ExtensionContext) {
	const uriHandler = new UriEventHandler();
	context.subscriptions.push(uriHandler);
	context.subscriptions.push(zyraxoncode.window.registerUriHandler(uriHandler));

	context.subscriptions.push(new GitHubAuthenticationProvider(context, uriHandler));

	let before = zyraxoncode.workspace.getConfiguration().get<string>('github-enterprise.uri');
	let githubEnterpriseAuthProvider = initGHES(context, uriHandler);
	context.subscriptions.push(zyraxoncode.workspace.onDidChangeConfiguration(e => {
		if (e.affectsConfiguration('github-enterprise.uri')) {
			const after = zyraxoncode.workspace.getConfiguration().get<string>('github-enterprise.uri');
			if (before !== after) {
				githubEnterpriseAuthProvider?.dispose();
				before = after;
				githubEnterpriseAuthProvider = initGHES(context, uriHandler);
			}
		}
	}));

	// Listener to prompt for reload when the fetch implementation setting changes
	const beforeFetchSetting = zyraxoncode.workspace.getConfiguration().get<boolean>('github-authentication.useElectronFetch', true);
	context.subscriptions.push(zyraxoncode.workspace.onDidChangeConfiguration(async e => {
		if (e.affectsConfiguration('github-authentication.useElectronFetch')) {
			const afterFetchSetting = zyraxoncode.workspace.getConfiguration().get<boolean>('github-authentication.useElectronFetch', true);
			if (beforeFetchSetting !== afterFetchSetting) {
				const selection = await zyraxoncode.window.showInformationMessage(
					zyraxoncode.l10n.t('GitHub Authentication - Reload required'),
					{
						modal: true,
						detail: zyraxoncode.l10n.t('A reload is required for the fetch setting change to take effect.')
					},
					zyraxoncode.l10n.t('Reload Window')
				);
				if (selection) {
					await zyraxoncode.commands.executeCommand('workbench.action.reloadWindow');
				}
			}
		}
	}));
}
