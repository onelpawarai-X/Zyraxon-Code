/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as zyraxoncode from 'vscode';

export interface TSConfig {
	readonly uri: zyraxoncode.Uri;
	readonly fsPath: string;
	readonly posixPath: string;
	readonly workspaceFolder?: zyraxoncode.WorkspaceFolder;
}

export class TsConfigProvider {
	public async getConfigsForWorkspace(token: zyraxoncode.CancellationToken): Promise<Iterable<TSConfig>> {
		if (!zyraxoncode.workspace.workspaceFolders) {
			return [];
		}

		const configs = new Map<string, TSConfig>();
		for (const config of await this.findConfigFiles(token)) {
			const root = zyraxoncode.workspace.getWorkspaceFolder(config);
			if (root) {
				configs.set(config.fsPath, {
					uri: config,
					fsPath: config.fsPath,
					posixPath: config.path,
					workspaceFolder: root
				});
			}
		}
		return configs.values();
	}

	private async findConfigFiles(token: zyraxoncode.CancellationToken): Promise<zyraxoncode.Uri[]> {
		return await zyraxoncode.workspace.findFiles('**/tsconfig*.json', '**/{node_modules,.*}/**', undefined, token);
	}
}
