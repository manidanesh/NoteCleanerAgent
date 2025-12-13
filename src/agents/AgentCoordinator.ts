import { Note } from '../models/Note';
import { Recommendation } from '../models/Recommendation';
import { UtilityScore } from '../models/UtilityScore';
import { DuplicateGroup } from '../models/DuplicateGroup';
import { ProcessingStatus, SystemConfiguration, UserFeedback } from '../models';
import { ContentExtractorAgent, ExtractedContent } from './ContentExtractorAgent';
import { UtilityScorerAgent } from './UtilityScorerAgent';
import { DuplicateDetectorAgent } from './DuplicateDetectorAgent';
import { OrganizationAgent } from './OrganizationAgent';
import { LearningComponent } from './LearningComponent';
import { JunkNoteDetectorAgent, JunkDetectionResult } from './JunkNoteDetectorAgent';
import { LLMService } from '../services/LLMService';
import { VectorIndexingService } from '../services/VectorIndexingService';
import { PerformanceOptimizer } from '../services/PerformanceOptimizer';
import { BatchProcessor } from '../services/BatchProcessor';

/**
 * Agent capability registration information
 */
export interface AgentCapability {
  agentId: string;
  name: string;
  version: string;
  capabilities: string[];
  dependencies: string[];
  status: AgentStatus;
  lastHealthCheck: Date;
}

/**
 * Agent status enumeration
 */
export enum AgentStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  ERROR = 'error',
  INITIALIZING = 'initializing'
}

/**
 * Workflow step definition
 */
export interface WorkflowStep {
  id: string;
  name: string;
  agentId: string;
  dependencies: string[];
  timeout: number;
  retryCount: number;
  fallbackStrategy: FallbackStrategy;
}

/**
 * Fallback strategy for agent failures
 */
export enum FallbackStrategy {
  SKIP = 'skip',
  RETRY = 'retry',
  FALLBACK_AGENT = 'fallback_agent',
  MANUAL_INTERVENTION = 'manual_intervention'
}

/**
 * Processing result from workflow execution
 */
export interface ProcessingResult {
  noteId: string;
  extractedContent?: ExtractedContent;
  utilityScore?: UtilityScore;
  duplicateGroups?: DuplicateGroup[];
  recommendations?: Recommendation[];
  junkDetectionResult?: JunkDetectionResult;
  errors: ProcessingError[];
  processingTime: number;
  timestamp: Date;
}

/**
 * Processing error information
 */
export interface ProcessingError {
  step: string;
  agentId: string;
  error: string;
  severity: 'warning' | 'error' | 'critical';
  recoverable: boolean;
  fallbackUsed?: string;
}

/**
 * Cross-device coordination message
 */
export interface CoordinationMessage {
  id: string;
  type: CoordinationMessageType;
  sourceDevice: string;
  targetDevice?: string;
  payload: any;
  timestamp: Date;
  priority: MessagePriority;
}

/**
 * Types of coordination messages
 */
export enum CoordinationMessageType {
  PROCESSING_REQUEST = 'processing_request',
  PROCESSING_COMPLETE = 'processing_complete',
  STATUS_UPDATE = 'status_update',
  SYNC_REQUEST = 'sync_request',
  CAPABILITY_ANNOUNCEMENT = 'capability_announcement',
  HEALTH_CHECK = 'health_check'
}

/**
 * Message priority levels
 */
export enum MessagePriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  CRITICAL = 'critical'
}

/**
 * Agent Coordinator - Lightweight orchestration system for specialized AI agents
 * Implements Requirements 25.1, 25.2, 25.3, 25.4, 25.5
 */
export class AgentCoordinator {
  private agents: Map<string, AgentCapability> = new Map();
  private workflow: WorkflowStep[] = [];
  private processingQueue: Note[] = [];
  private isProcessing: boolean = false;
  private processingStatus: ProcessingStatus = {
    isProcessing: false,
    currentStep: '',
    progress: 0
  };
  private config: SystemConfiguration;
  private deviceId: string;
  private coordinationCallbacks: Map<CoordinationMessageType, Function[]> = new Map();

