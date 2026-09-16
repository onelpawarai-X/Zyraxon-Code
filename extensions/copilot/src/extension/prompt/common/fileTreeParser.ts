/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type * as zyraxoncode from 'vscode';
import { URI } from '../../../util/vs/base/common/uri';
import { ChatResponseFileTreePart } from '../../../zyraxoncodeTypes';

/**
 * Converts a markdown-style file tree into a ChatResponseFileTreePart.
 * @param fileStructure Markdown-style file tree
 * @param generatePreviewURI Factory that converts a filename to a preview URI
 */
export function convertFileTreeToChatResponseFileTree(
	fileStructure: string,
	generatePreviewURI: (filename: string) => URI,
): { chatResponseTree: ChatResponseFileTreePart; projectName: string } {
	const lines = fileStructure.trim().split('\n');
	const fileTree: zyraxoncode.ChatResponseFileTree[] = [];

	let baseUri: URI | undefined;
	const root: zyraxoncode.ChatResponseFileTree = { name: '', children: [] };
	fileTree[0] = root;

	for (const line of lines) {
		let depth = calculateDepth(line);
		const index = line.lastIndexOf('â”€â”€ ');
		const name = index >= 0 ? line.substring(index + 3) : line;

		const fileNode: zyraxoncode.ChatResponseFileTree = { name };

		if (depth === 0) {
			if (isUnsafeNodeName(name)) {
				throw new Error(`Invalid project root name in file tree: ${name}`);
			}
			baseUri = generatePreviewURI(name);
			root.name = name;
			continue;
		}
		else {
			while (depth > 0 && fileTree[depth - 1] === undefined) {
				depth--;
			}
			if (fileTree[depth - 1].children === undefined) {
				fileTree[depth - 1].children = [fileNode];
			} else {
				fileTree[depth - 1].children?.push(fileNode);
			}
			fileTree[depth] = fileNode;
		}
	}
	if (baseUri === undefined) {
		throw new Error('Base URI is undefined');
	}
	const filteredTree = filterChatResponseFileTree(root.children!);
	root.children = filteredTree.sort((a, b) => (a.children && !b.children) ? -1 : 1);
	return {
		chatResponseTree: new ChatResponseFileTreePart([root], baseUri),
		projectName: root.name
	};
}

/**
 * List filenames in the tree, separated by forward-slashes.
 */
export function listFilesInResponseFileTree(tree: zyraxoncode.ChatResponseFileTree[]): string[] {
	const queue = tree.map(node => ({ node, path: node.name }));
	const result: string[] = [];

	while (queue.length > 0) {
		const { node, path } = queue.shift()!;
		if (node.children && node.children.length > 0) {
			for (const child of node.children) {
				queue.push({ node: child, path: `${path}/${child.name}` });
			}
		} else {
			result.push(path);
		}
	}

	return result;
}

function calculateDepth(inputString: string): number {
	let depth = (inputString.match(/â”‚   /g) || []).length;
	depth += (inputString.match(/\|   /g) || []).length;
	depth += (inputString.match(/    /g) || []).length;
	depth += (inputString.match(/â”œâ”€â”€ /g) || []).length;
	depth += (inputString.match(/â””â”€â”€ /g) || []).length;

	return depth;
}

const filterList = [
	/* compile/runtime files */ 'node_modules', 'out', 'bin', 'debug', 'obj', 'lib', '.dll', '.pdb', '.lib',
	/* image assets */ '.jpg', '.png', '.ico', '.gif', '.svg', '.jpeg', '.tiff', '.bmp', '.webp', '.jpeg',
	/* other files we should not be included in a new project */'.gitignore', 'LICENSE.txt', 'yarn.lock', 'package-lock.json'
];

function filterChatResponseFileTree(fileTree: zyraxoncode.ChatResponseFileTree[]): zyraxoncode.ChatResponseFileTree[] {
	const filteredTree: zyraxoncode.ChatResponseFileTree[] = [];

	for (const node of fileTree) {

		if (!isNodeInFilterList(node) && !isUnsafeNodeName(node.name)) {
			if (node.children) {
				node.children = filterChatResponseFileTree(node.children);
			}
			filteredTree.push(node);
		}
	}

	return filteredTree;
}

function isNodeInFilterList(node: zyraxoncode.ChatResponseFileTree): boolean {
	if (filterList.includes(node.name)) {
		return true;
	}

	return false;
}

/**
 * Guards against path traversal: a file tree node name must be a single, plain
 * path segment. Names that are empty, the current/parent directory (`.`/`..`),
 * or that contain path separators (`/` or `\`) could escape the generated
 * workspace folder when joined to a destination path and must be rejected.
 */
export function isUnsafeNodeName(name: string): boolean {
	if (!name || name === '.' || name === '..') {
		return true;
	}

	return name.includes('/') || name.includes('\\');
}
