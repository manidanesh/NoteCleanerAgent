/**
 * Central export for all data models
 */

// Core models
export * from './Note';
export * from './UtilityScore';
export * from './Recommendation';
export * from './DuplicateGroup';
export * from './LLMModels';

// Additional types and interfaces
export interface ProcessingStatus {
  isProcessing: boolean;
  currentStep: string;
  progress: number;
  estimatedTimeRemaining?: number;
}

export interface UserFeedback {
  recommendationId: string;
  action: 'approved' | 'rejected';
  timestamp: Date;
  context?: string;
}

export interface SystemConfiguration {
  maxConcurrentProcessing: number;
  cpuThrottleThreshold: number;
  memoryThreshold: number;
  batchSize: number;
  enableOnDeviceLLM: boolean;
  enableCloudLLM: boolean;
  privacyMode: 'strict' | 'balanced' | 'performance';
}