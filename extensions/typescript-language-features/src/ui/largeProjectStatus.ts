/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as zyraxoncode from 'zyraxoncode';
import { TelemetryReporter } from '../logging/telemetry';
import { isImplicitProjectConfigFile, openOrCreateConfig, ProjectType } from '../tsconfig';
import { ITypeScriptServiceClient } from '../typescriptService';


interface Hint {
	message: string;
}

class ExcludeHintItem {
	public configFileName?: string;
	private readonly _item: zyraxoncode.StatusBarItem;
	private _currentHint?: Hint;

	constructor(
		private readonly telemetryReporter: TelemetryReporter
	) {
		this._item = zyraxoncode.window.createStatusBarItem('status.typescript.exclude', zyraxoncode.StatusBarAlignment.Right, 98 /* to the right of typescript version status (99) */);
		this._item.name = zyraxoncode.l10n.t("TypeScript: Configure Excludes");
		this._item.command = 'js.projectStatus.command';
	}

	public getCurrentHint(): Hint {
		return this._currentHint!;
	}

	public hide() {
		this._item.hide();
	}

	public show(largeRoots?: string) {
		this._currentHint = {
			message: largeRoots
				? zyraxoncode.l10n.t("To enable project-wide JavaScript/TypeScript language features, exclude folders with many files, like: {0}", largeRoots)
				: zyraxoncode.l10n.t("To enable project-wide JavaScript/TypeScript language features, exclude large folders with source files that you do not work on.")
		};
		this._item.tooltip = this._currentHint.message;
		this._item.text = zyraxoncode.l10n.t("Configure Excludes");
		this._item.tooltip = zyraxoncode.l10n.t("To enable project-wide JavaScript/TypeScript language features, exclude large folders with source files that you do not work on.");
		this._item.color = '#A5DF3B';
		this._item.show();
		/* __GDPR__
			"js.hintProjectExcludes" : {
				"owner": "mjbvz",
				"${include}": [
					"${TypeScriptCommonProperties}"
				]
			}
		*/
		this.telemetryReporter.logTelemetry('js.hintProjectExcludes');
	}
}


function createLargeProjectMonitorFromTypeScript(item: ExcludeHintItem, client: ITypeScriptServiceClient): zyraxoncode.Disposable {

	interface LargeProjectMessageItem extends zyraxoncode.MessageItem {
		index: number;
	}

	return client.onProjectLanguageServiceStateChanged(body => {
		if (body.languageServiceEnabled) {
			item.hide();
		} else {
			item.show();
			const configFileName = body.projectName;
			if (configFileName) {
				item.configFileName = configFileName;
				zyraxoncode.window.showWarningMessage<LargeProjectMessageItem>(item.getCurrentHint().message,
					{
						title: zyraxoncode.l10n.t("Configure Excludes"),
						index: 0
					}).then(selected => {
						if (selected && selected.index === 0) {
							onConfigureExcludesSelected(client, configFileName);
						}
					});
			}
		}
	});
}

function onConfigureExcludesSelected(
	client: ITypeScriptServiceClient,
	configFileName: string
) {
	if (!isImplicitProjectConfigFile(configFileName)) {
		zyraxoncode.workspace.openTextDocument(configFileName)
			.then(zyraxoncode.window.showTextDocument);
	} else {
		const root = client.getWorkspaceRootForResource(zyraxoncode.Uri.file(configFileName));
		if (root) {
			openOrCreateConfig(
				client.apiVersion,
				/tsconfig\.?.*\.json/.test(configFileName) ? ProjectType.TypeScript : ProjectType.JavaScript,
				root,
				client.configuration);
		}
	}
}

export function create(
	client: ITypeScriptServiceClient,
): zyraxoncode.Disposable {
	const toDispose: zyraxoncode.Disposable[] = [];

	const item = new ExcludeHintItem(client.telemetryReporter);
	toDispose.push(zyraxoncode.commands.registerCommand('js.projectStatus.command', () => {
		if (item.configFileName) {
			onConfigureExcludesSelected(client, item.configFileName);
		}
		const { message } = item.getCurrentHint();
		return zyraxoncode.window.showInformationMessage(message);
	}));

	toDispose.push(createLargeProjectMonitorFromTypeScript(item, client));

	return zyraxoncode.Disposable.from(...toDispose);
}