  // Performance optimization components
  private performanceOptimizer: PerformanceOptimizer;
  private batchProcessor: BatchProcessor;

  // Agent instances
  private contentExtractor: ContentExtractorAgent;
  private utilityScorer: UtilityScorerAgent;
  private duplicateDetector: DuplicateDetectorAgent;
  private organizationAgent: OrganizationAgent;
  private learningComponent: LearningComponent;
  private junkDetector: JunkNoteDetectorAgent;

  constructor(
    llmService: LLMService,
    config?: Partial<SystemConfiguration>
  ) {
    this.config = {
      maxConcurrentProcessing: 5,
      cpuThrottleThreshold: 75,
      memoryThreshold: 80,
      batchSize: 10,
      enableOnDeviceLLM: true,
      enableCloudLLM: false,
      privacyMode: 'strict',
      ...config
    };

    // Enforce privacy mode constraints
    if (this.config.privacyMode === 'strict') {
      this.config.enableCloudLLM = false;
    }

    this.deviceId = this.generateDeviceId();

    // Initialize performance optimization components
    this.performanceOptimizer = new PerformanceOptimizer({
      maxCpuUsage: this.config.cpuThrottleThreshold || 25,
      maxMemoryUsage: this.config.memoryThreshold || 500,
      batchSize: this.config.batchSize,
      enableCaching: true,
      enableInterruption: true
    });

    // Initialize agents
    this.contentExtractor = new ContentExtractorAgent(llmService);
    this.utilityScorer = new UtilityScorerAgent(llmService);
    this.duplicateDetector = new DuplicateDetectorAgent(llmService);
    this.organizationAgent = new OrganizationAgent(llmService);
    this.learningComponent = new LearningComponent();
    this.junkDetector = new JunkNoteDetectorAgent(llmService);

    // Initialize batch processor
    this.batchProcessor = new BatchProcessor(this, this.performanceOptimizer);

    // Register agents and setup workflow
    this.initializeAgents();
    this.setupWorkflow();
  }

  /**
   * Initialize and register all agents with their capabilities
   * Implements Requirements 25.1: Agent capability registration
   */
  private initializeAgents(): void {
    // Register Content Extractor Agent
    this.registerAgent({
      agentId: 'content-extractor',
      name: 'Content Extractor Agent',
      version: '1.0.0',
      capabilities: [
        'text_processing',
        'ocr_processing',
        'image_analysis',
        'attachment_processing',
        'checklist_parsing',
        'semantic_analysis'
      ],
      dependencies: ['llm-service'],
      status: AgentStatus.INITIALIZING,
      lastHealthCheck: new Date()
    });

    // Register Utility Scorer Agent
    this.registerAgent({
      agentId: 'utility-scorer',
      name: 'Utility Scorer Agent',
      version: '1.0.0',
      capabilities: [
        'tfidf_analysis',
        'behavioral_scoring',
        'semantic_scoring',
        'rule_based_classification',
        'hybrid_scoring'
      ],
      dependencies: ['llm-service', 'content-extractor'],
      status: AgentStatus.INITIALIZING,
      lastHealthCheck: new Date()
    });

    // Register Duplicate Detector Agent
    this.registerAgent({
      agentId: 'duplicate-detector',
      name: 'Duplicate Detector Agent',
      version: '1.0.0',
      capabilities: [
        'vector_indexing',
        'similarity_search',
        'semantic_comparison',
        'merge_strategy_determination',
        'conflict_resolution'
      ],
      dependencies: ['llm-service', 'vector-indexing-service'],
      status: AgentStatus.INITIALIZING,
      lastHealthCheck: new Date()
    });

    // Register Organization Agent
    this.registerAgent({
      agentId: 'organization-agent',
      name: 'Organization Agent',
      version: '1.0.0',
      capabilities: [
        'title_analysis',
        'title_generation',
        'folder_suggestions',
        'recommendation_generation',
        'batch_optimization'
      ],
      dependencies: ['llm-service', 'utility-scorer'],
      status: AgentStatus.INITIALIZING,
      lastHealthCheck: new Date()
    });

    // Register Learning Component
    this.registerAgent({
      agentId: 'learning-component',
      name: 'Learning Component',
      version: '1.0.0',
      capabilities: [
        'feedback_collection',
        'pattern_recognition',
        'algorithm_adaptation',
        'privacy_preserving_learning'
      ],
      dependencies: [],
      status: AgentStatus.INITIALIZING,
      lastHealthCheck: new Date()
    });

    // Register Junk Note Detector Agent
    this.registerAgent({
      agentId: 'junk-detector',
      name: 'Junk Note Detector Agent',
      version: '1.0.0',
      capabilities: [
        'pattern_recognition',
        'content_analysis',
        'temporal_analysis',
        'behavioral_analysis',
        'multi_stage_validation',
        'junk_categorization'
      ],
      dependencies: ['llm-service'],
      status: AgentStatus.INITIALIZING,
      lastHealthCheck: new Date()
    });

    // Mark all agents as active after registration
    this.agents.forEach(agent => {
      agent.status = AgentStatus.ACTIVE;
    });
  }

