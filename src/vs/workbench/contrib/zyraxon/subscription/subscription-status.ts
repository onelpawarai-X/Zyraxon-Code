// ─── Subscription Status Tool ───────────────────────────────────────────────
// Provides a tool/function that returns the user's current subscription status,
// available tiers, and upgrade information. Used by the AI assistant and UI.

import {
	type SubscriptionTier,
	type SubscriptionPlan,
	SUBSCRIPTION_PLANS,
	TIER_ORDER,
	TIER_STATS,
} from './subscription-types';

import {
	loadSubState,
	activateWithCode,
	getDaysRemaining,
	getPlan,
	isActive,
	isPermanentUnlock,
	getCurrentTier,
} from './subscription-store';

import { SubscriptionService, getSubscriptionService } from './subscription-service';

// ─── Status Response Types ──────────────────────────────────────────────────

export interface TierInfo {
	id: SubscriptionTier;
	name: string;
	price: number;
	priceDisplay: string;
	description: string;
	featureCount: number;
	toolCount: number;
	maxAgents: string;
	isCurrentTier: boolean;
	isUpgrade: boolean;
}

export interface SubscriptionStatusResponse {
	current: {
		tier: SubscriptionTier;
		tierName: string;
		toolCount: number;
		maxAgents: string;
		price: number;
		activatedAt: number | null;
		expiresAt: number | null;
		daysRemaining: number | null;
		isPermanent: boolean;
		isActive: boolean;
		statusDisplay: string;
	};
	tiers: TierInfo[];
	upgradePath: SubscriptionTier[];
	tools: {
		available: number;
		locked: number;
		total: number;
	};
	activation: {
		secretCodeRequired: boolean;
		prefixes: string[];
		knownCodes: string[];
	};
	message: string;
}

// ─── Build Full Status ──────────────────────────────────────────────────────

export function buildSubscriptionStatus(): SubscriptionStatusResponse {
	const service = getSubscriptionService();
	const state = service.state;
	const currentPlan = service.plan;
	const currentTier = state.tier;

	// Build tier list
	const tiers: TierInfo[] = TIER_ORDER.map((tierId) => {
		const plan = SUBSCRIPTION_PLANS[tierId];
		const stats = TIER_STATS[tierId];
		return {
			id: tierId,
			name: plan.name,
			price: plan.price,
			priceDisplay: plan.price === 0 ? 'Free' : `$${plan.price}/mo`,
			description: plan.description,
			featureCount: plan.features.length,
			toolCount: stats?.totalTools || plan.toolCount,
			maxAgents: plan.maxAgents === -1 ? 'Unlimited' : String(plan.maxAgents),
			isCurrentTier: tierId === currentTier,
			isUpgrade: TIER_ORDER.indexOf(tierId) > TIER_ORDER.indexOf(currentTier),
		};
	});

	// Build upgrade path
	const upgradePath: SubscriptionTier[] = [];
	const currentIdx = TIER_ORDER.indexOf(currentTier);
	for (let i = currentIdx + 1; i < TIER_ORDER.length; i++) {
		upgradePath.push(TIER_ORDER[i]);
	}

	// Tool stats
	const toolStats = service.getToolStats();

	// Build response
	return {
		current: {
			tier: currentTier,
			tierName: currentPlan.name,
			toolCount: currentPlan.toolCount,
			maxAgents: currentPlan.maxAgents === -1 ? 'Unlimited' : String(currentPlan.maxAgents),
			price: currentPlan.price,
			activatedAt: state.activatedAt,
			expiresAt: state.expiresAt,
			daysRemaining: service.daysRemaining,
			isPermanent: service.isPermanent,
			isActive: !service.isExpired,
			statusDisplay: service.getStatusDisplay(),
		},
		tiers,
		upgradePath,
		tools: toolStats,
		activation: {
			secretCodeRequired: true,
			prefixes: ['ZYRAXON-PRO-*', 'ZYRAXON-MAX-*', 'ZYRAXON-ULTRA-*'],
			knownCodes: [
				'ZYRAXON-PRO-2026',
				'ZYRAXON-PRO-YEAR',
				'ZYRAXON-MAX-2026',
				'ZYRAXON-MAX-YEAR',
				'ZYRAXON-ULTRA-2026',
				'ZYRAXON-ULTRA-FULL',
				'ZYRAXON-DEV-TEST',
				'ZYRAXON-FOUNDER',
			],
		},
		message: buildStatusMessage(currentTier, state, toolStats),
	};
}

// ─── Status Message Builder ─────────────────────────────────────────────────

function buildStatusMessage(
	tier: SubscriptionTier,
	state: { activatedAt: number | null; expiresAt: number | null },
	toolStats: { available: number; locked: number; total: number }
): string {
	const plan = SUBSCRIPTION_PLANS[tier];
	const lines: string[] = [];

	lines.push(`Tier: ${plan.name} ($${plan.price}/mo)`);
	lines.push(`Tools: ${toolStats.available} available / ${toolStats.locked} locked`);

	if (tier === 'free') {
		const nextTier = SUBSCRIPTION_PLANS.pro;
		lines.push(`\nUpgrade to Pro ($${nextTier.price}/mo) for ${nextTier.toolCount}+ tools.`);
		lines.push(`Use code ZYRAXON-PRO-2026 for instant activation.`);
	} else if (state.expiresAt) {
		const days = getDaysRemaining({ tier, expiresAt: state.expiresAt, activatedAt: state.activatedAt, secretCode: null, stripeSessionId: null });
		if (days !== null && days > 0) {
			lines.push(`Expires in ${days} days.`);
		} else {
			lines.push(`Subscription expired. Renew or use a new code.`);
		}
	} else if (state.activatedAt) {
		lines.push(`Permanent unlock. No expiration.`);
	}

	if (tier !== 'ultra') {
		const nextTier = TIER_ORDER[TIER_ORDER.indexOf(tier) + 1];
		const nextPlan = SUBSCRIPTION_PLANS[nextTier];
		lines.push(`\nNext tier: ${nextPlan.name} ($${nextPlan.price}/mo)`);
	}

	return lines.join('\n');
}

