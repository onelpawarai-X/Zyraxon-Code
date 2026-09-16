/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as zyraxoncode from 'vscode';
import { CommandManager } from '../commandManager';
import { isMarkdownFile } from '../util/file';


// Copied from markdown language service
export enum DiagnosticCode {
	link_noSuchReferences = 'link.no-such-reference',
	link_noSuchHeaderInOwnFile = 'link.no-such-header-in-own-file',
	link_noSuchFile = 'link.no-such-file',
	link_noSuchHeaderInFile = 'link.no-such-header-in-file',
}


class AddToIgnoreLinksQuickFixProvider implements zyraxoncode.CodeActionProvider {

	static readonly #addToIgnoreLinksCommandId = '_markdown.addToIgnoreLinks';

	static readonly #metadata: zyraxoncode.CodeActionProviderMetadata = {
		providedCodeActionKinds: [
			zyraxoncode.CodeActionKind.QuickFix
		],
	};

	public static register(selector: zyraxoncode.DocumentSelector, commandManager: CommandManager): zyraxoncode.Disposable {
		const reg = zyraxoncode.languages.registerCodeActionsProvider(selector, new AddToIgnoreLinksQuickFixProvider(), AddToIgnoreLinksQuickFixProvider.#metadata);
		const commandReg = commandManager.register({
			id: AddToIgnoreLinksQuickFixProvider.#addToIgnoreLinksCommandId,
			execute(resource: zyraxoncode.Uri, path: string) {
				const settingId = 'validate.ignoredLinks';
				const config = zyraxoncode.workspace.getConfiguration('markdown', resource);
				const paths = new Set(config.get<string[]>(settingId, []));
				paths.add(path);
				config.update(settingId, [...paths], zyraxoncode.ConfigurationTarget.WorkspaceFolder);
			}
		});
		return zyraxoncode.Disposable.from(reg, commandReg);
	}

	provideCodeActions(document: zyraxoncode.TextDocument, _range: zyraxoncode.Range | zyraxoncode.Selection, context: zyraxoncode.CodeActionContext, _token: zyraxoncode.CancellationToken): zyraxoncode.ProviderResult<(zyraxoncode.CodeAction | zyraxoncode.Command)[]> {
		const fixes: zyraxoncode.CodeAction[] = [];

		for (const diagnostic of context.diagnostics) {
			switch (diagnostic.code) {
				case DiagnosticCode.link_noSuchReferences:
				case DiagnosticCode.link_noSuchHeaderInOwnFile:
				case DiagnosticCode.link_noSuchFile:
				case DiagnosticCode.link_noSuchHeaderInFile: {
					const hrefText = (diagnostic as unknown as Record<string, any>).data?.hrefText;
					if (hrefText) {
						const fix = new zyraxoncode.CodeAction(
							zyraxoncode.l10n.t("Exclude '{0}' from link validation.", hrefText),
							zyraxoncode.CodeActionKind.QuickFix);

						fix.command = {
							command: AddToIgnoreLinksQuickFixProvider.#addToIgnoreLinksCommandId,
							title: '',
							arguments: [document.uri, hrefText],
						};
						fixes.push(fix);
					}
					break;
				}
			}
		}

		return fixes;
	}
}

function registerMarkdownStatusItem(selector: zyraxoncode.DocumentSelector, commandManager: CommandManager): zyraxoncode.Disposable {
	const statusItem = zyraxoncode.languages.createLanguageStatusItem('markdownStatus', selector);

	const enabledSettingId = 'validate.enabled';
	const commandId = '_markdown.toggleValidation';

	const commandSub = commandManager.register({
		id: commandId,
		execute: (enabled: boolean) => {
			zyraxoncode.workspace.getConfiguration('markdown').update(enabledSettingId, enabled);
		}
	});

	const update = () => {
		const activeDoc = zyraxoncode.window.activeTextEditor?.document;
		const markdownDoc = activeDoc && isMarkdownFile(activeDoc) ? activeDoc : undefined;

		const enabled = zyraxoncode.workspace.getConfiguration('markdown', markdownDoc).get(enabledSettingId);
		if (enabled) {
			statusItem.text = zyraxoncode.l10n.t('Markdown link validation enabled');
			statusItem.command = {
				command: commandId,
				arguments: [false],
				title: zyraxoncode.l10n.t('Disable'),
				tooltip: zyraxoncode.l10n.t('Disable validation of Markdown links'),
			};
		} else {
			statusItem.text = zyraxoncode.l10n.t('Markdown link validation disabled');
			statusItem.command = {
				command: commandId,
				arguments: [true],
				title: zyraxoncode.l10n.t('Enable'),
				tooltip: zyraxoncode.l10n.t('Enable validation of Markdown links'),
			};
		}
	};
	update();

	return zyraxoncode.Disposable.from(
		statusItem,
		commandSub,
		zyraxoncode.workspace.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration('markdown.' + enabledSettingId)) {
				update();
			}
		}),
	);
}

export function registerDiagnosticSupport(
	selector: zyraxoncode.DocumentSelector,
	commandManager: CommandManager,
): zyraxoncode.Disposable {
	return zyraxoncode.Disposable.from(
		AddToIgnoreLinksQuickFixProvider.register(selector, commandManager),
		registerMarkdownStatusItem(selector, commandManager),
	);
}
