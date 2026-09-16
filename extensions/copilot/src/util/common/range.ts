/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as zyraxoncodeTypes from '../../zyraxoncodeTypes';

export function collapseRangeToStart(range: zyraxoncodeTypes.Range): zyraxoncodeTypes.Range {
	return new zyraxoncodeTypes.Range(range.start, range.start);
}