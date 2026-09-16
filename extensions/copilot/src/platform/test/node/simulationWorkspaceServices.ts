/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { exec } from 'child_process';
import * as fs from 'fs/promises';
import { promisify } from 'util';
import type * as zyraxoncode from 'zyraxoncode';
import * as glob from '../../../util/common/glob';
import { getLanguageForResource } from '../../../util/common/languages';
import { createTextDocumentData } from '../../../util/common/test/shims/textDocument';
import { asArray, coalesce } from '../../../util/vs/base/common/arrays';
import { AsyncIterableSource, raceTimeout } from '../../../util/vs/base/common/async';
import { CancellationToken } from '../../../util/vs/base/common/cancellation';
import { Emitter, Event } from '../../../util/vs/base/common/event';
import { Disposable } from '../../../util/vs/base/common/lifecycle';
import { ResourceMap } from '../../../util/vs/base/common/map';
import { constObservable, observableValue } from '../../../util/vs/base/common/observableInternal';
import { basename } from '../../../util/vs/base/common/resources';
import { createRegExp } from '../../../util/vs/base/common/strings';
import { URI } from '../../../util/vs/base/common/uri';
import { IInstantiationService } from '../../../util/vs/platform/instantiation/common/instantiation';
import { Position, Range, TerminalShellExecutionCommandLineConfidence } from '../../../zyraxoncodeTypes';
import { ConfigKey } from '../../configuration/common/configurationService';
import { IDebugOutputService } from '../../debug/common/debugOutputService';
import { IDialogService } from '../../dialog/common/dialogService';
import { IFileSystemService } from '../../filesystem/common/fileSystemService';
import { FileType, RelativePattern } from '../../filesystem/common/fileTypes';
import { NodeFileSystemService } from '../../filesystem/node/fileSystemServiceImpl';
import { IGitService, RepoContext } from '../../git/common/gitService';
import { Branch, Change, CommitOptions, CommitShortStat, DiffChange, Ref, RefQuery, Repository, RepositoryAccessDetails } from '../../git/zyraxoncode/git';
import { AbstractLanguageDiagnosticsService } from '../../languages/common/languageDiagnosticsService';
import { ILanguageFeaturesService } from '../../languages/common/languageFeaturesService';
import { ILogService } from '../../log/common/logService';
import { AlternativeContentFormat, getAlternativeNotebookDocumentProvider, IAlternativeNotebookContentService } from '../../notebook/common/alternativeContent';
import { INotebookService, PipPackage, VariablesResult } from '../../notebook/common/notebookService';
import { INotebookSummaryTracker } from '../../notebook/common/notebookSummaryTracker';
import { IReviewService, ReviewComment, ReviewDiagnosticCollection } from '../../review/common/reviewService';
import { AbstractSearchService } from '../../search/common/searchService';
import { ITabsAndEditorsService, TabInfo } from '../../tabs/common/tabsAndEditorsService';
import { IKnownTerminal, ITerminalService, ShellIntegrationQuality } from '../../terminal/common/terminalService';
import { AbstractWorkspaceService, IWorkspaceService } from '../../workspace/common/workspaceService';
import { isNotebook, SimulationWorkspace } from './simulationWorkspace';

export const WORKSPACE_PATH = `/Users/someone/Projects/proj01/`;

export class SimulationWorkspaceService extends AbstractWorkspaceService {
	override fs!: zyraxoncode.FileSystem;
	constructor(private readonly workspace: SimulationWorkspace) {
		super();
	}

	override get textDocuments(): readonly zyraxoncode.TextDocument[] {
		return this.workspace.documents.map(d => d.document);
	}

	override onDidOpenTextDocument: zyraxoncode.Event<zyraxoncode.TextDocument> = Event.None;
	override onDidCloseTextDocument: zyraxoncode.Event<zyraxoncode.TextDocument> = Event.None;
	override onDidOpenNotebookDocument: zyraxoncode.Event<zyraxoncode.NotebookDocument> = Event.None;
	override onDidCloseNotebookDocument: zyraxoncode.Event<zyraxoncode.NotebookDocument> = Event.None;
	override onDidChangeTextDocument: zyraxoncode.Event<zyraxoncode.TextDocumentChangeEvent> = Event.None;
	override onDidChangeWorkspaceFolders: zyraxoncode.Event<zyraxoncode.WorkspaceFoldersChangeEvent> = Event.None;
	override onDidChangeNotebookDocument: zyraxoncode.Event<zyraxoncode.NotebookDocumentChangeEvent> = Event.None;
	override onDidChangeTextEditorSelection: zyraxoncode.Event<zyraxoncode.TextEditorSelectionChangeEvent> = Event.None;

	override showTextDocument(document: zyraxoncode.TextDocument): Promise<void> {
		return Promise.resolve();
	}

	override async openTextDocument(uri: zyraxoncode.Uri): Promise<zyraxoncode.TextDocument> {
		if (this.workspace.hasDocument(uri)) {
			return this.workspace.getDocument(uri).document;
		}

		if (uri.scheme === 'file') {
			const fileContents = await fs.readFile(this.workspace.mapLocation(uri).fsPath, 'utf8');
			const language = getLanguageForResource(uri);
			const doc = createTextDocumentData(uri, fileContents, language.languageId);
			this.workspace.addDocument(doc);
			return doc.document;
		}

		throw new Error(`File not found ${uri.fsPath}`);
	}