// ─── Tool Status Check ──────────────────────────────────────────────────────

export interface ToolAccessResult {
	toolId: string;
	accessible: boolean;
	requiredTier: SubscriptionTier;
	currentTier: SubscriptionTier;
	message: string;
}

export function checkToolAccess(toolId: string): ToolAccessResult {
	const service = getSubscriptionService();
	const required = service.getToolRequiredTier(toolId);
	const accessible = service.canUseTool(toolId);

	let message: string;
	if (accessible) {
		message = `✓ ${toolId} is available on ${SUBSCRIPTION_PLANS[service.tier].name} tier.`;
	} else {
		const requiredPlan = SUBSCRIPTION_PLANS[required];
		message = `🔒 ${toolId} requires ${requiredPlan.name} tier ($${requiredPlan.price}/mo). ` +
			`Upgrade with code: ZYRAXON-${required.toUpperCase()}-2026`;
	}

	return {
		toolId,
		accessible,
		requiredTier: required,
		currentTier: service.tier,
		message,
	};
}

// ─── Tier Comparison ────────────────────────────────────────────────────────

export interface TierComparison {
	currentTier: SubscriptionTier;
	tiers: Array<{
		tier: SubscriptionTier;
		name: string;
		features: readonly string[];
		unlocksTools: number;
		unlocksCategories: string[];
	}>;
}

export function compareTiers(): TierComparison {
	const current = getCurrentTier();
	const currentLevel = TIER_ORDER.indexOf(current);

	return {
		currentTier: current,
		tiers: TIER_ORDER.map((tierId) => {
			const plan = SUBSCRIPTION_PLANS[tierId];
			const stats = TIER_STATS[tierId];

			// Count tools that THIS tier unlocks (not lower tiers)
			const levelIdx = TIER_ORDER.indexOf(tierId);
			let unlocksTools = 0;
			const unlocksCategories: string[] = [];

			if (stats) {
				unlocksTools = stats.totalTools;
				unlocksCategories.push(...(stats.categories as string[]));
			}

			return {
				tier: tierId,
				name: plan.name,
				features: plan.features,
				unlocksTools,
				unlocksCategories,
			};
		}),
	};
}

// ─── Activation Helper ──────────────────────────────────────────────────────

export interface ActivationResult {
	success: boolean;
	message: string;
	tier: SubscriptionTier;
	tierName: string;
}

export function activateCode(code: string): ActivationResult {
	const service = getSubscriptionService();
	const result = service.activateWithCode(code);

	if (result.success) {
		const plan = SUBSCRIPTION_PLANS[result.state.tier];
		return {
			success: true,
			message: result.message,
			tier: result.state.tier,
			tierName: plan.name,
		};
	}

	return {
		success: false,
		message: result.message,
		tier: 'free',
		tierName: 'Free',
	};
}

// ─── Status as Formatted String ─────────────────────────────────────────────

export function formatStatusAsText(): string {
	const status = buildSubscriptionStatus();
	const lines: string[] = [];

	lines.push('═══════════════════════════════════════════');
	lines.push('         ZYRAXON SUBSCRIPTION STATUS');
	lines.push('═══════════════════════════════════════════');
	lines.push('');
	lines.push(`Current Tier: ${status.current.tierName}`);
	lines.push(`Price: $${status.current.price}/mo`);
	lines.push(`Tools: ${status.tools.available} available / ${status.tools.locked} locked / ${status.tools.total} total`);
	lines.push(`Max Agents: ${status.current.maxAgents}`);

	if (status.current.isPermanent) {
		lines.push(`Status: Permanent unlock`);
	} else if (status.current.expiresAt && status.current.daysRemaining !== null) {
		lines.push(`Expires: ${status.current.daysRemaining} days remaining`);
	} else {
		lines.push(`Status: Free tier`);
	}

	lines.push('');
	lines.push('───────────────────────────────────────────');
	lines.push('Available Tiers:');
	lines.push('');

	for (const tier of status.tiers) {
		const marker = tier.isCurrentTier ? ' ← YOU' : tier.isUpgrade ? ' ← UPGRADE' : '';
		lines.push(`  ${tier.name.padEnd(8)} ${tier.priceDisplay.padEnd(10)} ${tier.toolCount} tools${marker}`);
	}

	lines.push('');
	lines.push('───────────────────────────────────────────');
	lines.push('Activation Codes:');
	lines.push('  Prefix: ZYRAXON-PRO-*, ZYRAXON-MAX-*, ZYRAXON-ULTRA-*');
	lines.push('  Or use: ZYRAXON-FOUNDER, ZYRAXON-DEV-TEST');
	lines.push('');
	lines.push('═══════════════════════════════════════════');

	return lines.join('\n');
}

// ─── Re-exports ─────────────────────────────────────────────────────────────

export {
	buildSubscriptionStatus as getStatus,
	checkToolAccess as checkAccess,
	compareTiers as compare,
	activateCode as activate,
	formatStatusAsText as format,
};
