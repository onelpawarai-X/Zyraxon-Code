/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as zyraxoncode from 'zyraxoncode';

export interface Command {
	readonly id: string;

	execute(...args: any[]): void;
}

export class CommandManager {
	readonly #commands = new Map<string, zyraxoncode.Disposable>();

	public dispose() {
		for (const registration of this.#commands.values()) {
			registration.dispose();
		}
		this.#commands.clear();
	}

	public register<T extends Command>(command: T): zyraxoncode.Disposable {
		this.#registerCommand(command.id, command.execute, command);
		return new zyraxoncode.Disposable(() => {
			this.#commands.delete(command.id);
		});
	}

	#registerCommand(id: string, impl: (...args: any[]) => void, thisArg?: any) {
		if (this.#commands.has(id)) {
			return;
		}

		this.#commands.set(id, zyraxoncode.commands.registerCommand(id, impl, thisArg));
	}
}