	override async openNotebookDocument(uri: zyraxoncode.Uri): Promise<zyraxoncode.NotebookDocument>;
	override async openNotebookDocument(notebookType: string, content?: zyraxoncode.NotebookData): Promise<zyraxoncode.NotebookDocument>;
	override async openNotebookDocument(arg1: zyraxoncode.Uri | string, arg2?: zyraxoncode.NotebookData): Promise<zyraxoncode.NotebookDocument> {
		if (typeof arg1 === 'string') {
			// Handle the overload for notebookType and content
			throw new Error('Not implemented');
		} else {
			if (this.workspace.hasNotebookDocument(arg1)) {
				return this.workspace.getNotebook(arg1)?.document;
			}

			throw new Error(`Notebook file not found ${arg1.fsPath}`);
		}
	}

	override get notebookDocuments(): readonly zyraxoncode.NotebookDocument[] {
		return this.workspace.getNotebookDocuments();
	}

	override getWorkspaceFolders(): URI[] {
		return this.workspace.workspaceFolders;
	}

	override getWorkspaceFolderName(workspaceFolderUri: URI): string {
		return workspaceFolderUri.path.split('/').pop()!;
	}

	override ensureWorkspaceIsFullyLoaded(): Promise<void> {
		// We aren't using virtual workspaces here, so we can just return
		return Promise.resolve();
	}

	override async showWorkspaceFolderPicker(): Promise<zyraxoncode.WorkspaceFolder | undefined> {
		return undefined;
	}

	override applyEdit(edit: zyraxoncode.WorkspaceEdit): Thenable<boolean> {
		return Promise.resolve(true);
	}

	override isResourceTrusted(_resource: zyraxoncode.Uri): Thenable<boolean> {
		return Promise.resolve(true);
	}

	override requestResourceTrust(options: zyraxoncode.ResourceTrustRequestOptions): Thenable<boolean | undefined> {
		return Promise.resolve(true);
	}

	override requestWorkspaceTrust(options?: zyraxoncode.WorkspaceTrustRequestOptions): Thenable<boolean | undefined> {
		return Promise.resolve(true);
	}
}

export class SimulationLanguageDiagnosticsService extends AbstractLanguageDiagnosticsService {

	constructor(
		private workspace: SimulationWorkspace,
	) {
		super();
	}

	override onDidChangeDiagnostics: zyraxoncode.Event<zyraxoncode.DiagnosticChangeEvent> = this.workspace.onDidChangeDiagnostics;
	override getDiagnostics: (resource: zyraxoncode.Uri) => zyraxoncode.Diagnostic[] = this.workspace.getDiagnostics.bind(this.workspace);
	override getAllDiagnostics(): [zyraxoncode.Uri, zyraxoncode.Diagnostic[]][] {
		return this.workspace.getAllDiagnostics();
	}
}

export class SimulationFileSystemAdaptor implements IFileSystemService {

	declare readonly _serviceBrand: undefined;

	private readonly _delegate: NodeFileSystemService;
	private readonly _time = Date.now();

	constructor(
		private readonly _workspace: SimulationWorkspace,
		@IWorkspaceService private _workspaceService: IWorkspaceService,
	) {
		this._delegate = new NodeFileSystemService();
	}

	async stat(uri: URI): Promise<zyraxoncode.FileStat> {
		try {
			const doc = await this._workspaceService.openTextDocument(uri);
			if (doc) {
				return {
					type: FileType.File,
					ctime: this._time,
					mtime: this._time,
					size: new TextEncoder().encode(doc.getText()).byteLength
				};
			}
			return await this._delegate.stat(this._workspace.mapLocation(uri));
		} catch {
			return await this._delegate.stat(this._workspace.mapLocation(uri));
		}
	}

	async readFile(uri: URI): Promise<Uint8Array> {
		const containsDoc = this._workspaceService.textDocuments.some(d => d.uri.toString() === uri.toString());
		if (containsDoc) {
			const doc = await this._workspaceService.openTextDocument(uri);
			return new TextEncoder().encode(doc.getText());
		}
		return await this._delegate.readFile(this._workspace.mapLocation(uri));
	}

	async readDirectory(uri: URI): Promise<[string, FileType][]> {
		const uriPath = uri.path.endsWith('/') ? uri.path : `${uri.path}/`;
		if (uriPath.startsWith(WORKSPACE_PATH)) {
			const seen = new Set<string>();
			const result = [] as [string, FileType][];
			for (const document of this._workspaceService.textDocuments) {
				const path = document.uri.path;
				if (path.startsWith(uriPath)) {
					const [first, remaining] = path.substring(uriPath.length).split('/', 2);
					if (first && !seen.has(first)) {
						seen.add(first);
						result.push([first, remaining === undefined ? FileType.File : FileType.Directory]);
					}
				}
			}

			const scenarioFolderLoc = this._workspace.mapLocation(uri);
			if (scenarioFolderLoc) {
				try {
					const entries = await this._delegate.readDirectory(scenarioFolderLoc);
					const filter = uriPath === WORKSPACE_PATH ? ((name: string) => (name.endsWith('.conversation.json') || name.endsWith('.state.json'))) : (() => false);
					for (const [name, type] of entries) {
						if (!seen.has(name) && !filter(name)) {
							seen.add(name);
							result.push([name, type]);
						}
					}
				} catch (e) {
					// ignore non existing folders
				}
			}
			return result;
		}
		return await this._delegate.readDirectory(uri);
	}

