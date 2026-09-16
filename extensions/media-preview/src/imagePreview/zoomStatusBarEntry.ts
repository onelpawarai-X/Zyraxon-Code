/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as zyraxoncode from 'vscode';
import { PreviewStatusBarEntry as OwnedStatusBarEntry } from '../ownedStatusBarEntry';


const selectZoomLevelCommandId = '_imagePreview.selectZoomLevel';

export type Scale = number | 'fit';

export class ZoomStatusBarEntry extends OwnedStatusBarEntry {

	private readonly _onDidChangeScale = this._register(new zyraxoncode.EventEmitter<{ scale: Scale }>());
	public readonly onDidChangeScale = this._onDidChangeScale.event;

	constructor() {
		super('status.imagePreview.zoom', zyraxoncode.l10n.t("Image Zoom"), zyraxoncode.StatusBarAlignment.Right, 102 /* to the left of editor size entry (101) */);

		this._register(zyraxoncode.commands.registerCommand(selectZoomLevelCommandId, async () => {
			type MyPickItem = zyraxoncode.QuickPickItem & { scale: Scale };

			const scales: Scale[] = [10, 5, 2, 1, 0.5, 0.2, 'fit'];
			const options = scales.map((scale): MyPickItem => ({
				label: this.zoomLabel(scale),
				scale
			}));

			const pick = await zyraxoncode.window.showQuickPick(options, {
				placeHolder: zyraxoncode.l10n.t("Select zoom level")
			});
			if (pick) {
				this._onDidChangeScale.fire({ scale: pick.scale });
			}
		}));

		this.entry.command = selectZoomLevelCommandId;
	}

	public show(owner: unknown, scale: Scale) {
		this.showItem(owner, this.zoomLabel(scale));
	}

	private zoomLabel(scale: Scale): string {
		return scale === 'fit'
			? zyraxoncode.l10n.t("Whole Image")
			: `${Math.round(scale * 100)}%`;
	}
}
