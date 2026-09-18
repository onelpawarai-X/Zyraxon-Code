/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { $ } from '../../../../../../base/browser/dom.js';
import { CancellationToken } from '../../../../../../base/common/cancellation.js';
import { Disposable, DisposableStore } from '../../../../../../base/common/lifecycle.js';
import { URI } from '../../../../../../base/common/uri.js';
import { IInstantiationService } from '../../../../../../platform/instantiation/common/instantiation.js';
import { IStorageService } from '../../../../../../platform/storage/common/storage.js';
import { ILogService } from '../../../../../../platform/log/common/log.js';
import { ITelemetryService } from '../../../../../../platform/telemetry/common/telemetry.js';
import { IThemeService } from '../../../../../../platform/theme/common/themeService.js';
import { IViewPaneOptions, ViewPane } from '../../../browser/parts/views/viewPane.js';
import { IViewDescriptorService } from '../../../../../../platform/views/common/views.js';
import { IOpenerService } from '../../../../../../platform/opener/common/opener.js';
import { IListService, IListVirtualDelegate } from '../../../../../../platform/list/browser/listService.js';
import { IKeybindingService } from '../../../../../../platform/keybinding/common/keybinding.js';
import { ContextKeyExpression, IContextKeyService } from '../../../../../../platform/contextkey/common/contextkey.js';
import { getCurrentTier, getTierInfo, hasAccess, TIER_ORDER } from '../../common/tools/zyraxonTools/source/subscriptionStatus.js';

const TIER_ORDER_LIST = ['free', 'pro', 'max', 'ultra'] as const;

interface TierItem {
	id: string;
	name: string;
	price: string;
	tools: string;
	agents: string;
	features: string;
	current: boolean;
	accessible: boolean;
}

export class SubscriptionViewPane extends ViewPane {
	private readonly _container: HTMLElement;
	private readonly _disposables = this._register(new DisposableStore());

	constructor(
		options: IViewPaneOptions,
		@IInstantiationService instantiationService: IInstantiationService,
		@IStorageService private readonly _storageService: IStorageService,
		@IThemeService themeService: IThemeService,
		@IKeybindingService keybindingService: IKeybindingService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IViewDescriptorService viewDescriptorService: IViewDescriptorService,
		@IOpenerService openerService: IOpenerService,
		@ILogService private readonly _logService: ILogService,
		@ITelemetryService telemetryService: ITelemetryService,
	) {
		super(options, keybindingService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, telemetryService);
		this._container = document.createElement('div');
		this._container.classList.add('zyraxon-subscription-view');
	}

	protected override layoutBody(width: number, height: number): void {
		// No-op for now
	}

	protected override renderBody(container: HTMLElement): void {
		super.renderBody(container);

		const currentTier = getCurrentTier(this._storageService);
		const tierInfo = getTierInfo(currentTier);

		// Header
		const header = document.createElement('div');
		header.classList.add('subscription-header');
		header.innerHTML = `
			<div class="subscription-title">ZYRAXON Subscription</div>
			<div class="subscription-current">
				<span class="tier-badge tier-${currentTier}">${currentTier.toUpperCase()}</span>
				<span class="tier-tools">${tierInfo.tools}</span>
			</div>
		`;
		container.appendChild(header);

		// Tier cards
		const tiersContainer = document.createElement('div');
		tiersContainer.classList.add('subscription-tiers');

		for (const tier of TIER_ORDER_LIST) {
			const info = getTierInfo(tier);
			const isCurrent = tier === currentTier;
			const isAccessible = hasAccess(currentTier, tier);

			const card = document.createElement('div');
			card.classList.add('tier-card', `tier-${tier}`, { 'current': isCurrent, 'accessible': isAccessible });
			card.innerHTML = `
				<div class="tier-name">${tier.toUpperCase()}</div>
				<div class="tier-price">${tier === 'free' ? 'Free' : tier === 'pro' ? '$5/mo' : tier === 'max' ? '$15/mo' : '$99/mo'}</div>
				<div class="tier-tools">${info.tools}</div>
				<div class="tier-agents">${info.agents} agents</div>
				<div class="tier-features">${info.features}</div>
				${isCurrent ? '<div class="tier-current-badge">Current Plan</div>' : ''}
			`;
			tiersContainer.appendChild(card);
		}

		container.appendChild(tiersContainer);
	}

	override dispose(): void {
		this._disposables.dispose();
		super.dispose();
	}
}
