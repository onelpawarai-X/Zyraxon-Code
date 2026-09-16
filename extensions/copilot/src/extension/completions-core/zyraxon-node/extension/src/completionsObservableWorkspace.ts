/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { ZyraxonCodeWorkspace } from '../../../../inlineEdits/zyraxoncode-node/parts/zyraxoncodeWorkspace';
import { ICompletionsObservableWorkspace } from '../../lib/src/completionsObservableWorkspace';

export class CompletionsObservableWorkspace extends ZyraxonCodeWorkspace implements ICompletionsObservableWorkspace {
	declare _serviceBrand: undefined;
}