// ─── Zyraxon Subscription System ────────────────────────────────────────────
// Tier definitions, plan details, access control, and secret code validation.

export type SubscriptionTier = 'free' | 'pro' | 'max' | 'ultra';

export interface SubscriptionPlan {
	readonly id: SubscriptionTier;
	readonly name: string;
	readonly price: number;
	readonly currency: string;
	readonly durationDays: number | null;
	readonly description: string;
	readonly features: readonly string[];
	readonly toolCount: number;
	readonly memoryOptimization: string;
	readonly maxAgents: number;
	readonly maxProjects: string;
}

export interface SubscriptionState {
	tier: SubscriptionTier;
	activatedAt: number | null;
	expiresAt: number | null;
	secretCode: string | null;
	stripeSessionId: string | null;
}

// ─── Tier Order (ascending power) ──────────────────────────────────────────
export const TIER_ORDER: readonly SubscriptionTier[] = ['free', 'pro', 'max', 'ultra'];

// ─── Plan Definitions ──────────────────────────────────────────────────────
export const SUBSCRIPTION_PLANS: Record<SubscriptionTier, SubscriptionPlan> = {
	free: {
		id: 'free',
		name: 'Free',
		price: 0,
		currency: 'USD',
		durationDays: null,
		description: 'Get started with the basics',
		features: [
			'Basic AI Chat (1 agent)',
			'File System Access (Read/Write/Edit)',
			'Shell Execution (Bash/PowerShell)',
			'Web Search & Fetch',
			'Glob & Grep File Search',
			'Todo Task Management',
			'Basic Memory (100 entries)',
			'Math & Science Calculators',
			'Daily Life Tools',
			'Document & Skill Tools',
			'Browser Automation (1 tab)',
			'Up to 3 Projects',
		],
		toolCount: 57,
		memoryOptimization: 'Basic (100 entries, 10MB cache)',
		maxAgents: 1,
		maxProjects: '3',
	},
	pro: {
		id: 'pro',
		name: 'Pro',
		price: 5,
		currency: 'USD',
		durationDays: 15,
		description: 'More power for professionals',
		features: [
			'Everything in Free',
			'Unlimited Projects',
			'Memory & Context Sync (500 entries)',
			'Code Analysis & Planning',
			'Self-Evolution & Screen Vision',
			'API Testing Tools',
			'Aviation Systems (24 tools)',
			'Ground Vehicle Systems (18 tools)',
			'Drone Systems (21 tools)',
			'Helicopter Systems (20 tools)',
			'ML & Safety Tools (13 tools)',
			'Common Sense & Ethics AI (11 tools)',
			'Creativity Engine (5 tools)',
			'Multi-Agent (up to 3 agents)',
			'Priority Processing',
		],
		toolCount: 113,
		memoryOptimization: 'Pro (500 entries, 50MB cache)',
		maxAgents: 3,
		maxProjects: 'Unlimited',
	},
	max: {
		id: 'max',
		name: 'Max',
		price: 15,
		currency: 'USD',
		durationDays: 60,
		description: 'Built for teams and scale',
		features: [
			'Everything in Pro',
			'Space Systems (22 tools)',
			'Industrial Control (15 tools)',
			'Infrastructure Systems (15 tools)',
			'Security & Surveillance (15 tools)',
			'Survey & Mapping (14 tools)',
			'Agriculture Systems (15 tools)',
			'Marine Systems (15 tools)',
			'Construction Systems (15 tools)',
			'Physical Interface & Sensors (22 tools)',
			'SDR & Radio (7 tools)',
			'Digital Twin & Simulation (5 tools)',
			'Dashboard & Visualization (5 tools)',
			'Alert & Notification (4 tools)',
			'Data Logging & Export (5 tools)',
			'Remote Control (6 tools)',
			'Predictive Maintenance (6 tools)',
			'Decision Support (6 tools)',
			'Authorization & Auth (6 tools)',
			'Extended AI Tools (24 tools)',
			'Multi-Agent (up to 8 agents)',
			'Team Workspace (3 members)',
			'GitHub Integration',
			'Site Creation & Publishing',
			'Memory (2000 entries, 200MB cache)',
		],
		toolCount: 370,
		memoryOptimization: 'Max (2000 entries, 200MB cache)',
		maxAgents: 8,
		maxProjects: 'Unlimited + Team',
	},
	ultra: {
		id: 'ultra',
		name: 'Ultra',
		price: 99,
		currency: 'USD',
		durationDays: 365,
		description: 'Maximum power. No limits.',
		features: [
			'Everything in Max',
			'Singularity AI Engine (5 tools)',
			'Guardian System (4 tools)',
			'Ultra Code Generator',
			'Ultra Security Sweeper',
			'Ultra Performance Optimizer',
			'Ultra Refactoring Engine',
			'Ultra Test Generator',
			'Ultra Auto-Deploy Pipeline',
			'Ultra Code Reviewer',
			'Ultra Quantum Analyzer',
			'Unlimited Agents (no cap)',
			'Full Cloud Execution (24/7)',
			'Team Workspace (10 members)',
			'Custom Models & Settings',
			'Priority Support',
			'Early Access to New Features',
			'Memory (10000 entries, 1GB cache)',
			'Dedicated Agent Instances',
			'Exclusive Tools & Integrations',
		],
		toolCount: 500,
		memoryOptimization: 'Ultra (10000 entries, 1GB cache)',
		maxAgents: -1,
		maxProjects: 'Unlimited + Team + Enterprise',
	},
};

