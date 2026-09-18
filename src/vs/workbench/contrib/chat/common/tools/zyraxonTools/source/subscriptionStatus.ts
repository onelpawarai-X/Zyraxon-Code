/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IStorageService, StorageScope, StorageTarget } from '../../../../../../platform/storage/common/storage.js';
import { ILogService } from '../../../../../../platform/log/common/log.js';

const TIER_ORDER = ['free', 'pro', 'max', 'ultra'] as const;
type Tier = typeof TIER_ORDER[number];

export interface SubState {
	tier: Tier;
	activatedAt: number | null;
	expiresAt: number | null;
	secretCode: string | null;
	stripeSessionId: string | null;
}

const SUBSCRIPTION_KEY = 'zyraxon.subscription';

const TIER_INFO: Record<Tier, { tools: string; agents: string; memory: string; features: string }> = {
	free: {
		tools: '56 (Core, Math, Science, Finance, Security, Daily Life, Memory, Documents, Tasks)',
		agents: '1',
		memory: 'Basic (100 entries)',
		features: 'File R/W, Shell, Web Search, Glob/Grep, Todo, Math, Science, Finance, Data Science, Security basics, Daily life, Memory, Documents, Skills, Tasks',
	},
	pro: {
		tools: '113 (All Free + Aviation, Ground Vehicles, Drones, Helicopters, ML, Ethics, Creativity)',
		agents: '3',
		memory: 'Pro (500 entries)',
		features: 'Everything in Free + Code Analysis, API Testing, Screen Vision, Self-Evolution, Aviation (25 tools), Ground Vehicles (18), Drones (21), Helicopters (20), ML/Safety (13), Common Sense AI (11), Creativity (5), Multi-Agent',
	},
	max: {
		tools: '370 (All Pro + Space, Medical, Industrial, Infrastructure, Security, Survey, Agriculture, Marine, Construction, IoT, Digital Twin, Dashboard, Remote Control, Decision Support)',
		agents: '8',
		memory: 'Max (2000 entries)',
		features: 'Everything in Pro + Space Systems (22), Medical (9), Industrial (15), Infrastructure (15), Security (15), Survey (14), Agriculture (15), Marine (15), Construction (15), Physical I/O (22), SDR (7), Digital Twin (5), Dashboard (5), Alerts (4), Data Logging (5), Remote Control (6), Maintenance (6), Decision (6), Auth (6), Extended AI (24), Site Creation, GitHub Integration',
	},
	ultra: {
		tools: '500+ (All Max + Ultra Tools, Singularity AI, Guardian System, Unlimited Everything)',
		agents: 'Unlimited',
		memory: 'Ultra (10000 entries)',
		features: 'Everything in Max + Ultra Code Generator, Ultra Security, Ultra Performance, Ultra Refactoring, Ultra Test Gen, Ultra Auto-Deploy, Ultra Code Review, Ultra Quantum, Singularity AI (5), Guardian System (4), Custom Models, Priority Support, Early Access',
	},
};

export function hasAccess(currentTier: Tier, requiredTier: Tier): boolean {
	return TIER_ORDER.indexOf(currentTier) >= TIER_ORDER.indexOf(requiredTier);
}

export function getCurrentTier(storageService: IStorageService): Tier {
	try {
		const raw = storageService.get(SUBSCRIPTION_KEY, StorageScope.PROFILE, '');
		if (!raw) { return 'free'; }
		const data: SubState = JSON.parse(raw);
		if (data.expiresAt && Date.now() > data.expiresAt) { return 'free'; }
		if (TIER_ORDER.includes(data.tier)) { return data.tier; }
	} catch {
		// Ignore
	}
	return 'free';
}

export function getTierInfo(tier: Tier) {
	return TIER_INFO[tier];
}

export function setTier(storageService: IStorageService, tier: Tier, days?: number): void {
	const state: SubState = {
		tier,
		activatedAt: Date.now(),
		expiresAt: days ? Date.now() + days * 24 * 60 * 60 * 1000 : null,
		secretCode: null,
		stripeSessionId: null,
	};
	storageService.store(SUBSCRIPTION_KEY, JSON.stringify(state), StorageScope.PROFILE, StorageTarget.MACHINE);
}