  /**
   * Setup the processing workflow sequence
   * Implements Requirements 25.4: Workflow sequencing
   */
  private setupWorkflow(): void {
    this.workflow = [
      {
        id: 'indexing',
        name: 'Vector Indexing Preparation',
        agentId: 'duplicate-detector',
        dependencies: [],
        timeout: 30000, // 30 seconds
        retryCount: 2,
        fallbackStrategy: FallbackStrategy.SKIP
      },
      {
        id: 'extraction',
        name: 'Content Extraction',
        agentId: 'content-extractor',
        dependencies: [],
        timeout: 60000, // 60 seconds
        retryCount: 3,
        fallbackStrategy: FallbackStrategy.RETRY
      },
      {
        id: 'scoring',
        name: 'Utility Scoring',
        agentId: 'utility-scorer',
        dependencies: ['extraction'],
        timeout: 30000, // 30 seconds
        retryCount: 2,
        fallbackStrategy: FallbackStrategy.FALLBACK_AGENT
      },
      {
        id: 'detection',
        name: 'Duplicate Detection',
        agentId: 'duplicate-detector',
        dependencies: ['indexing', 'extraction'],
        timeout: 45000, // 45 seconds
        retryCount: 2,
        fallbackStrategy: FallbackStrategy.SKIP
      },
      {
        id: 'junk-detection',
        name: 'Junk Note Detection',
        agentId: 'junk-detector',
        dependencies: ['extraction'],
        timeout: 30000, // 30 seconds
        retryCount: 2,
        fallbackStrategy: FallbackStrategy.SKIP
      },
      {
        id: 'recommendations',
        name: 'Recommendation Generation',
        agentId: 'organization-agent',
        dependencies: ['scoring', 'junk-detection'],
        timeout: 30000, // 30 seconds
        retryCount: 2,
        fallbackStrategy: FallbackStrategy.RETRY
      }
    ];
  }

  /**
   * Register an agent with its capabilities
   * Implements Requirements 25.1: Agent capability registration
   */
  registerAgent(capability: AgentCapability): void {
    this.agents.set(capability.agentId, capability);
    console.log(`Registered agent: ${capability.name} (${capability.agentId})`);
  }

  /**
   * Get registered agent capabilities
   */
  getAgentCapabilities(): AgentCapability[] {
    return Array.from(this.agents.values());
  }

