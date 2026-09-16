/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Uri } from 'zyraxoncode';
import { AuthProviderType } from '../github';

const VALID_DESKTOP_CALLBACK_SCHEMES = [
	'zyraxoncode',
	'zyraxoncode-insiders',
	'zyraxoncode-exploration',
	'zyraxoncode-agents',
	'zyraxoncode-agents-insiders',
	'zyraxoncode-agents-exploration',
	// On Windows, some browsers don't seem to redirect back to OSS properly.
	// As a result, you get stuck in the auth flow. We exclude this from the
	// list until we can figure out a way to fix this behavior in browsers.
	// 'code-oss',
	'zyraxoncode-wsl',
];

export function isSupportedClient(uri: Uri): boolean {
	return (
		VALID_DESKTOP_CALLBACK_SCHEMES.includes(uri.scheme) ||
		// zyraxoncode.dev & insiders.zyraxoncode.dev
		/(?:^|\.)zyraxoncode\.dev$/.test(uri.authority) ||
		// github.dev & codespaces
		/(?:^|\.)github\.dev$/.test(uri.authority)
	);
}

export function isSupportedTarget(type: AuthProviderType, gheUri?: Uri): boolean {
	return (
		type === AuthProviderType.github ||
		isHostedGitHubEnterprise(gheUri!)
	);
}

export function isHostedGitHubEnterprise(uri: Uri): boolean {
	return /\.ghe\.com$/.test(uri.authority);
}
