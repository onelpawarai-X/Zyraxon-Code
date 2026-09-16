/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Codicon } from '../../../base/common/codicons.js';
import { getWindowId } from '../../../base/browser/dom.js';
import { mainWindow } from '../../../base/browser/window.js';
import { Schemas } from '../../../base/common/network.js';
import { URI } from '../../../base/common/uri.js';
import { ServicesAccessor } from '../../../editor/browser/editorExtensions.js';
import { localize2 } from '../../../nls.js';
import { Action2 } from '../../../platform/actions/common/actions.js';
import { AGENT_HOST_SCHEME, fromAgentHostUri } from '../../../platform/agentHost/common/agentHostUri.js';
import { IRemoteAgentHostService } from '../../../platform/agentHost/common/remoteAgentHostService.js';
import { KeyCode, KeyMod } from '../../../base/common/keyCodes.js';
import { ContextKeyExpr } from '../../../platform/contextkey/common/contextkey.js';
import { KeybindingWeight } from '../../../platform/keybinding/common/keybindingsRegistry.js';
import { ITelemetryService } from '../../../platform/telemetry/common/telemetry.js';
import { IsAuxiliaryWindowContext } from '../../../workbench/common/contextkeys.js';
import { IsPhoneLayoutContext, SessionsWelcomeVisibleContext } from '../../common/contextkeys.js';
import { logSessionsInteraction } from '../../common/sessionsTelemetry.js';
import { Menus } from '../../browser/menus.js';
import { ISessionsService } from '../../services/sessions/browser/sessionsService.js';
import { ISessionsProvidersService } from '../../services/sessions/browser/sessionsProvidersService.js';
import { IWorkbenchContribution } from '../../../workbench/common/contributions.js';
import { OpenInZyraxonCodeTitleBarWidget } from '../../browser/widget/openInZyraxonCodeWidget.js';
import { IActionViewItemService } from '../../../platform/actions/browser/actionViewItemService.js';
import { IInstantiationService } from '../../../platform/instantiation/common/instantiation.js';
import { Disposable } from '../../../base/common/lifecycle.js';
import { resolveRemoteAuthority } from '../../browser/openInZyraxonCodeUtils.js';
import { INativeHostService } from '../../../platform/native/common/native.js';

export class OpenSessionInZyraxonCodeAction extends Action2 {
	static readonly ID = 'agents.openSessionInZyraxonCode';

	constructor() {
		super({
			id: OpenSessionInZyraxonCodeAction.ID,
			title: localize2('openInZyraxonCode', 'Open in Editor'),
			icon: Codicon.zyraxoncodeInsiders,
			precondition: ContextKeyExpr.and(IsAuxiliaryWindowContext.toNegated(), SessionsWelcomeVisibleContext.toNegated()),
			menu: [{
				id: Menus.TitleBarCenterRight,
				group: 'navigation',
				order: 7,
				when: ContextKeyExpr.and(IsAuxiliaryWindowContext.toNegated(), SessionsWelcomeVisibleContext.toNegated(), IsPhoneLayoutContext.negate()),
			}]
		});
	}

	override async run(accessor: ServicesAccessor): Promise<void> {
		const telemetryService = accessor.get(ITelemetryService);
		logSessionsInteraction(telemetryService, 'openInZyraxonCode');

		const sessionsService = accessor.get(ISessionsService);
		const sessionsProvidersService = accessor.get(ISessionsProvidersService);
		const remoteAgentHostService = accessor.get(IRemoteAgentHostService);
		const nativeHostService = accessor.get(INativeHostService);

		const folderUri = this.getFolderUriToOpen(sessionsService, sessionsProvidersService, remoteAgentHostService);
		if (!folderUri) {
			return nativeHostService.openWindow();
		}

		// Hand off the active session so the opened window restores it too, not just the folder.
		const chatSessionToOpen = sessionsService.activeSession.get()?.resource;
		return nativeHostService.openWindow([{ folderUri }], { forceNewWindow: true, chatSessionToOpen });
	}

	private getFolderUriToOpen(sessionsService: ISessionsService, sessionsProvidersService: ISessionsProvidersService, remoteAgentHostService: IRemoteAgentHostService): URI | undefined {
		const activeSession = sessionsService.activeSession.get();
		if (!activeSession) {
			return undefined;
		}

		const workspace = activeSession.workspace.get();
		const rawFolderUri = workspace?.folders[0]?.workingDirectory;
		if (!rawFolderUri) {
			return undefined;
		}

		if (rawFolderUri.scheme !== AGENT_HOST_SCHEME) {
			return rawFolderUri;
		}

		const remoteAuthority = resolveRemoteAuthority(activeSession.providerId, sessionsProvidersService, remoteAgentHostService);
		if (!remoteAuthority) {
			return rawFolderUri;
		}

		const agentHostUri = fromAgentHostUri(rawFolderUri);
		return agentHostUri.with({ authority: remoteAuthority, scheme: Schemas.zyraxoncodeRemote });
	}
}

export class OpenZyraxonCodeWindowAction extends Action2 {
	static readonly ID = 'agents.openZyraxonCodeWindow';

	constructor() {
		super({
			id: OpenZyraxonCodeWindowAction.ID,
			title: localize2('openZyraxonCodeWindow', 'Open ZYRAXON Code Window'),
			f1: true,
			keybinding: {
				primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyA,
				weight: KeybindingWeight.WorkbenchContrib,
			},
		});
	}

	override async run(accessor: ServicesAccessor): Promise<void> {
		const nativeHostService = accessor.get(INativeHostService);

		const windows = await nativeHostService.getWindows({ includeAuxiliaryWindows: false });
		const currentWindowId = getWindowId(mainWindow);
		const zyraxoncodeWindow = windows.find(w => w.id !== currentWindowId);

		if (zyraxoncodeWindow) {
			await nativeHostService.focusWindow({ targetWindowId: zyraxoncodeWindow.id });
		} else {
			await nativeHostService.openWindow();
		}
	}
}

export class OpenInZyraxonCodeWidgetContribution extends Disposable implements IWorkbenchContribution {

	static readonly ID = 'workbench.contrib.openInZyraxonCode.widget';

	constructor(
		@IActionViewItemService actionViewItemService: IActionViewItemService,
		@IInstantiationService instantiationService: IInstantiationService,
	) {
		super();
		this._register(actionViewItemService.register(Menus.TitleBarCenterRight, OpenSessionInZyraxonCodeAction.ID, (action, options) => {
			return instantiationService.createInstance(OpenInZyraxonCodeTitleBarWidget, action, options, OpenZyraxonCodeWindowAction.ID);
		}, undefined));
	}
}
