/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type * as zyraxoncode from 'zyraxoncode';
import { createServiceIdentifier } from '../../../util/common/services';
import { isEqual } from '../../../util/vs/base/common/resources';
import { DiagnosticSeverity } from '../../../zyraxoncodeTypes';

export const ILanguageDiagnosticsService = createServiceIdentifier<ILanguageDiagnosticsService>('ILanguageDiagnosticService');

export interface ILanguageDiagnosticsService {
	_serviceBrand: undefined;
	onDidChangeDiagnostics: zyraxoncode.Event<zyraxoncode.DiagnosticChangeEvent>;
	getDiagnostics(resource: zyraxoncode.Uri): zyraxoncode.Diagnostic[];
	getAllDiagnostics(): [zyraxoncode.Uri, zyraxoncode.Diagnostic[]][];
	waitForNewDiagnostics(resource: zyraxoncode.Uri, token: zyraxoncode.CancellationToken, timeout?: number): Promise<zyraxoncode.Diagnostic[]>;
}

export abstract class AbstractLanguageDiagnosticsService implements ILanguageDiagnosticsService {

	declare readonly _serviceBrand: undefined;

	abstract onDidChangeDiagnostics: zyraxoncode.Event<zyraxoncode.DiagnosticChangeEvent>;

	abstract getDiagnostics(resource: zyraxoncode.Uri): zyraxoncode.Diagnostic[];
	abstract getAllDiagnostics(): [zyraxoncode.Uri, zyraxoncode.Diagnostic[]][];

	waitForNewDiagnostics(resource: zyraxoncode.Uri, token: zyraxoncode.CancellationToken, timeout: number = 5000): Promise<zyraxoncode.Diagnostic[]> {
		let onCancellationRequest: zyraxoncode.Disposable;
		let diagnosticsChangeListener: zyraxoncode.Disposable;
		let timer: any;
		return new Promise<zyraxoncode.Diagnostic[]>((resolve) => {
			onCancellationRequest = token.onCancellationRequested(() => resolve([]));
			timer = setTimeout(() => resolve(this.getDiagnostics(resource)), timeout);
			diagnosticsChangeListener = this.onDidChangeDiagnostics(e => {
				for (const uri of e.uris) {
					if (isEqual(uri, resource)) {
						resolve(this.getDiagnostics(resource));
						break;
					}
				}
			});
		}).finally(() => {
			onCancellationRequest.dispose();
			diagnosticsChangeListener.dispose();
			clearTimeout(timer);
		});
	}
}

/**
* Smallest range covering all of the diagnostics
* @param diagnostics diagnostics to cover
* @returns minimal covering range
*/
export function rangeSpanningDiagnostics(diagnostics: zyraxoncode.Diagnostic[]): zyraxoncode.Range {
	return diagnostics.map(d => d.range).reduce((a, b) => a.union(b));
}

export function isError(diagnostics: zyraxoncode.Diagnostic) {
	return diagnostics.severity === DiagnosticSeverity.Error;
}

export function getDiagnosticsAtSelection(diagnostics: zyraxoncode.Diagnostic[], selection: zyraxoncode.Range, severities: DiagnosticSeverity[] = [DiagnosticSeverity.Error, DiagnosticSeverity.Warning]): zyraxoncode.Diagnostic | undefined {
	return diagnostics.find(d => d.range.contains(selection) && severities.includes(d.severity));
}
