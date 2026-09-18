/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Zyraxon Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable, IDisposable } from '../../../../../../base/common/lifecycle.js';
import { ILogService } from '../../../../../../platform/log/common/log.js';
import { IStorageService } from '../../../../../../platform/storage/common/storage.js';
import { ILanguageModelToolsService, IToolData, IToolImpl, ToolDataSource } from '../languageModelToolsService.js';
import { ZyraxonToolDef, createToolRegistrationFromXToolDef } from './zyraxonToolWrapper.js';
import { getCurrentTier, hasAccess } from './source/subscriptionStatus.js';
import { IJSONSchema } from '../../../../../../base/common/jsonSchema.js';

/**
 * Tool tier mapping - maps tool ID to required tier.
 * Copied from ZYRAXON-AI-main/packages/zyraxon/src/x/x-tool-registry.ts
 */
const TOOL_TIER_MAP: Record<string, 'free' | 'pro' | 'max' | 'ultra'> = {
	// PRO tools
	task: 'pro', plan: 'pro', apply_patch: 'pro', code_analyzer: 'pro', api_tester: 'pro',
	system_info: 'pro', screen_vision: 'pro', self_evolve: 'pro', code_mode: 'pro', mcp_websearch: 'pro',
	// Aviation (PRO)
	x_atc_connect: 'pro', x_atc_disconnect: 'pro', x_atc_tune: 'pro', x_atc_set_squawk: 'pro',
	x_atc_request_clearance: 'pro', x_atc_read_back: 'pro', x_atc_declare_emergency: 'pro',
	x_weather_parse_metar: 'pro', x_weather_check_turbulence: 'pro', x_weather_check_icing: 'pro',
	x_weather_get_winds_aloft: 'pro', x_notam_add: 'pro', x_notam_get_by_location: 'pro',
	x_notam_check_runway: 'pro', x_runway_set_condition: 'pro', x_runway_calc_landing_distance: 'pro',
	x_runway_get_braking: 'pro', x_tcas_detect_traffic: 'pro', x_tcas_calculate_resolution: 'pro',
	x_pilot_request_override: 'pro', x_pilot_release_override: 'pro', x_cabin_set_altitude: 'pro',
	x_cabin_detect_decompression: 'pro', x_engine_add: 'pro', x_engine_check_health: 'pro',
	// Ground Vehicles (PRO)
	x_v2x_connect: 'pro', x_v2x_send_v2v: 'pro', x_v2x_send_v2i: 'pro',
	x_pedestrian_add: 'pro', x_pedestrian_predict: 'pro', x_pedestrian_risk: 'pro',
	x_traffic_set_signal: 'pro', x_traffic_should_proceed: 'pro', x_traffic_recommended_speed: 'pro',
	x_dms_update: 'pro', x_dms_get_alertness: 'pro', x_dms_get_fatigue: 'pro',
	x_road_update_friction: 'pro', x_road_detect_hazard: 'pro', x_road_get_recommendation: 'pro',
	x_collision_calc_ttc: 'pro', x_collision_should_brake: 'pro', x_collision_should_evade: 'pro',
	// Drones (PRO)
	x_geofence_add_zone: 'pro', x_geofence_check: 'pro', x_geofence_violations: 'pro',
	x_wind_update_imu: 'pro', x_wind_update_gps: 'pro', x_wind_get_vector: 'pro',
	x_obstacle_add_3d: 'pro', x_obstacle_get_avoidance: 'pro', x_obstacle_find_path: 'pro',
	x_swarm_add_drone: 'pro', x_swarm_consensus: 'pro', x_swarm_leader_election: 'pro',
	x_delivery_create: 'pro', x_delivery_assign: 'pro', x_delivery_track: 'pro',
	x_spray_set_field: 'pro', x_spray_plan_swath: 'pro', x_spray_get_coverage: 'pro',
	x_sar_set_area: 'pro', x_sar_plan_grid: 'pro', x_sar_plan_spiral: 'pro',
	// Helicopters (PRO)
	x_rotor_set_collective: 'pro', x_rotor_set_cyclic: 'pro', x_rotor_set_pedal: 'pro',
	x_rotor_get_rpm: 'pro', x_rotor_health: 'pro', x_hover_set_target: 'pro',
	x_hover_get_error: 'pro', x_hover_correction: 'pro', x_load_attach: 'pro',
	x_load_detach: 'pro', x_load_compensate: 'pro', x_auto_detect_power_loss: 'pro',
	x_auto_initiate: 'pro', x_auto_maintain: 'pro', x_heli_weather_get_correction: 'pro',
	x_heli_weather_get_crosswind: 'pro', x_vtol_plan_takeoff: 'pro', x_vtol_plan_landing: 'pro',
	x_vtol_energy: 'pro',
	// ML/Safety (PRO)
	x_vision_detect: 'pro', x_nlp_analyze: 'pro', x_predict_add: 'pro',
	x_classify_add: 'pro', x_anomaly_add: 'pro', x_rl_create_state: 'pro',
	x_failsafe_add_rule: 'pro', x_watchdog_start: 'pro', x_emergency_activate: 'pro',
	x_redundancy_add: 'pro', x_fmea_add: 'pro', x_interlock_add: 'pro', x_breaker_add: 'pro',
	// Common Sense (PRO)
	x_reason_add_fact: 'pro', x_causal_add_link: 'pro', x_world_add_object: 'pro',
	x_context_set: 'pro', x_analogy_add: 'pro', x_spatial_add_obj: 'pro',
	// Ethics (PRO)
	x_ethics_add_principle: 'pro', x_bias_add_dataset: 'pro', x_fairness_add_model: 'pro',
	x_transparency_add: 'pro', x_safety_validate: 'pro',
	// Creativity (PRO)
	x_idea_add_concept: 'pro', x_innovation_add_tech: 'pro', x_design_create_project: 'pro',
	x_pattern_add: 'pro', x_relax_add_problem: 'pro',
	// MAX tools
	site_create: 'max', site_publish: 'max', site_unpublish: 'max',
	site_domain: 'max', site_preview: 'max', media_fetch: 'max',
	svg_generate: 'max', github_connect: 'max', external_directory: 'max',
	// Space (MAX)
	x_launch_calc_window: 'max', x_launch_get_next: 'max', x_launch_check_constraints: 'max',
	x_ground_station_add: 'max', x_ground_station_schedule: 'max', x_ground_station_next_pass: 'max',
	x_stage_separate: 'max', x_stage_deploy_chutes: 'max', x_stage_touchdown: 'max',
	x_payload_create: 'max', x_payload_deploy: 'max', x_payload_confirm: 'max',
	x_deorbit_calc_burn: 'max', x_deorbit_get_window: 'max',
	x_constellation_add_sat: 'max', x_constellation_coverage: 'max', x_constellation_revisit: 'max',
	x_eclipse_predict: 'max', x_eclipse_power_budget: 'max',
	x_thermal_monitor: 'max', x_thermal_check_limits: 'max', x_thermal_predict_flux: 'max',
	// Medical (MAX)
	x_medical_update_vitals: 'max', x_medical_get_vitals: 'max', x_medical_check_alerts: 'max',
	x_drug_add_medication: 'max', x_drug_check_interactions: 'max', x_drug_get_contraindications: 'max',
	x_patient_set: 'max', x_patient_update_vitals: 'max', x_patient_get_alert_level: 'max',
	// Industrial (MAX)
	x_plc_connect: 'max', x_plc_read_register: 'max', x_plc_write_register: 'max',
	x_scada_add_sensor: 'max', x_scada_update_value: 'max', x_scada_check_limits: 'max',
	x_cnc_load_program: 'max', x_cnc_start: 'max', x_cnc_stop: 'max', x_cnc_get_status: 'max',
	x_robot_set_joint: 'max', x_robot_move_linear: 'max', x_robot_get_kinematics: 'max',
	x_conveyor_start: 'max', x_conveyor_stop: 'max',
	// Infrastructure (MAX)
	x_power_add_generator: 'max', x_power_add_load: 'max', x_power_get_balance: 'max',
	x_water_set_flow: 'max', x_water_set_ph: 'max', x_water_get_quality: 'max',
	x_hvac_set_temp: 'max', x_hvac_set_humidity: 'max', x_hvac_get_efficiency: 'max',
	x_fire_detect_smoke: 'max', x_fire_detect_heat: 'max', x_fire_activate: 'max',
	x_rail_set_signal: 'max', x_rail_set_speed: 'max', x_rail_emergency_stop: 'max',
	// Security (MAX)
	x_surveillance_add_camera: 'max', x_surveillance_detect_motion: 'max', x_surveillance_set_recording: 'max',
	x_access_grant: 'max', x_access_revoke: 'max', x_access_check: 'max',
	x_intrusion_set_zone: 'max', x_intrusion_arm: 'max', x_intrusion_check_breach: 'max',
	x_cyber_detect_port_scan: 'max', x_cyber_detect_brute_force: 'max', x_cyber_block_ip: 'max',
	x_encrypt_data: 'max', x_decrypt_data: 'max', x_encrypt_hash: 'max',
	// Survey (MAX)
	x_lidar_add_point: 'max', x_lidar_downsample: 'max', x_lidar_get_volume: 'max',
	x_gpsrtk_set_base: 'max', x_gpsrtk_get_correction: 'max', x_gpsrtk_get_position: 'max',
	x_total_station_set_point: 'max', x_total_station_measure: 'max',
	x_drone_mapper_plan_flight: 'max', x_drone_mapper_get_orthomosaic: 'max',
	x_seismic_add_sensor: 'max', x_seismic_detect_event: 'max',
	// Agriculture (MAX)
	x_soil_add_sample: 'max', x_soil_analyze_nutrients: 'max', x_soil_get_ph: 'max',
	x_crop_add_field: 'max', x_crop_check_health: 'max', x_crop_get_ndvi: 'max',
	x_irrigation_set_schedule: 'max', x_irrigation_get_moisture: 'max', x_irrigation_activate: 'max',
	x_pest_add_trap: 'max', x_pest_identify: 'max', x_pest_get_risk: 'max',
	x_harvest_plan: 'max', x_harvest_optimize: 'max', x_harvest_get_yield: 'max',
	// Marine (MAX)
	x_sonar_add_ping: 'max', x_sonar_detect_object: 'max', x_sonar_get_depth: 'max',
	x_nav_add_waypoint: 'max', x_nav_get_course: 'max', x_nav_check_collision: 'max',
	x_hull_add_sensor: 'max', x_hull_check_integrity: 'max', x_hull_get_stress: 'max',
	x_anchor_set: 'max', x_anchor_check_drag: 'max', x_anchor_get_force: 'max',
	x_ballast_set_level: 'max', x_ballast_check_trim: 'max', x_ballast_auto_level: 'max',
	// Construction (MAX)
	x_excavator_set_arm: 'max', x_excavator_dig: 'max', x_excavator_get_depth: 'max',
	x_crane_set_load: 'max', x_crane_lift: 'max', x_crane_check_stability: 'max',
	x_mixer_set_speed: 'max', x_mixer_add_material: 'max', x_mixer_get_slump: 'max',
	x_survey_drone_plan: 'max', x_survey_drone_execute: 'max', x_survey_drone_get_ortho: 'max',
	x_bulldozer_set_blade: 'max', x_bulldozer_push: 'max', x_bulldozer_get_grade: 'max',
	// Physical I/O (MAX)
	x_arduino_connect: 'max', x_arduino_digital_write: 'max', x_arduino_analog_read: 'max',
	x_raspi_connect: 'max', x_raspi_gpio_write: 'max', x_raspi_gpio_read: 'max',
	x_can_send_frame: 'max', x_can_read_frame: 'max', x_can_set_bitrate: 'max',
	x_uart_send: 'max', x_uart_read: 'max', x_uart_set_baud: 'max',
	x_i2c_write: 'max', x_i2c_read: 'max', x_i2c_scan: 'max',
	x_spi_transfer: 'max', x_spi_read: 'max',
	x_adc_read: 'max', x_adc_set_reference: 'max',
	x_pwm_set_duty: 'max', x_pwm_set_frequency: 'max',
	// SDR (MAX)
	x_sdr_set_freq: 'max', x_sdr_set_sample_rate: 'max', x_sdr_read_samples: 'max',
	x_fm_set_freq: 'max', x_fm_transmit: 'max', x_fm_stop: 'max',
	x_wifi_scan: 'max', x_wifi_connect: 'max', x_wifi_disconnect: 'max',
	x_bt_scan: 'max', x_bt_pair: 'max', x_bt_connect: 'max',
	x_lora_set_freq: 'max', x_lora_send: 'max', x_lora_receive: 'max',
	x_gps_get_position: 'max', x_gps_get_satellites: 'max',
	x_signal_analyze: 'max', x_signal_generate: 'max',
	// Digital Twin (MAX)
	x_twin_create: 'max', x_twin_update_state: 'max', x_twin_sync: 'max',
	x_twin_simulate: 'max', x_twin_get_metrics: 'max',
	// Dashboard (MAX)
	x_dashboard_create: 'max', x_dashboard_add_widget: 'max', x_dashboard_update: 'max',
	x_dashboard_add_chart: 'max', x_dashboard_set_refresh: 'max',
	// Alerts (MAX)
	x_alert_create: 'max', x_alert_set_threshold: 'max', x_alert_acknowledge: 'max',
	x_alert_get_history: 'max',
	// Data Logger (MAX)
	x_log_add_entry: 'max', x_log_query: 'max', x_log_export: 'max',
	x_log_set_retention: 'max', x_log_get_stats: 'max',
	// Remote Control (MAX)
	x_remote_connect: 'max', x_remote_send_command: 'max', x_remote_disconnect: 'max',
	x_remote_get_status: 'max', x_remote_set_heartbeat: 'max',
	// Maintenance (MAX)
	x_maint_predict: 'max', x_maint_schedule: 'max', x_maint_get_parts: 'max',
	x_maint_analyze_vibration: 'max', x_maint_analyze_oil: 'max', x_maint_trend_thermal: 'max',
	// Decision (MAX)
	x_decision_evaluate: 'max', x_decision_analyze_scenario: 'max', x_decision_assess_risk: 'max',
	x_decision_tradeoff: 'max', x_decision_build_tree: 'max', x_decision_causal: 'max',
	// Auth (MAX)
	x_rbac_add_role: 'max', x_rbac_assignPermission: 'max', x_rbac_checkAccess: 'max',
	x_authenticate: 'max', x_policy_add: 'max', x_token_create: 'max',
	// Extended AI (MAX)
	x_matlab_eig: 'max', x_matlab_inv: 'max', x_matlab_det: 'max',
	x_matlab_fft: 'max', x_matlab_filter: 'max', x_matlab_interp: 'max',
	x_risk_add_factor: 'max', x_risk_evaluate: 'max', x_risk_mitigate: 'max',
	x_circuit_add_component: 'max', x_circuit_simulate: 'max', x_circuit_analyze: 'max',
	x_material_set_property: 'max', x_material_stress: 'max', x_material_fatigue: 'max',
	// ULTRA tools
	x_ultra_math: 'ultra', x_ultra_codegen: 'ultra', x_ultra_security: 'ultra',
	x_ultra_performance: 'ultra', x_ultra_refactor: 'ultra', x_ultra_testgen: 'ultra',
	x_ultra_deploy: 'ultra', x_ultra_review: 'ultra',
	// Ultra X (ULTRA)
	x_universal_command: 'ultra', x_reality_bridge: 'ultra', x_omni_creator: 'ultra',
	x_time_manipulator: 'ultra', x_consciousness_transfer: 'ultra', x_self_evolve: 'ultra',
	x_emotion_aware: 'ultra', x_memory_palace: 'ultra', x_reality_sim: 'ultra',
	x_singularity: 'ultra',
	// Code Guardian (ULTRA)
	x_code_guardian_scan: 'ultra', x_code_guardian_fix: 'ultra',
	x_code_guardian_review: 'ultra', x_code_guardian_analyze: 'ultra',
};

