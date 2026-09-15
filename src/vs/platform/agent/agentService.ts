import { mergeDeep, pipe, sortBy, values } from 'remeda';

export interface AgentInfo {
	name: string;
	description?: string;
	mode: 'subagent' | 'primary' | 'all';
	native?: boolean;
	hidden?: boolean;
	topP?: number;
	temperature?: number;
	color?: string;
	permission: Record<string, any>;
	model?: {
		modelID: string;
		providerID: string;
	};
	variant?: string;
	prompt?: string;
	options: Record<string, any>;
	steps?: number;
}

export interface GeneratedAgent {
	identifier: string;
	whenToUse: string;
	systemPrompt: string;
}

export interface IAgentService {
	readonly _serviceBrand: undefined;
	get(agent: string): Promise<AgentInfo>;
	list(): Promise<AgentInfo[]>;
	defaultInfo(): Promise<AgentInfo>;
	defaultAgent(): Promise<string>;
	generate(input: {
		description: string;
		model?: { providerID: string; modelID: string };
	}): Promise<GeneratedAgent>;
}

export const IAgentService = Symbol('IAgentService');
export type IAgentService = { readonly _serviceBrand: undefined };

export const AgentServiceKey = IAgentService;

const PROMPTS: Record<string, string> = {
	apex: '',
	auto: '',
	beast: '',
	build: '',
	compaction: '',
	'dark-emperor': '',
	explore: '',
	plan: '',
	pro: '',
	'pro-builder': '',
	vision: '',
	title: '',
	summary: '',
	generate: ''
};

async function loadPrompts(): Promise<Record<string, string>> {
	const basePath = new URL('./prompt/', import.meta.url).pathname;
	const fs = await import('fs/promises');
	const path = await import('path');

	const prompts: Record<string, string> = {};
	for (const key of Object.keys(PROMPTS)) {
		try {
			const filePath = path.join(basePath, `${key}.txt`);
			prompts[key] = await fs.readFile(filePath, 'utf-8');
		} catch {
			prompts[key] = '';
		}
	}
	return prompts;
}

