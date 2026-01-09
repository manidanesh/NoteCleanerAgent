/**
 * LangGraph-based Agent Coordinator
 * 
 * Replaces the custom AgentCoordinator with LangGraph workflows
 * for more robust orchestration and better error handling.
 */

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
import { VectorIndexingServiceImpl } from '../services/VectorIndexingService';
import { DatabaseService } from '../services/DatabaseService';
import { WorkerPool } from '../services/worker/WorkerPool';

// Import the ProcessingResult interface from AgentCoordinator for compatibility
import { ProcessingResult, ProcessingError } from './AgentCoordinator';

// LangGraph imports
import { createAllWorkflows } from '../langgraph/graphs';
import { AgentProcessingState, createInitialState } from '../langgraph/state';
import { ProcessingStrategy } from '../core/AgentDriverInterface';

/**
 * LangGraph-based Agent Coordinator
 * Uses LangGraph workflows for orchestration instead of custom logic
 */
export class LangGraphCoordinator {
  private static instance: LangGraphCoordinator;

  private workflows: any;
  private processingStatus: ProcessingStatus = {
    isProcessing: false,
    currentStep: '',
    progress: 0
  };
  private config: SystemConfiguration;

  // Agent instances
  private contentExtractor: ContentExtractorAgent;
  private utilityScorer: UtilityScorerAgent;
  private duplicateDetector: DuplicateDetectorAgent;
  private organizationAgent: OrganizationAgent;
  private learningComponent: LearningComponent;
  private junkDetector: JunkNoteDetectorAgent;

  public static getInstance(
    llmService?: LLMService,
    databaseService?: DatabaseService,
    workerPool?: WorkerPool,
    config?: Partial<SystemConfiguration>
  ): LangGraphCoordinator {
    if (!LangGraphCoordinator.instance) {
      if (!llmService) {
        throw new Error('LLMService is required for first initialization');
      }
      LangGraphCoordinator.instance = new LangGraphCoordinator(llmService, databaseService, workerPool, config);
    }
    return LangGraphCoordinator.instance;
  }

  constructor(
    llmService: LLMService,
    databaseService?: DatabaseService,
    workerPool?: WorkerPool,
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

    if (this.config.privacyMode === 'strict') {
      this.config.enableCloudLLM = false;
    }

    // Initialize services with error handling
    let vectorIndexingService: VectorIndexingServiceImpl;
    try {
      vectorIndexingService = new VectorIndexingServiceImpl(databaseService);
    } catch (error) {
      console.warn('⚠️  Vector indexing service initialization failed, using fallback:', error);
      // Create a mock vector indexing service for testing
      vectorIndexingService = {
        initialize: async () => {},
        addVector: async () => {},
        search: async () => [],
        removeVector: async () => {},
        clear: async () => {},
        getStats: () => ({ totalVectors: 0, indexType: 'mock' })
      } as any;
    }

    // Initialize agents
    this.contentExtractor = new ContentExtractorAgent(llmService);
    this.utilityScorer = new UtilityScorerAgent(llmService, workerPool);
    this.duplicateDetector = new DuplicateDetectorAgent(llmService, vectorIndexingService);
    this.organizationAgent = new OrganizationAgent(llmService);
    this.learningComponent = new LearningComponent();
    this.junkDetector = new JunkNoteDetectorAgent(llmService);

    // Initialize LangGraph workflows
    this.initializeWorkflows();
  }

  /**
   * Initialize LangGraph workflows
   */
  private initializeWorkflows(): void {
    console.log('🔧 Initializing LangGraph workflows...');
    
    this.workflows = createAllWorkflows(
      this.contentExtractor,
      this.utilityScorer,
      this.junkDetector,
      this.duplicateDetector,
      this.organizationAgent
    );

    console.log('✅ LangGraph workflows initialized');
  }

  /**
   * Initialize the coordinator and all its components
   */
  public async initialize(): Promise<void> {
    console.log('🚀 Initializing LangGraphCoordinator...');

    // Initialize all agents
    await Promise.all([
      this.contentExtractor.initialize?.(),
      this.utilityScorer.initialize?.(),
      this.duplicateDetector.initialize?.(1000), // Default to 1000 notes for initialization
      this.organizationAgent.initialize?.(),
      this.learningComponent.initialize?.(),
      this.junkDetector.initialize?.()
    ].filter(Boolean));

    console.log('✅ LangGraphCoordinator initialized successfully');
  }

  /**
   * Process a single note using LangGraph workflows
   */
  async processNote(note: Note, strategy: ProcessingStrategy = 'balanced'): Promise<ProcessingResult> {
    const startTime = Date.now();
    
    try {
      console.log(`📝 Processing note "${note.title}" with ${strategy} strategy`);
      
      // Create initial state
      const initialState = createInitialState(note, strategy);
      
      // Select workflow based on strategy
      const workflow = this.selectWorkflow(strategy);
      
      // Execute workflow
      this.updateProcessingStatus(`Processing with ${strategy} workflow`, 0);
      
      const result = await workflow.invoke(initialState, {
        configurable: {
          thread_id: `note_${note.id}_${Date.now()}`
        }
      });

      // Convert LangGraph result to our format
      const processingResult = this.convertToProcessingResult(result, strategy, Date.now() - startTime);
      
      this.updateProcessingStatus('Processing complete', 100);
      
      console.log(`✅ Note processing complete in ${processingResult.processingTime}ms`);
      return processingResult;

    } catch (error) {
      console.error('❌ LangGraph processing failed:', error);
      
      return {
        noteId: note.id,
        errors: [{
          step: 'workflow',
          agentId: 'langgraph-coordinator',
          error: `Workflow execution failed: ${error}`,
          severity: 'critical',
          recoverable: false
        }],
        processingTime: Date.now() - startTime,
        timestamp: new Date()
      };
    }
  }

