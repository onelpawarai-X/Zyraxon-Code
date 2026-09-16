/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type * as zyraxoncode from 'vscode';
import { createServiceIdentifier } from '../../../util/common/services';

export const ITestProvider = createServiceIdentifier<ITestProvider>('ITestProvider');

export interface ITestFailure {
	snapshot: zyraxoncode.TestResultSnapshot;
	task: zyraxoncode.TestSnapshotTaskState;
}

export interface ITestProvider {
	readonly _serviceBrand: undefined;

	/** Millisecond timestamp when the last results, if any, were added. */
	readonly lastResultsFrom?: number;

	/** Fired when test results change. */
	readonly onDidChangeResults: zyraxoncode.Event<void>;

	/** Gets all test failures from the last result. */
	getAllFailures(): Iterable<ITestFailure>;

	/** Gets the last failure the given test item had. */
	getLastFailureFor(testItem: zyraxoncode.TestItem): ITestFailure | undefined;

	/** Gets a test at a position. */
	getFailureAtPosition(uri: zyraxoncode.Uri, position: zyraxoncode.Position): ITestFailure | undefined;

	/** Gets tests in the given URI */
	hasTestsInUri(uri: zyraxoncode.Uri): Promise<boolean>;

	/** Gets whether there's any test controller that has found tests in the workspace. */
	hasAnyTests(): Promise<boolean>;
}
