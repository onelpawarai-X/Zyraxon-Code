/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/


import type * as zyraxoncode from 'zyraxoncode';
import { URI } from '../../../util/vs/base/common/uri';
import { ITasksService, TaskResult, TaskStatus } from './tasksService';

export class TestTasksService implements ITasksService {
	_serviceBrand: undefined;

	async ensureTask(): Promise<void> {
		// No-op for stub
	}

	hasTask(): boolean {
		return false;
	}

	getTasks(): [] {
		return [];
	}

	getTaskConfigPosition() {
		return Promise.resolve(undefined);
	}

	async executeTask(def: zyraxoncode.TaskDefinition, token: zyraxoncode.CancellationToken, workspaceFolder?: URI): Promise<TaskResult> {
		return {
			status: TaskStatus.Error,
			error: new Error(`Task not found: ${def.type}:${def.label}`)
		};
	}

	isTaskActive(def: zyraxoncode.TaskDefinition): boolean {
		return false;
	}

	getTerminalForTask(task: zyraxoncode.TaskDefinition): zyraxoncode.Terminal | undefined {
		// Return a mock terminal with a defined processId for testing
		return {
			name: task.label || 'mock-terminal',
			processId: Promise.resolve(12345),
			// Add any other properties/methods as needed for your tests
		} as unknown as zyraxoncode.Terminal;
	}
}
