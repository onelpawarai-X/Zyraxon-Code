import { registerSingleton } from '../instantiation/common/extensions.js';
import { AiProviderService } from './aiProviderService.js';
import { AiProviderAgentBridgeRegistry } from './aiProviderAgentBridge.js';

// Use symbols as service identifiers (interfaces don't exist at runtime)
const IAiProviderServiceSymbol = Symbol('IAiProviderService');
registerSingleton(IAiProviderServiceSymbol, AiProviderService, true);
registerSingleton(AiProviderAgentBridgeRegistry, AiProviderAgentBridgeRegistry, true);
