/**
 * Agent Driver Interface - Enhanced orchestration for intelligent agent coordination
 * 
 * This interface defines the contract for the Agent Driver approach, which provides:
 * - Intelligent routing and conditional agent invocation
 * - Parallel processing of independent agents
 * - LLM context sharing and optimization
 * - Resource-aware throttling and adaptation
 * - Learning-based processing strategy selection
 */

import { Note } from '../models/Note';
import { Recommendation } from '../models/Recommendation';
import { UtilityScore } from '../models/UtilityScore';
import { DuplicateGroup } from '../models/DuplicateGroup';
import { ExtractedContent } from '../agents/ContentExtractorAgent';
import { JunkDetectionResult } from '../agents/JunkNoteDetectorAgent';

/**
 * Agent interface that all agents must implement
 */
export interface IAgent {
  /** Unique identifier for the agent */
  readonly agentId: string;
  
  /** Human-readable name */
  readonly name: string;
  
  /** Agent version */
  readonly version: string;
  
  /** Capabilities this agent provides */
  readonly capabilities: AgentCapability[];
  
  /** Other agents this agent depends on */
  readonly dependencies: string[];
  
  /** Current status of the agent */
  status: AgentStatus;
  
  /** Initialize the agent */
  initialize?(): Promise<void>;
  
  /** Health check for the agent */
  healthCheck?(): Promise<boolean>;
  
  /** Estimate resource requirements for processing */
  estimateResourceRequirements?(note: Note): ResourceRequirements;
}

/**
 * Agent capability enumeration
 */
export enum AgentCapability {
  // Content Extractor capabilities
  TEXT_PROCESSING = 'text_processing',
  OCR_PROCESSING = 'ocr_processing',
  IMAGE_ANALYSIS = 'image_analysis',
  ATTACHMENT_PROCESSING = 'attachment_processing',
  CHECKLIST_PARSING = 'checklist_parsing',
  SEMANTIC_ANALYSIS = 'semantic_analysis',
  
  // Utility Scorer capabilities
  TFIDF_ANALYSIS = 'tfidf_analysis',
  BEHAVIORAL_SCORING = 'behavioral_scoring',
  SEMANTIC_SCORING = 'semantic_scoring',
  RULE_BASED_CLASSIFICATION = 'rule_based_classification',
  HYBRID_SCORING = 'hybrid_scoring',
  
  // Duplicate Detector capabilities
  VECTOR_INDEXING = 'vector_indexing',
  SIMILARITY_SEARCH = 'similarity_search',
  SEMANTIC_COMPARISON = 'semantic_comparison',
  MERGE_STRATEGY = 'merge_strategy',
  CONFLICT_RESOLUTION = 'conflict_resolution',
  
  // Organization Agent capabilities
  TITLE_ANALYSIS = 'title_analysis',
  TITLE_GENERATION = 'title_generation',
  FOLDER_SUGGESTIONS = 'folder_suggestions',
  RECOMMENDATION_GENERATION = 'recommendation_generation',
  BATCH_OPTIMIZATION = 'batch_optimization',
  
  // Junk Detector capabilities
  PATTERN_RECOGNITION = 'pattern_recognition',
  CONTENT_ANALYSIS = 'content_analysis',
  TEMPORAL_ANALYSIS = 'temporal_analysis',
  BEHAVIORAL_ANALYSIS = 'behavioral_analysis',
  MULTI_STAGE_VALIDATION = 'multi_stage_validation',
  JUNK_CATEGORIZATION = 'junk_categorization',
  
  // Learning Component capabilities
  FEEDBACK_COLLECTION = 'feedback_collection',
  PATTERN_LEARNING = 'pattern_learning',
  ALGORITHM_ADAPTATION = 'algorithm_adaptation',
  PRIVACY_PRESERVING_LEARNING = 'privacy_preserving_learning'
}

/**
 * Agent status enumeration
 */
