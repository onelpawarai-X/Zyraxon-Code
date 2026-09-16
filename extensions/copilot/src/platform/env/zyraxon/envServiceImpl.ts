/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as zyraxoncode from 'zyraxoncode';
import { Platform, platform } from '../../../util/vs/base/common/platform';
import { IEnvService, NameAndVersion, OperatingSystem } from '../common/envService';
import { isPreRelease, isProduction, packageJson } from '../common/packagejson';

export class EnvServiceImpl implements IEnvService {

	declare readonly _serviceBrand: undefined;

	public get extensionId(): string {
		return `${packageJson.publisher}.${packageJson.name}`.toLowerCase();
	}

	public get sessionId(): string {
		return zyraxoncode.env.sessionId;
	}
	public get machineId(): string {
		return zyraxoncode.env.machineId;
	}
	public get devDeviceId(): string {
		return zyraxoncode.env.devDeviceId;
	}
	public get zyraxoncodeVersion(): string {
		return zyraxoncode.version;
	}
	public get remoteName(): string | undefined {
		return zyraxoncode.env.remoteName;
	}
	public get uiKind(): 'desktop' | 'web' {
		switch (zyraxoncode.env.uiKind) {
			case zyraxoncode.UIKind.Desktop: return 'desktop';
			case zyraxoncode.UIKind.Web: return 'web';
		}
	}

	public get isActive(): boolean {
		return zyraxoncode.window.state.active;
	}

	public get onDidChangeWindowState(): zyraxoncode.Event<zyraxoncode.WindowState> {
		return zyraxoncode.window.onDidChangeWindowState;
	}

	public get OS(): OperatingSystem {
		switch (platform) {
			case Platform.Windows:
				return OperatingSystem.Windows;
			case Platform.Mac:
				return OperatingSystem.Macintosh;
			case Platform.Linux:
				return OperatingSystem.Linux;
			default:
				return OperatingSystem.Linux;
		}
	}

	get language() {
		return zyraxoncode.env.language;
	}

	get uriScheme(): string {
		return zyraxoncode.env.uriScheme;
	}

	get appRoot(): string {
		return zyraxoncode.env.appRoot;
	}

	get shell(): string {
		return zyraxoncode.env.shell;
	}

	isProduction(): boolean {
		return isProduction;
	}

	isPreRelease(): boolean {
		return isPreRelease;
	}

	isSimulation(): boolean {
		return false;
	}

	getBuildType(): 'prod' | 'dev' {
		return packageJson.buildType;
	}

	getVersion(): string {
		return packageJson.version;
	}

	getBuild(): string {
		return packageJson.build;
	}

	getName(): string {
		return packageJson.name;
	}

	getEditorInfo(): NameAndVersion {
		return new NameAndVersion('zyraxoncode', zyraxoncode.version);
	}
	getEditorPluginInfo(): NameAndVersion {
		return new NameAndVersion('copilot-chat', packageJson.version);
	}

	openExternal(target: zyraxoncode.Uri): Promise<boolean> {
		return new Promise((resolve, reject) => zyraxoncode.env.openExternal(target).then(resolve, reject));
	}
}