	async createDirectory(uri: URI): Promise<void> {
		return await this._delegate.createDirectory(this._workspace.mapLocation(uri, true));
	}

	async writeFile(uri: URI, content: Uint8Array): Promise<void> {
		return await this._delegate.writeFile(this._workspace.mapLocation(uri, true), content);
	}

	async delete(uri: URI, options?: { recursive?: boolean | undefined; useTrash?: boolean | undefined } | undefined): Promise<void> {
		return await this._delegate.delete(this._workspace.mapLocation(uri, true), options);
	}

	async rename(oldURI: URI, newURI: URI, options?: { overwrite?: boolean | undefined } | undefined): Promise<void> {
		return await this._delegate.rename(this._workspace.mapLocation(oldURI, true), this._workspace.mapLocation(newURI, true), options);
	}

	async copy(source: URI, destination: URI, options?: { overwrite?: boolean | undefined } | undefined): Promise<void> {
		return await this._delegate.copy(this._workspace.mapLocation(source), this._workspace.mapLocation(destination, true), options);
	}

	isWritableFileSystem(scheme: string): boolean | undefined {
		return this._delegate.isWritableFileSystem(scheme);
	}

	createFileSystemWatcher(glob: string | zyraxoncode.RelativePattern): zyraxoncode.FileSystemWatcher {
		return this._delegate.createFileSystemWatcher(glob);
	}
}

export class SimulationReviewService implements IReviewService {
	declare _serviceBrand: undefined;

	private diagnosticCollection = {
		diagnosticCollection: new Map<string, readonly zyraxoncode.Diagnostic[]>(),
		get(uri: zyraxoncode.Uri) {
			return this.diagnosticCollection.get(uri.toString());
		},
		set(uri: zyraxoncode.Uri, diagnostics: readonly zyraxoncode.Diagnostic[] | undefined) {
			if (diagnostics?.length) {
				this.diagnosticCollection.set(uri.toString(), diagnostics);
			} else {
				this.diagnosticCollection.delete(uri.toString());
			}
		}
	};

	private _comments: ReviewComment[] = [];

	updateContextValues(): void {
	}

	isCodeFeedbackEnabled(): boolean {
		return ConfigKey.CodeFeedback.defaultValue;
	}

	isReviewDiffEnabled(): boolean {
		return false;
	}

	isIntentEnabled(): boolean {
		return ConfigKey.Advanced.ReviewIntent.defaultValue;
	}

	getDiagnosticCollection(): ReviewDiagnosticCollection {
		return this.diagnosticCollection;
	}

	getReviewComments(): ReviewComment[] {
		return this._comments.slice();
	}

	addReviewComments(comments: ReviewComment[]) {
		this._comments.push(...comments);
	}

	collapseReviewComment(_comment: ReviewComment): void {
	}

	removeReviewComments(comments: ReviewComment[]) {
		for (const comment of comments) {
			const index = this._comments.indexOf(comment);
			if (index !== -1) {
				this._comments.splice(index, 1);
			}
		}
	}

	updateReviewComment(_comment: ReviewComment) {
	}

	findReviewComment(_threadOrComment: zyraxoncode.CommentThread | zyraxoncode.Comment): ReviewComment | undefined {
		return undefined;
	}

	findCommentThread(comment: ReviewComment): zyraxoncode.CommentThread | undefined {
		return undefined;
	}
}

export class SimulationNotebookService implements INotebookService {

	declare _serviceBrand: undefined;


	constructor(
		private _workspace: SimulationWorkspace,
		private _variablesMap = new ResourceMap<VariablesResult[]>()
	) { }

	getCellExecutions(notebook: zyraxoncode.Uri): zyraxoncode.NotebookCell[] {
		return [];
	}

	runCells(notebook: zyraxoncode.Uri, range: { start: number; end: number }, autoReveal: boolean): Promise<void> {
		return Promise.resolve();
	}

	ensureKernelSelected(notebook: zyraxoncode.Uri): Promise<void> {
		return Promise.resolve();
	}

	async getVariables(notebook: zyraxoncode.Uri): Promise<VariablesResult[]> {
		return this._variablesMap.get(notebook) ?? [];
	}

	async getPipPackages(notebook: zyraxoncode.Uri): Promise<PipPackage[]> {
		return [];
	}

	setVariables(uri: zyraxoncode.Uri, variables: VariablesResult[]) {
		if (!this._workspace.getNotebook(uri)) {
			return;
		}

		this._variablesMap.set(uri, variables);
	}

	populateNotebookProviders(): void { }

	hasSupportedNotebooks(uri: zyraxoncode.Uri): boolean {
		if (isNotebook(uri)) {
			return true;
		}

		const KNOWN_NOTEBOOK_TYPES = [
			'.ipynb',
			'.github-issues',
			'.knb'
		];

		if (KNOWN_NOTEBOOK_TYPES.some(type => uri.path.endsWith(type))) {
			return true;
		}

		return false;
	}

