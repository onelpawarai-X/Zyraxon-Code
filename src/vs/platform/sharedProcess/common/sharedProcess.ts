/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export const SharedProcessLifecycle = {
	exit: 'zyraxoncode:electron-main->shared-process=exit',
	ipcReady: 'zyraxoncode:shared-process->electron-main=ipc-ready',
	initDone: 'zyraxoncode:shared-process->electron-main=init-done'
};

export const SharedProcessChannelConnection = {
	request: 'zyraxoncode:createSharedProcessChannelConnection',
	response: 'zyraxoncode:createSharedProcessChannelConnectionResult'
};

export const SharedProcessRawConnection = {
	request: 'zyraxoncode:createSharedProcessRawConnection',
	response: 'zyraxoncode:createSharedProcessRawConnectionResult'
};
