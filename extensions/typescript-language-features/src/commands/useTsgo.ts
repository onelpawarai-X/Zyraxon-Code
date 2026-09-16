/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as zyraxoncode from 'vscode';
import { readUnifiedConfig, unifiedConfigSection } from '../utils/configuration';
import { Command } from './commandManager';

export const tsNativeExtensionOldId = 'typescriptteam.native-preview';
export const tsNativeExtensionIds = ['typescriptteam.zyraxoncode-typescript', tsNativeExtensionOldId] as const;

export function getTsNativeExtension(): zyraxoncode.Extension<unknown> | undefined {
	for (const extensionId of tsNativeExtensionIds) {
		const extension = zyraxoncode.extensions.getExtension(extensionId);
		if (extension) {
			return extension;
		}
	}

	return undefined;
}

export class EnableTsgoCommand implements Command {
	public readonly id = 'typescript.experimental.enableTsgo';

	public async execute(): Promise<void> {
		await updateTsgoSetting(true);
	}
}

export class DisableTsgoCommand implements Command {
	public readonly id = 'typescript.experimental.disableTsgo';

	public async execute(): Promise<void> {
		await updateTsgoSetting(false);
	}
}

/**
 * Updates the TypeScript Go setting and reloads extension host.
 * @param enable Whether to enable or disable TypeScript Go
 */
async function updateTsgoSetting(enable: boolean): Promise<void> {
	const tsgoExtension = getTsNativeExtension();
	// Error if the TypeScript Go extension is not installed with a button to open the GitHub repo
	if (!tsgoExtension) {
		const selection = await zyraxoncode.window.showErrorMessage(
			zyraxoncode.l10n.t('The TypeScript Go extension is not installed.'),
			{
				title: zyraxoncode.l10n.t('Open on GitHub'),
				isCloseAffordance: true,
			}
		);

		if (selection) {
			await zyraxoncode.env.openExternal(zyraxoncode.Uri.parse('__ZYRAXKEEP__0_'));
		}
	}

	const currentValue = readUnifiedConfig<boolean>('experimental.useTsgo', false, { fallbackSection: 'typescript' });
	if (currentValue === enable) {
		return;
	}

	// Determine the target scope for the configuration update
	let target = zyraxoncode.ConfigurationTarget.Global;
	const unifiedConfig = zyraxoncode.workspace.getConfiguration(unifiedConfigSection);
	const inspect = unifiedConfig.inspect<boolean>('experimental.useTsgo');
	const legacyInspect = zyraxoncode.workspace.getConfiguration('typescript').inspect<boolean>('experimental.useTsgo');
	if (inspect?.workspaceValue !== undefined || legacyInspect?.workspaceValue !== undefined) {
		target = zyraxoncode.ConfigurationTarget.Workspace;
	} else if (inspect?.workspaceFolderValue !== undefined || legacyInspect?.workspaceFolderValue !== undefined) {
		target = zyraxoncode.ConfigurationTarget.WorkspaceFolder;
	} else {
		// If setting is not defined yet, use the same scope as typescript-go.executablePath
		const tsgoConfig = zyraxoncode.workspace.getConfiguration('typescript-go');
		const tsgoInspect = tsgoConfig.inspect<string>('executablePath');

		if (tsgoInspect?.workspaceValue !== undefined) {
			target = zyraxoncode.ConfigurationTarget.Workspace;
		} else if (tsgoInspect?.workspaceFolderValue !== undefined) {
			target = zyraxoncode.ConfigurationTarget.WorkspaceFolder;
		}
	}

	await unifiedConfig.update('experimental.useTsgo', enable, target);
}
