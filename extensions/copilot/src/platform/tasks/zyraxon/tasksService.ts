/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/


import * as jsonc from 'jsonc-parser';
import * as zyraxoncode from 'vscode';
import { CancellationToken } from '../../../util/vs/base/common/cancellation';
import { CancellationError } from '../../../util/vs/base/common/errors';
import { DisposableStore } from '../../../util/vs/base/common/lifecycle';
import { equals } from '../../../util/vs/base/common/objects';
import { URI } from '../../../util/vs/base/common/uri';
import { Range } from '../../../util/vs/editor/common/core/range';
import { OffsetLineColumnConverter } from '../../editing/common/offsetLineColumnConverter';
import { IFileSystemService } from '../../filesystem/common/fileSystemService';
import { ILanguageDiagnosticsService } from '../../languages/common/languageDiagnosticsService';
import { ILogService } from '../../log/common/logService';
import { IWorkspaceService } from '../../workspace/common/workspaceService';
import { ITasksService, TaskResult, TaskStatus } from '../common/tasksService';


export class TasksService extends DisposableStore implements ITasksService {
	_serviceBrand: undefined;

	private latestTerminalForTaskDefinition: Map<zyraxoncode.TaskDefinition, zyraxoncode.Terminal> = new Map();
	constructor(
		@IWorkspaceService private readonly workspaceService: IWorkspaceService,
		@IFileSystemService private readonly fileSystemService: IFileSystemService,
		@ILanguageDiagnosticsService private readonly languageDiagnosticsService: ILanguageDiagnosticsService,
		@ILogService private readonly logService: ILogService
	) {
		super();
		this.add(zyraxoncode.tasks.onDidStartTask(e => {
			const terminal: zyraxoncode.Terminal | undefined = (e.execution as unknown as { terminal?: zyraxoncode.Terminal }).terminal;
			if (!terminal) {
				return;
			}
			this.latestTerminalForTaskDefinition.set(e.execution.task.definition, terminal);
			const closeListener = zyraxoncode.window.onDidCloseTerminal(closedTerminal => {
				if (closedTerminal === terminal && this.latestTerminalForTaskDefinition.has(e.execution.task.definition)) {
					this.latestTerminalForTaskDefinition.delete(e.execution.task.definition);
					closeListener.dispose();
				}
			});
			this.add(closeListener);

			const endListener = zyraxoncode.tasks.onDidEndTask(ev => {
				if (ev.execution.task.definition === e.execution.task.definition) {
					closeListener.dispose();
					endListener.dispose();
				}
			});
			this.add(endListener);
		}));
	}

	private getTasksFromConfig(workspaceFolder: URI): zyraxoncode.TaskDefinition[] {
		const tasks = zyraxoncode.workspace.getConfiguration('tasks', workspaceFolder);
		return tasks.get<zyraxoncode.TaskDefinition[]>('tasks') || [];
	}

	private matchesTask(task: zyraxoncode.TaskDefinition, def: zyraxoncode.TaskDefinition): boolean {
		return task.type === def.type && task.label === def.label;
	}

	hasTask(workspaceFolder: URI, def: zyraxoncode.TaskDefinition): boolean {
		const existingTasks = this.getTasksFromConfig(workspaceFolder);
		return existingTasks.some(t => this.matchesTask(t, def));
	}

