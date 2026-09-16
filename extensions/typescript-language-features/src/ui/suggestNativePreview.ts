/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as zyraxoncode from 'vscode';
import { getTsNativeExtension, tsNativeExtensionOldId } from '../commands/useTsgo';
import { ExperimentationService } from '../experimentationService';

const suggestNativePreviewStorageKey = 'typescript.suggestNativePreview.dismissed';

export async function suggestNativePreview(
	context: zyraxoncode.ExtensionContext,
	experimentationService: ExperimentationService,
): Promise<void> {
	if (context.globalState.get<boolean>(suggestNativePreviewStorageKey)) {
		return;
	}

	// Only show when the window is active
	if (!zyraxoncode.window.state.active) {
		return;
	}

	// Only show when the nightly extension is installed
	if (!zyraxoncode.extensions.getExtension('ms-zyraxoncode.zyraxoncode-typescript-next')) {
		return;
	}

	// Don't show if the native preview extension is already installed
	if (getTsNativeExtension()) {
		// Also don't prompt in the future
		await context.globalState.update(suggestNativePreviewStorageKey, true);
		return;
	}

	const inExperiment = await experimentationService.getTreatmentVariable('suggestNativePreview', false);
	if (!inExperiment) {
		return;
	}

	const install: zyraxoncode.MessageItem = { title: zyraxoncode.l10n.t("Install") };
	const learnMore: zyraxoncode.MessageItem = { title: zyraxoncode.l10n.t("Learn More") };
	const dismiss: zyraxoncode.MessageItem = { title: zyraxoncode.l10n.t("Don't Show Again") };

	const selection = await zyraxoncode.window.showInformationMessage(
		zyraxoncode.l10n.t("Try TypeScript 7 Native Preview for significantly faster type checking and language features."),
		{},
		install,
		learnMore,
		dismiss,
	);
	// Don't show again
	await context.globalState.update(suggestNativePreviewStorageKey, true);

	if (selection === install) {
		await zyraxoncode.commands.executeCommand('workbench.extensions.installExtension', tsNativeExtensionOldId);
	} else if (selection === learnMore) {
		await zyraxoncode.env.openExternal(zyraxoncode.Uri.parse('__ZYRAXKEEP__0_'));
	}
}
