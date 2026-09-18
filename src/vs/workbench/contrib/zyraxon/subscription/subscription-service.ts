// ─── Subscription Service — High-Level Access Control ───────────────────────
// Wraps subscription-store with service-level methods for the Zyraxon extension.
// Use this service (not the store directly) from other parts of the codebase.

import {
	type SubscriptionTier,
	type SubscriptionState,
	type SubscriptionPlan,
	SUBSCRIPTION_PLANS,
	TIER_ORDER,
	hasAccess,
	tierLevel,
	getToolRequiredTier,
} from './subscription-types';

import {
	loadSubState,
	activateWithCode,
	activateTier,
	activateTierWithDuration,
	resetToFree,
	canUseTool,
	getDaysRemaining,
	getPlan,
	isActive,
	isPermanentUnlock,
	getCurrentTier,
	openStripeCheckout,
	lockSubscription,
} from './subscription-store';

// ─── Singleton Service ──────────────────────────────────────────────────────

let _instance: SubscriptionService | null = null;

export class SubscriptionService {
	private _state: SubscriptionState;
	private _listeners: Set<(state: SubscriptionState) => void> = new Set();

	private constructor() {
		this._state = loadSubState();
	}

	static getInstance(): SubscriptionService {
		if (!_instance) {
			_instance = new SubscriptionService();
		}
		return _instance;
	}

	// ─── State Accessors ─────────────────────────────────────────────────────

	get tier(): SubscriptionTier {
		return this._state.tier;
	}

	get state(): Readonly<SubscriptionState> {
		return { ...this._state };
	}

	get plan(): SubscriptionPlan {
		return getPlan(this._state);
	}

	get daysRemaining(): number | null {
		return getDaysRemaining(this._state);
	}

	get isExpired(): boolean {
		return !isActive(this._state);
	}

	get isPermanent(): boolean {
		return isPermanentUnlock();
	}

	get tierLevel(): number {
		return tierLevel(this._state.tier);
	}

	// ─── Observer Pattern ────────────────────────────────────────────────────

	onChange(listener: (state: SubscriptionState) => void): () => void {
		this._listeners.add(listener);
		return () => this._listeners.delete(listener);
	}

	private _notify(): void {
		for (const listener of this._listeners) {
			try {
				listener(this._state);
			} catch {
				// Listener threw — don't break other listeners
			}
		}
	}

	// ─── Access Checks ───────────────────────────────────────────────────────

	/**
	 * Check if the current tier can use a specific tool.
	 * This is the primary method other parts of the code should call.
	 */
	canUseTool(toolId: string): boolean {
		return canUseTool(toolId, this._state.tier);
	}

	/**
	 * Check if the current tier meets or exceeds a required tier.
	 */
	hasAccess(requiredTier: SubscriptionTier): boolean {
		return hasAccess(this._state.tier, requiredTier);
	}

	/**
	 * Get the required tier for a specific tool.
	 */
	getToolRequiredTier(toolId: string): SubscriptionTier {
		return getToolRequiredTier(toolId);
	}

	/**
	 * Get all tools available at or below the current tier.
	 */
	getAvailableTools(): string[] {
		const currentLevel = tierLevel(this._state.tier);
		const available: string[] = [];

		// Import TOOL_TIER_MAP dynamically to avoid circular deps
		const { TOOL_TIER_MAP } = require('./subscription-types');
		for (const [toolId, requiredTier] of Object.entries(TOOL_TIER_MAP)) {
			if (tierLevel(requiredTier as SubscriptionTier) <= currentLevel) {
				available.push(toolId);
			}
		}

		return available;
	}

	/**
	 * Get all tools locked behind a higher tier.
	 */
	getLockedTools(): Array<{ toolId: string; requiredTier: SubscriptionTier }> {
		const currentLevel = tierLevel(this._state.tier);
		const locked: Array<{ toolId: string; requiredTier: SubscriptionTier }> = [];

		const { TOOL_TIER_MAP } = require('./subscription-types');
		for (const [toolId, requiredTier] of Object.entries(TOOL_TIER_MAP)) {
			if (tierLevel(requiredTier as SubscriptionTier) > currentLevel) {
				locked.push({ toolId, requiredTier: requiredTier as SubscriptionTier });
			}
		}

		return locked;
	}

	/**
	 * Count how many tools are available vs locked.
	 */
	getToolStats(): { available: number; locked: number; total: number } {
		const currentLevel = tierLevel(this._state.tier);
		let available = 0;
		let locked = 0;

		const { TOOL_TIER_MAP } = require('./subscription-types');
		for (const [, requiredTier] of Object.entries(TOOL_TIER_MAP)) {
			if (tierLevel(requiredTier as SubscriptionTier) <= currentLevel) {
				available++;
			} else {
				locked++;
			}
		}

		return { available, locked, total: available + locked };
	}

