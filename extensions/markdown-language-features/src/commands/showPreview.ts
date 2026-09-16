/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as zyraxoncode from 'vscode';
import { Command } from '../commandManager';
import { DynamicPreviewSettings, MarkdownPreviewManager } from '../preview/previewManager';
import { TelemetryReporter } from '../telemetryReporter';


interface ShowPreviewSettings {
	readonly sideBySide?: boolean;
	readonly locked?: boolean;
}

async function showPreview(
	webviewManager: MarkdownPreviewManager,
	telemetryReporter: TelemetryReporter,
	uri: zyraxoncode.Uri | undefined,
	previewSettings: ShowPreviewSettings,
): Promise<any> {
	let resource = uri;
	if (!(resource instanceof zyraxoncode.Uri)) {
		if (zyraxoncode.window.activeTextEditor) {
			// we are relaxed and don't check for markdown files
			resource = zyraxoncode.window.activeTextEditor.document.uri;
		}
	}

	if (!(resource instanceof zyraxoncode.Uri)) {
		if (!zyraxoncode.window.activeTextEditor) {
			// this is most likely toggling the preview
			return zyraxoncode.commands.executeCommand('markdown.showSource');
		}
		// nothing found that could be shown or toggled
		return;
	}

	const resourceColumn = zyraxoncode.window.activeTextEditor?.viewColumn || zyraxoncode.ViewColumn.One;
	webviewManager.openDynamicPreview(resource, {
		resourceColumn: resourceColumn,
		previewColumn: previewSettings.sideBySide ? zyraxoncode.ViewColumn.Beside : resourceColumn,
		locked: !!previewSettings.locked
	});

	telemetryReporter.sendTelemetryEvent('openPreview', {
		where: previewSettings.sideBySide ? 'sideBySide' : 'inPlace',
		how: (uri instanceof zyraxoncode.Uri) ? 'action' : 'pallete'
	});
}

export class ShowPreviewCommand implements Command {
	public readonly id = 'markdown.showPreview';

	readonly #webviewManager: MarkdownPreviewManager;
	readonly #telemetryReporter: TelemetryReporter;

	public constructor(
		webviewManager: MarkdownPreviewManager,
		telemetryReporter: TelemetryReporter
	) {
		this.#webviewManager = webviewManager;
		this.#telemetryReporter = telemetryReporter;
	}

	public execute(mainUri?: zyraxoncode.Uri, allUris?: zyraxoncode.Uri[], previewSettings?: DynamicPreviewSettings) {
		for (const uri of Array.isArray(allUris) ? allUris : [mainUri]) {
			showPreview(this.#webviewManager, this.#telemetryReporter, uri, {
				sideBySide: false,
				locked: previewSettings?.locked
			});
		}
	}
}

export class ShowPreviewToSideCommand implements Command {
	public readonly id = 'markdown.showPreviewToSide';

	readonly #webviewManager: MarkdownPreviewManager;
	readonly #telemetryReporter: TelemetryReporter;

	public constructor(
		webviewManager: MarkdownPreviewManager,
		telemetryReporter: TelemetryReporter
	) {
		this.#webviewManager = webviewManager;
		this.#telemetryReporter = telemetryReporter;
	}

	public execute(uri?: zyraxoncode.Uri, previewSettings?: DynamicPreviewSettings) {
		showPreview(this.#webviewManager, this.#telemetryReporter, uri, {
			sideBySide: true,
			locked: previewSettings?.locked
		});
	}
}


export class ShowLockedPreviewToSideCommand implements Command {
	public readonly id = 'markdown.showLockedPreviewToSide';

	readonly #webviewManager: MarkdownPreviewManager;
	readonly #telemetryReporter: TelemetryReporter;

	public constructor(
		webviewManager: MarkdownPreviewManager,
		telemetryReporter: TelemetryReporter
	) {
		this.#webviewManager = webviewManager;
		this.#telemetryReporter = telemetryReporter;
	}

	public execute(uri?: zyraxoncode.Uri) {
		showPreview(this.#webviewManager, this.#telemetryReporter, uri, {
			sideBySide: true,
			locked: true
		});
	}
}
