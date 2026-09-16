/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as zyraxoncode from 'vscode';

const Logger = zyraxoncode.window.createOutputChannel(zyraxoncode.l10n.t('Zyraxon Authentication'), { log: true });
export default Logger;
