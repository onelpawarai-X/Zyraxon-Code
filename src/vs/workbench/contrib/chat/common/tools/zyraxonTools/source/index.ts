/**
 * ZYRAXON X - Main Entry
 * Exports all X subsystems
 */

export { ZyraxonX } from "./core"
export type { XConfig } from "./core"

export { ZyraxonVoice, ZyraxonTTS, VOICE_LANGUAGES } from "./voice"
export type { VoiceState, VoiceResult, TTSState } from "./voice"

export { ZyraxonPredict } from "./predict"
export { ZyraxonLearn } from "./learn"
export { ZyraxonHeal } from "./heal"
export { ZyraxonEvolve } from "./evolve"
export { ZyraxonGraph } from "./graph"
export { ZyraxonQuantum } from "./quantum"
export { ZyraxonMemory } from "./memory"

export {
  ZyraxonPhysical,
  WiFiController,
  BluetoothController,
  SerialController,
  GPIOController,
  I2CController,
  GPSController,
  CameraController,
} from "./physical"

export {
  ZyraxonVehicles,
  DroneController,
  CarController,
  BoatController,
  RocketController,
  SatelliteController,
} from "./vehicles"
export type { VehicleType, Telemetry, Waypoint, OrbitParams, RocketState } from "./vehicles"

export {
  ZyraxonIoT,
  MQTTController,
  HTTPController,
  WSController,
  ModbusController,
  HomeAssistantController,
} from "./iot"
export type { MQTTMessage } from "./iot"

export {
  ZyraxonBehavior,
  StateMachine,
  DecisionTree,
  PriorityQueue,
  Geofence,
  Scheduler,
  Watchdog,
  EventChain,
} from "./behavior"
export type { StateConfig, Transition, DecisionNode, PriorityTask, GeofenceZone, ScheduledTask, ChainStep } from "./behavior"

export { KnowledgeSystem } from "./knowledge/index"
export type { KnowledgeCategory, KnowledgeEntry, SearchResult } from "./knowledge/index"

export { VehicleIntelligence } from "./vehicle-intelligence"
export type { ControlResult, AircraftParams, VehicleParams, IoTParams } from "./vehicle-intelligence"

export {
  AircraftFCS,
  EngineSystem, HydraulicSystem, ElectricalSystem, FuelSystem,
  PressurizationSystem, AntiIceSystem, LandingGearSystem, FlapSystem,
  TrimSystem, TCAS, GPWS, WeatherRadar, RadioAltimeter,
  AutobrakeSystem, OxygenSystem, FireDetectionSystem,
} from "./aircraft-fcs"

export {
  TelemetryTool, MissionTool, CommunicationTool, SensorTool, EmergencyTool,
  LoggingTool, PermissionTool, HealthTool, NavigationTool, PositionTool,
  OrientationTool, PowerTool, EngineTool, WeatherTool, ObstacleTool,
  DockingTool, OrbitTool, AttitudeTool, TelemetryLinkTool, PayloadTool,
  GroundStationTool, CameraTool, GpsTool, ServoTool, RelayTool,
  PwmTool, DataLoggerTool, SchedulerTool, AlertTool, ConfigTool,
  CalibrationTool, DiagnosticsTool, FirmwareTool, NetworkTool, StorageTool,
  ProcessTool, TimerTool, MathTool,
  AutopilotTool, FlightDirectorTool, NavigationDisplayTool,
  EngineMonitorTool, HydraulicsTool, ElectricalTool, FuelSystemTool,
  PressurizationTool, AntiIceTool, LandingGearTool, AutoBrakeTool,
  TCASTool, WeatherRadarTool, GPWSTool, RadioAltimeterTool,
  TransmissionTool, BrakeSystemTool, SteeringTool, SuspensionTool,
  TireMonitorTool, ClimateControlTool, LightingTool,
  SeatControlTool, MirrorControlTool, WindowControlTool,
  WiperControlTool, CruiseControlTool, StabilityControlTool,
  EmissionMonitorTool, OBDTool,
} from "./tools"
export type { ToolResult, ToolCategory, ToolDef, LogEntry, Permission } from "./tools"