	/**
	 * This is needed because when tasks exit, they're removed from the taskExecutions, but we might want to review the output of the task
	 * after it has exited. This allows us to get the terminal for a task definition.
	 * @param task
	 */
	getTerminalForTask(taskDefinition: zyraxoncode.TaskDefinition): zyraxoncode.Terminal | undefined {
		for (const [key, terminal] of this.latestTerminalForTaskDefinition.entries()) {
			if (key.id) {
				// Only some task definitions have IDs
				const taskId = this._getTaskId(taskDefinition);
				if (taskId === key.id) {
					return terminal;
				}
			}
			if ((taskDefinition.type === key.type &&
				(key.label || key.script || key.command) &&
				(!key.label || taskDefinition.label === key.label) &&
				(!key.script || taskDefinition.script === key.script) &&
				(!key.command || taskDefinition.command === key.command))) {
				return terminal;
			}
			this.logService.debug(`getTerminalForTask: no terminal found for task definition: ${JSON.stringify(taskDefinition)} matching ${JSON.stringify(key)}`);
			this.logService.debug(`getTerminalForTask: current stored terminals: ${[...this.latestTerminalForTaskDefinition.values()].map(t => t.name).join(', ')}`);
		}
	}
	private _getTaskId(taskDefinition: zyraxoncode.TaskDefinition): string | undefined {
		if (!taskDefinition.type || (taskDefinition.command === undefined && taskDefinition.script === undefined)) {
			return undefined;
		}
		return taskDefinition.type + ',' + (taskDefinition.command ?? taskDefinition.script) + ',';
	}

	async getTaskConfigPosition(workspaceFolder: URI, def: zyraxoncode.TaskDefinition) {
		const index = this.getTasksFromConfig(workspaceFolder).findIndex(t => this.matchesTask(t, def));
		if (index === -1) {
			return undefined;
		}

		const uri = URI.joinPath(workspaceFolder, '.zyraxoncode', 'tasks.json');
		let text: string;
		try {
			const contents = await this.fileSystemService.readFile(uri);
			text = new TextDecoder().decode(contents);
		} catch {
			return undefined;
		}

		const root = jsonc.parseTree(text);
		if (!root) {
			return undefined;
		}

		const node = jsonc.findNodeAtLocation(root, ['tasks', index]);
		if (!node) {
			return undefined;
		}

		const convert = new OffsetLineColumnConverter(text);
		return {
			uri,
			range: Range.fromPositions(
				convert.offsetToPosition(node.offset),
				convert.offsetToPosition(node.offset + node.length),
			),
		};
	}

	async ensureTask(workspaceFolder: URI, def: zyraxoncode.TaskDefinition, skipDefault?: boolean): Promise<void> {
		const existingTasks = this.getTasksFromConfig(workspaceFolder);
		if (existingTasks.some(t => this.matchesTask(t, def))) {
			return;
		}

		const tasks = zyraxoncode.workspace.getConfiguration('tasks', workspaceFolder);
		await tasks.update(
			'tasks',
			skipDefault ? [def] : [...existingTasks, def],
			zyraxoncode.ConfigurationTarget.WorkspaceFolder,
		);
	}

	isTaskActive(task: zyraxoncode.TaskDefinition): boolean {
		const activeTasks = zyraxoncode.tasks.taskExecutions;
		for (const a of activeTasks) {
			if (a.task.definition.type === task.type && a.task.name === task.label) {
				return true;
			}
		}
		return false;
	}

	getTasks(): [URI, zyraxoncode.TaskDefinition[]][];
	getTasks(workspaceFolder: URI): zyraxoncode.TaskDefinition[];
	getTasks(workspaceFolder?: URI): [URI, zyraxoncode.TaskDefinition[]][] | zyraxoncode.TaskDefinition[] {
		if (workspaceFolder) {
			return this.getTasksFromConfig(workspaceFolder);
		}

		return this.workspaceService.getWorkspaceFolders()
			.map((folder): [URI, zyraxoncode.TaskDefinition[]] => [folder, this.getTasksFromConfig(folder)])
			.filter(([, tasks]) => tasks.length > 0);
	}

	private async getBestMatchingContributedTask(def: zyraxoncode.TaskDefinition) {
		const tasks = await zyraxoncode.tasks.fetchTasks({ type: def?.type });

		let best: zyraxoncode.Task | undefined;
		let bestOverlap = -1;
		tasks.forEach(task => {
			let currentOverlap = 0;
			for (const [key, value] of Object.entries(task.definition)) {
				if (!equals(def[key], value)) {
					return;
				}
				currentOverlap++;
			}

			if (currentOverlap > bestOverlap) {
				best = task;
				bestOverlap = currentOverlap;
			}
		});

		return best;
	}

