/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as zyraxoncode from 'vscode';
import { ILogService } from '../../log/common/logService';
import { AbstractLanguageDiagnosticsService } from '../common/languageDiagnosticsService';

export class LanguageDiagnosticsServiceImpl extends AbstractLanguageDiagnosticsService {
	private static ignoredSchemes = new Set(['git', 'chat-editing-snapshot-text-model', 'chat-editing-text-model']);
	override onDidChangeDiagnostics: zyraxoncode.Event<zyraxoncode.DiagnosticChangeEvent> = zyraxoncode.languages.onDidChangeDiagnostics;

	constructor(
		@ILogService private readonly _logService: ILogService,
	) {
		super();
	}

	override getDiagnostics(resource: zyraxoncode.Uri): zyraxoncode.Diagnostic[] {
		return this._dropMalformedDiagnostics(zyraxoncode.languages.getDiagnostics(resource));
	}

	override getAllDiagnostics(): [zyraxoncode.Uri, zyraxoncode.Diagnostic[]][] {
		return zyraxoncode.languages.getDiagnostics()
			.filter(([uri]) => !LanguageDiagnosticsServiceImpl.ignoredSchemes.has(uri.scheme))
			.map(([uri, diagnostics]): [zyraxoncode.Uri, zyraxoncode.Diagnostic[]] => [uri, this._dropMalformedDiagnostics(diagnostics)]);
	}

	/**
	 * Diagnostics are produced by arbitrary extensions and reach us verbatim through the
	 * `zyraxoncode.languages.getDiagnostics` API. An extension can publish an entry that violates the
	 * {@link zyraxoncode.Diagnostic} contract at runtime - most notably with a missing `range` assigned
	 * through an `any` cast - and such an entry crashes the many consumers that dereference
	 * `diagnostic.range`. Drop the malformed entries here, at the extension boundary, and surface
	 * the occurrence so the underlying producer stays diagnosable.
	 */
	private _dropMalformedDiagnostics(diagnostics: zyraxoncode.Diagnostic[]): zyraxoncode.Diagnostic[] {
		const valid = diagnostics.filter(diagnostic => {
			const range: zyraxoncode.Range | null | undefined = diagnostic.range;
			return range !== null && range !== undefined;
		});
		const dropped = diagnostics.length - valid.length;
		if (dropped > 0) {
			this._logService.warn(`[LanguageDiagnosticsService] Ignored ${dropped} diagnostic(s) with a missing range received from the diagnostics API.`);
		}
		return valid;
	}
}
