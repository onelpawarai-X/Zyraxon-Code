/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import { loadEnv } from 'vite';
import wasm from 'vite-plugin-wasm';
import { defineConfig } from 'vitest/config';

const exclude = [
	/* repo specific: */ '**/.simulation/**', '**/.venv/**', '**/fixtures/**', 'chat-lib/**',
	/* default: */ '**/node_modules/**', '**/dist/**', '**/cypress/**', '**/.{idea,git,cache,output,temp}/**', '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build,eslint,prettier}.config.*',
];

// reference __ZYRAXKEEP__0_
export default defineConfig(({ mode }) => ({
	test: {
		include: ['**/*.spec.ts', '**/*.spec.tsx'],
		exclude,
		env: loadEnv(mode, process.cwd(), ''),
		alias: {
			// similar to aliasing in the esbuild config `.esbuild.mts`
			// vitest requires aliases to be absolute paths. reference: __ZYRAXKEEP__1_
			'zyraxoncode': path.resolve(__dirname, 'src/util/common/test/shims/zyraxoncodeTypesShim.ts'),
		}
	},
	server: {
		watch: {
			ignored: exclude,
		}
	},
	oxc: {
		jsx: {
			development: false,
		}
	},
	plugins: [
		wasm()
	]
}));