  /**
   * Process a single note through the complete workflow
   * Implements Requirements 25.2: Agent communication protocols
   */
  async processNote(note: Note): Promise<ProcessingResult> {
    const startTime = Date.now();
    const result: ProcessingResult = {
      noteId: note.id,
      errors: [],
      processingTime: 0,
      timestamp: new Date()
    };

    try {
      // Update processing status
      this.updateProcessingStatus('Starting note processing', 0);

      // Execute workflow steps in sequence
      for (let i = 0; i < this.workflow.length; i++) {
        const step = this.workflow[i];
        const progress = ((i + 1) / this.workflow.length) * 100;
        
        this.updateProcessingStatus(`Executing ${step.name}`, progress);

        try {
          await this.executeWorkflowStep(step, note, result);
        } catch (error) {
          const processingError: ProcessingError = {
            step: step.id,
            agentId: step.agentId,
            error: `${error}`,
            severity: 'error',
            recoverable: step.fallbackStrategy !== FallbackStrategy.MANUAL_INTERVENTION
          };

          result.errors.push(processingError);

          // Handle fallback strategies
          const fallbackResult = await this.handleStepFailure(step, error, note, result);
          if (!fallbackResult.canContinue) {
            break;
          }
        }
      }

      result.processingTime = Date.now() - startTime;
      this.updateProcessingStatus('Processing complete', 100);

      return result;

    } catch (error) {
      result.errors.push({
        step: 'coordinator',
        agentId: 'agent-coordinator',
        error: `Critical processing failure: ${error}`,
        severity: 'critical',
        recoverable: false
      });

      result.processingTime = Date.now() - startTime;
      return result;
    }
  }

  /**
   * Process multiple notes in batches with performance optimization
   * Implements Requirements 8.1, 8.2, 8.3, 8.4, 8.5: Performance optimization system
   */
  async processNotes(notes: Note[], resumeFromCheckpoint?: string): Promise<ProcessingResult[]> {
    // Use the optimized batch processor
    return await this.batchProcessor.processNotes(notes, resumeFromCheckpoint);
  }

  /**
   * Process multiple notes in batches (legacy method for backward compatibility)
   * Implements Requirements 25.5: Data consistency across agent interactions
   */
  async processNotesLegacy(notes: Note[]): Promise<ProcessingResult[]> {
    const results: ProcessingResult[] = [];
    
    // Check if we can process based on system resources
    if (!(await this.performanceOptimizer.canProcessBatch())) {
      throw new Error('System resources insufficient for processing');
    }

    // Create optimized batches
    const batches = this.performanceOptimizer.createOptimizedBatches(notes);

    this.isProcessing = true;
    
    try {
      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        // Check for interruption
        if (this.performanceOptimizer.shouldInterruptProcessing()) {
          console.log('Processing interrupted by performance optimizer');
          break;
        }

        // Wait for resources if needed
        while (!(await this.performanceOptimizer.canProcessBatch())) {
          console.log('Waiting for system resources...');
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

        const batch = batches[batchIndex];
        const batchProgress = (batchIndex / batches.length) * 100;
        
        this.updateProcessingStatus(
          `Processing batch ${batchIndex + 1} of ${batches.length}`,
          batchProgress
        );

        // Process batch with concurrency control
        const batchPromises = batch.map(note => this.processNote(note));
        const batchResults = await Promise.allSettled(batchPromises);

        // Collect results and handle failures
        for (const promiseResult of batchResults) {
          if (promiseResult.status === 'fulfilled') {
            results.push(promiseResult.value);
          } else {
            // Create error result for failed processing
            results.push({
              noteId: 'unknown',
              errors: [{
                step: 'batch-processing',
                agentId: 'agent-coordinator',
                error: `Batch processing failed: ${promiseResult.reason}`,
                severity: 'error',
                recoverable: true
              }],
              processingTime: 0,
              timestamp: new Date()
            });
          }
        }

        // Perform memory cleanup if needed
        if (batchIndex % 5 === 0) { // Every 5 batches
          this.performanceOptimizer.performMemoryCleanup();
        }
      }

      return results;

    } finally {
      this.isProcessing = false;
      this.updateProcessingStatus('Idle', 0);
    }
  }

