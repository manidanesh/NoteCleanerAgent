/**
 * Notes AI Organizer - Main Entry Point
 * Multi-agent AI system for Apple Notes organization
 */

// Export all models
export * from './models';

// Export all agents
export { ContentExtractorAgent } from './agents/ContentExtractorAgent';
export { UtilityScorerAgent } from './agents/UtilityScorerAgent';
export { DuplicateDetectorAgent } from './agents/DuplicateDetectorAgent';
export { OrganizationAgent } from './agents/OrganizationAgent';
export { LearningComponent } from './agents/LearningComponent';
export { AgentCoordinator } from './agents/AgentCoordinator';

// Export all services
export type { LLMService } from './services/LLMService';
export type { NotesAPIService } from './services/NotesAPIService';
export type { VectorIndexingService } from './services/VectorIndexingService';

// Export security services
export { SecurityService } from './services/SecurityService';
export { SecureCacheService } from './services/SecureCacheService';
export { SecureNetworkService } from './services/SecureNetworkService';
export { SecureMemoryManager } from './services/SecureMemoryManager';
export { SecurityIntegrationService } from './services/SecurityIntegrationService';

// Export UI components
export { Dashboard } from './ui/components/Dashboard';
export { RecommendationCard } from './ui/components/RecommendationCard';
export { DetailView } from './ui/components/DetailView';
export { BiometricAuthProvider, useBiometricAuth, withBiometricAuth } from './ui/components/BiometricAuthProvider';

// Version information
export const VERSION = '1.0.0';
export const BUILD_TARGET = process.env.NODE_ENV || 'development';