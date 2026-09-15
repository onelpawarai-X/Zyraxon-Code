"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MarkdownEditorProvider = void 0;
exports.lineRangesToGutterMarkers = lineRangesToGutterMarkers;
const vscode = __importStar(require("vscode"));
const dispose_1 = require("../util/dispose");
const resources_1 = require("../util/resources");
const lineDiff_1 = require("./lineDiff");
/**
 * Experimental hybrid (WYSIWYG) Markdown editor backed by the
 * `@vscode/markdown-editor` component. The {@link vscode.TextDocument} remains
 * the single source of truth, so native undo/redo, dirty state and hot-exit are
 * preserved.
 */
class MarkdownEditorProvider extends dispose_1.Disposable {
    static viewType = 'vscode.markdown.editor';
    /**
     * Memento key under which the last chosen edit/read-only mode is remembered.
     * The value is a single global default shared by every Markdown editor, so
     * flipping the lock in one editor becomes the initial mode for the next.
     */
    static #readonlyStateKey = 'markdown.editor.readonly';
    #mediaRoot;
    #extensionUri;
    #globalState;
    #linkOpener;
    constructor(extensionUri, globalState, linkOpener) {
        super();
        this.#extensionUri = extensionUri;
        this.#globalState = globalState;
        this.#linkOpener = linkOpener;
        this.#mediaRoot = vscode.Uri.joinPath(this.#extensionUri, 'markdown-editor-out');
    }
    async resolveCustomTextEditor(document, webviewPanel, token) {
        await this.#resolveEditor(document, webviewPanel, token);
    }
    async resolveCustomTextEditorInlineDiff(documents, webviewPanel, token) {
        await this.#resolveEditor(documents.modified, webviewPanel, token, documents.original);
    }
    async #resolveEditor(document, webviewPanel, token, originalDocument) {
        if (!vscode.workspace.isTrusted) {
            const cancel = { title: vscode.l10n.t("Cancel"), isCloseAffordance: true };
            const openAnyway = { title: vscode.l10n.t("Open Anyway") };
            const choice = await vscode.window.showWarningMessage(vscode.l10n.t("This Markdown file is in an untrusted workspace. Do you want to open it anyway?"), {
                modal: true,
                detail: vscode.l10n.t("For your security, only continue if you trust the source of this Markdown file."),
            }, cancel, openAnyway);
            if (choice !== openAnyway || token.isCancellationRequested) {
                webviewPanel.dispose();
                return;
            }
        }
        if (token.isCancellationRequested) {
            return;
        }
        const webview = webviewPanel.webview;
        this.#configureWebview(document.uri, webview);
        this.#wireSingle(document, webviewPanel, originalDocument);
    }
    #configureWebview(documentUri, webview) {
        webview.options = {
            enableScripts: true,
            localResourceRoots: (0, resources_1.getMarkdownLocalResourceRoots)(documentUri, [this.#mediaRoot], {
                includeWorkspaceResources: vscode.workspace.isTrusted,
            }),
        };
        webview.html = this.#getHtml(documentUri, webview);
    }
    #wireSingle(document, webviewPanel, originalDocument) {
        const webview = webviewPanel.webview;
        let isUpdatingFromWebview = false;
        let editQueue = Promise.resolve();
        const onMessage = webview.onDidReceiveMessage(async (message) => {
            switch (message.type) {
                case 'ready': {
                    webview.postMessage({ type: 'init', content: document.getText(), readonly: this.#globalState.get(_a.#readonlyStateKey, true) });
                    break;
                }
                case 'setReadonly': {
                    // Remember the edit/read-only choice as the global default for the
                    // next Markdown editor.
                    await this.#globalState.update(_a.#readonlyStateKey, !!message.readonly);
                    break;
                }
                case 'history': {
                    // The TextDocument owns undo/redo, so route the chord to the built-in
                    // command; the active custom editor input scopes it to this resource's
                    // history, shared with the Edit menu and Command Palette. Drain any
                    // in-flight edit first and only act while this panel is active, so the
                    // chord cannot race a pending edit or land on a different document.
                    if (message.command === 'undo' || message.command === 'redo') {
                        await editQueue;
                        if (webviewPanel.active) {
                            await vscode.commands.executeCommand(message.command);
                        }
                    }
                    break;
                }
                case 'openLink': {
                    await this.#linkOpener.openDocumentLink(message.href, document.uri);
                    break;
                }
                case 'edit': {
                    editQueue = editQueue.then(async () => {
                        const edit = new vscode.WorkspaceEdit();
                        edit.replace(document.uri, new vscode.Range(document.positionAt(message.start), document.positionAt(message.endExclusive)), message.text);
                        isUpdatingFromWebview = true;
                        try {
                            await vscode.workspace.applyEdit(edit);
                        }
                        finally {
                            isUpdatingFromWebview = false;
                        }
                    });
                    await editQueue;
                    break;
                }
            }
        });
        const onDocumentChange = vscode.workspace.onDidChangeTextDocument((e) => {
            if (e.document.uri.toString() !== document.uri.toString() || isUpdatingFromWebview) {
                return;
            }
            webview.postMessage({ type: 'update', content: document.getText() });
        });
        const highlight = this.#wireHighlight(webview);
        const quickDiff = originalDocument
            ? this.#wireDocumentDiff(originalDocument, document, webview)
            : this.#wireQuickDiff(document, webview);
        const comments = this.#wireComments(document, webview);
        const onDidGrantWorkspaceTrust = vscode.workspace.onDidGrantWorkspaceTrust(() => {
            this.#configureWebview(document.uri, webview);
        });
        webviewPanel.onDidDispose(() => {
            onMessage.dispose();
            onDocumentChange.dispose();
            highlight.dispose();
            quickDiff.dispose();
            comments.dispose();
            onDidGrantWorkspaceTrust.dispose();
        });
    }
    /**
     * Forwards the source-control change information for the document (the same
     * added/modified/deleted line changes shown in the editor gutter) to the
     * webview, where it is painted in the Markdown editor's gutter. Line ranges
     * are converted to source character offsets here, since the webview works in
     * offsets.
     */
    #wireQuickDiff(document, webview) {
        const diffProvider = vscode.window.createSourceControlDiffInformation(document.uri);
        const postMarkers = () => {
            const diffInformation = diffProvider.diffInformation;
            // The changes are computed asynchronously against a specific document
            // version. Only map them to offsets while that version still matches the
            // document we hold, otherwise the line positions could be stale. A newer
            // diff for the current version will arrive via onDidChange.
            if (!diffInformation || diffInformation.isStale) {
                return;
            }
            webview.postMessage({ type: 'gutterMarkers', markers: toGutterMarkers(document, diffInformation.changes) });
        };
        const onChange = diffProvider.onDidChange(postMarkers);
        // Re-send once the webview has (re)initialized its model, and whenever the
        // document settles on the version the changes were computed for.
        const onMessage = webview.onDidReceiveMessage((message) => {
            if (message.type === 'ready') {
                postMarkers();
            }
        });
        const onDocumentChange = vscode.workspace.onDidChangeTextDocument((e) => {
            if (e.document.uri.toString() === document.uri.toString()) {
                postMarkers();
            }
        });
        return vscode.Disposable.from(diffProvider, onChange, onMessage, onDocumentChange);
    }
    #wireDocumentDiff(originalDocument, modifiedDocument, webview) {
        const lineDiffProvider = new lineDiff_1.MarkdownPreviewLineDiffProvider(originalDocument, modifiedDocument);
        const postMarkers = async () => {
            const originalVersion = originalDocument.version;
            const modifiedVersion = modifiedDocument.version;
            const changes = await lineDiffProvider.getChangedLineRanges();
            if (originalVersion !== originalDocument.version || modifiedVersion !== modifiedDocument.version) {
                return;
            }
            webview.postMessage({ type: 'gutterMarkers', markers: lineRangesToGutterMarkers(modifiedDocument, changes) });
        };
        const onMessage = webview.onDidReceiveMessage(message => {
            if (message.type === 'ready') {
                void postMarkers();
            }
        });
        const onDocumentChange = vscode.workspace.onDidChangeTextDocument(event => {
            if (event.document.uri.toString() === originalDocument.uri.toString() || event.document.uri.toString() === modifiedDocument.uri.toString()) {
                void postMarkers();
            }
        });
        return vscode.Disposable.from(onMessage, onDocumentChange);
    }
    /**
     * Bridges the workbench's agent/session comments (the same store the code
     * editor renders its comments from) to the webview: existing comments are
     * forwarded for rendering, and comments the user adds in the Markdown editor
     * are written back to the shared store so they appear in the code editor too.
     * Comment ranges are converted between {@link vscode.Range} and the source
     * character offsets the webview works in.
     */
    #wireComments(document, webview) {
        const commentsProvider = vscode.window.createAgentEditorComments(document.uri);
        let webviewReady = false;
        let revealedCommentId;
        const postComments = () => {
            const comments = commentsProvider.comments.map(comment => ({
                id: comment.id,
                start: document.offsetAt(comment.range.start),
                endExclusive: document.offsetAt(comment.range.end),
                body: comment.body,
                author: comment.author,
            }));
            webview.postMessage({ type: 'comments', comments, acceptsComments: commentsProvider.acceptsComments });
        };
        const postReveal = () => {
            if (webviewReady && revealedCommentId) {
                webview.postMessage({ type: 'revealComment', id: revealedCommentId });
            }
        };
        const onChange = commentsProvider.onDidChange(postComments);
        const onDidRevealComment = commentsProvider.onDidRevealComment(id => {
            revealedCommentId = id;
            postReveal();
        });
        const onMessage = webview.onDidReceiveMessage((message) => {
            if (message.type === 'ready') {
                webviewReady = true;
                postComments();
                postReveal();
            }
            else if (message.type === 'addComment') {
                const range = new vscode.Range(document.positionAt(message.start), document.positionAt(message.endExclusive));
                commentsProvider.addComment(range, message.text);
            }
            else if (message.type === 'deleteComment') {
                commentsProvider.deleteComment(message.id);
            }
        });
        return vscode.Disposable.from(commentsProvider, onChange, onDidRevealComment, onMessage);
    }
    /**
     * Proxies the webview's syntax highlighting requests to the
     * `documentSyntaxHighlighting` proposed API, since the webview cannot call
     * it directly. Also forwards theme changes so the webview can re-highlight.
     */
    #wireHighlight(webview) {
        const onMessage = webview.onDidReceiveMessage(async (message) => {
            if (message.type !== 'highlight') {
                return;
            }
            const result = await vscode.languages.computeFullSyntaxHighlighting(message.source, message.languageId);
            webview.postMessage({
                type: 'highlightResult',
                requestId: message.requestId,
                tokens: result.tokens,
                colorMap: result.colorMap,
            });
        });
        const onThemeChange = vscode.languages.onDidChangeSyntaxHighlighting(() => {
            webview.postMessage({ type: 'highlightThemeChanged' });
        });
        return vscode.Disposable.from(onMessage, onThemeChange);
    }
    #getHtml(documentUri, webview) {
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this.#mediaRoot, 'editor.js'));
        const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this.#mediaRoot, 'editor.css'));
        const baseUri = webview.asWebviewUri(documentUri);
        const nonce = getNonce();
        const body = /* html */ `
	<div id="editor"></div>`;
        return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1.0" />
	<meta http-equiv="Content-Security-Policy"
		content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; font-src ${webview.cspSource}; img-src ${webview.cspSource} https: data:; media-src ${webview.cspSource} https: data:; script-src 'nonce-${nonce}';" />
	<base href="${baseUri}" />
	<link rel="stylesheet" href="${styleUri}" />
	<title>Markdown Editor</title>