  /**
   * Process multiple notes in batches
   */
  async processNotes(notes: Note[], strategy: ProcessingStrategy = 'balanced'): Promise<ProcessingResult[]> {
    const results: ProcessingResult[] = [];
    const batchSize = this.config.batchSize || 10;

    console.log(`📊 Processing ${notes.length} notes in batches of ${batchSize}`);

    // Process in batches to manage resources
    for (let i = 0; i < notes.length; i += batchSize) {
      const batch = notes.slice(i, i + batchSize);
      const batchProgress = (i / notes.length) * 100;
      
      this.updateProcessingStatus(
        `Processing batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(notes.length / batchSize)} (${results.length}/${notes.length} notes completed)`,
        batchProgress
      );

      console.log(`🔄 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(notes.length / batchSize)} - Notes ${i + 1}-${Math.min(i + batchSize, notes.length)} of ${notes.length}`);

      // Process batch concurrently but with limited concurrency
      const batchPromises = batch.map(note => this.processNote(note, strategy));
      const batchResults = await Promise.allSettled(batchPromises);

      // Collect results
      for (const promiseResult of batchResults) {
        if (promiseResult.status === 'fulfilled') {
          results.push(promiseResult.value);
        } else {
          // Create error result for failed processing
          results.push({
            noteId: 'unknown',
            errors: [{
              step: 'batch-processing',
              agentId: 'langgraph-coordinator',
              error: `Batch processing failed: ${promiseResult.reason}`,
              severity: 'error',
              recoverable: true
            }],
            processingTime: 0,
            timestamp: new Date()
          });
        }
      }

      // Small delay between batches to prevent overwhelming the system
      if (i + batchSize < notes.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Progress update after each batch
      console.log(`📊 Batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(notes.length / batchSize)} complete - ${results.length}/${notes.length} notes processed (${Math.round((results.length / notes.length) * 100)}%)`);
    }

    this.updateProcessingStatus('Batch processing complete', 100);
    console.log(`✅ Processed ${results.length} notes`);
    
    return results;
  }

  /**
   * Select appropriate workflow based on strategy
   */
  private selectWorkflow(strategy: ProcessingStrategy): any {
    switch (strategy) {
      case 'quick_junk':
        return this.workflows.quickJunk;
      case 'comprehensive':
        return this.workflows.comprehensive;
      case 'balanced':
      default:
        return this.workflows.balanced;
    }
  }

  /**
   * Convert LangGraph state to our processing result format
   */
  private convertToProcessingResult(
    state: AgentProcessingState,
    workflowUsed: ProcessingStrategy,
    processingTime: number
  ): ProcessingResult {
    return {
      noteId: state.note.id,
      extractedContent: state.extractedContent,
      utilityScore: state.utilityScore,
      duplicateGroups: state.duplicateGroups || [],
      recommendations: state.recommendations || [],
      junkDetectionResult: state.junkDetectionResult,
      errors: state.metadata.errors.map(error => ({
        step: error.agentId,
        agentId: error.agentId,
        error: error.message,
        severity: error.severity === 'critical' ? 'critical' : 
                 error.severity === 'error' ? 'error' : 'warning',
        recoverable: error.recoverable
      })),
      processingTime,
      timestamp: new Date()
    };
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
   * Get available workflows
   */
  getAvailableWorkflows(): ProcessingStrategy[] {
    return ['quick_junk', 'comprehensive', 'balanced'];
  }

  /**
   * Get workflow information
   */
  getWorkflowInfo(workflowName: ProcessingStrategy): any {
    const workflows = {
      quick_junk: {
        name: 'Quick Junk Detection',
        description: 'Fast path for obvious junk notes',
        steps: ['extract', 'detectJunk', 'generateRecommendations'],
        estimatedTime: '< 1 second'
      },
      comprehensive: {
        name: 'Comprehensive Analysis',
        description: 'Full analysis with parallel execution',
        steps: ['extract', 'scoreUtility', 'detectDuplicates', 'organize'],
        estimatedTime: '2-5 seconds'
      },
      balanced: {
        name: 'Balanced Processing',
        description: 'Standard workflow with conditional routing',
        steps: ['extract', 'scoreUtility', 'detectJunk', 'detectDuplicates', 'organize'],
        estimatedTime: '1-3 seconds'
      }
    };

    return workflows[workflowName];
  }

  /**
   * Shutdown coordinator and cleanup resources
   */
  async shutdown(): Promise<void> {
    console.log('🔄 Shutting down LangGraphCoordinator...');

    // Clear duplicate detector index
    await this.duplicateDetector.clearIndex();

    console.log('✅ LangGraphCoordinator shutdown complete');
  }
}