#!/usr/bin/env bash

if [ $# -eq 0 ]; then
	echo "Pass in a version like ./scripts/generate-zyraxoncode-dts.sh 1.30."
	echo "Failed to generate index.d.ts."
	exit 1
fi

header="// Type definitions for ZYRAXON Code ${1}
// Project: __ZYRAXKEEP__0_
// Definitions by: ZYRAXON Code Team, Zyraxon <__ZYRAXKEEP__1_>
// Definitions: __ZYRAXKEEP__2_

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License.
 *  See __ZYRAXKEEP__3_ for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Type Definition for ZYRAXON Code ${1} Extension API
 * See __ZYRAXKEEP__4_ for more information
 */"

if [ -f ./src/zyraxoncode-dts/zyraxoncode.d.ts ]; then
	echo "$header" > index.d.ts
	sed "1,4d" ./src/zyraxoncode-dts/zyraxoncode.d.ts >> index.d.ts
	echo "Generated index.d.ts for version ${1}."
else
	echo "Can't find ./src/zyraxoncode-dts/zyraxoncode.d.ts. Run this script at zyraxon root."
fi
