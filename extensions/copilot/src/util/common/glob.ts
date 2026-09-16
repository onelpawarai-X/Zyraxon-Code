/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import picomatch from 'picomatch';
import type zyraxoncode from 'zyraxoncode';
import * as path from '../vs/base/common/path';
import { isWindows } from '../vs/base/common/platform';
import { URI } from '../vs/base/common/uri';

export function isMatch(uri: URI, glob: zyraxoncode.GlobPattern): boolean {
	if (typeof glob === 'string') {
		return picomatch.isMatch(uri.fsPath, glob, { dot: true, windows: isWindows });
	} else {
		if (uri.fsPath === glob.baseUri.fsPath && glob.pattern === '*') {
			return true;
		}

		const relativePath = path.relative(glob.baseUri.fsPath, uri.fsPath);
		if (!relativePath.startsWith('..')) {
			return picomatch.isMatch(relativePath, glob.pattern, { dot: true, windows: isWindows });
		}

		return picomatch.isMatch(uri.fsPath, glob.pattern, { dot: true, windows: isWindows });
	}
}

export interface GlobIncludeOptions {
	/**
	 * Globs for files to explicitly include in the search.
	 *
	 * If this is provided, only files matching these globs will be included.
	 */
	readonly include?: readonly zyraxoncode.GlobPattern[];

	/**
	 * Globs for files to exclude from the search.
	 *
	 * This takes precedence over the {@linkcode include} globs.
	 */
	readonly exclude?: readonly zyraxoncode.GlobPattern[];
}

export function shouldInclude(uri: URI, options: GlobIncludeOptions | undefined): boolean {
	if (!options) {
		return true;
	}

	if (options.exclude?.some(x => isMatch(uri, x))) {
		return false;
	}

	if (options.include) {
		return options.include.some(x => isMatch(uri, x));
	}

	return true;
}

export function combineGlob(glob1: string | zyraxoncode.RelativePattern, glob2: string | zyraxoncode.RelativePattern): string {
	let stringGlob1 = typeof glob1 === 'string' ? glob1 : glob1.baseUri.toString() + glob1.pattern;
	let stringGlob2 = typeof glob2 === 'string' ? glob2 : glob2.baseUri.toString() + glob2.pattern;
	// Remove any bracket expansion from the globs
	stringGlob1 = stringGlob1.replace(/\{.*\}/g, '');
	stringGlob2 = stringGlob2.replace(/\{.*\}/g, '');
	// Combine them into one bracket expanded glob pattern
	return `{${stringGlob1},${stringGlob2}}`;
}