// ─── Access Control ────────────────────────────────────────────────────────

/**
 * Check if `currentTier` grants access to content gated at `requiredTier`.
 * Higher tiers unlock everything below them.
 */
export function hasAccess(currentTier: SubscriptionTier, requiredTier: SubscriptionTier): boolean {
	return TIER_ORDER.indexOf(currentTier) >= TIER_ORDER.indexOf(requiredTier);
}

/**
 * Get the numeric tier level (0=free, 1=pro, 2=max, 3=ultra).
 */
export function tierLevel(tier: SubscriptionTier): number {
	return TIER_ORDER.indexOf(tier);
}

// ─── Secret Code System ────────────────────────────────────────────────────

export interface SecretCodeResult {
	tier: SubscriptionTier;
	durationDays: number | null;
}

const SECRET_CODES: Record<string, SecretCodeResult> = {
	'ZYRAXON-PRO-2026': { tier: 'pro', durationDays: null },
	'ZYRAXON-PRO-YEAR': { tier: 'pro', durationDays: null },
	'ZYRAXON-MAX-2026': { tier: 'max', durationDays: null },
	'ZYRAXON-MAX-YEAR': { tier: 'max', durationDays: null },
	'ZYRAXON-ULTRA-2026': { tier: 'ultra', durationDays: null },
	'ZYRAXON-ULTRA-FULL': { tier: 'ultra', durationDays: null },
	'ZYRAXON-DEV-TEST': { tier: 'ultra', durationDays: null },
	'ZYRAXON-FOUNDER': { tier: 'ultra', durationDays: null },
};

/**
 * Validate a secret activation code.
 * Supports hardcoded codes and prefix-based matching (ZYRAXON-PRO-*, ZYRAXON-MAX-*, ZYRAXON-ULTRA-*).
 * Returns null if invalid.
 */
export function validateSecretCode(code: string): SecretCodeResult | null {
	const normalized = code.trim().toUpperCase();

	// Check hardcoded codes first
	const entry = SECRET_CODES[normalized];
	if (entry) {
		return entry;
	}

	// Prefix-based matching
	if (normalized.startsWith('ZYRAXON-ULTRA-')) {
		return { tier: 'ultra', durationDays: null };
	}
	if (normalized.startsWith('ZYRAXON-MAX-')) {
		return { tier: 'max', durationDays: null };
	}
	if (normalized.startsWith('ZYRAXON-PRO-')) {
		return { tier: 'pro', durationDays: null };
	}

	return null;
}

// ─── Tool Tier Map ─────────────────────────────────────────────────────────
// Maps every tool ID to the minimum tier required to use it.

