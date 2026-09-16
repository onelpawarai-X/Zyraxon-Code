/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type * as zyraxoncode from 'zyraxoncode';
import { RepoContext } from '../../git/common/gitService';


/**
 * Contains a subset of information needed to construct `IDeserializedWorkspaceState`
 * This is what is saved to the state.json files
 */
export interface ISerializedWorkspaceState {
	readonly workspaceFoldersFilePaths: string[] | undefined;
	readonly workspaceFolderFilePath: string | undefined;
	readonly repoContexts: Array<RepoContext | undefined> | undefined;
	readonly activeTextEditor: {
		selections: { anchor: zyraxoncode.Position; active: zyraxoncode.Position; isReversed: boolean }[];
		documentFilePath: string;
		visibleRanges: { start: zyraxoncode.Position; end: zyraxoncode.Position }[];
		languageId: string;
	} | undefined;
	readonly symbols: {
		name: string;
		kind: zyraxoncode.SymbolKind;
		containerName: string;
		filePath: string;
		start: zyraxoncode.Position;
		end: zyraxoncode.Position;
	}[] | undefined;
	readonly notebookDocumentFilePaths: string[] | undefined;
	readonly activeFileDiagnostics: {
		start: zyraxoncode.Position;
		end: zyraxoncode.Position;
		message: string;
		severity?: zyraxoncode.DiagnosticSeverity;
		relatedInformation?: ISerializedDiagnosticRelatedInformation[];
	}[];
	readonly debugConsoleOutput: string;
	readonly terminalBuffer: string;
	readonly terminalLastCommand: {
		commandLine: string | undefined;
		cwd: string | undefined;
		exitCode: number | undefined;
		output: string | undefined;
	} | undefined;
	readonly terminalSelection: string;
	readonly terminalShellType: string;
	readonly activeNotebookEditor: {
		selections: { start: number; end: number }[];
		documentFilePath: string;
	} | undefined;
	readonly lsifIndex?: string;
	readonly changeFiles?: { path: string; contents: string }[];
	readonly textDocumentFilePaths: string[];
	readonly testFailures?: IWorkspaceStateTestFailure[];
}

export interface ISerializedDiagnosticRelatedInformation {
	readonly message: string;
	readonly start: zyraxoncode.Position;
	readonly end: zyraxoncode.Position;
	readonly filePath: string;
}

export interface IWorkspaceStateTestFailure {
	message: string;
	line: number;
	column: number;
	file_path: string;
}

export interface IWorkspaceStateChangeFile {
	/** Path relative to the workspace folder */
	readonly path: string;
	/** Contents with which to replace the file. */
	readonly contents: string;
}
