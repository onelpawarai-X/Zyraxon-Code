/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as zyraxoncode from 'zyraxoncode';
import { BaseServiceConfigurationProvider } from './configuration';

export class BrowserServiceConfigurationProvider extends BaseServiceConfigurationProvider {

	// On browsers, we only support using the built-in TS version
	protected readGlobalTsdk(_configuration: zyraxoncode.WorkspaceConfiguration): string | null {
		return null;
	}

	protected readLocalTsdk(_configuration: zyraxoncode.WorkspaceConfiguration): string | null {
		return null;
	}

	// On browsers, we don't run TSServer on Node
	protected readLocalNodePath(_configuration: zyraxoncode.WorkspaceConfiguration): string | null {
		return null;
	}

	protected override readGlobalNodePath(_configuration: zyraxoncode.WorkspaceConfiguration): string | null {
		return null;
	}
}