	// ─── Tier Upgrade Path ───────────────────────────────────────────────────

	/**
	 * Get the next upgrade tier (if any).
	 */
	getNextTier(): SubscriptionTier | null {
		const currentIdx = TIER_ORDER.indexOf(this._state.tier);
		if (currentIdx < TIER_ORDER.length - 1) {
			return TIER_ORDER[currentIdx + 1];
		}
		return null;
	}

	/**
	 * Get all upgrade options with pricing.
	 */
	getUpgradeOptions(): Array<{ tier: SubscriptionTier; plan: SubscriptionPlan; priceDisplay: string }> {
		const currentIdx = TIER_ORDER.indexOf(this._state.tier);
		const options: Array<{ tier: SubscriptionTier; plan: SubscriptionPlan; priceDisplay: string }> = [];

		for (let i = currentIdx + 1; i < TIER_ORDER.length; i++) {
			const tier = TIER_ORDER[i];
			const plan = SUBSCRIPTION_PLANS[tier];
			options.push({
				tier,
				plan,
				priceDisplay: plan.price === 0 ? 'Free' : `$${plan.price}/mo`,
			});
		}

		return options;
	}

	// ─── Activation ──────────────────────────────────────────────────────────

	/**
	 * Activate a tier using a secret code.
	 * Returns success/failure and the updated state.
	 */
	activateWithCode(code: string): { success: boolean; message: string; state: SubscriptionState } {
		const result = activateWithCode(code);
		if (result.success) {
			this._state = result.state;
			this._notify();
		}
		return result;
	}

	/**
	 * Activate a tier directly (admin/Stripe callback).
	 */
	activateTier(tier: SubscriptionTier): SubscriptionState {
		this._state = activateTier(tier);
		this._notify();
		return this._state;
	}

	/**
	 * Activate a tier with a specific duration (Stripe callback).
	 */
	activateTierWithDuration(tier: SubscriptionTier, durationDays: number): SubscriptionState {
		this._state = activateTierWithDuration(tier, durationDays);
		this._notify();
		return this._state;
	}

	/**
	 * Reset to free tier.
	 */
	resetToFree(): SubscriptionState {
		this._state = resetToFree();
		this._notify();
		return this._state;
	}

	/**
	 * Lock subscription (admin function).
	 */
	lockSubscription(): SubscriptionState {
		this._state = lockSubscription();
		this._notify();
		return this._state;
	}

	// ─── Stripe Integration ──────────────────────────────────────────────────

	/**
	 * Open Stripe Checkout for the current tier upgrade.
	 */
	openCheckout(tier?: SubscriptionTier): void {
		const targetTier = tier || this.getNextTier();
		if (targetTier) {
			openStripeCheckout(targetTier);
		}
	}

	/**
	 * Check if Stripe is ready for payments.
	 */
	isStripeReady(): boolean {
		// TODO: Check for Stripe publishable key
		return false;
	}

	// ─── Display Helpers ─────────────────────────────────────────────────────

	/**
	 * Get a formatted status string for the current subscription.
	 */
	getStatusDisplay(): string {
		const plan = this.plan;
		const parts: string[] = [
			`${plan.name} Tier`,
			`$${plan.price}/mo`,
			`${plan.toolCount} tools`,
		];

		if (this._state.activatedAt) {
			const activatedDate = new Date(this._state.activatedAt).toLocaleDateString();
			parts.push(`Activated: ${activatedDate}`);
		}

		if (this._state.expiresAt) {
			const days = this.daysRemaining;
			if (days !== null && days > 0) {
				parts.push(`${days} days remaining`);
			} else {
				parts.push('EXPIRED');
			}
		} else if (this._state.tier !== 'free') {
			parts.push('Permanent');
		}

		return parts.join(' | ');
	}

	/**
	 * Check if the user needs to upgrade for a specific tool.
	 */
	needsUpgrade(toolId: string): boolean {
		return !this.canUseTool(toolId);
	}

	/**
	 * Get the message shown when a tool is locked.
	 */
	getLockedMessage(toolId: string): string {
		const required = this.getToolRequiredTier(toolId);
		const requiredPlan = SUBSCRIPTION_PLANS[required];
		const currentPlan = this.plan;

		return `🔒 ${toolId} requires ${requiredPlan.name} tier ($${requiredPlan.price}/mo). ` +
			`You're on ${currentPlan.name}. Upgrade to unlock ${requiredPlan.toolCount}+ tools.`;
	}

	/**
	 * Refresh state from storage (call after external changes).
	 */
	refresh(): void {
		this._state = loadSubState();
		this._notify();
	}
}

// ─── Convenience Exports ────────────────────────────────────────────────────

export function getSubscriptionService(): SubscriptionService {
	return SubscriptionService.getInstance();
}

export { SubscriptionService as default };
