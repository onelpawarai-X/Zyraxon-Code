/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { WebviewStyles } from '../../../../webview/browser/webview.js';

const mapping: ReadonlyMap<string, string> = new Map([
	['theme-font-family', 'zyraxoncode-font-family'],
	['theme-font-weight', 'zyraxoncode-font-weight'],
	['theme-font-size', 'zyraxoncode-font-size'],
	['theme-code-font-family', 'zyraxoncode-editor-font-family'],
	['theme-code-font-weight', 'zyraxoncode-editor-font-weight'],
	['theme-code-font-size', 'zyraxoncode-editor-font-size'],
	['theme-scrollbar-background', 'zyraxoncode-scrollbarSlider-background'],
	['theme-scrollbar-hover-background', 'zyraxoncode-scrollbarSlider-hoverBackground'],
	['theme-scrollbar-active-background', 'zyraxoncode-scrollbarSlider-activeBackground'],
	['theme-quote-background', 'zyraxoncode-textBlockQuote-background'],
	['theme-quote-border', 'zyraxoncode-textBlockQuote-border'],
	['theme-code-foreground', 'zyraxoncode-textPreformat-foreground'],
	['theme-code-background', 'zyraxoncode-textPreformat-background'],
	// Editor
	['theme-background', 'zyraxoncode-editor-background'],
	['theme-foreground', 'zyraxoncode-editor-foreground'],
	['theme-ui-foreground', 'zyraxoncode-foreground'],
	['theme-link', 'zyraxoncode-textLink-foreground'],
	['theme-link-active', 'zyraxoncode-textLink-activeForeground'],
	// Buttons
	['theme-button-background', 'zyraxoncode-button-background'],
	['theme-button-hover-background', 'zyraxoncode-button-hoverBackground'],
	['theme-button-foreground', 'zyraxoncode-button-foreground'],
	['theme-button-secondary-background', 'zyraxoncode-button-secondaryBackground'],
	['theme-button-secondary-hover-background', 'zyraxoncode-button-secondaryHoverBackground'],
	['theme-button-secondary-foreground', 'zyraxoncode-button-secondaryForeground'],
	['theme-button-hover-foreground', 'zyraxoncode-button-foreground'],
	['theme-button-focus-foreground', 'zyraxoncode-button-foreground'],
	['theme-button-secondary-hover-foreground', 'zyraxoncode-button-secondaryForeground'],
	['theme-button-secondary-focus-foreground', 'zyraxoncode-button-secondaryForeground'],
	// Inputs
	['theme-input-background', 'zyraxoncode-input-background'],
	['theme-input-foreground', 'zyraxoncode-input-foreground'],
	['theme-input-placeholder-foreground', 'zyraxoncode-input-placeholderForeground'],
	['theme-input-focus-border-color', 'zyraxoncode-focusBorder'],
	// Menus
	['theme-menu-background', 'zyraxoncode-menu-background'],
	['theme-menu-foreground', 'zyraxoncode-menu-foreground'],
	['theme-menu-hover-background', 'zyraxoncode-menu-selectionBackground'],
	['theme-menu-focus-background', 'zyraxoncode-menu-selectionBackground'],
	['theme-menu-hover-foreground', 'zyraxoncode-menu-selectionForeground'],
	['theme-menu-focus-foreground', 'zyraxoncode-menu-selectionForeground'],
	// Errors
	['theme-error-background', 'zyraxoncode-inputValidation-errorBackground'],
	['theme-error-foreground', 'zyraxoncode-foreground'],
	['theme-warning-background', 'zyraxoncode-inputValidation-warningBackground'],
	['theme-warning-foreground', 'zyraxoncode-foreground'],
	['theme-info-background', 'zyraxoncode-inputValidation-infoBackground'],
	['theme-info-foreground', 'zyraxoncode-foreground'],
	// Notebook:
	['theme-notebook-output-background', 'zyraxoncode-notebook-outputContainerBackgroundColor'],
	['theme-notebook-output-border', 'zyraxoncode-notebook-outputContainerBorderColor'],
	['theme-notebook-cell-selected-background', 'zyraxoncode-notebook-selectedCellBackground'],
	['theme-notebook-symbol-highlight-background', 'zyraxoncode-notebook-symbolHighlightBackground'],
	['theme-notebook-diff-removed-background', 'zyraxoncode-diffEditor-removedTextBackground'],
	['theme-notebook-diff-inserted-background', 'zyraxoncode-diffEditor-insertedTextBackground'],
]);

const constants: Readonly<WebviewStyles> = {
	'theme-input-border-width': '1px',
	'theme-button-primary-hover-shadow': 'none',
	'theme-button-secondary-hover-shadow': 'none',
	'theme-input-border-color': 'transparent',
};

/**
 * Transforms base zyraxoncode theme variables into generic variables for notebook
 * renderers.
 * @see __ZYRAXKEEP__0_ for context
 * @deprecated
 */
export const transformWebviewThemeVars = (s: Readonly<WebviewStyles>): WebviewStyles => {
	const result = { ...s, ...constants };
	for (const [target, src] of mapping) {
		result[target] = s[src];
	}

	return result;
};
