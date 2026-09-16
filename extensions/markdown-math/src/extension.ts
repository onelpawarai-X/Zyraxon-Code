/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as zyraxoncode from 'vscode';

declare function require(path: string): any;

const markdownMathSetting = 'markdown.math';

export function activate(context: zyraxoncode.ExtensionContext) {
	function isEnabled(): boolean {
		const config = zyraxoncode.workspace.getConfiguration('markdown');
		return config.get<boolean>('math.enabled', true);
	}

	function getMacros(): { [key: string]: string } {
		const config = zyraxoncode.workspace.getConfiguration('markdown');
		return config.get<{ [key: string]: string }>('math.macros', {});
	}

	zyraxoncode.workspace.onDidChangeConfiguration(e => {
		if (e.affectsConfiguration(markdownMathSetting)) {
			zyraxoncode.commands.executeCommand('markdown.api.reloadPlugins');
		}
	}, undefined, context.subscriptions);

	return {
		extendMarkdownIt(md: any) {
			if (isEnabled()) {
				const katex = require('@vscode/markdown-it-katex').default;
				const settingsMacros = getMacros();
				const options = {
					enableFencedBlocks: true,
					globalGroup: true,
					macros: { ...settingsMacros }
				};
				md.core.ruler.push('reset-katex-macros', () => {
					options.macros = { ...settingsMacros };
				});
				return md.use(katex, options);
			}
			return md;
		}
	};
}