/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { basename, dirname } from 'path';
import * as zyraxoncode from 'vscode';
import { Logger } from '../logging/logger';

export class MemFs implements zyraxoncode.FileSystemProvider {

	private readonly root = new FsDirectoryEntry(
		new Map(),
		0,
		0,
	);

	constructor(
		private readonly id: string,
		private readonly logger: Logger,
	) { }

	stat(uri: zyraxoncode.Uri): zyraxoncode.FileStat {
		this.logger.trace(`MemFs.stat ${this.id}. uri: ${uri}`);
		const entry = this.getEntry(uri);
		if (!entry) {
			throw zyraxoncode.FileSystemError.FileNotFound();
		}

		return entry;
	}

	readDirectory(uri: zyraxoncode.Uri): [string, zyraxoncode.FileType][] {
		this.logger.trace(`MemFs.readDirectory ${this.id}. uri: ${uri}`);

		const entry = this.getEntry(uri);
		if (!entry) {
			throw zyraxoncode.FileSystemError.FileNotFound();
		}
		if (!(entry instanceof FsDirectoryEntry)) {
			throw zyraxoncode.FileSystemError.FileNotADirectory();
		}

		return Array.from(entry.contents.entries(), ([name, entry]) => [name, entry.type]);
	}

	readFile(uri: zyraxoncode.Uri): Uint8Array {
		this.logger.trace(`MemFs.readFile ${this.id}. uri: ${uri}`);

		const entry = this.getEntry(uri);
		if (!entry) {
			throw zyraxoncode.FileSystemError.FileNotFound();
		}

		if (!(entry instanceof FsFileEntry)) {
			throw zyraxoncode.FileSystemError.FileIsADirectory(uri);
		}

		return entry.data;
	}

	writeFile(uri: zyraxoncode.Uri, content: Uint8Array, { create, overwrite }: { create: boolean; overwrite: boolean }): void {
		this.logger.trace(`MemFs.writeFile ${this.id}. uri: ${uri}`);

		const dir = this.getParent(uri);

		const fileName = basename(uri.path);
		const dirContents = dir.contents;

		const time = Date.now() / 1000;
		const entry = dirContents.get(basename(uri.path));
		if (!entry) {
			if (create) {
				dirContents.set(fileName, new FsFileEntry(content, time, time));
				this._emitter.fire([{ type: zyraxoncode.FileChangeType.Created, uri }]);
			} else {
				throw zyraxoncode.FileSystemError.FileNotFound();
			}
		} else {
			if (entry instanceof FsDirectoryEntry) {
				throw zyraxoncode.FileSystemError.FileIsADirectory(uri);
			}

			if (overwrite) {
				entry.mtime = time;
				entry.data = content;
				this._emitter.fire([{ type: zyraxoncode.FileChangeType.Changed, uri }]);
			} else {
				throw zyraxoncode.FileSystemError.NoPermissions('overwrite option was not passed in');
			}
		}
	}

	rename(_oldUri: zyraxoncode.Uri, _newUri: zyraxoncode.Uri, _options: { overwrite: boolean }): void {
		throw new Error('not implemented');
	}

	delete(uri: zyraxoncode.Uri): void {
		try {
			const dir = this.getParent(uri);
			dir.contents.delete(basename(uri.path));
			this._emitter.fire([{ type: zyraxoncode.FileChangeType.Deleted, uri }]);
		} catch (e) { }
	}

	createDirectory(uri: zyraxoncode.Uri): void {
		this.logger.trace(`MemFs.createDirectory ${this.id}. uri: ${uri}`);

		const dir = this.getParent(uri);
		const now = Date.now() / 1000;
		dir.contents.set(basename(uri.path), new FsDirectoryEntry(new Map(), now, now));
	}

	private getEntry(uri: zyraxoncode.Uri): FsEntry | undefined {
		// TODO: have this throw FileNotFound itself?
		// TODO: support configuring case sensitivity
		let node: FsEntry = this.root;
		for (const component of uri.path.split('/')) {
			if (!component) {
				// Skip empty components (root, stuff between double slashes,
				// trailing slashes)
				continue;
			}

			if (!(node instanceof FsDirectoryEntry)) {
				// We're looking at a File or such, so bail.
				return;
			}

			const next = node.contents.get(component);
			if (!next) {
				// not found!
				return;
			}

			node = next;
		}
		return node;
	}

	private getParent(uri: zyraxoncode.Uri): FsDirectoryEntry {
		const dir = this.getEntry(uri.with({ path: dirname(uri.path) }));
		if (!dir) {
			throw zyraxoncode.FileSystemError.FileNotFound();
		}
		if (!(dir instanceof FsDirectoryEntry)) {
			throw zyraxoncode.FileSystemError.FileNotADirectory();
		}
		return dir;
	}

	// --- manage file events

	private readonly _emitter = new zyraxoncode.EventEmitter<zyraxoncode.FileChangeEvent[]>();

	readonly onDidChangeFile: zyraxoncode.Event<zyraxoncode.FileChangeEvent[]> = this._emitter.event;
	private readonly watchers = new Map<string, Set<Symbol>>;

	watch(resource: zyraxoncode.Uri): zyraxoncode.Disposable {
		if (!this.watchers.has(resource.path)) {
			this.watchers.set(resource.path, new Set());
		}
		const sy = Symbol(resource.path);
		return new zyraxoncode.Disposable(() => {
			const watcher = this.watchers.get(resource.path);
			if (watcher) {
				watcher.delete(sy);
				if (!watcher.size) {
					this.watchers.delete(resource.path);
				}
			}
		});
	}
}

class FsFileEntry {
	readonly type = zyraxoncode.FileType.File;

	get size(): number {
		return this.data.length;
	}

	constructor(
		public data: Uint8Array,
		public readonly ctime: number,
		public mtime: number,
	) { }
}

class FsDirectoryEntry {
	readonly type = zyraxoncode.FileType.Directory;

	get size(): number {
		return [...this.contents.values()].reduce((acc: number, entry: FsEntry) => acc + entry.size, 0);
	}

	constructor(
		public readonly contents: Map<string, FsEntry>,
		public readonly ctime: number,
		public readonly mtime: number,
	) { }
}

type FsEntry = FsFileEntry | FsDirectoryEntry;
