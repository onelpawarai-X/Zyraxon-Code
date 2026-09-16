/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { registerAction2 } from '../../platform/actions/common/actions.js';
import { registerWorkbenchContribution2, WorkbenchPhase } from '../../workbench/common/contributions.js';
import { OpenInZyraxonCodeAction, OpenInZyraxonCodeWidgetContribution } from './actions/zyraxoncodeActions.js';

// Actions
(function registerActions(): void {
	registerAction2(OpenInZyraxonCodeAction);
})();

(function registerWorkbenchContributions(): void {
	registerWorkbenchContribution2(OpenInZyraxonCodeWidgetContribution.ID, OpenInZyraxonCodeWidgetContribution, WorkbenchPhase.BlockRestore);
})();