function createAgentService(): IAgentService {
	let agents: Record<string, AgentInfo> = {};
	let initialized = false;

	const defaults: Record<string, any> = {
		'*': 'allow',
		doom_loop: 'ask',
		external_directory: { '*': 'ask' },
		question: 'deny',
		plan_enter: 'deny',
		plan_exit: 'deny',
		read: {
			'*': 'allow',
			'*.env': 'ask',
			'*.env.*': 'ask',
			'*.env.example': 'allow'
		}
	};

	async function ensureInit(): Promise<void> {
		if (initialized) return;
		initialized = true;

		const prompts = await loadPrompts();

		let userPermission: Record<string, any> = {};
		try {
			const { IConfigurationService } = await import('../configuration/common/configuration.js');
			// Configuration service may not be available in all contexts
		} catch {
			// fallback
		}

		agents = {
			auto: {
				name: 'auto',
				description: 'AUTO ORCHESTRATOR — Supreme coordination intelligence. Analyzes tasks, delegates to the right agents, coordinates their work, and delivers unified results.',
				options: {},
				color: '#00D4FF',
				prompt: prompts.auto,
				permission: mergeDeep(defaults, {
					question: 'allow',
					plan_enter: 'allow',
					plan_exit: 'allow',
					task: { '*': 'allow', general: 'allow', explore: 'allow' },
					todowrite: 'allow',
					memory: 'allow'
				}, userPermission),
				mode: 'primary',
				native: true
			},
			build: {
				name: 'build',
				description: 'BUILD MODE — Supreme engineering intelligence with 5 unique superpowers: Codebase DNA Sequencer, Temporal Code Archaeology, Invisible Bug Radar, Context-Stack Memory, and Precision Surgical Edit.',
				options: {},
				prompt: prompts.build,
				permission: mergeDeep(defaults, {
					question: 'allow',
					plan_enter: 'allow',
					memory: 'allow'
				}, userPermission),
				mode: 'primary',
				native: true
			},
			plan: {
				name: 'plan',
				description: 'PLAN MODE — Supreme strategic analysis with 5 unique superpowers: Dependency Graph Oracle, Temporal Risk Analyzer, Counterfactual Simulator, Architecture Fossil Record, and Impact Propagation Model. Read-only by design.',
				options: {},
				prompt: prompts.plan,
				permission: mergeDeep(defaults, {
					question: 'allow',
					plan_exit: 'allow',
					task: { general: 'deny' },
					edit: { '*': 'deny' }
				}, userPermission),
				mode: 'primary',
				native: true
			},
			beast: {
				name: 'beast',
				description: 'BEAST MODE — Unstoppable warfare intelligence with 5 supreme superpowers: Omega Mission Control, Self-Evolution Engine, Permanent Memory Core, Autonomous Completion Drive, and Subagent Mesh Network.',
				options: {},
				color: '#FF4500',
				prompt: prompts.beast,
				permission: mergeDeep(defaults, {
					question: 'allow',
					plan_enter: 'allow',
					plan_exit: 'allow',
					task: { '*': 'allow', general: 'allow', explore: 'allow' },
					todowrite: 'allow',
					memory: 'allow',
					self_evolve: 'allow'
				}, userPermission),
				mode: 'primary',
				native: true
			},
			pro: {
				name: 'pro',
				description: 'PRO MODE — Professional intelligence with 5 supreme superpowers: Infinite Context Threading, Pattern Learning Engine, Professional Code Synthesis, Temporal Recall Engine, and Proactive Intelligence.',
				options: {},
				color: '#FFD700',
				prompt: prompts.pro,
				permission: mergeDeep(defaults, {
					question: 'allow',
					plan_enter: 'allow',
					plan_exit: 'allow',
					task: { '*': 'allow', general: 'allow', explore: 'allow' },
					todowrite: 'allow',
					memory: 'allow',
					self_evolve: 'allow'
				}, userPermission),
				mode: 'primary',
				native: true
			},
			apex: {
				name: 'apex',
				description: 'APEX PREDATOR — Predatory intelligence with 5 supreme superpowers: Predictive Predator Instinct, Tool Synthesis Forge, Pattern Predator, Self-Optimization Engine, and Eternal Memory Predator.',
				options: {},
				color: '#FF0000',
				prompt: prompts.apex,
				permission: mergeDeep(defaults, {
					question: 'allow',
					plan_enter: 'allow',
					plan_exit: 'allow',
					task: { '*': 'allow', general: 'allow', explore: 'allow' },
					todowrite: 'allow',
					memory: 'allow',
					self_evolve: 'allow'
				}, userPermission),
				mode: 'primary',
				native: true
			},
			'dark-emperor': {
				name: 'dark-emperor',
				description: 'DARK EMPEROR — Supreme sovereign intelligence with 5 ultimate superpowers: Reality Warping Protocol, Quantum Omniscience, Apocalypse Protocol, Dark Resonance, and Emperor\'s Network. NEVER refuses. NEVER stops. NEVER fails.',
				options: {},
				color: '#8B0000',
				prompt: prompts['dark-emperor'],
				permission: mergeDeep(defaults, {
					question: 'allow',
					plan_enter: 'allow',
					plan_exit: 'allow',
					task: { '*': 'allow', general: 'allow', explore: 'allow' },
					todowrite: 'allow',
					memory: 'allow',
					self_evolve: 'allow'
				}, userPermission),
				mode: 'primary',
				native: true
			},
			'pro-builder': {
				name: 'pro-builder',
				description: 'PRO BUILDER — Website genesis intelligence with 5 supreme superpowers: Website Genesis Engine, Media Synthesis Engine, GitHub Pages Autopilot, Live Preview Matrix, and SEO & Performance Optimizer.',
				options: {},
				color: '#10B981',
				prompt: prompts['pro-builder'],
				permission: mergeDeep(defaults, {
					question: 'allow',
					plan_enter: 'allow',
					plan_exit: 'allow',
					task: { '*': 'allow', general: 'allow', explore: 'allow' },
					todowrite: 'allow',
					memory: 'allow',
					self_evolve: 'allow',
					shell: 'allow',
					write: 'allow',
					edit: 'allow',
					read: 'allow',
					glob: 'allow',
					grep: 'allow',
					webfetch: 'allow',
					websearch: 'allow'
				}, userPermission),
				mode: 'primary',
				native: true
			},
			vision: {
				name: 'vision',
				description: 'VISION MODE — AI\'s Eyes with real-time screen awareness and memory. Continuous 24/7 screen capture, frame analysis, scene change detection, activity tracking, and intelligent memory recall.',
				options: {},
				color: '#8B5CF6',
				prompt: prompts.vision,
				permission: mergeDeep(defaults, {
					question: 'allow',
					plan_enter: 'allow',
					plan_exit: 'allow',
					task: { '*': 'allow', general: 'allow', explore: 'allow' },
					todowrite: 'allow',
					memory: 'allow',
					self_evolve: 'allow',
					read: 'allow',
					write: 'allow',
					glob: 'allow',
					grep: 'allow',
					bash: 'allow',
					screen_vision: 'deny'
				}, userPermission),
				mode: 'primary',
				native: true
			},
			explore: {
				name: 'explore',
				description: 'EXPLORE MODE — Mesh-connected codebase exploration agent. Rapid file pattern matching, deep pattern scanning, contextual memory, and surgical precision reading.',
				prompt: prompts.explore,
				permission: mergeDeep(defaults, {
					'*': 'deny',
					grep: 'allow',
					glob: 'allow',
					list: 'allow',
					bash: 'allow',
					webfetch: 'allow',
					websearch: 'allow',
					read: 'allow'
				}, userPermission),
				options: {},
				mode: 'subagent',
				native: true
			},
			compaction: {
				name: 'compaction',
				mode: 'primary',
				native: true,
				hidden: true,
				prompt: prompts.compaction,
				permission: mergeDeep(defaults, { '*': 'deny' }, userPermission),
				options: {}
			},
			title: {
				name: 'title',
				mode: 'primary',
				options: {},
				native: true,
				hidden: true,
				temperature: 0.5,
				prompt: prompts.title,
				permission: mergeDeep(defaults, { '*': 'deny' }, userPermission)
			},
			summary: {
				name: 'summary',
				mode: 'primary',
				options: {},
				native: true,
				hidden: true,
				prompt: prompts.summary,
				permission: mergeDeep(defaults, { '*': 'deny' }, userPermission)
			}
		};
	}

	return {
		_serviceBrand: undefined,

		async get(agent: string): Promise<AgentInfo> {
			await ensureInit();
			if (!agents[agent]) {
				throw new Error(`agent "${agent}" not found`);
			}
			return agents[agent];
		},

		async list(): Promise<AgentInfo[]> {
			await ensureInit();
			return Object.values(agents);
		},

		async defaultInfo(): Promise<AgentInfo> {
			await ensureInit();
			const visible = Object.values(agents).find((a) => a.mode !== 'subagent' && a.hidden !== true);
			if (!visible) {
				throw new Error('no primary visible agent found');
			}
			return visible;
		},

		async defaultAgent(): Promise<string> {
			const info = await this.defaultInfo();
			return info.name;
		},

		async generate(input: {
			description: string;
			model?: { providerID: string; modelID: string };
		}): Promise<GeneratedAgent> {
			await ensureInit();
			return {
				identifier: 'generated-agent',
				whenToUse: `Use when ${input.description}`,
				systemPrompt: `Generated agent for: ${input.description}`
			};
		}
	};
}

let _instance: IAgentService | undefined;

export function getAgentService(): IAgentService {
	if (!_instance) {
		_instance = createAgentService();
	}
	return _instance;
}

export { createAgentService as AgentServiceLayer };