export const TOOL_TIER_MAP: Record<string, SubscriptionTier> = {
	// ═══════════════════════════════════════════════════════════════
	// FREE — Core tools (57 tools)
	// ═══════════════════════════════════════════════════════════════
	// Builtin tools
	read: 'free',
	write: 'free',
	edit: 'free',
	glob: 'free',
	grep: 'free',
	shell: 'free',
	webfetch: 'free',
	websearch: 'free',
	todo: 'free',
	question: 'free',
	skill: 'free',
	memory: 'free',
	lsp: 'free',
	invalid: 'free',
	// Math tools (8)
	x_math_matrix: 'free',
	x_math_derivative: 'free',
	x_math_integral: 'free',
	x_math_gradient: 'free',
	x_math_stats: 'free',
	x_math_prime: 'free',
	x_math_geometry: 'free',
	x_math_combinatorics: 'free',
	// Science basics
	x_physics_mechanics: 'free',
	x_physics_thermo: 'free',
	x_physics_em: 'free',
	x_physics_relativity: 'free',
	x_physics_waves: 'free',
	x_chem_molar_mass: 'free',
	x_chem_moles: 'free',
	x_chem_dilution: 'free',
	x_chem_gas_laws: 'free',
	x_chem_buffer: 'free',
	x_chem_nernst: 'free',
	x_chem_halflife: 'free',
	x_chem_electrochemistry: 'free',
	x_bio_punnett: 'free',
	x_bio_hardy_weinberg: 'free',
	x_bio_dna_rna: 'free',
	x_bio_gc_content: 'free',
	x_bio_population: 'free',
	// Finance basics
	x_fin_compound: 'free',
	x_fin_present_value: 'free',
	x_fin_mortgage: 'free',
	x_fin_npv: 'free',
	x_fin_irr: 'free',
	x_fin_roi: 'free',
	x_fin_sharpe: 'free',
	x_fin_stock: 'free',
	x_fin_bond: 'free',
	x_fin_black_scholes: 'free',
	// Data science basics
	x_ds_normalize: 'free',
	x_ds_distance: 'free',
	x_ds_cosine: 'free',
	x_ds_entropy: 'free',
	x_ds_gini: 'free',
	x_ds_sigmoid: 'free',
	x_ds_softmax: 'free',
	x_ds_kmeans: 'free',
	// Security basics
	x_sec_password: 'free',
	x_sec_caesar: 'free',
	x_sec_subnet: 'free',
	x_sec_entropy: 'free',
	x_sec_xor: 'free',
	x_sec_cve: 'free',
	x_sec_hash_id: 'free',
	x_sec_ssl: 'free',
	// Daily life tools
	x_life_bmi: 'free',
	x_life_calories: 'free',
	x_life_tip: 'free',
	x_life_emi: 'free',
	x_life_unit: 'free',
	x_life_date_diff: 'free',
	x_life_heart_rate: 'free',
	x_life_age: 'free',
	x_life_text_stats: 'free',
	x_life_temp: 'free',
	x_life_fuel: 'free',
	x_life_gst: 'free',
	x_life_wpm: 'free',
	// Memory / Doc / Skill tools
	x_memory_view: 'free',
	x_memory_create: 'free',
	x_memory_read: 'free',
	x_memory_update: 'free',
	x_memory_append: 'free',
	x_memory_delete: 'free',
	x_memory_search: 'free',
	x_doc_read: 'free',
	x_doc_create: 'free',
	x_doc_edit: 'free',
	x_doc_markdown_to_html: 'free',
	x_doc_count_words: 'free',
	x_skill_create: 'free',
	x_skill_list: 'free',
	x_skill_delete: 'free',
	// Task tools
	x_task_create: 'free',
	x_task_list: 'free',
	x_task_delete: 'free',
	x_task_toggle: 'free',
	x_task_run_now: 'free',
	// Captcha tools
	x_captcha_detect: 'free',
	x_captcha_click: 'free',
	x_captcha_solve_image: 'free',
	x_captcha_input: 'free',

	// ═══════════════════════════════════════════════════════════════
	// PRO — Professional tools (113 total)
	// ═══════════════════════════════════════════════════════════════
	task: 'pro',
	plan: 'pro',
	apply_patch: 'pro',
	code_analyzer: 'pro',
	api_tester: 'pro',
	system_info: 'pro',
	screen_vision: 'pro',
	self_evolve: 'pro',
	code_mode: 'pro',
	mcp_websearch: 'pro',
	// Aviation (25)
	x_atc_connect: 'pro',
	x_atc_disconnect: 'pro',
	x_atc_tune: 'pro',
	x_atc_set_squawk: 'pro',
	x_atc_request_clearance: 'pro',
	x_atc_read_back: 'pro',
	x_atc_declare_emergency: 'pro',
	x_weather_parse_metar: 'pro',
	x_weather_check_turbulence: 'pro',
	x_weather_check_icing: 'pro',
	x_weather_get_winds_aloft: 'pro',
	x_notam_add: 'pro',
	x_notam_get_by_location: 'pro',
	x_notam_check_runway: 'pro',
	x_runway_set_condition: 'pro',
	x_runway_calc_landing_distance: 'pro',
	x_runway_get_braking: 'pro',
	x_tcas_detect_traffic: 'pro',
	x_tcas_calculate_resolution: 'pro',
	x_pilot_request_override: 'pro',
	x_pilot_release_override: 'pro',
	x_cabin_set_altitude: 'pro',
	x_cabin_detect_decompression: 'pro',
	x_engine_add: 'pro',
	x_engine_check_health: 'pro',
	// Ground vehicle (18)
	x_v2x_connect: 'pro',
	x_v2x_send_v2v: 'pro',
	x_v2x_send_v2i: 'pro',
	x_pedestrian_add: 'pro',
	x_pedestrian_predict: 'pro',
	x_pedestrian_risk: 'pro',
	x_traffic_set_signal: 'pro',
	x_traffic_should_proceed: 'pro',
	x_traffic_recommended_speed: 'pro',
	x_dms_update: 'pro',
	x_dms_get_alertness: 'pro',
	x_dms_get_fatigue: 'pro',
	x_road_update_friction: 'pro',
	x_road_detect_hazard: 'pro',
	x_road_get_recommendation: 'pro',
	x_collision_calc_ttc: 'pro',
	x_collision_should_brake: 'pro',
	x_collision_should_evade: 'pro',
	// Drone (21)
	x_geofence_add_zone: 'pro',
	x_geofence_check: 'pro',
	x_geofence_violations: 'pro',
	x_wind_update_imu: 'pro',
	x_wind_update_gps: 'pro',
	x_wind_get_vector: 'pro',
	x_obstacle_add_3d: 'pro',
	x_obstacle_get_avoidance: 'pro',
	x_obstacle_find_path: 'pro',
	x_swarm_add_drone: 'pro',
	x_swarm_consensus: 'pro',
	x_swarm_leader_election: 'pro',
	x_delivery_create: 'pro',
	x_delivery_assign: 'pro',
	x_delivery_track: 'pro',
	x_spray_set_field: 'pro',
	x_spray_plan_swath: 'pro',
	x_spray_get_coverage: 'pro',
	x_sar_set_area: 'pro',
	x_sar_plan_grid: 'pro',
	x_sar_plan_spiral: 'pro',
	// Helicopter (20)
	x_rotor_set_collective: 'pro',
	x_rotor_set_cyclic: 'pro',
	x_rotor_set_pedal: 'pro',
	x_rotor_get_rpm: 'pro',
	x_rotor_health: 'pro',
	x_hover_set_target: 'pro',
	x_hover_get_error: 'pro',
	x_hover_correction: 'pro',
	x_load_attach: 'pro',
	x_load_detach: 'pro',
	x_load_compensate: 'pro',
	x_auto_detect_power_loss: 'pro',
	x_auto_initiate: 'pro',
	x_auto_maintain: 'pro',
	x_heli_weather_get_correction: 'pro',
	x_heli_weather_get_crosswind: 'pro',
	x_vtol_plan_takeoff: 'pro',
	x_vtol_plan_landing: 'pro',
	x_vtol_energy: 'pro',
	// ML & Safety (13)
	x_vision_detect: 'pro',
	x_nlp_analyze: 'pro',
	x_predict_add: 'pro',
	x_classify_add: 'pro',
	x_anomaly_add: 'pro',
	x_rl_create_state: 'pro',
	x_failsafe_add_rule: 'pro',
	x_watchdog_start: 'pro',
	x_emergency_activate: 'pro',
	x_redundancy_add: 'pro',
	x_fmea_add: 'pro',
	x_interlock_add: 'pro',
	x_breaker_add: 'pro',
	// Common sense & Ethics (11)
	x_reason_add_fact: 'pro',
	x_causal_add_link: 'pro',
	x_world_add_object: 'pro',
	x_context_set: 'pro',
	x_analogy_add: 'pro',
	x_spatial_add_obj: 'pro',
	x_ethics_add_principle: 'pro',
	x_bias_add_dataset: 'pro',
	x_fairness_add_model: 'pro',
	x_transparency_add: 'pro',
	x_safety_validate: 'pro',
	// Creativity (5)
	x_idea_add_concept: 'pro',
	x_innovation_add_tech: 'pro',
	x_design_create_project: 'pro',
	x_pattern_add: 'pro',
	x_relax_add_problem: 'pro',

	// ═══════════════════════════════════════════════════════════════
	// MAX — Advanced tools (370 total)
	// ═══════════════════════════════════════════════════════════════
	site_create: 'max',
	site_publish: 'max',
	site_unpublish: 'max',
	site_domain: 'max',
	site_preview: 'max',
	media_fetch: 'max',
	svg_generate: 'max',
	github_connect: 'max',
	external_directory: 'max',
	// Space (22)
	x_launch_calc_window: 'max',
	x_launch_get_next: 'max',
	x_launch_check_constraints: 'max',
	x_ground_station_add: 'max',
	x_ground_station_schedule: 'max',
	x_ground_station_next_pass: 'max',
	x_stage_separate: 'max',
	x_stage_deploy_chutes: 'max',
	x_stage_touchdown: 'max',
	x_payload_create: 'max',
	x_payload_deploy: 'max',
	x_payload_confirm: 'max',
	x_deorbit_calc_burn: 'max',
	x_deorbit_get_window: 'max',
	x_constellation_add_sat: 'max',
	x_constellation_coverage: 'max',
	x_constellation_revisit: 'max',
	x_eclipse_predict: 'max',
	x_eclipse_power_budget: 'max',
	x_thermal_monitor: 'max',
	x_thermal_check_limits: 'max',
	x_thermal_predict_flux: 'max',
	// Medical (9)
	x_medical_update_vitals: 'max',
	x_medical_get_vitals: 'max',
	x_medical_check_alerts: 'max',
	x_drug_add_medication: 'max',
	x_drug_check_interactions: 'max',
	x_drug_get_contraindications: 'max',
	x_patient_set: 'max',
	x_patient_update_vitals: 'max',
	x_patient_get_alert_level: 'max',
	// Industrial (15)
	x_plc_connect: 'max',
	x_plc_read_register: 'max',
	x_plc_write_register: 'max',
	x_scada_add_sensor: 'max',
	x_scada_update_value: 'max',
	x_scada_check_limits: 'max',
	x_cnc_load_program: 'max',
	x_cnc_start: 'max',
	x_cnc_stop: 'max',
	x_cnc_get_status: 'max',
	x_robot_set_joint: 'max',
	x_robot_move_linear: 'max',
	x_robot_get_kinematics: 'max',
	x_conveyor_start: 'max',
	x_conveyor_stop: 'max',
	// Infrastructure (15)
	x_power_add_generator: 'max',
	x_power_add_load: 'max',
	x_power_get_balance: 'max',
	x_water_set_flow: 'max',
	x_water_set_ph: 'max',
	x_water_get_quality: 'max',
	x_hvac_set_temp: 'max',
	x_hvac_set_humidity: 'max',
	x_hvac_get_efficiency: 'max',
	x_fire_detect_smoke: 'max',
	x_fire_detect_heat: 'max',
	x_fire_activate: 'max',
	x_rail_set_signal: 'max',
	x_rail_set_speed: 'max',
	x_rail_emergency_stop: 'max',
	// Security & Surveillance (15)
	x_surveillance_add_camera: 'max',
	x_surveillance_detect_motion: 'max',
	x_surveillance_set_recording: 'max',
	x_access_grant: 'max',
	x_access_revoke: 'max',
	x_access_check: 'max',
	x_intrusion_set_zone: 'max',
	x_intrusion_arm: 'max',
	x_intrusion_check_breach: 'max',
	x_cyber_detect_port_scan: 'max',
	x_cyber_detect_brute_force: 'max',
	x_cyber_block_ip: 'max',
	x_encrypt_data: 'max',
	x_decrypt_data: 'max',
	x_encrypt_hash: 'max',
	// Survey & Mapping (14)
	x_lidar_add_point: 'max',
	x_lidar_downsample: 'max',
	x_lidar_get_volume: 'max',
	x_rtk_set_position: 'max',
	x_rtk_get_accuracy: 'max',
	x_rtk_get_fix: 'max',
	x_total_station_measure_distance: 'max',
	x_total_station_measure_angle: 'max',
	x_mapper_set_flight: 'max',
	x_mapper_add_photo: 'max',
	x_mapper_generate_model: 'max',
	x_seismic_add_sensor: 'max',
	x_seismic_detect_pwave: 'max',
	x_seismic_get_magnitude: 'max',
	// Agriculture (15)
	x_soil_add_sample: 'max',
	x_soil_get_recommendation: 'max',
	x_soil_get_heatmap: 'max',
	x_crop_add_field: 'max',
	x_crop_update_growth: 'max',
	x_crop_predict_yield: 'max',
	x_irrigation_set_zone: 'max',
	x_irrigation_start: 'max',
	x_irrigation_get_usage: 'max',
	x_pest_add_observation: 'max',
	x_pest_get_risk: 'max',
	x_pest_get_recommendation: 'max',
	x_harvest_set_field: 'max',
	x_harvest_plan_schedule: 'max',
	x_harvest_get_optimal_date: 'max',
	// Marine (15)
	x_sonar_add_target: 'max',
	x_sonar_get_targets: 'max',
	x_sonar_classify: 'max',
	x_nav_chart_add_waypoint: 'max',
	x_nav_chart_set_route: 'max',
	x_nav_chart_get_eta: 'max',
	x_hull_add_sensor: 'max',
	x_hull_check_integrity: 'max',
	x_hull_detect_leak: 'max',
	x_anchor_calculate_scope: 'max',
	x_anchor_drop: 'max',
	x_anchor_retrieve: 'max',
	x_ballast_add_tank: 'max',
	x_ballast_fill: 'max',
	x_ballast_get_stability: 'max',
	// Construction (15)
	x_excavator_set_arm: 'max',
	x_excavator_set_bucket: 'max',
	x_excavator_dig: 'max',
	x_crane_set_boom: 'max',
	x_crane_set_trolley: 'max',
	x_crane_check_wind: 'max',
	x_concrete_set_ratio: 'max',
	x_concrete_start_mix: 'max',
	x_concrete_get_consistency: 'max',
	x_construction_drone_set_site: 'max',
	x_construction_drone_capture: 'max',
	x_construction_drone_get_model: 'max',
	x_bulldozer_set_blade: 'max',
	x_bulldozer_push: 'max',
	x_bulldozer_get_grade: 'max',
	// Physical Interface & Sensors (22)
	x_arduino_connect: 'max',
	x_arduino_digital_write: 'max',
	x_arduino_analog_read: 'max',
	x_rpi_connect: 'max',
	x_rpi_gpio_read: 'max',
	x_can_connect: 'max',
	x_can_send: 'max',
	x_i2c_read: 'max',
	x_lidar_connect: 'max',
	x_lidar_get_pointcloud: 'max',
	x_camera_connect: 'max',
	x_radar_connect: 'max',
	x_imu_connect: 'max',
	x_imu_get_accel: 'max',
	x_ultrasonic_connect: 'max',
	x_thermal_connect: 'max',
	x_sdr_connect: 'max',
	x_sdr_get_fft: 'max',
	x_wifi_scan: 'max',
	x_bt_scan: 'max',
	x_lora_connect: 'max',
	x_gps_connect: 'max',
	x_signal_analyze: 'max',
	// Digital Twin & Simulation (5)
	x_twin_create: 'max',
	x_physics_add_body: 'max',
	x_scenario_create: 'max',
	x_sync_add_source: 'max',
	x_sim_add_task: 'max',
	// Dashboard & Visualization (5)
	x_dash_create_panel: 'max',
	x_chart_create: 'max',
	x_status_add: 'max',
	x_stream_create: 'max',
	x_widget_create: 'max',
	// Alert & Notification (4)
	x_alert_create: 'max',
	x_notify_add_channel: 'max',
	x_escalation_create: 'max',
	x_anomaly_alert_add: 'max',
	// Data Logging & Export (5)
	x_tsdb_create: 'max',
	x_event_log: 'max',
	x_audit_record: 'max',
	x_export_csv: 'max',
	x_storage_allocate: 'max',
	// Remote Control (6)
	x_ws_start: 'max',
	x_rest_add_route: 'max',
	x_auth_add_client: 'max',
	x_remote_connect: 'max',
	x_cmd_register: 'max',
	x_heartbeat_start: 'max',
	// Predictive Maintenance (6)
	x_failure_add: 'max',
	x_maint_add_task: 'max',
	x_spare_add: 'max',
	x_vibration_add: 'max',
	x_oil_add: 'max',
	x_thermal_trend_add: 'max',
	// Decision Support (6)
	x_decision_add_option: 'max',
	x_scenario_analyze: 'max',
	x_risk_add: 'max',
	x_tradeoff_add: 'max',
	x_tree_create: 'max',
	x_causal_add_var: 'max',
	// Authorization (6)
	x_rbac_add_role: 'max',
	x_auth_add_user: 'max',
	x_policy_add: 'max',
	x_access_log: 'max',
	x_token_create: 'max',
	x_cert_generate: 'max',
	// Extended AI Tools (24)
	x_uce_process: 'max',
	x_uce_devices: 'max',
	x_uce_history: 'max',
	x_rb_register: 'max',
	x_rb_control: 'max',
	x_rb_states: 'max',
	x_rb_scene_create: 'max',
	x_rb_scene_activate: 'max',
	x_oc_create: 'max',
	x_oc_templates: 'max',
	x_oc_projects: 'max',
	x_tm_timeline: 'max',
	x_tm_snapshot: 'max',
	x_tm_evolution: 'max',
	x_tm_predict: 'max',
	x_tm_bugs: 'max',
	x_ct_register: 'max',
	x_ct_transfer: 'max',
	x_ct_collab: 'max',
	x_ct_agents: 'max',
	x_se_analyze: 'max',
	x_se_suggest: 'max',
	x_se_trend: 'max',
	x_ea_analyze: 'max',
	x_ea_adapt: 'max',
	x_ea_mood: 'max',
	x_mp_store: 'max',
	x_mp_query: 'max',
	x_mp_stats: 'max',
	x_mp_connect: 'max',
	x_rs_simulate: 'max',
	x_rs_results: 'max',

	// ═══════════════════════════════════════════════════════════════
	// ULTRA — Maximum power tools (500+ total)
	// ═══════════════════════════════════════════════════════════════
	ultra_codegen: 'ultra',
	ultra_security_sweep: 'ultra',
	ultra_performance: 'ultra',
	ultra_refactor: 'ultra',
	ultra_test_gen: 'ultra',
	ultra_autodeploy: 'ultra',
	ultra_code_review: 'ultra',
	ultra_quantum: 'ultra',
	// Singularity AI (5)
	x_singularity_process: 'ultra',
	x_singularity_heal: 'ultra',
	x_singularity_learn: 'ultra',
	x_singularity_state: 'ultra',
	x_singularity_evolution: 'ultra',
	// Guardian System (4)
	x_guardian_scan: 'ultra',
	x_guardian_context: 'ultra',
	x_guardian_status: 'ultra',
	x_guardian_clear: 'ultra',
	// Subscription — always free
	x_subscription_status: 'free',
};