</head>
<body>${body}
	<script nonce="${nonce}" type="module" src="${scriptUri}"></script>
</body>
</html>`;
    }
}
exports.MarkdownEditorProvider = MarkdownEditorProvider;
_a = MarkdownEditorProvider;
function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}
/**
 * Converts the line-based source control changes into source character offset
 * ranges understood by the Markdown editor's `gutterMarkers`. Added/modified
 * changes map to the offset span of their modified lines; deleted changes map to
 * an empty range at the boundary where the removed text used to be.
 *
 * Line ranges use {@link vscode.TextEditorLineRange} semantics: 1-based
 * `startLineNumber` and exclusive `endLineNumberExclusive`.
 */
function toGutterMarkers(document, changes) {
    const markers = [];
    for (const change of changes) {
        if (change.kind === vscode.TextEditorChangeKind.Deletion) {
            // The modified range is empty; place an empty marker at the start of the
            // line where the removed content used to be.
            const line = Math.max(0, change.modified.startLineNumber - 1);
            const offset = document.offsetAt(new vscode.Position(line, 0));
            markers.push({ start: offset, endExclusive: offset, type: 'deleted' });
            continue;
        }
        const start = document.offsetAt(new vscode.Position(change.modified.startLineNumber - 1, 0));
        const endExclusive = document.offsetAt(document.lineAt(change.modified.endLineNumberExclusive - 2).range.end);
        markers.push({
            start,
            endExclusive,
            type: change.kind === vscode.TextEditorChangeKind.Addition ? 'added' : 'modified',
        });
    }
    return markers;
}
function lineRangesToGutterMarkers(document, changes) {
    return changes.map(change => {
        if (change.modifiedRange.isEmpty) {
            const offset = document.offsetAt(change.modifiedRange.start);
            return { start: offset, endExclusive: offset, type: 'deleted' };
        }
        const start = document.offsetAt(change.modifiedRange.start);
        const endExclusive = document.offsetAt(document.lineAt(change.modifiedRange.end.line - 1).range.end);
        return {
            start,
            endExclusive,
            type: change.originalRange.isEmpty ? 'added' : 'modified',
        };
    });
}
//# sourceMappingURL=markdownEditorProvider.js.map