/**
 * Core module exports for Agent Driver architecture
 */

// Agent Driver implementation
export { AgentDriver } from './AgentDriver';

// Interfaces and types
export type {
    IAgent,
    IAgentDriver,
    AgentDriverResult,
    ProcessingContext,
    ProcessingStrategy,
    ProcessingOptions,
    ProcessingStatistics,
    ProcessingMetadata,
    LLMContext,
    ProcessingError,
    UserFeedback,
    ResourceRequirements
} from './AgentDriverInterface';

// Enums (can be exported normally)
export {
    ProcessingPriority,
    ContentType,
    ErrorSeverity,
    AgentStatus,
    AgentCapability
} from './AgentDriverInterface';
