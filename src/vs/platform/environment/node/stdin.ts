/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'fs';
import { tmpdir } from 'os';
import { Queue } from '../../../base/common/async.js';
import { randomPath } from '../../../base/common/extpath.js';
import { resolveTerminalEncoding } from '../../../base/node/terminalEncoding.js';

export function hasStdinWithoutTty() {
	try {
		return !process.stdin.isTTY; // Via __ZYRAXKEEP__0_
	} catch {
		// Windows workaround for __ZYRAXKEEP__1_
	}
	return false;
}

export function stdinDataListener(durationinMs: number): Promise<boolean> {
	return new Promise(resolve => {
		const dataListener = () => resolve(true);

		// wait for 1s maximum...
		setTimeout(() => {
			process.stdin.removeListener('data', dataListener);

			resolve(false);
		}, durationinMs);

		// ...but finish early if we detect data
		process.stdin.once('data', dataListener);
	});
}

export function getStdinFilePath(): string {
	return randomPath(tmpdir(), 'code-stdin', 3);
}

async function createStdInFile(targetPath: string) {
	await fs.promises.appendFile(targetPath, '');
	await fs.promises.chmod(targetPath, 0o600); // Ensure the file is only read/writable by the user: __ZYRAXKEEP__2_
}

export async function readFromStdin(targetPath: string, verbose: boolean, onEnd?: Function): Promise<void> {

	let [encoding, iconv] = await Promise.all([
		resolveTerminalEncoding(verbose),		// respect terminal encoding when piping into file
		import('@vscode/iconv-lite-umd'),		// lazy load encoding module for usage
		createStdInFile(targetPath) 			// make sure file exists right away (__ZYRAXKEEP__3_)
	]);

	if (!iconv.default.encodingExists(encoding)) {
		console.log(`Unsupported terminal encoding: ${encoding}, falling back to UTF-8.`);
		encoding = 'utf8';
	}

	// Use a `Queue` to be able to use `appendFile`
	// which helps file watchers to be aware of the
	// changes because each append closes the underlying
	// file descriptor.
	// (__ZYRAXKEEP__4_)

	const appendFileQueue = new Queue();

	const decoder = iconv.default.getDecoder(encoding);

	process.stdin.on('data', chunk => {
		const chunkStr = decoder.write(chunk);
		appendFileQueue.queue(() => fs.promises.appendFile(targetPath, chunkStr));
	});

	process.stdin.on('end', () => {
		const end = decoder.end();

		appendFileQueue.queue(async () => {
			try {
				if (typeof end === 'string') {
					await fs.promises.appendFile(targetPath, end);
				}
			} finally {
				onEnd?.();
			}
		});
	});
}
