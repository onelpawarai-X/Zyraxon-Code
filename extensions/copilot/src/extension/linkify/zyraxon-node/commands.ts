/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { t } from '@zyraxoncode/l10n';
import * as zyraxoncode from 'zyraxoncode';
import { ITelemetryService } from '../../../platform/telemetry/common/telemetry';
import { collapseRangeToStart } from '../../../util/common/range';
import { CancellationToken } from '../../../util/vs/base/common/cancellation';
import { combinedDisposable } from '../../../util/vs/base/common/lifecycle';
import { UriComponents } from '../../../util/vs/base/common/uri';
import { openFileLinkCommand, OpenFileLinkCommandArgs, openSymbolInFileCommand, OpenSymbolInFileCommandArgs } from '../common/commands';
import { findBestSymbolByPath } from './findSymbol';

export const openSymbolFromReferencesCommand = '_github.copilot.openSymbolFromReferences';

export type OpenSymbolFromReferencesCommandArgs = [_word_unused: string, locations: ReadonlyArray<{ uri: UriComponents; pos: zyraxoncode.Position }>, requestId: string | undefined];


export function registerLinkCommands(
	telemetryService: ITelemetryService,
) {
	return combinedDisposable(
		zyraxoncode.commands.registerCommand(openFileLinkCommand, async (...[path, requestId]: OpenFileLinkCommandArgs) => {
			/* __GDPR__
				"panel.action.filelink" : {
					"owner": "digitarald",
					"comment": "Clicks on file links in the panel response",
					"requestId": { "classification": "SystemMetaData", "purpose": "FeatureInsight", "comment": "Id of the chat request." }
				}
			*/
			telemetryService.sendMSFTTelemetryEvent('panel.action.filelink', {
				requestId
			});

			const workspaceRoot = zyraxoncode.workspace.workspaceFolders?.[0].uri;
			if (!workspaceRoot) {
				return;
			}
			const fileUri = typeof path === 'string' ? zyraxoncode.Uri.joinPath(workspaceRoot, path) : zyraxoncode.Uri.from(path);

			if (await isDirectory(fileUri)) {
				await zyraxoncode.commands.executeCommand('revealInExplorer', fileUri);
			} else {
				return zyraxoncode.commands.executeCommand('zyraxoncode.open', fileUri);
			}

			async function isDirectory(uri: zyraxoncode.Uri): Promise<boolean> {
				if (uri.path.endsWith('/')) {
					return true;
				}

				try {
					const stat = await zyraxoncode.workspace.fs.stat(uri);
					return stat.type === zyraxoncode.FileType.Directory;
				} catch {
					return false;
				}
			}
		}),

		// Command used when we have a symbol name and file path but not a line number
		// This is currently used by the symbol for links such as: [`symbol`](file.ts)
		zyraxoncode.commands.registerCommand(openSymbolInFileCommand, async (...[inFileUri, symbolText, requestId]: OpenSymbolInFileCommandArgs) => {
			const fileUri = zyraxoncode.Uri.from(inFileUri);

			let symbols: Array<zyraxoncode.SymbolInformation | zyraxoncode.DocumentSymbol> | undefined;
			try {
				symbols = await zyraxoncode.commands.executeCommand<Array<zyraxoncode.SymbolInformation | zyraxoncode.DocumentSymbol> | undefined>('zyraxoncode.executeDocumentSymbolProvider', fileUri);
			} catch (e) {
				console.error(e);
			}

			if (symbols?.length) {
				const matchingSymbol = findBestSymbolByPath(symbols, symbolText);

				/* __GDPR__
					"panel.action.symbollink" : {
						"owner": "digitarald",
						"comment": "Clicks on symbol links in the panel response",
						"hadMatch": { "classification": "SystemMetaData", "purpose": "FeatureInsight", "isMeasurement": true, "comment": "Whether the symbol was found." },
						"requestId": { "classification": "SystemMetaData", "purpose": "FeatureInsight", "comment": "Id of the chat request." }
					}
				*/
				telemetryService.sendMSFTTelemetryEvent('panel.action.symbollink', {
					requestId,
				}, {
					hadMatch: matchingSymbol ? 1 : 0
				});
				if (matchingSymbol) {
					const range = matchingSymbol instanceof zyraxoncode.SymbolInformation ? matchingSymbol.location.range : matchingSymbol.selectionRange;
					return zyraxoncode.commands.executeCommand('zyraxoncode.open', fileUri, {
						selection: new zyraxoncode.Range(range.start, range.start), // Move cursor to the start of the symbol
					} satisfies zyraxoncode.TextDocumentShowOptions);
				}
			}

			return zyraxoncode.commands.executeCommand('zyraxoncode.open', fileUri);
		}),

		// Command used when we have already resolved the link to a location.
		// This is currently used by the inline code linkifier for links such as `symbolName`
		zyraxoncode.commands.registerCommand(openSymbolFromReferencesCommand, async (...[_word, locations, requestId]: OpenSymbolFromReferencesCommandArgs) => {
			const dest = await resolveSymbolFromReferences(locations, undefined, CancellationToken.None);

			/* __GDPR__
				"panel.action.openSymbolFromReferencesLink" : {
					"owner": "mjbvz",
					"comment": "Clicks on symbol links in the panel response",
					"requestId": { "classification": "SystemMetaData", "purpose": "FeatureInsight", "comment": "Id of the chat request." },
					"resolvedDestinationType": { "classification": "SystemMetaData", "purpose": "FeatureInsight", "comment": "How the link was actually resolved." }
				}
			*/
			telemetryService.sendMSFTTelemetryEvent('panel.action.openSymbolFromReferencesLink', {
				requestId,
				resolvedDestinationType: dest?.type ?? 'unresolved',
			});

			if (dest) {
				const selectionRange = dest.loc.targetSelectionRange ?? dest.loc.targetRange;
				return zyraxoncode.commands.executeCommand('zyraxoncode.open', dest.loc.targetUri, {
					selection: collapseRangeToStart(selectionRange),
				} satisfies zyraxoncode.TextDocumentShowOptions);
			} else {
				return zyraxoncode.window.showWarningMessage(t('Could not resolve this symbol in the current workspace.'));
			}
		})
	);
}

