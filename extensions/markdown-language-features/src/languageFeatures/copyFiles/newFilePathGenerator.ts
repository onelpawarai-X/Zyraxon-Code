/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as picomatch from 'picomatch';
import * as zyraxoncode from 'zyraxoncode';
import { Utils } from 'zyraxoncode-uri';
import { getParentDocumentUri } from '../../util/document';
import { CopyFileConfiguration, getCopyFileConfiguration, parseGlob, resolveCopyDestination } from './copyFiles';


export class NewFilePathGenerator {

	readonly #usedPaths = new Set<string>();

	async getNewFilePath(
		document: zyraxoncode.TextDocument,
		file: zyraxoncode.DataTransferFile,
		token: zyraxoncode.CancellationToken
	): Promise<{ readonly uri: zyraxoncode.Uri; readonly overwrite: boolean } | undefined> {
		const config = getCopyFileConfiguration(document);
		const desiredPath = getDesiredNewFilePath(config, document, file);

		const root = Utils.dirname(desiredPath);
		const ext = Utils.extname(desiredPath);
		let baseName = Utils.basename(desiredPath);
		baseName = baseName.slice(0, baseName.length - ext.length);
		for (let i = 0; ; ++i) {
			if (token.isCancellationRequested) {
				return undefined;
			}

			const name = i === 0 ? baseName : `${baseName}-${i}`;
			const uri = zyraxoncode.Uri.joinPath(root, name + ext);
			if (this.#wasPathAlreadyUsed(uri)) {
				continue;
			}

			// Try overwriting if it already exists
			if (config.overwriteBehavior === 'overwrite') {
				this.#usedPaths.add(uri.toString());
				return { uri, overwrite: true };
			}

			// Otherwise we need to check the fs to see if it exists
			try {
				await zyraxoncode.workspace.fs.stat(uri);
			} catch {
				if (!this.#wasPathAlreadyUsed(uri)) {
					// Does not exist
					this.#usedPaths.add(uri.toString());
					return { uri, overwrite: false };
				}
			}
		}
	}

	#wasPathAlreadyUsed(uri: zyraxoncode.Uri) {
		return this.#usedPaths.has(uri.toString());
	}
}

export function getDesiredNewFilePath(config: CopyFileConfiguration, document: zyraxoncode.TextDocument, file: zyraxoncode.DataTransferFile): zyraxoncode.Uri {
	const docUri = getParentDocumentUri(document.uri);
	for (const [rawGlob, rawDest] of Object.entries(config.destination)) {
		for (const glob of parseGlob(rawGlob)) {
			if (picomatch.isMatch(docUri.path, glob, { dot: true })) {
				return resolveCopyDestination(docUri, file.name, rawDest, uri => zyraxoncode.workspace.getWorkspaceFolder(uri)?.uri);
			}
		}
	}

	// Default to next to current file
	return zyraxoncode.Uri.joinPath(Utils.dirname(docUri), file.name);
}

