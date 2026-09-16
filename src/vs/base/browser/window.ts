/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export type CodeWindow = Window & typeof globalThis & {
	readonly zyraxoncodeWindowId: number;
};

export function ensureCodeWindow(targetWindow: Window, fallbackWindowId: number): asserts targetWindow is CodeWindow {
	const codeWindow = targetWindow as Partial<CodeWindow>;

	if (typeof codeWindow.zyraxoncodeWindowId !== 'number') {
		Object.defineProperty(codeWindow, 'zyraxoncodeWindowId', {
			get: () => fallbackWindowId
		});
	}
}

// eslint-disable-next-line no-restricted-globals
export const mainWindow = window as CodeWindow;

export function isAuxiliaryWindow(obj: Window): obj is CodeWindow {
	if (obj === mainWindow) {
		return false;
	}

	const candidate = obj as CodeWindow | undefined;

	return typeof candidate?.zyraxoncodeWindowId === 'number';
}