export enum AgentStatus {
  INITIALIZING = 'initializing',
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  ERROR = 'error',
  DEGRADED = 'degraded' // Agent is working but with reduced functionality
}

/**
 * Resource requirements for agent processing
 */
export interface ResourceRequirements {
  /** Estimated CPU usage (0-100) */
  estimatedCpuUsage: number;
  
  /** Estimated memory usage in MB */
  estimatedMemoryMb: number;
  
  /** Estimated processing time in milliseconds */
  estimatedTimeMs: number;
  
  /** Whether this operation requires LLM */
  requiresLLM: boolean;
  
  /** Priority level for resource allocation */
  priority: ProcessingPriority;
}

/**
 * Processing priority levels
 */
export enum ProcessingPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  CRITICAL = 'critical'
}

/**
 * Processing context shared between agents
 * This enables LLM context sharing and avoids redundant analysis
 */
export interface ProcessingContext {
  /** Unique identifier for this processing session */
  sessionId: string;
  
  /** The note being processed */
  note: Note;
  
  /** Extracted content (from Content Extractor) */
  extractedContent?: ExtractedContent;
  
  /** Utility score (from Utility Scorer) */
  utilityScore?: UtilityScore;
  
  /** Duplicate groups (from Duplicate Detector) */
  duplicateGroups?: DuplicateGroup[];
  
  /** Junk detection result (from Junk Detector) */
  junkDetectionResult?: JunkDetectionResult;
  
  /** Recommendations (from Organization Agent) */
  recommendations?: Recommendation[];
  
  /** Shared LLM context to avoid redundant analysis */
  llmContext?: LLMContext;
  
  /** Processing metadata */
  metadata: ProcessingMetadata;
  
  /** Errors encountered during processing */
  errors: ProcessingError[];
}

/**
 * LLM context shared between agents
 */
export interface LLMContext {
  /** Semantic embedding of the note content */
  embedding?: number[];
  
  /** Key topics extracted from content */
  topics: string[];
  
  /** Entities identified (people, dates, locations) */
  entities: {
    people: string[];
    dates: string[];
    locations: string[];
    other: string[];
  };
  
  /** Content type classification */
  contentType: ContentType;
  
  /** Importance indicators from LLM analysis */
  importanceIndicators: string[];
  
  /** Summary of the note content */
  summary?: string;
  
  /** Cached LLM responses to avoid redundant calls */
  cachedResponses: Map<string, any>;
}

/**
 * Content type classification
 */
export enum ContentType {
  MEETING_NOTES = 'meeting_notes',
  IDEA = 'idea',
  TASK = 'task',
  REFERENCE = 'reference',
  SHOPPING_LIST = 'shopping_list',
  SCRATCH_PAD = 'scratch_pad',
  JOURNAL = 'journal',
  CODE_SNIPPET = 'code_snippet',
  OTHER = 'other'
}

/**
 * Processing metadata
 */
export interface ProcessingMetadata {
  /** When processing started */
  startTime: Date;
  
  /** Total processing time so far (ms) */
  elapsedTimeMs: number;
  
  /** Which agents have been invoked */
  invokedAgents: string[];
  
  /** Processing strategy being used */
  strategy: ProcessingStrategy;
  
  /** Whether processing was interrupted */
  interrupted: boolean;
  
  /** Resource usage tracking */
  resourceUsage: {
    cpuUsage: number;
    memoryUsageMb: number;
    llmCallCount: number;
  };
}

/**
 * Processing strategy types
 */
export type ProcessingStrategy = 'quick_junk' | 'comprehensive' | 'balanced';

/**
 * Processing strategy configuration determined by Agent Driver
 */
export interface ProcessingStrategyConfig {
  /** Strategy name/identifier */
  name: ProcessingStrategy;
  
  /** Which agents to invoke */
  agentsToInvoke: string[];
  
  /** Whether to run agents in parallel */
  enableParallelProcessing: boolean;
  
  /** Whether to skip duplicate detection */
  skipDuplicateDetection: boolean;
  
