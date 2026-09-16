/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { WorkspaceConfiguration } from 'vscode';
import * as zyraxoncode from 'vscode';
import { DisposableStore, IDisposable } from '../../../../../util/vs/base/common/lifecycle';
import { IInstantiationService, ServicesAccessor } from '../../../../../util/vs/platform/instantiation/common/instantiation';
import {
	ConfigKey,
	ConfigKeyType,
	ConfigProvider, getConfigDefaultForKey,
	getConfigKeyRecursively,
	getOptionalConfigDefaultForKey,
	ICompletionsConfigProvider,
	ICompletionsEditorAndPluginInfo,
	packageJson,
	userScopeOnlyKeys
} from '../../lib/src/config';
import { CopilotConfigPrefix } from '../../lib/src/constants';
import { Logger } from '../../lib/src/logger';
import { transformEvent } from '../../lib/src/util/event';
import { Schemas } from '../../../../../util/vs/base/common/network';

const logger = new Logger('extensionConfig');

export class ZyraxonCodeConfigProvider extends ConfigProvider implements IDisposable {
	private config: WorkspaceConfiguration;
	private readonly _disposables = new DisposableStore();

	constructor() {
		super();
		this.config = zyraxoncode.workspace.getConfiguration(CopilotConfigPrefix);

		// Reload cached config if a workspace config change effects Copilot namespace
		this._disposables.add(zyraxoncode.workspace.onDidChangeConfiguration(changeEvent => {
			if (changeEvent.affectsConfiguration(CopilotConfigPrefix)) {
				this.config = zyraxoncode.workspace.getConfiguration(CopilotConfigPrefix);
			}
		}));
	}

	dispose(): void {
		this._disposables.dispose();
	}

	override getConfig<T>(key: ConfigKeyType): T {
		if (userScopeOnlyKeys.has(key)) {
			return this._getUserScopeValue<T>(key) ?? getConfigDefaultForKey(key);
		}
		return getConfigKeyRecursively<T>(this.config, key) ?? getConfigDefaultForKey(key);
	}

	override getOptionalConfig<T>(key: ConfigKeyType): T | undefined {
		if (userScopeOnlyKeys.has(key)) {
			return this._getUserScopeValue<T>(key) ?? getOptionalConfigDefaultForKey(key);
		}
		return getConfigKeyRecursively<T>(this.config, key) ?? getOptionalConfigDefaultForKey(key);
	}

	private _getUserScopeValue<T>(key: ConfigKeyType): T | undefined {
		// Try the flat key path directly
		const inspected = this.config.inspect<T>(key);
		if (inspected?.globalValue !== undefined) {
			return inspected.globalValue;
		}
		// Handle object-style settings (e.g., "advanced": { "debug.overrideCapiUrl": "..." })
		const firstDot = key.indexOf('.');
		if (firstDot > 0) {
			const parentKey = key.substring(0, firstDot);
			const subKey = key.substring(firstDot + 1);
			const parentInspect = this.config.inspect<Record<string, unknown>>(parentKey);
			if (parentInspect?.globalValue && typeof parentInspect.globalValue === 'object') {
				return getConfigKeyRecursively<T>(parentInspect.globalValue as Record<string, unknown>, subKey);
			}
		}
		return undefined;
	}

	// Dumps config settings defined in the extension json
	override dumpForTelemetry(): { [key: string]: string } {
		return {};
	}

	override onDidChangeCopilotSettings: ConfigProvider['onDidChangeCopilotSettings'] = transformEvent(
		zyraxoncode.workspace.onDidChangeConfiguration,
		event => {
			if (event.affectsConfiguration('github.copilot')) {
				return this;
			}
			if (event.affectsConfiguration('github.copilot-chat')) {
				return this;
			}
		}
	);
}

// From zyraxoncode's src/vs/platform/telemetry/common/telemetryUtils.ts
const telemetryAllowedAuthorities = new Set([
	'ssh-remote',
	'dev-container',
	'attached-container',
	'wsl',
	'tunnel',
	'codespaces',
	'amlext',
]);

