/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as zyraxoncode from 'zyraxoncode';
import { Command } from './commandManager';

export interface OpenJsDocLinkCommand_Args {
	readonly file: {
		readonly scheme: string;
		readonly authority?: string;
		readonly path?: string;
		readonly query?: string;
		readonly fragment?: string;
	};
	readonly position: {
		readonly line: number;
		readonly character: number;
	};
}

/**
 * Proxy command for opening links in jsdoc comments.
 *
 * This is needed to avoid incorrectly rewriting uris.
 */
export class OpenJsDocLinkCommand implements Command {
	public static readonly id = '_typescript.openJsDocLink';
	public readonly id = OpenJsDocLinkCommand.id;

	public async execute(args: OpenJsDocLinkCommand_Args): Promise<void> {
		const { line, character } = args.position;
		const position = new zyraxoncode.Position(line, character);
		await zyraxoncode.commands.executeCommand('zyraxoncode.open', zyraxoncode.Uri.from(args.file), {
			selection: new zyraxoncode.Range(position, position),
		} satisfies zyraxoncode.TextDocumentShowOptions);
	}
}
