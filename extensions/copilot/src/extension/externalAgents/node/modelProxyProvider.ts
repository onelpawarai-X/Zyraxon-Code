/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type * as zyraxoncode from 'zyraxoncode';
import { Disposable } from '../../../util/vs/base/common/lifecycle';
import { URI } from '../../../util/vs/base/common/uri';
import { IInstantiationService } from '../../../util/vs/platform/instantiation/common/instantiation';
import { OpenAILanguageModelServer } from './oaiLanguageModelServer';

export class LanguageModelProxyProvider implements zyraxoncode.LanguageModelProxyProvider {
	constructor(
		@IInstantiationService private readonly instantiationService: IInstantiationService
	) { }

	async provideModelProxy(forExtensionId: string, token: zyraxoncode.CancellationToken): Promise<zyraxoncode.LanguageModelProxy | undefined> {
		const server = this.instantiationService.createInstance(OpenAILanguageModelServer);
		await server.start();

		return new OpenAILanguageModelProxy(server);
	}
}

class OpenAILanguageModelProxy extends Disposable implements zyraxoncode.LanguageModelProxy {
	public readonly uri: zyraxoncode.Uri;
	public readonly key: string;

	constructor(
		runningServer: OpenAILanguageModelServer,
	) {
		super();
		this._register(runningServer);

		const config = runningServer.getConfig();
		this.uri = URI.parse(`__ZYRAXKEEP__0_{config.port}`);
		this.key = config.nonce;
	}
}
