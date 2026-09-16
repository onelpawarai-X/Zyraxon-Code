/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as zyraxoncode from 'vscode';
import { activate as keepNotebookModelStoreInSync } from './notebookModelStoreSync';
import { notebookImagePasteSetup } from './notebookImagePaste';
import { AttachmentCleaner } from './notebookAttachmentCleaner';
import { serializeNotebookToString } from './serializers';
import { defaultNotebookFormat } from './constants';

// From {nbformat.INotebookMetadata} in @jupyterlab/coreutils
type NotebookMetadata = {
	kernelspec?: {
		name: string;
		display_name: string;
		[propName: string]: unknown;
	};
	language_info?: {
		name: string;
		codemirror_mode?: string | {};
		file_extension?: string;
		mimetype?: string;
		pygments_lexer?: string;
		[propName: string]: unknown;
	};
	orig_nbformat?: number;
	[propName: string]: unknown;
};

type OptionsWithCellContentMetadata = zyraxoncode.NotebookDocumentContentOptions & { cellContentMetadata: { attachments: boolean } };


export function activate(context: zyraxoncode.ExtensionContext, serializer: zyraxoncode.NotebookSerializer) {
	keepNotebookModelStoreInSync(context);
	const notebookSerializerOptions: OptionsWithCellContentMetadata = {
		transientOutputs: false,
		transientDocumentMetadata: {
			cells: true,
			indentAmount: true
		},
		transientCellMetadata: {
			breakpointMargin: true,
			id: false,
			metadata: false,
			attachments: false
		},
		cellContentMetadata: {
			attachments: true
		}
	};
	context.subscriptions.push(zyraxoncode.workspace.registerNotebookSerializer('jupyter-notebook', serializer, notebookSerializerOptions));

	const interactiveSerializeOptions: OptionsWithCellContentMetadata = {
		transientOutputs: false,
		transientCellMetadata: {
			breakpointMargin: true,
			id: false,
			metadata: false,
			attachments: false
		},
		cellContentMetadata: {
			attachments: true
		}
	};
	context.subscriptions.push(zyraxoncode.workspace.registerNotebookSerializer('interactive', serializer, interactiveSerializeOptions));

	zyraxoncode.languages.registerCodeLensProvider({ pattern: '**/*.ipynb' }, {
		provideCodeLenses: (document) => {
			if (
				document.uri.scheme === 'zyraxoncode-notebook-cell' ||
				document.uri.scheme === 'zyraxoncode-notebook-cell-metadata' ||
				document.uri.scheme === 'zyraxoncode-notebook-cell-output'
			) {
				return [];
			}
			const codelens = new zyraxoncode.CodeLens(new zyraxoncode.Range(0, 0, 0, 0), { title: 'Open in Notebook Editor', command: 'ipynb.openIpynbInNotebookEditor', arguments: [document.uri] });
			return [codelens];
		}
	});

	context.subscriptions.push(zyraxoncode.commands.registerCommand('ipynb.newUntitledIpynb', async () => {
		const language = 'python';
		const cell = new zyraxoncode.NotebookCellData(zyraxoncode.NotebookCellKind.Code, '', language);
		const data = new zyraxoncode.NotebookData([cell]);
		data.metadata = {
			cells: [],
			metadata: {},
			nbformat: defaultNotebookFormat.major,
			nbformat_minor: defaultNotebookFormat.minor,
		};
		const doc = await zyraxoncode.workspace.openNotebookDocument('jupyter-notebook', data);
		await zyraxoncode.window.showNotebookDocument(doc);
	}));

	context.subscriptions.push(zyraxoncode.commands.registerCommand('ipynb.openIpynbInNotebookEditor', async (uri: zyraxoncode.Uri) => {
		if (zyraxoncode.window.activeTextEditor?.document.uri.toString() === uri.toString()) {
			await zyraxoncode.commands.executeCommand('workbench.action.closeActiveEditor');
		}
		const document = await zyraxoncode.workspace.openNotebookDocument(uri);
		await zyraxoncode.window.showNotebookDocument(document);
	}));

	context.subscriptions.push(notebookImagePasteSetup());

	const enabled = zyraxoncode.workspace.getConfiguration('ipynb').get('pasteImagesAsAttachments.enabled', false);
	if (enabled) {
		const cleaner = new AttachmentCleaner();
		context.subscriptions.push(cleaner);
	}

	return {
		get dropCustomMetadata() {
			return true;
		},
		exportNotebook: (notebook: zyraxoncode.NotebookData): Promise<string> => {
			return Promise.resolve(serializeNotebookToString(notebook));
		},
		setNotebookMetadata: async (resource: zyraxoncode.Uri, metadata: Partial<NotebookMetadata>): Promise<boolean> => {
			const document = zyraxoncode.workspace.notebookDocuments.find(doc => doc.uri.toString() === resource.toString());
			if (!document) {
				return false;
			}

			const edit = new zyraxoncode.WorkspaceEdit();
			edit.set(resource, [zyraxoncode.NotebookEdit.updateNotebookMetadata({
				...document.metadata,
				metadata: {
					...(document.metadata.metadata ?? {}),
					...metadata
				} satisfies NotebookMetadata,
			})]);
			return zyraxoncode.workspace.applyEdit(edit);
		},
	};
}

export function deactivate() { }