  /** Whether to skip junk detection */
  skipJunkDetection: boolean;
  
  /** Whether to use enhanced organization analysis */
  useEnhancedOrganization: boolean;
  
  /** Confidence threshold for recommendations */
  confidenceThreshold: number;
  
  /** Reasoning for this strategy selection */
  reasoning: string;
}

/**
 * Processing error information
 */
export interface ProcessingError {
  /** Which agent encountered the error */
  agentId: string;
  
  /** Error message */
  message: string;
  
  /** Error severity */
  severity: ErrorSeverity;
  
  /** Whether processing can continue */
  recoverable: boolean;
  
  /** Fallback action taken */
  fallbackAction?: string;
  
  /** Timestamp of error */
  timestamp: Date;
}

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical'
}

/**
 * Processing result from Agent Driver
 */
export interface AgentDriverResult {
  /** Processing context with all results */
  context: ProcessingContext;
  
  /** Whether processing completed successfully */
  success: boolean;
  
  /** Total processing time */
  processingTimeMs: number;
  
  /** Final recommendations */
  recommendations: Recommendation[];
  
  /** Processing statistics */
  statistics: ProcessingStatistics;
}

/**
 * Processing statistics
 */
export interface ProcessingStatistics {
  /** Number of agents invoked */
  agentsInvoked: number;
  
  /** Number of agents skipped */
  agentsSkipped: number;
  
  /** Number of LLM calls made */
  llmCallsMade: number;
  
  /** Number of LLM calls cached */
  llmCallsCached: number;
  
  /** Total CPU usage */
  totalCpuUsage: number;
  
  /** Total memory usage */
  totalMemoryUsageMb: number;
  
  /** Number of errors encountered */
  errorsEncountered: number;
  
  /** Number of fallbacks used */
  fallbacksUsed: number;
}

/**
 * Agent Driver interface
 */
export interface IAgentDriver {
  /**
   * Process a single note with intelligent agent coordination
   * @param note The note to process
   * @param options Optional processing options
   * @returns Processing result with recommendations
   */
  processNote(note: Note, options?: ProcessingOptions): Promise<AgentDriverResult>;
  
  /**
   * Process multiple notes in batch with optimization
   * @param notes Array of notes to process
   * @param options Optional processing options
   * @returns Array of processing results
   */
  processNotes(notes: Note[], options?: ProcessingOptions): Promise<AgentDriverResult[]>;
  
  /**
   * Register an agent with the driver
   * @param agent The agent to register
   */
  registerAgent(agent: IAgent): void;
  
  /**
   * Get all registered agents
   * @returns Array of registered agents
   */
  getRegisteredAgents(): IAgent[];
  
  /**
   * Determine processing strategy for a note
   * @param note The note to analyze
   * @param context Current processing context
   * @returns Recommended processing strategy
   */
  determineStrategy(note: Note, context: ProcessingContext): Promise<ProcessingStrategyConfig>;
  
  /**
   * Update processing strategy based on learning
   * @param feedback User feedback on recommendations
   */
  updateStrategyFromFeedback(feedback: UserFeedback[]): Promise<void>;
}

/**
 * Processing options
 */
export interface ProcessingOptions {
  /** Force specific processing strategy */
  forceStrategy?: ProcessingStrategyConfig;
  
  /** Skip learning/adaptation */
  skipLearning?: boolean;
  
  /** Maximum processing time (ms) */
  maxProcessingTime?: number;
  
  /** Priority level */
  priority?: ProcessingPriority;
  
  /** Enable verbose logging */
  verbose?: boolean;
}

/**
 * User feedback for learning
 */
export interface UserFeedback {
  /** Recommendation ID */
  recommendationId: string;
  
  /** Note ID */
  noteId: string;
  
  /** Whether user accepted or rejected */
  accepted: boolean;
  
  /** User's reasoning (optional) */
  userReasoning?: string;
  
  /** Timestamp of feedback */
  timestamp: Date;
  
  /** Additional context */
  context?: any;
}