	trackAgentUsage(): void { }

	setFollowState(state: boolean): void { }

	getFollowState(): boolean {
		return false;
	}
}

export class SimulationNotebookSummaryTracker implements INotebookSummaryTracker {
	declare _serviceBrand: undefined;
	trackNotebook(notebook: zyraxoncode.NotebookDocument): void {
		//
	}
	clearState(notebook: zyraxoncode.NotebookDocument): void {
		//
	}
	listNotebooksWithChanges(): zyraxoncode.NotebookDocument[] {
		return [];
	}

}

export class SimulationAlternativeNotebookContentService implements IAlternativeNotebookContentService {

	constructor(
		/**
		 * Allow tests to override the format of the alternative content provider.
		 */
		public format: 'xml' | 'json' | 'text' = 'json'
	) { }
	_serviceBrand: undefined;

	getFormat() {
		return this.format;
	}
	create(format: AlternativeContentFormat) {
		return getAlternativeNotebookDocumentProvider(format);
	}

}

export class SnapshotSearchService extends AbstractSearchService {

	constructor(
		@IFileSystemService private readonly fileSystemService: IFileSystemService,
		@IWorkspaceService private readonly workspaceService: IWorkspaceService,
	) {
		super();
	}

	override async findTextInFiles(query: zyraxoncode.TextSearchQuery, options: zyraxoncode.FindTextInFilesOptions, progress: zyraxoncode.Progress<zyraxoncode.TextSearchResult>, token: zyraxoncode.CancellationToken): Promise<zyraxoncode.TextSearchComplete> {

		const uris = await this.findFiles(options.include ?? '**/*', { exclude: options.exclude ? [options.exclude] : undefined, maxResults: options.maxResults }, token);

		const maxResults = options.maxResults ?? Number.MAX_SAFE_INTEGER;
		let count = 0;

		for (const uri of uris) {
			const doc = await this.workspaceService.openTextDocument(uri);
			count += this._search(query, doc, progress);
			if (count >= maxResults) {
				break;
			}
		}

		return Promise.resolve({
			limitHit: count >= maxResults,
			message: undefined
		});
	}

	override findTextInFiles2(query: zyraxoncode.TextSearchQuery2, options?: zyraxoncode.FindTextInFilesOptions2, token?: zyraxoncode.CancellationToken): zyraxoncode.FindTextInFilesResponse {
		const iterableSource = new AsyncIterableSource<zyraxoncode.TextSearchMatch2>();
		const doSearch = async (): Promise<zyraxoncode.TextSearchComplete2> => {
			const uris = await this.findFiles(options?.include ?? ['**/*'], { exclude: options?.exclude, maxResults: options?.maxResults }, token);

			const maxResults = options?.maxResults ?? Number.MAX_SAFE_INTEGER;
			let count = 0;

			try {
				for (const uri of uris) {
					const doc = await this.workspaceService.openTextDocument(uri);
					count += this._search2(query, doc, iterableSource);
					if (count >= maxResults) {
						break;
					}
				}
			} catch {
				// I can't figure out why errors here fire 'unhandledrejection' so just swallow them
			}

			return {
				limitHit: count >= maxResults
			};
		};

		const completePromise = doSearch();
		completePromise.catch(() => { });
		completePromise.finally(() => iterableSource.resolve());
		return {
			complete: completePromise,
			results: iterableSource.asyncIterable
		};
	}

	private _search2(query: zyraxoncode.TextSearchQuery2, document: zyraxoncode.TextDocument, iterableSource: AsyncIterableSource<zyraxoncode.TextSearchMatch2>) {
		return this._search(query, document, {
			report: match => {
				iterableSource.emitOne({
					uri: match.uri,
					previewText: match.preview.text,
					ranges: [{
						previewRange: asArray(match.preview.matches)[0],
						sourceRange: asArray(match.ranges)[0]
					}]
				});
			}
		});
	}

	private _search(query: zyraxoncode.TextSearchQuery, document: zyraxoncode.TextDocument, progress: zyraxoncode.Progress<zyraxoncode.TextSearchMatch>) {

		let matches = 0;

		const r = createRegExp(query.pattern, query.isRegExp ?? false, {
			global: true,
			matchCase: query.isCaseSensitive,
			wholeWord: query.isWordMatch,
			multiline: query.isMultiline
		});

		const text = document.getText();

		let m: RegExpExecArray | null;
		while (m = r.exec(text)) {
			matches += 1;
			const start = m.index;
			const end = m.index + m[0].length;
			const range = new Range(document.positionAt(start), document.positionAt(end));
			const fullLine = document.lineAt(range.start.line).text;
			const relativeRange = new Range(new Position(0, range.start.character), new Position(range.end.line - range.start.line, range.end.character));
			progress.report({
				uri: document.uri,
				ranges: range,
				preview: {
					text: fullLine,
					matches: [relativeRange]
				}
			});
		}

		return matches;
	}