/**
 * All tool definitions from ZYRAXON-AI that will be registered.
 */
const ALL_TOOL_DEFS: ZyraxonToolDef[] = [];

/**
 * Registry for ZYRAXON-AI tools in Zyraxon-Code.
 */
export class ZyraxonToolRegistry extends Disposable {
	static readonly ID = 'workbench.contrib.chat.zyraxonToolRegistry';

	private readonly _disposables: IDisposable[] = [];

	constructor(
		@ILanguageModelToolsService private readonly _toolsService: ILanguageModelToolsService,
		@ILogService private readonly _logService: ILogService,
		@IStorageService private readonly _storageService: IStorageService,
	) {
		super();
	}

	/**
	 * Register all ZYRAXON-AI tools with the tool service.
	 * Filters tools based on current subscription tier.
	 */
	registerAll(): void {
		const currentTier = getCurrentTier(this._storageService);
		this._logService.info(`[zyraxon-tools] Registering tools for tier: ${currentTier}`);

		let registered = 0;
		let skipped = 0;

		for (const tool of ALL_TOOL_DEFS) {
			const requiredTier = TOOL_TIER_MAP[tool.id] || 'free';

			if (!hasAccess(currentTier, requiredTier)) {
				skipped++;
				continue;
			}

			const [toolData, toolImpl] = createToolRegistrationFromXToolDef(tool);
			const disposable = this._toolsService.registerTool(toolData, toolImpl);
			this._disposables.push(disposable);
			registered++;
		}

		this._logService.info(`[zyraxon-tools] Registered ${registered} tools, skipped ${skipped} (tier restriction)`);
	}

	/**
	 * Refresh tool registrations when tier changes.
	 */
	refresh(): void {
		// Dispose old registrations
		for (const d of this._disposables) {
			d.dispose();
		}
		this._disposables.length = 0;

		// Re-register
		this.registerAll();
	}

	override dispose(): void {
		for (const d of this._disposables) {
			d.dispose();
		}
		super.dispose();
	}
}

/**
 * Add a tool definition to the registry.
 */
export function registerZyraxonTool(tool: ZyraxonToolDef): void {
	ALL_TOOL_DEFS.push(tool);
}

/**
 * Get all registered tool definitions.
 */
export function getAllZyraxonTools(): readonly ZyraxonToolDef[] {
	return ALL_TOOL_DEFS;
}
