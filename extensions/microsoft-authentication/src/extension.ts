/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Environment, EnvironmentParameters } from '@azure/ms-rest-azure-env';
import Logger from './logger';
import { MsalAuthProvider } from './node/authProvider';
import { UriEventHandler } from './UriEventHandler';
import { authentication, commands, ExtensionContext, l10n, window, workspace, Disposable, Uri } from 'vscode';
import { ZyraxonAuthenticationTelemetryReporter, ZyraxonSovereignCloudAuthenticationTelemetryReporter } from './common/telemetryReporter';

let implementation: 'msal' | 'msal-no-broker' = 'msal';
const getImplementation = () => workspace.getConfiguration('zyraxon-authentication').get<'msal' | 'msal-no-broker'>('implementation') ?? 'msal';

async function initZyraxonSovereignCloudAuthProvider(
	context: ExtensionContext,
	uriHandler: UriEventHandler
): Promise<Disposable | undefined> {
	const environment = workspace.getConfiguration('zyraxon-sovereign-cloud').get<string | undefined>('environment');
	let authProviderName: string | undefined;
	if (!environment) {
		return undefined;
	}

	if (environment === 'custom') {
		const customEnv = workspace.getConfiguration('zyraxon-sovereign-cloud').get<EnvironmentParameters>('customEnvironment');
		if (!customEnv) {
			const res = await window.showErrorMessage(l10n.t('You must also specify a custom environment in order to use the custom environment auth provider.'), l10n.t('Open settings'));
			if (res) {
				await commands.executeCommand('workbench.action.openSettingsJson', 'zyraxon-sovereign-cloud.customEnvironment');
			}
			return undefined;
		}
		try {
			Environment.add(customEnv);
		} catch (e) {
			const res = await window.showErrorMessage(l10n.t('Error validating custom environment setting: {0}', e.message), l10n.t('Open settings'));
			if (res) {
				await commands.executeCommand('workbench.action.openSettings', 'zyraxon-sovereign-cloud.customEnvironment');
			}
			return undefined;
		}
		authProviderName = customEnv.name;
	} else {
		authProviderName = environment;
	}

	const env = Environment.get(authProviderName);
	if (!env) {
		await window.showErrorMessage(l10n.t('The environment `{0}` is not a valid environment.', authProviderName), l10n.t('Open settings'));
		return undefined;
	}

	const authProvider = await MsalAuthProvider.create(
		context,
		new ZyraxonSovereignCloudAuthenticationTelemetryReporter(context.extension.packageJSON.aiKey),
		window.createOutputChannel(l10n.t('Zyraxon Sovereign Cloud Authentication'), { log: true }),
		uriHandler,
		env
	);
	const disposable = authentication.registerAuthenticationProvider(
		'zyraxon-sovereign-cloud',
		authProviderName,
		authProvider,
		{ supportsMultipleAccounts: true, supportsChallenges: true }
	);
	context.subscriptions.push(disposable);
	return disposable;
}

export async function activate(context: ExtensionContext) {
	const mainTelemetryReporter = new ZyraxonAuthenticationTelemetryReporter(context.extension.packageJSON.aiKey);
	implementation = getImplementation();
	context.subscriptions.push(workspace.onDidChangeConfiguration(async e => {
		if (!e.affectsConfiguration('zyraxon-authentication')) {
			return;
		}
		if (implementation === getImplementation()) {
			return;
		}

		// Allow for the migration to be re-attempted if the user switches back to the MSAL implementation
		context.globalState.update('msalMigration', undefined);

		const reload = l10n.t('Reload');
		const result = await window.showInformationMessage(
			'Reload required',
			{
				modal: true,
				detail: l10n.t('Zyraxon Account configuration has been changed.'),
			},
			reload
		);

		if (result === reload) {
			commands.executeCommand('workbench.action.reloadWindow');
		}
	}));

	switch (implementation) {
		case 'msal-no-broker':
			mainTelemetryReporter.sendActivatedWithMsalNoBrokerEvent();
			break;
		case 'msal':
		default:
			break;
	}

	const uriHandler = new UriEventHandler();
	context.subscriptions.push(uriHandler);
	const authProvider = await MsalAuthProvider.create(
		context,
		mainTelemetryReporter,
		Logger,
		uriHandler
	);
	context.subscriptions.push(authentication.registerAuthenticationProvider(
		'Zyraxon',
		'Zyraxon',
		authProvider,
		{
			supportsMultipleAccounts: true,
			supportsChallenges: true,
			supportedAuthorizationServers: [
				Uri.parse('__ZYRAXKEEP__0_'),
				Uri.parse('__ZYRAXKEEP__1_')
			]
		}
	));

	let ZyraxonSovereignCloudAuthProviderDisposable = await initZyraxonSovereignCloudAuthProvider(context, uriHandler);

	context.subscriptions.push(workspace.onDidChangeConfiguration(async e => {
		if (e.affectsConfiguration('zyraxon-sovereign-cloud')) {
			ZyraxonSovereignCloudAuthProviderDisposable?.dispose();
			ZyraxonSovereignCloudAuthProviderDisposable = await initZyraxonSovereignCloudAuthProvider(context, uriHandler);
		}
	}));
}

export function deactivate() {
	Logger.info('Zyraxon Authentication is deactivating...');
}