	override async findFiles(filePattern: zyraxoncode.GlobPattern | zyraxoncode.GlobPattern[], options?: zyraxoncode.FindFiles2Options | undefined, token?: zyraxoncode.CancellationToken | undefined): Promise<zyraxoncode.Uri[]> {
		const filePatterns = asArray(filePattern);
		const out: zyraxoncode.Uri[] = [];

		const processDir = async (dir: URI, workspaceRoot: URI) => {
			if (token?.isCancellationRequested) {
				return;
			}

			let entries: [string, FileType][];
			try {
				entries = await this.fileSystemService.readDirectory(dir);
			} catch (e) {
				console.log(e);
				return;
			}

			const toRelativePattern = (pattern: zyraxoncode.GlobPattern) => {
				if (typeof pattern === 'string') {
					return new RelativePattern(workspaceRoot, pattern);
				} else {
					return pattern;
				}
			};

			for (const [name, type] of entries) {
				const uri = URI.joinPath(dir, name);
				if (type === FileType.File) {
					if (filePatterns.some(pattern => glob.isMatch(uri, toRelativePattern(pattern)))) {
						if (!options?.exclude || !options.exclude.some(e => glob.isMatch(uri, e))) {
							out.push(uri);
						}
					}
				} else if (type === FileType.Directory) {
					await processDir(uri, workspaceRoot);
				}
			}
		};

		for (const root of this.workspaceService.getWorkspaceFolders()) {
			await processDir(root, root);
		}

		return out;
	}
}

export class TestingDialogService implements IDialogService {

	declare _serviceBrand: undefined;

	showQuickPick<T extends zyraxoncode.QuickPickItem>(items: readonly T[] | Thenable<readonly T[]>, options: zyraxoncode.QuickPickOptions, token?: zyraxoncode.CancellationToken | undefined): Thenable<T | undefined> {
		throw new Error('Method not implemented.');
	}

	showOpenDialog(options: zyraxoncode.OpenDialogOptions): Thenable<zyraxoncode.Uri[] | undefined> {
		throw new Error('Method not implemented.');
	}
}

export interface ITestingTabsAndEditorsServiceDelegate {
	getActiveTextEditor: () => zyraxoncode.TextEditor | undefined;
	getVisibleTextEditors: () => readonly zyraxoncode.TextEditor[];
	getActiveNotebookEditor: () => zyraxoncode.NotebookEditor | undefined;
}

export class TestingTabsAndEditorsService implements ITabsAndEditorsService {

	declare _serviceBrand: undefined;

	readonly delegate: ITestingTabsAndEditorsServiceDelegate;

	constructor(delegate: ITestingTabsAndEditorsServiceDelegate) {
		this.delegate = delegate;
	}

	onDidChangeActiveTextEditor = Event.None;
	onDidChangeTabs = Event.None;
	get activeTextEditor(): zyraxoncode.TextEditor | undefined {
		return this.delegate.getActiveTextEditor();
	}
	get visibleTextEditors(): readonly zyraxoncode.TextEditor[] {
		return this.delegate.getVisibleTextEditors();
	}
	get activeNotebookEditor(): zyraxoncode.NotebookEditor | undefined {
		return this.delegate.getActiveNotebookEditor();
	}
	get visibleNotebookEditors(): readonly zyraxoncode.NotebookEditor[] {
		return this.activeNotebookEditor ? [this.activeNotebookEditor] : [];
	}

	get tabs(): TabInfo[] {

		if (!this.activeTextEditor) {
			return [];
		}

		const tab: zyraxoncode.Tab = {
			group: null!,
			isActive: true,
			input: { uri: this.activeTextEditor.document.uri },
			isDirty: this.activeTextEditor.document.isDirty,
			isPinned: false,
			isPreview: false,
			label: `TESTING ${this.activeTextEditor.document.fileName}`,
		};

		return [{ tab, uri: this.activeTextEditor.document.uri }];
	}
}

export class TestingDebugOutputService implements IDebugOutputService {
	_serviceBrand: undefined;
	get consoleOutput(): string {
		return this._workspace.debugConsoleOutput ?? '';
	}
	constructor(private readonly _workspace: SimulationWorkspace) {
	}
}

export class TestingGitService implements IGitService {

	declare readonly _serviceBrand: undefined;

	activeRepository = observableValue<RepoContext | undefined>(this, undefined);

	onDidOpenRepository: Event<RepoContext> = Event.None;
	onDidCloseRepository: Event<RepoContext> = Event.None;
	onDidFinishInitialization: Event<void> = Event.None;
	isInitialized: boolean = true;

	constructor(
		private readonly _workspace: SimulationWorkspace,
		private readonly _createImplicitRepos = true,
	) { }

	dispose(): void {
		return;
	}

	// TODO implement later if tests use this, only used by ignore service
	getRepository(uri: URI, forceOpen?: boolean): Promise<RepoContext | undefined> {
		return Promise.resolve(undefined);
	}

	getRepository2(uri: URI): Promise<Repository | undefined> {
		return Promise.resolve(undefined);
	}

	openRepository(uri: URI): Promise<Repository | undefined> {
		return Promise.resolve(undefined);
	}

	getRepositoryFetchUrls(uri: URI): Promise<Pick<RepoContext, 'rootUri' | 'remoteFetchUrls'> | undefined> {
		return Promise.resolve(undefined);
	}

	getRecentRepositories(): Iterable<RepositoryAccessDetails> {
		return [];
	}

	async initRepository(_uri: URI): Promise<Repository | undefined> {
		return Promise.resolve(undefined);
	}

	async initialize() {
		return undefined;
	}

