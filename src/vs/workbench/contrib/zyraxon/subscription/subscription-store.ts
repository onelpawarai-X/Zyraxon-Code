// ─── Subscription Store — Persistence Layer ─────────────────────────────────
// Manages reading/writing subscription state via localStorage (web) or
// Electron IPC (desktop). Handles expiration, tier activation, and code redemption.

import {
	type SubscriptionTier,
	type SubscriptionState,
	SUBSCRIPTION_PLANS,
	TIER_ORDER,
	hasAccess,
	validateSecretCode,
	getToolRequiredTier,
} from './subscription-types';

const STORAGE_KEY = 'zyraxon-subscription';
const ADMIN_AUTH_KEY = 'zyraxon-admin-auth';

// ─── Electron IPC bridge (when running in desktop shell) ───────────────────

function syncToFile(state: SubscriptionState): void {
	try {
		const detail = JSON.stringify(state);
		if (typeof globalThis !== 'undefined' && (globalThis as any).electronAPI?.setSubscriptionState) {
			(globalThis as any).electronAPI.setSubscriptionState(detail);
		}
	} catch {
		// Silently ignore — localStorage is the source of truth
	}
}

// ─── Default free state ────────────────────────────────────────────────────

const FREE_STATE: SubscriptionState = {
	tier: 'free',
	activatedAt: null,
	expiresAt: null,
	secretCode: null,
	stripeSessionId: null,
};

// ─── Load / Save ───────────────────────────────────────────────────────────

export function loadSubState(): SubscriptionState {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) {
			return { ...FREE_STATE };
		}
		const parsed = JSON.parse(raw) as SubscriptionState;

		// Auto-expire paid tiers
		if (parsed.expiresAt && Date.now() > parsed.expiresAt) {
			localStorage.removeItem(STORAGE_KEY);
			return { ...FREE_STATE };
		}
		return parsed;
	} catch {
		return { ...FREE_STATE };
	}
}

function saveSubState(state: SubscriptionState): void {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
		syncToFile(state);
	} catch {
		// Storage full or unavailable — degrade gracefully
	}
}

// ─── Activation ────────────────────────────────────────────────────────────

/**
 * Activate a tier using a secret code (e.g. ZYRAXON-PRO-2026).
 * Returns success/failure and the updated state.
 */
export function activateWithCode(code: string): { success: boolean; message: string; state: SubscriptionState } {
	const result = validateSecretCode(code);
	if (!result) {
		return { success: false, message: 'Invalid activation code', state: loadSubState() };
	}

	const now = Date.now();
	const expiresAt = result.durationDays
		? now + result.durationDays * 24 * 60 * 60 * 1000
		: null;

	const newState: SubscriptionState = {
		tier: result.tier,
		activatedAt: now,
		expiresAt,
		secretCode: code.trim().toUpperCase(),
		stripeSessionId: null,
	};

	saveSubState(newState);
	return {
		success: true,
		message: `${SUBSCRIPTION_PLANS[result.tier].name} activated permanently!`,
		state: newState,
	};
}

/**
 * Activate a tier directly (admin / Stripe callback).
 */
export function activateTier(tier: SubscriptionTier): SubscriptionState {
	const newState: SubscriptionState = {
		tier,
		activatedAt: Date.now(),
		expiresAt: null,
		secretCode: null,
		stripeSessionId: null,
	};
	saveSubState(newState);
	return newState;
}

/**
 * Activate a tier with a specific duration (used by Stripe after payment).
 */
export function activateTierWithDuration(tier: SubscriptionTier, durationDays: number): SubscriptionState {
	const now = Date.now();
	const newState: SubscriptionState = {
		tier,
		activatedAt: now,
		expiresAt: now + durationDays * 24 * 60 * 60 * 1000,
		secretCode: null,
		stripeSessionId: `stripe_${now}`,
	};
	saveSubState(newState);
	return newState;
}

/**
 * Reset subscription back to free tier.
 */
export function resetToFree(): SubscriptionState {
	localStorage.removeItem(STORAGE_KEY);
	localStorage.removeItem(ADMIN_AUTH_KEY);
	return { ...FREE_STATE };
}

// ─── Tool Access Check ─────────────────────────────────────────────────────

/**
 * Check if the current tier can use a specific tool.
 */
export function canUseTool(toolId: string, currentTier: SubscriptionTier): boolean {
	const required = getToolRequiredTier(toolId);
	return hasAccess(currentTier, required);
}

// ─── Utility Functions ─────────────────────────────────────────────────────

export function getDaysRemaining(state: SubscriptionState): number | null {
	if (!state.expiresAt) {
		return null;
	}
	const diff = state.expiresAt - Date.now();
	return Math.max(0, Math.ceil(diff / (24 * 60 * 60 * 1000)));
}

export function getPlan(state: SubscriptionState) {
	return SUBSCRIPTION_PLANS[state.tier];
}

export function isActive(state: SubscriptionState): boolean {
	if (state.tier === 'free') {
		return true;
	}
	if (!state.expiresAt) {
		return true;
	}
	return Date.now() < state.expiresAt;
}

export function isPermanentUnlock(): boolean {
	const state = loadSubState();
	return state.tier !== 'free' && state.expiresAt === null;
}

export function getCurrentTier(): SubscriptionTier {
	return loadSubState().tier;
}

// ─── Stripe Integration ────────────────────────────────────────────────────

/**
 * Open Stripe Checkout for a given tier.
 * This is a scaffold — replace the URL with your actual Stripe Checkout Session URL.
 */
export function openStripeCheckout(tier: SubscriptionTier): void {
	const plan = SUBSCRIPTION_PLANS[tier];
	// TODO: Replace with your Stripe Checkout Session creation endpoint
	// POST /api/stripe/create-session { tier: plan.id, price: plan.price, duration: plan.durationDays }
	const stripeUrl = `https://checkout.stripe.com/pay/${plan.name.toUpperCase()}-${plan.price}`;
	globalThis.open?.(stripeUrl, '_blank');
}

/**
 * Check if Stripe is configured (publishable key present).
 */
export function isStripeReady(): boolean {
	// In a real app, check for VITE_STRIPE_PUBLISHABLE_KEY or similar
	return false; // Scaffold — not yet wired
}

// ─── Admin Lock / Unlock ───────────────────────────────────────────────────

/**
 * Lock subscription back to free (admin function).
 */
export function lockSubscription(): SubscriptionState {
	const current = loadSubState();
	const lockedState: SubscriptionState = {
		tier: 'free',
		activatedAt: current.activatedAt,
		expiresAt: null,
		secretCode: current.secretCode,
		stripeSessionId: null,
	};
	saveSubState(lockedState);
	return lockedState;
}

export function isAdminUnlocked(): boolean {
	try {
		return localStorage.getItem(ADMIN_AUTH_KEY) === 'true';
	} catch {
		return false;
	}
}

export function setAdminUnlocked(val: boolean): void {
	if (val) {
		localStorage.setItem(ADMIN_AUTH_KEY, 'true');
	} else {
		localStorage.removeItem(ADMIN_AUTH_KEY);
	}
}

// ─── Re-exports ────────────────────────────────────────────────────────────

export { TIER_ORDER, SUBSCRIPTION_PLANS, hasAccess };
export type { SubscriptionTier, SubscriptionState };