export {
  PIDControllerTool,
  KalmanFilterTool,
  AStarPathfinderTool,
  SignalProcessingTool,
  FFTTool,
  EncryptionTool,
  GraphTool,
  LRUCacheTool,
  BloomFilterTool,
  MatrixTool,
} from "./tools-extra"

export {
  AircraftFlightControl,
  AircraftSensors,
  PIDController,
  RateController,
  AttitudeController,
  NavigationController,
  TrajectoryTracker,
  WaypointNavigator,
  AltitudeHold,
  SpeedHold,
  HeadingHold,
  FlightDirector,
  AutopilotManager,
} from "./flight-control"

export {
  BoatMCS,
  DynamicPositioning,
  DPController,
  DynamicPosition,
  StationKeeper,
  ThrusterAllocator,
  DPFilter,
  FlightControlSurfaces,
  HelicopterControl,
} from "./boat-mcs"

export {
  RocketGNC,
  TrajectoryPlanner,
  AttitudeControl,
  StagingSystem,
  AbortSystem,
  TelemetryRecorder,
} from "./rocket-gnc"

export {
  RobotController,
  ManipulatorArm,
  MobileBase,
  OccupancyGrid,
  SensorFusion,
} from "./robot-controller"

export {
  EngineECU,
  TransmissionECU,
  ABSSystem,
  StabilityControl,
  CruiseControl,
  ADASSystem,
  ClimateControl as CarClimateControl,
  TireMonitor,
  OBDReader,
} from "./car-ecu"

export {
  MotorMixer,
  Quaternion,
  DroneFlightController,
  BatteryMonitor,
  FailsafeSystem,
  GeofenceSystem,
  WaypointNavigator as DroneWaypointNavigator,
} from "./drone-fc"

export {
  FlightDataRecorder,
  GroundCollisionAvoidance,
  FuelOptimizer,
  ApproachController,
  PerformanceCalculator,
  EmergencyAutoland,
  EngineHealthMonitor,
} from "./aircraft-autonomy"

export {
  FormationFlight,
  PayloadController,
  VisualLandingSystem,
  ReturnToHome,
  ObjectTracker,
  BatteryManager,
  GeofenceEnforcer,
  DroneAutonomy,
} from "./drone-autonomy"

export {
  SensorFusionEngine,
  PathPlanner,
  LaneController,
  ParkingController,
  AutonomousEmergencyBraking,
  DriverMonitoring,
  TrafficSignRecognition,
  AdaptiveCruiseControl,
  CarAutonomy,
} from "./car-autonomy"

export {
  RadarProcessor,
  AISReceiver,
  VoyagePlanner,
  COLREGSAvoidance,
  ManeuveringPrediction,
  GMDSS,
  BoatAutonomy,
} from "./boat-autonomy"

export {
  MissionPlanner,
  OrbitDetermination,
  PropulsionController,
  LaunchSequencer,
  RocketAutonomy,
} from "./rocket-autonomy"

export {
  MotionPlanner,
  ForceController,
  TaskScheduler,
  VisionProcessor,
  RobotAutonomy,
} from "./robot-autonomy"

export {
  scanForModels,
  getModelDir,
  detectBackends,
  generateLocally,
  downloadModel,
  quickTest,
} from "./local-model-provider"
export type { LocalModelInfo, GenerateOptions, GenerateResult, BackendInfo } from "./local-model-provider"

export {
  PINNED_MODELS,
  getPinnedModel,
  getPinnedByCategory,
  getPinnedModelIds,
  isPinnedModel,
  getPinnedLocalPath,
  formatSize,
} from "./pinned-models"
export type { PinnedModel, ModelCategory } from "./pinned-models"