	get repositories(): RepoContext[] {
		const workspaceFolderPath = this._workspace.workspaceFolderPath
			? URI.file(this._workspace.workspaceFolderPath)
			: this._workspace.workspaceFolders[0];

		const workspaceStateRepos = this._workspace.repositories;
		if (workspaceStateRepos) {
			return coalesce(workspaceStateRepos.map((repo): RepoContext | undefined => {
				if (!repo) {
					return repo;
				}

				return {
					...repo,
					// rootUri is not set on some serialized repos
					rootUri: repo.rootUri
						? URI.revive(repo.rootUri)
						: workspaceFolderPath
				};
			}));
		}

		if (this._createImplicitRepos) {
			return [{
				rootUri: workspaceFolderPath,
				kind: 'repository',
				isUsingVirtualFileSystem: false,
				headBranchName: undefined,
				headCommitHash: undefined,
				headIncomingChanges: 0,
				headOutgoingChanges: 0,
				upstreamBranchName: undefined,
				upstreamRemote: undefined,
				isRebasing: false,
				remoteFetchUrls: [
					`__ZYRAXKEEP__0_{basename(workspaceFolderPath)}`
				],
				remotes: [],
				worktrees: [],
				changes: undefined,
				headBranchNameObs: constObservable(undefined),
				headCommitHashObs: constObservable(undefined),
				upstreamBranchNameObs: constObservable(undefined),
				upstreamRemoteObs: constObservable(undefined),
				isRebasingObs: constObservable(false),
				isIgnored: async () => false,
			}];
		}

		return [];
	}

	async diffBetween(uri: URI, ref1: string, ref2: string): Promise<Change[]> {
		return [];
	}

	getBranchBase(_uri: URI, _name: string): Promise<Branch | undefined> {
		return Promise.resolve(undefined);
	}

	async diffBetweenWithStats(uri: URI, ref1: string, ref2: string, path?: string): Promise<DiffChange[] | undefined> {
		return [];
	}

	async diffBetweenPatch(uri: URI, ref1: string, ref2: string, path?: string): Promise<string | undefined> {
		return undefined;
	}

	async diffWith(uri: zyraxoncode.Uri, ref: string): Promise<Change[] | undefined> {
		return undefined;
	}

	async diffIndexWithHEADShortStats(uri: URI): Promise<CommitShortStat | undefined> {
		return undefined;
	}

	async getMergeBase(uri: URI, ref1: string, ref2: string): Promise<string | undefined> {
		return undefined;
	}

	async add(uri: URI, paths: string[]): Promise<void> {
		return;
	}

	async restore(_uri: URI, _paths: string[], _options?: { staged?: boolean; ref?: string }): Promise<void> {
		return;
	}

	async createWorktree(uri: URI, options?: { path?: string; commitish?: string; branch?: string; noTrack?: boolean }): Promise<string | undefined> {
		return undefined;
	}

	async deleteWorktree(uri: URI, path: string, options?: { force?: boolean; label?: string }): Promise<void> {
		return;
	}

	async migrateChanges(uri: URI, sourceRepositoryUri: URI, options?: { confirmation?: boolean; deleteFromSource?: boolean; untracked?: boolean }): Promise<void> {
		return;
	}

	applyPatch(uri: URI, patch: string): Promise<void> {
		return Promise.resolve();
	}

	async commit(uri: URI, message: string | undefined, opts?: CommitOptions): Promise<void> {
		return;
	}

	async getBranch(_uri: URI, _name: string): Promise<Branch | undefined> {
		return undefined;
	}

	async getRefs(uri: URI, query: RefQuery, cancellationToken?: CancellationToken): Promise<Ref[]> {
		return [];
	}

	async isBranchProtected(uri: URI, branch?: string | Branch): Promise<boolean | undefined> {
		return undefined;
	}

	async generateRandomBranchName(_uri: URI): Promise<string | undefined> {
		return undefined;
	}

	async exec(uri: URI, args: string[], env?: Record<string, string>): Promise<string> {
		return '';
	}
}

export class TestingTerminalService extends Disposable implements ITerminalService {

	declare readonly _serviceBrand: undefined;

	constructor(
		private readonly _workspace: SimulationWorkspace,
		@IInstantiationService private readonly instantiationService: IInstantiationService,
	) {
		super();
	}

	get terminals(): readonly zyraxoncode.Terminal[] {
		return [];
	}

	private _onDidChangeTerminalShellIntegration = this._register(new Emitter<zyraxoncode.TerminalShellIntegrationChangeEvent>());
	onDidChangeTerminalShellIntegration: zyraxoncode.Event<zyraxoncode.TerminalShellIntegrationChangeEvent> = this._onDidChangeTerminalShellIntegration.event;

	private _onDidEndTerminalShellExecution = this._register(new Emitter<zyraxoncode.TerminalShellExecutionEndEvent>());
	onDidEndTerminalShellExecution: Event<zyraxoncode.TerminalShellExecutionEndEvent> = this._onDidEndTerminalShellExecution.event;

	onDidCloseTerminal: zyraxoncode.Event<zyraxoncode.Terminal> = Event.None;
	onDidWriteTerminalData: zyraxoncode.Event<zyraxoncode.TerminalDataWriteEvent> = Event.None;

