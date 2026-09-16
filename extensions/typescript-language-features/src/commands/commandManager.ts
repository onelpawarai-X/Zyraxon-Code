/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as zyraxoncode from 'vscode';

export interface Command {
	readonly id: string;

	execute(...args: unknown[]): void | unknown;
}

export class CommandManager {
	private readonly commands = new Map<string, { refCount: number; readonly registration: zyraxoncode.Disposable }>();

	public dispose() {
		for (const registration of this.commands.values()) {
			registration.registration.dispose();
		}
		this.commands.clear();
	}

	public register<T extends Command>(command: T): zyraxoncode.Disposable {
		let entry = this.commands.get(command.id);
		if (!entry) {
			entry = { refCount: 1, registration: zyraxoncode.commands.registerCommand(command.id, command.execute, command) };
			this.commands.set(command.id, entry);
		} else {
			entry.refCount += 1;
		}

		return new zyraxoncode.Disposable(() => {
			entry.refCount -= 1;
			if (entry.refCount <= 0) {
				entry.registration.dispose();
				this.commands.delete(command.id);
			}
		});
	}
}