export {
  startDownload,
  cancelDownload,
  isModelDownloaded,
  getDownloadProgress,
  onDownloadProgress,
  getActiveDownloads,
  formatSpeed,
  formatETA,
} from "./download-manager"
export type { DownloadProgress, DownloadStatus } from "./download-manager"

// ═══════════════════════════════════════════════════════════════════
// Aviation Tools
// ═══════════════════════════════════════════════════════════════════
export {
  ATCCommunication,
  WeatherSystem,
  NOTAMSystem,
  RunwayConditionSystem,
  TCASResolution,
  PilotOverride,
  CabinPressure,
  EngineHealthMonitoring,
} from "./aviation-tools"
export type { METAR, SIGMET, NOTAM, RunwayCondition } from "./aviation-tools"

// ═══════════════════════════════════════════════════════════════════
// Ground Vehicle Tools
// ═══════════════════════════════════════════════════════════════════
export {
  V2XCommunication,
  PedestrianPrediction,
  TrafficLightRecognition,
  DriverMonitoringSystem,
  RoadConditionSystem,
  CollisionImminenceSystem,
} from "./ground-tools"

// ═══════════════════════════════════════════════════════════════════
// Drone Tools
// ═══════════════════════════════════════════════════════════════════
export {
  GeoFencing,
  WindEstimation,
  ObstacleAvoidance3D,
  SwarmIntelligence,
  PackageDeliveryChain,
  AgriculturalSpraying,
  SearchAndRescue,
} from "./drone-tools"

// ═══════════════════════════════════════════════════════════════════
// Space Tools
// ═══════════════════════════════════════════════════════════════════
export {
  LaunchWindowCalculator,
  GroundStationScheduler,
  StageRecovery,
  PayloadDeployment,
  DeorbitPlanning,
  ConstellationManagement,
  EclipsePrediction,
  ThermalProtection,
} from "./space-tools"

// ═══════════════════════════════════════════════════════════════════
// Helicopter Tools
// ═══════════════════════════════════════════════════════════════════
export {
  RotorController,
  HoverController,
  ExternalLoadController,
  AutorotationSystem,
  HelicopterWeatherCompensation,
  VerticalTakeoffLanding,
} from "./helicopter-tools"

// ═══════════════════════════════════════════════════════════════════
// Medical Tools
// ═══════════════════════════════════════════════════════════════════
export {
  VitalSignsMonitor,
  DrugInteractionChecker,
  PatientMonitor,
} from "./medical-tools"

// ═══════════════════════════════════════════════════════════════════
// Industrial Tools
// ═══════════════════════════════════════════════════════════════════
export {
  PLCController,
  SCADAMonitor,
  CNCController,
  RoboticArmController,
  ConveyorController,
} from "./industrial-tools"

// ═══════════════════════════════════════════════════════════════════
// Infrastructure Tools
// ═══════════════════════════════════════════════════════════════════
export {
  PowerGridController,
  WaterTreatmentSystem,
  HVACController,
  FireSuppressionSystem,
  RailwayController,
} from "./infrastructure-tools"

// ═══════════════════════════════════════════════════════════════════
// Security Tools
// ═══════════════════════════════════════════════════════════════════
export {
  SurveillanceSystem,
  AccessControlSystem,
  IntrusionDetector,
  CyberSecurityMonitor,
  EncryptionEngine,
} from "./security-tools"

// ═══════════════════════════════════════════════════════════════════
// Survey Tools
// ═══════════════════════════════════════════════════════════════════
export {
  LiDARScanner,
  GPSRTK,
  TotalStation,
  DroneMapper,
  SeismicMonitor,
} from "./survey-tools"

// ═══════════════════════════════════════════════════════════════════
// Agriculture Tools
// ═══════════════════════════════════════════════════════════════════
export {
  SoilAnalyzer,
  CropMonitor,
  IrrigationController,
  PestDetector,
  HarvestPlanner,
} from "./agriculture-tools"