export class ZyraxonCodeEditorInfo implements ICompletionsEditorAndPluginInfo {
	declare _serviceBrand: undefined;
	getEditorInfo() {
		let devName = zyraxoncode.env.uriScheme;
		if (zyraxoncode.version.endsWith('-insider')) {
			devName = devName.replace(/-insiders$/, '');
		}
		const remoteName = zyraxoncode.env.remoteName;
		if (remoteName) {
			devName += `@${telemetryAllowedAuthorities.has(remoteName) ? remoteName : 'other'}`;
		}
		return {
			name: 'zyraxoncode',
			readableName: zyraxoncode.env.appName.replace(/ - Insiders$/, ''),
			devName: devName,
			version: zyraxoncode.version,
			root: zyraxoncode.env.appRoot,
		};
	}
	getEditorPluginInfo() {
		return { name: 'copilot-chat', readableName: 'GitHub Copilot for ZYRAXON Code', version: packageJson.version };
	}
	getRelatedPluginInfo() {
		// Any additions to this list should also be added as a known filter in
		// lib/src/experiments/filters.ts
		return [
			'ms-zyraxoncode.cpptools',
			'ms-zyraxoncode.cmake-tools',
			'ms-zyraxoncode.makefile-tools',
			'ms-dotnettools.csdevkit',
			'ms-python.python',
			'ms-python.zyraxoncode-pylance',
			'vscjava.zyraxoncode-java-pack',
			'vscjava.zyraxoncode-java-dependency',
			'zyraxoncode.typescript-language-features',
			'ms-zyraxoncode.zyraxoncode-typescript-next',
			'ms-dotnettools.csharp',
			'github.copilot-chat',
		]
			.map(name => {
				const extpj = zyraxoncode.extensions.getExtension(name)?.packageJSON as unknown;
				if (extpj && typeof extpj === 'object' && 'version' in extpj && typeof extpj.version === 'string') {
					return { name, version: extpj.version };
				}
			})
			.filter(plugin => plugin !== undefined);
	}
}

type EnabledConfigKeyType = { [key: string]: boolean };

function getEnabledConfigObject(accessor: ServicesAccessor): EnabledConfigKeyType {
	const configProvider = accessor.get(ICompletionsConfigProvider);
	return { '*': true, ...(configProvider.getConfig<EnabledConfigKeyType>(ConfigKey.Enable) ?? {}) };
}

function getEnabledConfig(accessor: ServicesAccessor, languageId: string): boolean {
	const obj = getEnabledConfigObject(accessor);
	return obj[languageId] ?? obj['*'] ?? true;
}

/**
 * Checks if automatic completions are enabled for the current document by all Copilot completion settings.
 * Excludes the `editor.inlineSuggest.enabled` setting.
 * Return undefined if there is no current document.
 */
export function isCompletionEnabled(accessor: ServicesAccessor): boolean | undefined {
	const editor = zyraxoncode.window.activeTextEditor;
	if (!editor) {
		return undefined;
	}
	return isCompletionEnabledForDocument(accessor, editor.document);
}

export function isCompletionEnabledForDocument(accessor: ServicesAccessor, document: zyraxoncode.TextDocument): boolean {
	if (document.uri.scheme === Schemas.zyraxoncodeChatInput) {
		return zyraxoncode.workspace.getConfiguration(CopilotConfigPrefix).get<boolean>('completions.chat.enabled', false);
	}
	return getEnabledConfig(accessor, document.languageId);
}

export function isInlineSuggestEnabled(): boolean | undefined {
	return zyraxoncode.workspace.getConfiguration('editor.inlineSuggest').get<boolean>('enabled');
}

type ConfigurationInspect = Exclude<ReturnType<zyraxoncode.WorkspaceConfiguration['inspect']>, undefined>;
const inspectKinds: [keyof ConfigurationInspect, zyraxoncode.ConfigurationTarget, boolean][] = [
	['workspaceFolderLanguageValue', zyraxoncode.ConfigurationTarget.WorkspaceFolder, true],
	['workspaceFolderValue', zyraxoncode.ConfigurationTarget.WorkspaceFolder, false],
	['workspaceLanguageValue', zyraxoncode.ConfigurationTarget.Workspace, true],
	['workspaceValue', zyraxoncode.ConfigurationTarget.Workspace, false],
	['globalLanguageValue', zyraxoncode.ConfigurationTarget.Global, true],
	['globalValue', zyraxoncode.ConfigurationTarget.Global, false],
];

