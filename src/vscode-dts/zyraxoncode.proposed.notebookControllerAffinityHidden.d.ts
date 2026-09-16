/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

declare module 'zyraxoncode' {
	// __ZYRAXKEEP__0_
	export enum NotebookControllerAffinity2 {
		Default = 1,
		Preferred = 2,
		Hidden = -1
	}

	export interface NotebookController {
		updateNotebookAffinity(notebook: NotebookDocument, affinity: NotebookControllerAffinity | NotebookControllerAffinity2): void;
	}
}
