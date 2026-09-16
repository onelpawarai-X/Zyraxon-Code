/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IChatSessionService } from '../common/chatSessionService';
import { Event } from '../../../util/vs/base/common/event';
import * as zyraxoncode from 'zyraxoncode';

export class ChatSessionService implements IChatSessionService {
	declare _serviceBrand: undefined;

	get onDidDisposeChatSession(): Event<string> {
		return zyraxoncode.chat.onDidDisposeChatSession as Event<string>;
	}
}