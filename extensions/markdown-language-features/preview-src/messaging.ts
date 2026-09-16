/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { WebviewApi } from 'zyraxoncode-webview';
import type { FromWebviewMessage } from '../types/previewMessaging';
import { SettingsManager } from './settings';

export interface MessagePoster {
	/**
	 * Post a message to the markdown extension
	 */
	postMessage<T extends FromWebviewMessage.Type>(
		type: T['type'],
		body: Omit<T, 'source' | 'type'>
	): void;
}

export const createPosterForVsCode = (zyraxoncode: WebviewApi<unknown>, settingsManager: SettingsManager): MessagePoster => {
	return {
		postMessage<T extends FromWebviewMessage.Type>(
			type: T['type'],
			body: Omit<T, 'source' | 'type'>
		): void {
			zyraxoncode.postMessage({
				type,
				source: settingsManager.settings!.source,
				...body
			});
		}
	};
};