  /**
   * Execute a specific workflow step
   * Implements Requirements 25.2: Agent communication protocols
   */
  private async executeWorkflowStep(
    step: WorkflowStep,
    note: Note,
    result: ProcessingResult
  ): Promise<void> {
    // Check agent health before execution
    const agent = this.agents.get(step.agentId);
    if (!agent || agent.status !== AgentStatus.ACTIVE) {
      throw new Error(`Agent ${step.agentId} is not available`);
    }

    // Check dependencies
    for (const dependency of step.dependencies) {
      if (!this.isDependencySatisfied(dependency, result)) {
        throw new Error(`Dependency ${dependency} not satisfied for step ${step.id}`);
      }
    }

    // Execute step with timeout
    const stepPromise = this.executeAgentOperation(step.agentId, note, result);
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Step ${step.id} timed out`)), step.timeout);
    });

    await Promise.race([stepPromise, timeoutPromise]);
  }

  /**
   * Execute operation for a specific agent
   */
  private async executeAgentOperation(
    agentId: string,
    note: Note,
    result: ProcessingResult
  ): Promise<void> {
    switch (agentId) {
      case 'content-extractor':
        result.extractedContent = await this.contentExtractor.extractContent(note);
        break;

      case 'utility-scorer':
        if (!result.extractedContent) {
          throw new Error('Content extraction required for utility scoring');
        }
        result.utilityScore = await this.utilityScorer.scoreNote(note);
        break;

      case 'duplicate-detector':
        // For single note processing, we'll skip duplicate detection
        // In batch processing, this would be handled differently
        result.duplicateGroups = [];
        break;

      case 'junk-detector':
        result.junkDetectionResult = await this.junkDetector.analyzeNote(note);
        break;

      case 'organization-agent':
        if (!result.utilityScore) {
          throw new Error('Utility score required for recommendation generation');
        }
        result.recommendations = await this.organizationAgent.generateRecommendations(
          note,
          result.utilityScore
        );
        break;

      default:
        throw new Error(`Unknown agent: ${agentId}`);
    }
  }

  /**
   * Handle workflow step failure with fallback strategies
   * Implements Requirements 25.3: Fallback mechanisms for agent failures
   */
  private async handleStepFailure(
    step: WorkflowStep,
    error: any,
    note: Note,
    result: ProcessingResult
  ): Promise<{ canContinue: boolean; fallbackUsed?: string }> {
    console.warn(`Step ${step.id} failed:`, error);

    switch (step.fallbackStrategy) {
      case FallbackStrategy.SKIP:
        console.log(`Skipping failed step: ${step.id}`);
        return { canContinue: true, fallbackUsed: 'skip' };

      case FallbackStrategy.RETRY:
        if (step.retryCount > 0) {
          console.log(`Retrying step: ${step.id} (${step.retryCount} attempts remaining)`);
          step.retryCount--;
          try {
            await this.executeWorkflowStep(step, note, result);
            return { canContinue: true, fallbackUsed: 'retry_success' };
          } catch (retryError) {
            return this.handleStepFailure(step, retryError, note, result);
          }
        } else {
          console.log(`Retry limit exceeded for step: ${step.id}, skipping`);
          return { canContinue: true, fallbackUsed: 'retry_exhausted' };
        }

      case FallbackStrategy.FALLBACK_AGENT:
        console.log(`Using fallback for step: ${step.id}`);
        try {
          await this.executeFallbackOperation(step.agentId, note, result);
          return { canContinue: true, fallbackUsed: 'fallback_agent' };
        } catch (fallbackError) {
          console.error(`Fallback also failed for step: ${step.id}`, fallbackError);
          return { canContinue: true, fallbackUsed: 'fallback_failed' };
        }

      case FallbackStrategy.MANUAL_INTERVENTION:
        console.error(`Manual intervention required for step: ${step.id}`);
        return { canContinue: false, fallbackUsed: 'manual_intervention' };

      default:
        return { canContinue: false };
    }
  }

  /**
   * Execute fallback operation for failed agent
   */
  private async executeFallbackOperation(
    agentId: string,
    note: Note,
    result: ProcessingResult
  ): Promise<void> {
    switch (agentId) {
      case 'utility-scorer':
        // Fallback to simple rule-based scoring
        result.utilityScore = {
          noteId: note.id,
          overallScore: 50, // Neutral score
          contentScore: Math.min(100, note.content.length / 10),
          behavioralScore: 50,
          semanticScore: 50,
          ruleBasedScore: 50,
          explanation: 'Fallback scoring used due to agent failure',
          confidence: 0.3,
          factors: [{
            name: 'Fallback Scoring',
            weight: 1.0,
            value: 50,
            description: 'Simple fallback scoring mechanism'
          }],
          timestamp: new Date()
        };
        break;

      case 'organization-agent':
        // Fallback to basic recommendations
        result.recommendations = [{
          id: `fallback_${note.id}_${Date.now()}`,
          noteId: note.id,
          action: 'review' as any,
          confidence: 0.3,
          reasoning: 'Manual review recommended due to processing limitations',
          impact: 'low' as any,
          reversible: true,
          timestamp: new Date(),
          status: 'pending' as any
        }];
        break;

      default:
        throw new Error(`No fallback available for agent: ${agentId}`);
    }
  }

  /**
   * Check if workflow step dependency is satisfied
   */
  private isDependencySatisfied(dependency: string, result: ProcessingResult): boolean {
    switch (dependency) {
      case 'extraction':
        return !!result.extractedContent;
      case 'scoring':
        return !!result.utilityScore;
      case 'indexing':
        return true; // Always satisfied for single note processing
      default:
        return false;
    }
  }

  /**
   * Create batches from notes array (legacy method)
   */
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Check system resources and throttle if needed (legacy method)
   */
  private async checkSystemResources(): Promise<void> {
    // Delegate to performance optimizer
    return await this.performanceOptimizer.canProcessBatch() ? 
      Promise.resolve() : 
      new Promise(resolve => setTimeout(resolve, 1000));
  }

  /**
   * Update processing status
   */
  private updateProcessingStatus(currentStep: string, progress: number): void {
    this.processingStatus = {
      isProcessing: progress < 100,
      currentStep,
      progress,
      estimatedTimeRemaining: progress > 0 ? 
        ((Date.now() - (this.processingStatus as any).startTime) / progress) * (100 - progress) : 
        undefined
    };

    // Broadcast status update for cross-device coordination
    this.broadcastCoordinationMessage({
      type: CoordinationMessageType.STATUS_UPDATE,
      payload: this.processingStatus,
      priority: MessagePriority.NORMAL
    });
  }

  /**
   * Get current processing status
   */
  getProcessingStatus(): ProcessingStatus {
    return { ...this.processingStatus };
  }

  /**
   * Record user feedback and update learning
   */
  recordFeedback(
    recommendationId: string,
    action: 'approved' | 'rejected',
    context?: any
  ): UserFeedback {
    return this.learningComponent.recordFeedback(recommendationId, action, context);
  }

  /**
   * Cross-device coordination methods
   * Implements Requirements 25.5: Cross-device coordination
   */

  /**
   * Register callback for coordination messages
   */
  onCoordinationMessage(
    messageType: CoordinationMessageType,
    callback: (message: CoordinationMessage) => void
  ): void {
    if (!this.coordinationCallbacks.has(messageType)) {
      this.coordinationCallbacks.set(messageType, []);
    }
    this.coordinationCallbacks.get(messageType)!.push(callback);
  }

  /**
   * Broadcast coordination message to other devices
   */
  private broadcastCoordinationMessage(
    messageData: Partial<CoordinationMessage>
  ): void {
    const message: CoordinationMessage = {
      id: this.generateMessageId(),
      sourceDevice: this.deviceId,
      timestamp: new Date(),
      priority: MessagePriority.NORMAL,
      ...messageData
    } as CoordinationMessage;

    // In a real implementation, this would send the message over the network
    console.log(`Broadcasting coordination message: ${message.type}`, message);
  }

  /**
   * Handle incoming coordination message
   */
  handleCoordinationMessage(message: CoordinationMessage): void {
    const callbacks = this.coordinationCallbacks.get(message.type);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(message);
        } catch (error) {
          console.error('Error handling coordination message:', error);
        }
      });
    }
  }

  /**
   * Request processing delegation to macOS companion
   */
  async requestMacOSProcessing(notes: Note[]): Promise<void> {
    this.broadcastCoordinationMessage({
      type: CoordinationMessageType.PROCESSING_REQUEST,
      payload: {
        notes: notes.map(n => ({ id: n.id, title: n.title })),
        requestedCapabilities: ['heavy_processing', 'ocr', 'vector_indexing']
      },
      priority: MessagePriority.HIGH
    });
  }

  /**
   * Announce capabilities to other devices
   */
  announceCapabilities(): void {
    this.broadcastCoordinationMessage({
      type: CoordinationMessageType.CAPABILITY_ANNOUNCEMENT,
      payload: {
        deviceId: this.deviceId,
        capabilities: Array.from(this.agents.values()),
        systemConfig: this.config
      },
      priority: MessagePriority.NORMAL
    });
  }

  /**
   * Perform health check on all agents
   */
  async performHealthCheck(): Promise<Map<string, AgentStatus>> {
    const healthStatus = new Map<string, AgentStatus>();

    for (const [agentId, agent] of this.agents) {
      try {
        // Simple health check - in real implementation would be more comprehensive
        agent.lastHealthCheck = new Date();
        agent.status = AgentStatus.ACTIVE;
        healthStatus.set(agentId, AgentStatus.ACTIVE);
      } catch (error) {
        console.error(`Health check failed for agent ${agentId}:`, error);
        agent.status = AgentStatus.ERROR;
        healthStatus.set(agentId, AgentStatus.ERROR);
      }
    }

    return healthStatus;
  }

  /**
   * Get system configuration
   */
  getConfiguration(): SystemConfiguration {
    return { ...this.config };
  }

  /**
   * Update system configuration
   */
  updateConfiguration(newConfig: Partial<SystemConfiguration>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Enforce privacy mode constraints
    if (this.config.privacyMode === 'strict') {
      this.config.enableCloudLLM = false;
    }
  }

  /**
   * Generate unique device ID
   */
  private generateDeviceId(): string {
    return `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate unique message ID
   */
  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get performance optimizer instance
   */
  getPerformanceOptimizer(): PerformanceOptimizer {
    return this.performanceOptimizer;
  }

  /**
   * Get batch processor instance
   */
  getBatchProcessor(): BatchProcessor {
    return this.batchProcessor;
  }

  /**
   * Interrupt current processing
   */
  interruptProcessing(): void {
    this.batchProcessor.interruptProcessing();
  }

  /**
   * Get processing progress
   */
  getProcessingProgress(): any {
    return this.batchProcessor.getProgress();
  }

  /**
   * Perform memory cleanup
   */
  performMemoryCleanup(): void {
    this.performanceOptimizer.performMemoryCleanup();
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): any {
    return this.performanceOptimizer.getPerformanceMetrics();
  }

  /**
   * Get resource metrics
   */
  getResourceMetrics(): any {
    return this.performanceOptimizer.getCurrentResourceMetrics();
  }

  /**
   * Update performance configuration
   */
  updatePerformanceConfiguration(config: any): void {
    this.performanceOptimizer.updateConfiguration(config);
  }

  /**
   * Shutdown coordinator and cleanup resources
   */
  async shutdown(): Promise<void> {
    this.isProcessing = false;
    this.processingQueue = [];
    
    // Shutdown performance components
    this.performanceOptimizer.shutdown();
    
    // Clear duplicate detector index
    await this.duplicateDetector.clearIndex();
    
    // Clear coordination callbacks
    this.coordinationCallbacks.clear();
    
    console.log('Agent Coordinator shutdown complete');
  }
}