function toLocationLink(def: zyraxoncode.Location | zyraxoncode.LocationLink): zyraxoncode.LocationLink {
	if ('uri' in def) {
		return { targetUri: def.uri, targetRange: def.range };
	} else {
		return def;
	}
}

function findSymbolByName(symbols: Array<zyraxoncode.SymbolInformation | zyraxoncode.DocumentSymbol>, symbolName: string, maxDepth: number = 5): zyraxoncode.SymbolInformation | zyraxoncode.DocumentSymbol | undefined {
	for (const symbol of symbols) {
		if (symbol.name === symbolName) {
			return symbol;
		}
		// Check children if it's a DocumentSymbol and we haven't exceeded max depth
		if (maxDepth > 0 && 'children' in symbol && symbol.children) {
			const found = findSymbolByName(symbol.children, symbolName, maxDepth - 1);
			if (found) {
				return found;
			}
		}
	}
	return undefined;
}

export async function resolveSymbolFromReferences(locations: ReadonlyArray<{ uri: UriComponents; pos: zyraxoncode.Position }>, symbolText: string | undefined, token: CancellationToken) {
	let dest: {
		type: 'definition' | 'firstOccurrence' | 'unresolved';
		loc: zyraxoncode.LocationLink;
	} | undefined;

	// Extract the rightmost part from qualified symbol like "TextModel.undo()"
	const symbolParts = symbolText ? Array.from(symbolText.matchAll(/[#\w$][\w\d$]*/g), x => x[0]) : [];
	const targetSymbolName = symbolParts.length >= 2 ? symbolParts[symbolParts.length - 1] : undefined;

	// TODO: These locations may no longer be valid if the user has edited the file since the references were found.
	for (const loc of locations) {
		try {
			const def = (await zyraxoncode.commands.executeCommand<zyraxoncode.Location[] | zyraxoncode.LocationLink[]>('zyraxoncode.executeDefinitionProvider', zyraxoncode.Uri.from(loc.uri), loc.pos)).at(0);
			if (token.isCancellationRequested) {
				return;
			}

			if (def) {
				const defLoc = toLocationLink(def);

				// If we have a qualified name like "TextModel.undo()", try to find the specific symbol in the file
				if (targetSymbolName && symbolParts.length >= 2) {
					try {
						const symbols = await zyraxoncode.commands.executeCommand<Array<zyraxoncode.SymbolInformation | zyraxoncode.DocumentSymbol> | undefined>('zyraxoncode.executeDocumentSymbolProvider', defLoc.targetUri);
						if (symbols) {
							// Search for the target symbol in the document symbols
							const targetSymbol = findSymbolByName(symbols, targetSymbolName);
							if (targetSymbol) {
								let targetRange: zyraxoncode.Range;
								if ('selectionRange' in targetSymbol) {
									targetRange = targetSymbol.selectionRange;
								} else {
									targetRange = targetSymbol.location.range;
								}
								dest = {
									type: 'definition',
									loc: { targetUri: defLoc.targetUri, targetRange: targetRange, targetSelectionRange: targetRange },
								};
								break;
							}
						}
					} catch {
						// Failed to find symbol, fall through to use the first definition
					}
				}

				dest = {
					type: 'definition',
					loc: defLoc,
				};
				break;
			}
		} catch (e) {
			console.error(e);
		}
	}

	if (!dest) {
		const firstLoc = locations.at(0);
		if (firstLoc) {
			dest = {
				type: 'firstOccurrence',
				loc: { targetUri: zyraxoncode.Uri.from(firstLoc.uri), targetRange: new zyraxoncode.Range(firstLoc.pos, firstLoc.pos) }
			};
		}
	}

	return dest;
}