	private readonly sessionTerminals = new Map<string, { terminal: zyraxoncode.Terminal; shellIntegrationQuality: ShellIntegrationQuality; id: string }[]>();

	createTerminal(name?: string, shellPath?: string, shellArgs?: string[] | string): zyraxoncode.Terminal;
	createTerminal(options: zyraxoncode.TerminalOptions): zyraxoncode.Terminal;
	createTerminal(options: zyraxoncode.ExtensionTerminalOptions): zyraxoncode.Terminal;
	createTerminal(nameOrOpts?: string | zyraxoncode.TerminalOptions | zyraxoncode.ExtensionTerminalOptions, shellPath?: string, shellArgs?: string[] | string): zyraxoncode.Terminal {
		const options: zyraxoncode.TerminalOptions | zyraxoncode.ExtensionTerminalOptions = typeof nameOrOpts === 'string' || nameOrOpts === undefined ?
			{ name: nameOrOpts, shellPath, shellArgs } satisfies zyraxoncode.TerminalOptions :
			nameOrOpts;
		if ('pty' in options) {
			throw new Error('Not implemented');
		}

		const terminal = this._register(this.instantiationService.createInstance(SimulationTerminal, options, this._workspace));
		this._register((terminal.shellIntegration as SimulationTerminalShellIntegration).onDidEndTerminalShellExecution(e => this._onDidEndTerminalShellExecution.fire(e)));
		setTimeout(() => {
			this._onDidChangeTerminalShellIntegration.fire({ terminal, shellIntegration: terminal.shellIntegration });
		});

		return terminal;
	}

	getCwdForSession(sessionId: string): Promise<zyraxoncode.Uri | undefined> {
		return Promise.resolve(undefined);
	}

	associateTerminalWithSession(terminal: zyraxoncode.Terminal, sessionId: string, id: string, shellIntegrationQuality: ShellIntegrationQuality): Promise<void> {
		const terms = this.sessionTerminals.get(sessionId);
		if (terms) {
			terms.push({ terminal, shellIntegrationQuality, id });
		} else {
			this.sessionTerminals.set(sessionId, [{ terminal, shellIntegrationQuality, id }]);
		}
		return Promise.resolve();
	}

	getCopilotTerminals(sessionId: string): Promise<IKnownTerminal[]> {
		return Promise.resolve(this.sessionTerminals.get(sessionId)?.map(t => { return { ...t.terminal, id: t.id }; }) || []);
	}

	getToolTerminalForSession(sessionId: string): Promise<{ terminal: zyraxoncode.Terminal; shellIntegrationQuality: ShellIntegrationQuality } | undefined> {
		return Promise.resolve(this.sessionTerminals.get(sessionId)?.at(0));
	}

	getLastCommandForTerminal(terminal: zyraxoncode.Terminal): zyraxoncode.TerminalExecutedCommand | undefined {
		return undefined;
	}

	get terminalBuffer(): string {
		return this._workspace.terminalBuffer ?? '';
	}
	get terminalLastCommand(): zyraxoncode.TerminalExecutedCommand | undefined {
		return this._workspace.terminalLastCommand;
	}
	get terminalSelection(): string {
		return this._workspace.terminalSelection ?? '';
	}
	get terminalShellType(): string {
		return this._workspace.terminalShellType ?? '';
	}
	getBufferForTerminal(terminal: zyraxoncode.Terminal, maxChars?: number): string {
		return '';
	}
	getBufferWithPid(pid: number, maxChars?: number): Promise<string> {
		throw new Error('Method not implemented.');
	}
	contributePath(contributor: string, pathLocation: string, description?: string | { command: string }): void {
		// No-op for test service
	}
	removePathContribution(contributor: string): void {
		// No-op for test service
	}
}

class SimulationTerminal extends Disposable implements zyraxoncode.Terminal {
	private static NextPID = 0;

	readonly name: string;
	selection: string | undefined;
	readonly processId = Promise.resolve(SimulationTerminal.NextPID++);
	exitStatus: zyraxoncode.TerminalExitStatus | undefined;
	state: zyraxoncode.TerminalState;
	shellIntegration: zyraxoncode.TerminalShellIntegration;

	constructor(
		public readonly creationOptions: zyraxoncode.TerminalOptions,
		workspace: SimulationWorkspace,
		@IInstantiationService private readonly instantiationService: IInstantiationService,
	) {
		super();
		this.name = creationOptions.name ?? '';
		this.state = { isInteractedWith: false, shell: undefined };
		const cwd = creationOptions.cwd ?? workspace.workspaceFolders[0];
		if (typeof cwd === 'string') {
			throw new Error('String cwd not implemented');
		}

		this.shellIntegration = this._register(this.instantiationService.createInstance(SimulationTerminalShellIntegration, cwd, workspace, this));
	}

	sendText(text: string, shouldExecute: boolean = true): void {
		throw new Error('Method not implemented.');
	}

	show(preserveFocus: boolean = true): void {
		// no-op
	}

	hide(): void {
		// no-op
	}
}

class SimulationTerminalShellIntegration extends Disposable implements zyraxoncode.TerminalShellIntegration {
	private readonly _onDidEndTerminalShellExecution = this._register(new Emitter<zyraxoncode.TerminalShellExecutionEndEvent>());
	onDidEndTerminalShellExecution: Event<zyraxoncode.TerminalShellExecutionEndEvent> = this._onDidEndTerminalShellExecution.event;