/**
 * Get the required tier for a given tool. Defaults to 'free' if not mapped.
 */
export function getToolRequiredTier(toolId: string): SubscriptionTier {
	return TOOL_TIER_MAP[toolId] ?? 'free';
}

/**
 * Tier statistics for status display.
 */
export const TIER_STATS: Record<SubscriptionTier, { totalTools: number; categories: readonly string[] }> = {
	free: { totalTools: 57, categories: ['Core AI', 'Math', 'Science', 'Finance', 'Data Science', 'Security Basics', 'Daily Life', 'Memory', 'Documents', 'Tasks', 'Captcha', 'Subscription'] },
	pro: { totalTools: 113, categories: ['Pro Dev Tools', 'Aviation', 'Ground Vehicles', 'Drones', 'Helicopters', 'ML & Safety', 'Common Sense AI', 'Ethics AI', 'Creativity'] },
	max: { totalTools: 370, categories: ['Site Tools', 'Space', 'Medical', 'Industrial', 'Infrastructure', 'Security', 'Survey', 'Agriculture', 'Marine', 'Construction', 'Physical I/O', 'Digital Twin', 'Dashboard', 'Alerts', 'Data Logging', 'Remote Control', 'Maintenance', 'Decision Support', 'Authorization', 'Extended AI'] },
	ultra: { totalTools: 500, categories: ['Ultra Tools (8)', 'Singularity AI (5)', 'Guardian System (4)', 'Unlimited Everything'] },
};
