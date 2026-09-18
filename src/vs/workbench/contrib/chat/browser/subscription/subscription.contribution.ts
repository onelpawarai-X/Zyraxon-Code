/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { localize2 } from '../../../../nls.js';
import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { registerIcon } from '../../../../platform/theme/common/iconRegistry.js';
import { ViewPaneContainer } from '../../../browser/parts/views/viewPaneContainer.js';
import { IWorkbenchContribution, registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';
import { IViewContainersRegistry, IViewDescriptor, IViewsRegistry, ViewContainer, ViewContainerLocation, Extensions as ViewExtensions } from '../../../common/views.js';
import { SubscriptionViewPane } from './subscriptionViewPane.js';

export const SubscriptionViewId = 'workbench.view.zyraxon.subscription';
const SubscriptionViewContainerId = 'workbench.container.zyraxon.subscription';

const subscriptionIcon = registerIcon('subscription-view-icon', Codicon.starFull, localize2('subscriptionIcon', 'View icon of the subscription view.'));

const subscriptionViewContainer: ViewContainer = Registry.as<IViewContainersRegistry>(ViewExtensions.ViewContainersRegistry).registerViewContainer({
	id: SubscriptionViewContainerId,
	title: localize2('subscription.viewContainer.label', "Subscription"),
	icon: subscriptionIcon,
	ctorDescriptor: new SyncDescriptor(ViewPaneContainer, [SubscriptionViewContainerId, { mergeViewWithContainerWhenSingleView: true }]),
	storageId: SubscriptionViewContainerId,
	hideIfEmpty: true,
	order: 10,
}, ViewContainerLocation.Sidebar, { isDefault: false, doNotRegisterOpenCommand: false });

const subscriptionViewDescriptor: IViewDescriptor = {
	id: SubscriptionViewId,
	containerIcon: subscriptionViewContainer.icon,
	containerTitle: subscriptionViewContainer.title.value,
	singleViewPaneContainerTitle: subscriptionViewContainer.title.value,
	name: localize2('subscription.viewContainer.label', "Subscription"),
	canToggleVisibility: true,
	canMoveView: true,
	openCommandActionDescriptor: {
		id: SubscriptionViewContainerId,
		title: subscriptionViewContainer.title,
		mnemonicTitle: localize2({ key: 'miSubscription', comment: ['&& denotes a mnemonic'] }, "&&Subscription"),
		order: 10
	},
	ctorDescriptor: new SyncDescriptor(SubscriptionViewPane),
};

Registry.as<IViewsRegistry>(ViewExtensions.ViewsRegistry).registerViews([subscriptionViewDescriptor], subscriptionViewContainer);

class SubscriptionContribution extends Disposable implements IWorkbenchContribution {
	static readonly ID = 'workbench.contrib.chat.subscription';

	constructor() {
		super();
	}
}

registerWorkbenchContribution2(SubscriptionContribution.ID, SubscriptionContribution, WorkbenchPhase.BlockRestore);