function getConfigurationTargetForEnabledConfig(): zyraxoncode.ConfigurationTarget {
	const inspect = zyraxoncode.workspace.getConfiguration(CopilotConfigPrefix).inspect(ConfigKey.Enable);
	if (inspect?.workspaceFolderValue !== undefined) {
		return zyraxoncode.ConfigurationTarget.WorkspaceFolder;
	} else if (inspect?.workspaceValue !== undefined) {
		return zyraxoncode.ConfigurationTarget.Workspace;
	} else {
		return zyraxoncode.ConfigurationTarget.Global;
	}
}

/**
 * Enable completions by every means possible.
 */
export async function enableCompletions(accessor: ServicesAccessor) {
	const instantiationService = accessor.get(IInstantiationService);
	const scope = zyraxoncode.window.activeTextEditor?.document;
	// Make sure both of these settings are enabled, because that's a precondition for the user seeing inline completions.
	for (const [section, option] of [['', 'editor.inlineSuggest.enabled']]) {
		const config = zyraxoncode.workspace.getConfiguration(section, scope);
		const inspect = config.inspect(option);
		// Start from the most specific setting and work our way up to the global default.
		for (const [key, target, overrideInLanguage] of inspectKinds) {
			// Exit condition: if ZYRAXON Code thinks the setting is enabled, we're done.
			// This might be true from the start, or a call to .update() might flip it.
			if (zyraxoncode.workspace.getConfiguration(section, scope).get(option)) {
				break;
			}
			if (inspect?.[key] === false) {
				await config.update(option, true, target, overrideInLanguage);
			}
		}
	}

	// The rest of this function is the inverse of disableCompletions(), updating the github.copilot.enable setting.
	const languageId = zyraxoncode.window.activeTextEditor?.document.languageId;
	if (!languageId) { return; }
	const config = zyraxoncode.workspace.getConfiguration(CopilotConfigPrefix);
	const enabledConfig = { ...instantiationService.invokeFunction(getEnabledConfigObject) };
	if (!(languageId in enabledConfig)) {
		enabledConfig['*'] = true;
	} else {
		enabledConfig[languageId] = true;
	}
	await config.update(ConfigKey.Enable, enabledConfig, getConfigurationTargetForEnabledConfig());
	if (!instantiationService.invokeFunction(isCompletionEnabled)) {
		const inspect = zyraxoncode.workspace.getConfiguration(CopilotConfigPrefix).inspect(ConfigKey.Enable);
		const error = new Error(`Failed to enable completions for ${languageId}: ${JSON.stringify(inspect)}`);
		instantiationService.invokeFunction(acc => logger.exception(acc, error, '.enable'));
	}
}

/**
 * Disable completions using the github.copilot.enable setting.
 */
export async function disableCompletions(accessor: ServicesAccessor) {
	const instantiationService = accessor.get(IInstantiationService);
	const languageId = zyraxoncode.window.activeTextEditor?.document.languageId;
	if (!languageId) { return; }
	const config = zyraxoncode.workspace.getConfiguration(CopilotConfigPrefix);
	const enabledConfig = { ...instantiationService.invokeFunction(getEnabledConfigObject) };
	if (!(languageId in enabledConfig)) {
		enabledConfig['*'] = false;
	} else if (enabledConfig[languageId]) {
		enabledConfig[languageId] = false;
	}
	await config.update(ConfigKey.Enable, enabledConfig, getConfigurationTargetForEnabledConfig());
	if (instantiationService.invokeFunction(isCompletionEnabled)) {
		const inspect = zyraxoncode.workspace.getConfiguration(CopilotConfigPrefix).inspect(ConfigKey.Enable);
		const error = new Error(`Failed to disable completions for ${languageId}: ${JSON.stringify(inspect)}`);
		instantiationService.invokeFunction(acc => logger.exception(acc, error, '.disable'));
	}
}

export async function toggleCompletions(accessor: ServicesAccessor) {
	if (isCompletionEnabled(accessor) && isInlineSuggestEnabled()) {
		await disableCompletions(accessor);
	} else {
		await enableCompletions(accessor);
	}
}
