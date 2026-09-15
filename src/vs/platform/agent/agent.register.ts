import { registerSingleton } from '../instantiation/common/extensions.js';
import { getAgentService } from './agentService.js';

// Register the agent service as a singleton
const AgentServiceSymbol = Symbol('IAgentService');
registerSingleton(AgentServiceSymbol, getAgentService, true);