// ═══════════════════════════════════════════════════════════════════
// Marine Tools
// ═══════════════════════════════════════════════════════════════════
export {
  SonarSystem,
  NavigationChart,
  HullMonitor,
  AnchorSystem,
  BallastController,
} from "./marine-tools"

// ═══════════════════════════════════════════════════════════════════
// Construction Tools
// ═══════════════════════════════════════════════════════════════════
export {
  ExcavatorController,
  CraneController,
  ConcreteMixer,
  SurveyDrone,
  BulldozerController,
} from "./construction-tools"

// ═══════════════════════════════════════════════════════════════════
// Physical Interface Tools
// ═══════════════════════════════════════════════════════════════════
export {
  ArduinoController,
  RaspberryPiController,
  CANBusController,
  UARTController,
  I2CBusController,
  SPIController,
  ADCController,
  PWMController,
} from "./physical-interface"

// ═══════════════════════════════════════════════════════════════════
// Sensor Tools
// ═══════════════════════════════════════════════════════════════════
export {
  LiDARSensor,
  CameraSensor,
  RadarSensor,
  IMUSensor,
  UltrasonicSensor,
  ThermalSensor,
  AccelerometerSensor,
  PressureSensor,
} from "./sensor-tools"

// ═══════════════════════════════════════════════════════════════════
// SDR Tools
// ═══════════════════════════════════════════════════════════════════
export {
  SDRReceiver,
  FMTransmitter,
  WiFiAnalyzer,
  BluetoothScanner,
  LoRaTransceiver,
  GPSReceiver,
  SignalAnalyzer,
} from "./sdr-tools"

// ═══════════════════════════════════════════════════════════════════
// Safety Tools
// ═══════════════════════════════════════════════════════════════════
export {
  FailSafeSystem,
  WatchdogTimer,
  EmergencyShutdown,
  RedundancyManager,
  FMEAAnalyzer,
  SafetyInterlock,
  CircuitBreaker,
} from "./safety-tools"

// ═══════════════════════════════════════════════════════════════════
// ML Tools
// ═══════════════════════════════════════════════════════════════════
export {
  VisionModel,
  NLPModel,
  PredictionEngine,
  ClassifierEngine,
  AnomalyDetector,
  ReinforcementLearner,
} from "./ml-tools"

// ═══════════════════════════════════════════════════════════════════
// Digital Twin Tools
// ═══════════════════════════════════════════════════════════════════
export {
  TwinManager,
  PhysicsEngine,
  ScenarioRunner,
  StateSynchronizer,
  SimulationScheduler,
} from "./digital-twin"

// ═══════════════════════════════════════════════════════════════════
// Dashboard Tools
// ═══════════════════════════════════════════════════════════════════
export {
  DashboardManager,
  ChartEngine,
  StatusMonitor,
  RealTimeStream,
  WidgetFactory,
} from "./dashboard-tools"

// ═══════════════════════════════════════════════════════════════════
// Alert Tools
// ═══════════════════════════════════════════════════════════════════
export {
  AlertManager,
  NotificationEngine,
  EscalationPolicy,
  AnomalyAlerter,
} from "./alert-tools"

// ═══════════════════════════════════════════════════════════════════
// Data Logger Tools
// ═══════════════════════════════════════════════════════════════════
export {
  TimeSeriesDB,
  EventLogger,
  AuditTrail,
  DataExporter,
  StorageManager,
} from "./data-logger"

// ═══════════════════════════════════════════════════════════════════
// Remote Control Tools
// ═══════════════════════════════════════════════════════════════════
export {
  WebSocketServer,
  RESTAPI,
  NetworkAuth,
  RemoteSession,
  CommandProtocol,
  HeartbeatMonitor,
} from "./remote-control"

