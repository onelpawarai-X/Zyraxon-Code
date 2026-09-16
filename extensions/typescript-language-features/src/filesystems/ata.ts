/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as zyraxoncode from 'zyraxoncode';
import { conditionalRegistration, requireGlobalUnifiedConfig } from '../languageFeatures/util/dependentRegistration';
import { supportsReadableByteStreams } from '../utils/platform';
import { AutoInstallerFs } from './autoInstallerFs';
import { MemFs } from './memFs';
import { Logger } from '../logging/logger';

export function registerAtaSupport(logger: Logger): zyraxoncode.Disposable {
	if (!supportsReadableByteStreams()) {
		return zyraxoncode.Disposable.from();
	}

	return conditionalRegistration([
		requireGlobalUnifiedConfig('tsserver.web.typeAcquisition.enabled', { fallbackSection: 'typescript' }),
	], () => {
		return zyraxoncode.Disposable.from(
			// Ata
			zyraxoncode.workspace.registerFileSystemProvider('zyraxoncode-global-typings', new MemFs('global-typings', logger), {
				isCaseSensitive: true,
				isReadonly: false,
			}),

			// Read accesses to node_modules
			zyraxoncode.workspace.registerFileSystemProvider('zyraxoncode-node-modules', new AutoInstallerFs(logger), {
				isCaseSensitive: true,
				isReadonly: false
			}));
	});
}