	async executeTask(def: zyraxoncode.TaskDefinition, token: CancellationToken, workspaceFolder?: URI): Promise<TaskResult> {
		const disposables = new DisposableStore();

		try {
			// todo@connor4312: is this really the best way to run a task definition?
			let task = await this.getBestMatchingContributedTask(def);

			if (token.isCancellationRequested) {
				throw new CancellationError();
			}

			return await new Promise<TaskResult>((resolve) => {
				let processExitCode: number | undefined;

				disposables.add(zyraxoncode.tasks.onDidEndTaskProcess(e => {
					if (e.execution.task === task) {
						processExitCode = e.exitCode;
					}
				}));

				disposables.add(zyraxoncode.tasks.onDidEndTask(e => {
					if (e.execution.task === task) {
						if (processExitCode !== undefined && processExitCode !== 0) {
							resolve({ status: TaskStatus.Error, error: new Error(`Task exited with code ${processExitCode}`) });
						} else {
							resolve({ status: TaskStatus.Finished });
						}
					}
				}));

				let adopted = false;
				let execution: zyraxoncode.TaskExecution | undefined;

				function cancel() {
					resolve({ status: TaskStatus.Error, error: new CancellationError() });
					if (!adopted && execution) {
						execution.terminate(); // Only cancel non-background tasks that we started
					}
				}

				if (!def.isBackground) {
					disposables.add(token.onCancellationRequested(cancel));
				}

				if (task) {
					const existing = zyraxoncode.tasks.taskExecutions.find(e => equals(e.task.definition, task!.definition));
					adopted = !!existing;

					Promise.resolve(existing || zyraxoncode.tasks.executeTask(task)).then(_execution => {
						execution = _execution;
						if (token.isCancellationRequested) {
							cancel();
						} else if (task!.isBackground) {
							let resolved = false;
							disposables.add(zyraxoncode.tasks.onDidEndTaskProblemMatchers(async (e) => {
								resolved = true;
								if (e.execution.task === task) {
									if (e.hasErrors) {
										let diagnostics: string[] = [];
										if (workspaceFolder) {
											diagnostics = this.languageDiagnosticsService.getAllDiagnostics().map(d => d[0] + ' ' + d[1].map(d => d.message).join(', '));
										}
										resolve({ status: TaskStatus.Error, error: new Error('Task exited with errors in the following files: ' + diagnostics.join(', ')) });
									} else {
										resolve({ status: TaskStatus.Finished });
									}
								}
							}));
							setTimeout(() => {
								if (!resolved) {
									resolve({ status: TaskStatus.Started });
								}
							}, task?.isBackground && task.problemMatchers.length ? 10000 : 0);
						} else {
							resolve({ status: TaskStatus.Started });
						}
					}, (error: Error) => resolve({ status: TaskStatus.Error, error }));
				} else {
					// No provided task found? Try to run by label or definition
					// assume whatever task is next is the one that's started
					zyraxoncode.commands.executeCommand('workbench.action.tasks.runTask', def.label || def);
					disposables.add(zyraxoncode.tasks.onDidStartTask(e => {
						task = e.execution.task;
						resolve({ status: TaskStatus.Started });
					}));
					disposables.add(zyraxoncode.tasks.onDidEndTask(e => {
						if (e.execution.task.name === def.label) {
							if (processExitCode !== undefined && processExitCode !== 0) {
								resolve({ status: TaskStatus.Error, error: new Error(`Task exited with code ${processExitCode}`) });
							} else {
								resolve({ status: TaskStatus.Finished });
							}
						}
					}));
				}
			});
		} finally {
			disposables.dispose();
		}
	}
}