// ═══════════════════════════════════════════════════════════════════
// Predictive Maintenance Tools
// ═══════════════════════════════════════════════════════════════════
export {
  FailurePredictor,
  MaintenanceScheduler,
  SparePartsManager,
  VibrationAnalyzer,
  OilAnalyzer,
  ThermalTrendAnalyzer,
} from "./predictive-maintenance"

// ═══════════════════════════════════════════════════════════════════
// Decision Support Tools
// ═══════════════════════════════════════════════════════════════════
export {
  DecisionEngine,
  ScenarioAnalyzer,
  RiskAssessor,
  TradeoffAnalyzer,
  DecisionTree,
  CausalAnalyzer,
} from "./decision-support"

// ═══════════════════════════════════════════════════════════════════
// Authorization Tools
// ═══════════════════════════════════════════════════════════════════
export {
  RBACManager,
  AuthenticationEngine,
  PolicyEngine,
  AccessLog,
  TokenManager,
  CertificateManager,
} from "./authorization-tools"

// ═══════════════════════════════════════════════════════════════════
// Common Sense Tools
// ═══════════════════════════════════════════════════════════════════
export {
  ReasoningEngine,
  CausalInference,
  WorldModel,
  ContextManager,
  AnalogyEngine,
  SpatialReasoning,
} from "./common-sense"

// ═══════════════════════════════════════════════════════════════════
// Ethics Tools
// ═══════════════════════════════════════════════════════════════════
export {
  EthicalFramework,
  BiasDetector,
  FairnessAnalyzer,
  TransparencyEngine,
  SafetyValidator,
} from "./ethics-tools"

// ═══════════════════════════════════════════════════════════════════
// Creativity Tools
// ═══════════════════════════════════════════════════════════════════
export {
  IdeaGenerator,
  InnovationEngine,
  DesignThinking,
  PatternSynthesizer,
  ConstraintRelaxer,
} from "./creativity-tools"

// ═══════════════════════════════════════════════════════════════════
// Ultra X Tools — Singularity Tier
// ═══════════════════════════════════════════════════════════════════

export { UniversalCommandEngine } from "./universal-command"
export type { UniversalCommand, CommandResult, CommandHistory } from "./universal-command"

export { RealityBridge } from "./reality-bridge"
export type { IoTDevice, Scene, DeviceState, AutomationAction } from "./reality-bridge"

export { OmniCreator } from "./omni-creator"
export type { CreationType, CreationRequest, CreationResult, CreationTemplate } from "./omni-creator"

export { TimeManipulator } from "./time-manipulator"
export type { CodeSnapshot, TimeEvent, EvolutionMetrics } from "./time-manipulator"

export { ConsciousnessTransfer } from "./consciousness-transfer"
export type { Agent, TransferPackage, CollaborationSession } from "./consciousness-transfer"

export { SelfEvolvingCodebase } from "./self-evolve"
export type { CodePattern, RefactorSuggestion, EvolutionMetric } from "./self-evolve"

export { EmotionAwareComputing } from "./emotion-aware"
export type { Emotion, EmotionReading, AdaptationRule } from "./emotion-aware"

export { MemoryPalace } from "./memory-palace"
export type { MemoryNode, MemoryQuery, MemoryStats } from "./memory-palace"

export { RealitySimulator } from "./reality-sim"
export type { SimulationScenario, SimulationResult } from "./reality-sim"

export { SingularityEngine } from "./singularity"
export type { SystemState, Capability, HealAction, EvolutionStep } from "./singularity"

// ═══════════════════════════════════════════════════════════════════
// Code Guardian — Real-Time Code Intelligence
// ═══════════════════════════════════════════════════════════════════
export { CodeGuardian, CodeGuardianScanner, CodeGuardianMonaco, CodeGuardianAIFeedback } from "./code-guardian"
export type { CodeIssue, ScanResult, IssueSeverity, MonacoMarker, HoverInfo, FeedbackMessage, AIFixResult } from "./code-guardian"