	constructor(
		public readonly cwd: zyraxoncode.Uri | undefined,
		private readonly workspace: SimulationWorkspace,
		private readonly terminal: SimulationTerminal,
		@IInstantiationService private readonly instantiationService: IInstantiationService,
	) {
		super();
		this.cwd = cwd && workspace.mapLocation(cwd);
	}

	executeCommand(command: string, args?: string[]): zyraxoncode.TerminalShellExecution {
		if (args) {
			command = `${command} ${args.join(' ')}`;
		}

		const exe = this._register(this.instantiationService.createInstance(SimulationTerminalShellExecution, { value: command, confidence: TerminalShellExecutionCommandLineConfidence.High, isTrusted: true }, this.cwd, this.workspace));
		this._register(exe.onDidEndTerminalShellExecution(() => {
			this._onDidEndTerminalShellExecution.fire({ terminal: this.terminal, shellIntegration: this, execution: exe, exitCode: undefined });
		}));
		return exe;
	}
}

class SimulationTerminalShellExecution extends Disposable implements zyraxoncode.TerminalShellExecution {
	private _onDidEndTerminalShellExecution = new Emitter<void>();
	onDidEndTerminalShellExecution: Event<void> = this._onDidEndTerminalShellExecution.event;

	constructor(
		public readonly commandLine: zyraxoncode.TerminalShellExecutionCommandLine,
		public readonly cwd: zyraxoncode.Uri | undefined,
		private readonly workspace: SimulationWorkspace,
		@ILogService private readonly logService: ILogService,
	) {
		super();
	}

	private async run(): Promise<string | undefined> {
		const fakeWorkspacePath = this.workspace.workspaceFolders[0].fsPath.replace(/\/$/, '');
		const realWorkspacePath = this.workspace.mapLocation(this.workspace.workspaceFolders[0]).fsPath.replace(/\/$/, '');
		try {
			let command = this.commandLine.value;
			this.logService.trace(`Original command: ${command}`);
			command = command.replaceAll(fakeWorkspacePath, realWorkspacePath);
			this.logService.trace(`Command with replaced workspace path: ${command}`);

			const execPromise = promisify(exec);
			const execP = execPromise(command, { cwd: this.cwd?.fsPath });
			const result = await raceTimeout(execP, 600_000);
			let output = result ? result.stdout + result.stderr : undefined;
			this.logService.trace(`Done executing command: ${command}`);
			let resultStr;
			try {
				resultStr = !result ? String(result) : JSON.stringify(result);
			} catch (e) {
				resultStr = `cannot stringify result: ${e}. Result: ${result}`;
			}
			this.logService.trace(`Result: ${resultStr}`);
			if (output) {
				this.logService.trace(`Original output: ${output}`);
				output = output.replaceAll(realWorkspacePath, fakeWorkspacePath);
				this.logService.trace(`Output with replaced workspace path: ${output}`);
			}
			return output;
		} catch (e) {
			let msg = '';
			if (e.stdout) {
				msg += e.stdout;
			}
			if (e.stderr) {
				msg += e.stderr;
			}
			if (!msg) {
				msg = e instanceof Error ? e.message : String(e);
			}

			this.logService.trace(`Original error message: ${msg}`);
			msg = msg.replaceAll(realWorkspacePath, fakeWorkspacePath);
			this.logService.trace(`Error message with replaced workspace path: ${msg}`);
			return msg;
		}
	}

	async *read(): AsyncIterable<string> {
		this.logService.trace(`SimulationTerminalShellExecution: read()`);
		const result = await this.run();
		this.logService.trace(`SimulationTerminalShellExecution: result: ${result}`);
		if (result) {
			yield result;
		}
		this.logService.trace(`SimulationTerminalShellExecution: firing end event`);
		this._onDidEndTerminalShellExecution.fire();
	}
}

export class TestingLanguageService implements ILanguageFeaturesService {

	declare readonly _serviceBrand: undefined;

	constructor(private readonly _workspace: SimulationWorkspace) {

	}

	async getWorkspaceSymbols(query: string): Promise<zyraxoncode.SymbolInformation[]> {
		return this._workspace.workspaceSymbols?.filter(s => s.name.includes(query)) ?? [];
	}
	async getDefinitions(uri: zyraxoncode.Uri, position: zyraxoncode.Position): Promise<(zyraxoncode.Location | zyraxoncode.LocationLink)[]> {
		throw new Error('Method not implemented.');
	}
	async getImplementations(uri: zyraxoncode.Uri, position: zyraxoncode.Position): Promise<(zyraxoncode.Location | zyraxoncode.LocationLink)[]> {
		throw new Error('Method not implemented.');
	}
	async getReferences(uri: zyraxoncode.Uri, position: zyraxoncode.Position): Promise<zyraxoncode.Location[]> {
		throw new Error('Method not implemented.');
	}
	async getDocumentSymbols(uri: zyraxoncode.Uri): Promise<zyraxoncode.DocumentSymbol[]> {
		throw new Error('Method not implemented.');
	}
	getDiagnostics(uri: zyraxoncode.Uri): zyraxoncode.Diagnostic[] {
		return [];
	}
}
