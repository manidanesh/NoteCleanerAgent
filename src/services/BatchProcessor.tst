import {nano ./src/services/BatchProcessor.ts
 Note } from '../models/Note';
import { ProcessingResult, AgentCoordinator } from '../agents/AgentCoordinator';
import { PerformanceOptimizer, BatchResult, ProcessingCheckpoint } from './PerformanceOptimizer';

/**
 * Batch processing configuration
 */
export interface BatchProcessingConfig {
  maxConcurrentBatches: number;
  batchTimeout: number; // milliseconds
  retryAttempts: number;
  progressUpdateInterval: number; // milliseconds
  enableCheckpointing: boolean;
  checkpointInterval: number; // number of batches between checkpoints
}

/**
 * Batch processing progress information
 */
export interface BatchProgress {
  totalBatches: number;
  completedBatches: number;
  currentBatch: number;
  totalNotes: number;
  processedNotes: number;
  estimatedTimeRemaining: number; // milliseconds
  averageBatchTime: number; // milliseconds
  currentStep: string;
  errors: string[];
}

/**
 * Batch processing event types
 */
export type BatchProcessingEvent = 
  | { type: 'batch_started'; batchIndex: number; batchSize: number }
  | { type: 'batch_completed'; batchIndex: number; result: BatchResult }
  | { type: 'batch_failed'; batchIndex: number; error: string }
  | { type: 'processing_paused'; reason: string }
  | { type: 'processing_resumed'; fromCheckpoint?: string }
  | { type: 'checkpoint_created'; checkpoint: ProcessingCheckpoint }
  | { type: 'progress_updated'; progress: BatchProgress };

/**
 * Batch Processor - Handles large-scale note processing with optimization
 * Implements Requirements 8.1, 8.4: Batch processing and interruption/resumption
 */
export class BatchProcessor {
  private config: BatchProcessingConfig;
  private performanceOptimizer: PerformanceOptimizer;
  private agentCoordinator: AgentCoordinator;
  private isProcessing: boolean = false;
  private isPaused: boolean = false;
  private currentProgress: BatchProgress;
  private eventListeners: ((event: BatchProcessingEvent) => void)[] = [];
  private processingStartTime?: Date;
  private batchTimes: number[] = [];

  constructor(
    agentCoordinator: AgentCoordinator,
    performanceOptimizer: PerformanceOptimizer,
    config?: Partial<BatchProcessingConfig>
  ) {
    this.agentCoordinator = agentCoordinator;
    this.performanceOptimizer = performanceOptimizer;
    this.config = {
      maxConcurrentBatches: 2,
      batchTimeout: 60000, // 1 minute per batch
      retryAttempts: 3,
      progressUpdateInterval: 1000, // 1 second
      enableCheckpointing: true,
      checkpointInterval: 5, // Every 5 batches
      ...config
    };

    this.currentProgress = {
      totalBatches: 0,
      completedBatches: 0,
      currentBatch: 0,
      totalNotes: 0,
      processedNotes: 0,
      estimatedTimeRemaining: 0,
      averageBatchTime: 0,
      currentStep: 'Idle',
      errors: []
    };
  }

  /**
   * Process notes in optimized batches
   */
  async processNotes(notes: Note[], resumeFromCheckpoint?: string): Promise<ProcessingResult[]> {
    // Reset processing state if it's stuck
    if (this.isProcessing) {
      console.warn('Batch processing already in progress - resetting state and proceeding');
      this.isProcessing = false;
      this.isPaused = false;
    }

    this.isProcessing = true;
    this.isPaused = false;
    this.processingStartTime = new Date();
    
    // Declare allResults outside try block so it's accessible in catch
    let allResults: ProcessingResult[] = [];
    
    try {
      // Check if resuming from checkpoint
      let checkpoint: ProcessingCheckpoint | null = null;
      let startBatchIndex = 0;
      let remainingNotes = notes;

      if (resumeFromCheckpoint) {
        checkpoint = this.performanceOptimizer.resumeFromCheckpoint(resumeFromCheckpoint);
        if (checkpoint) {
          startBatchIndex = checkpoint.batchIndex;
          allResults = [...checkpoint.partialResults];
          
          // Filter out already processed notes
          remainingNotes = notes.filter(note => 
            !checkpoint!.processedNotes.includes(note.id)
          );
          
          this.emitEvent({
            type: 'processing_resumed',
            fromCheckpoint: resumeFromCheckpoint
          });
        }
      }

      // Create optimized batches
      const batches = this.performanceOptimizer.createOptimizedBatches(remainingNotes);
      
      // Initialize progress tracking
      this.currentProgress = {
        totalBatches: batches.length,
        completedBatches: startBatchIndex,
        currentBatch: startBatchIndex,
        totalNotes: notes.length,
        processedNotes: allResults.length,
        estimatedTimeRemaining: 0,
        averageBatchTime: 0,
        currentStep: 'Starting batch processing',
        errors: []
      };

      this.emitEvent({
        type: 'progress_updated',
        progress: { ...this.currentProgress }
      });

      // Process batches
      for (let i = startBatchIndex; i < batches.length; i++) {
        // Check for interruption
        if (this.performanceOptimizer.shouldInterruptProcessing()) {
          await this.pauseProcessing(i, allResults, batches, notes);
          break;
        }

        // Wait for resources if throttled
        while (!(await this.performanceOptimizer.canProcessBatch())) {
          if (!this.isPaused) {
            this.isPaused = true;
            this.emitEvent({
              type: 'processing_paused',
              reason: 'Resource constraints'
            });
          }
          
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Check for interruption during pause
          if (this.performanceOptimizer.shouldInterruptProcessing()) {
            await this.pauseProcessing(i, allResults, batches, notes);
            return allResults;
          }
        }

        if (this.isPaused) {
          this.isPaused = false;
          this.emitEvent({
            type: 'processing_resumed'
          });
        }

        // Process current batch
        const batchResult = await this.processBatch(batches[i], i);
        allResults.push(...batchResult.results);

        // Update progress
        this.updateProgress(i + 1, allResults.length, batchResult.processingTime);

        // Create checkpoint if needed
        if (this.config.enableCheckpointing && 
            (i + 1) % this.config.checkpointInterval === 0) {
          const processedNoteIds = allResults.map(r => r.noteId);
          const pendingNoteIds = notes
            .filter(n => !processedNoteIds.includes(n.id))
            .map(n => n.id);
          
          const checkpoint = this.performanceOptimizer.createCheckpoint(
            i + 1,
            processedNoteIds,
            pendingNoteIds,
            allResults
          );
          
          this.emitEvent({
            type: 'checkpoint_created',
            checkpoint
          });
        }
      }

      // Final progress update
      this.currentProgress.currentStep = 'Processing complete';
      this.emitEvent({
        type: 'progress_updated',
        progress: { ...this.currentProgress }
      });

      return allResults;

    } catch (error) {
      console.error('Batch processing failed:', error);
      // Return partial results instead of throwing
      return allResults;
    } finally {
      // Always reset processing state to prevent infinite loops
      this.isProcessing = false;
      this.isPaused = false;
      this.performanceOptimizer.resetInterruption();
      console.log('Batch processing state reset');
    }
  }

  /**
   * Process a single batch with error handling and retries
   */
  private async processBatch(batch: Note[], batchIndex: number): Promise<BatchResult> {
    const batchId = `batch_${batchIndex}_${Date.now()}`;
    const startTime = Date.now();
    
    this.emitEvent({
      type: 'batch_started',
      batchIndex,
      batchSize: batch.length
    });

    let attempts = 0;
    let lastError: string | null = null;

    while (attempts < this.config.retryAttempts) {
      try {
        // Create timeout promise
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Batch processing timeout')), this.config.batchTimeout);
        });

        // Process batch with timeout
        const processingPromise = const processingPromise = this.agentCoordinator.processNotesLegacy(batch);;
        const results = await Promise.race([processingPromise, timeoutPromise]);

        const processingTime = Date.now() - startTime;
        const resourceUsage = this.performanceOptimizer.getCurrentResourceMetrics();

        const batchResult: BatchResult = {
          batchId,
          results,
          processingTime,
          resourceUsage,
          errors: lastError ? [lastError] : []
        };

        this.emitEvent({
          type: 'batch_completed',
          batchIndex,
          result: batchResult
        });

        return batchResult;

      } catch (error) {
        attempts++;
        lastError = `Attempt ${attempts}: ${error}`;
        
        if (attempts < this.config.retryAttempts) {
          console.warn(`Batch ${batchIndex} failed, retrying (${attempts}/${this.config.retryAttempts}):`, error);
          
          // Exponential backoff
          const delay = Math.pow(2, attempts) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          console.error(`Batch ${batchIndex} failed after ${this.config.retryAttempts} attempts:`, error);
          
          this.emitEvent({
            type: 'batch_failed',
            batchIndex,
            error: lastError || `${error}`
          });

          // Return partial results with errors
          const processingTime = Date.now() - startTime;
          const resourceUsage = this.performanceOptimizer.getCurrentResourceMetrics();

          return {
            batchId,
            results: [], // No results due to failure
            processingTime,
            resourceUsage,
            errors: [lastError || `${error}`]
          };
        }
      }
    }

    // This should never be reached, but TypeScript requires it
    throw new Error('Unexpected end of processBatch method');
  }

  /**
   * Pause processing and create checkpoint
   */
  private async pauseProcessing(
    currentBatchIndex: number,
    partialResults: ProcessingResult[],
    batches: Note[][],
    allNotes: Note[]
  ): Promise<void> {
    const processedNoteIds = partialResults.map(r => r.noteId);
    const pendingNoteIds = allNotes
      .filter(n => !processedNoteIds.includes(n.id))
      .map(n => n.id);
    
    const checkpoint = this.performanceOptimizer.createCheckpoint(
      currentBatchIndex,
      processedNoteIds,
      pendingNoteIds,
      partialResults
    );
    
    this.emitEvent({
      type: 'processing_paused',
      reason: 'User interruption'
    });
    
    this.emitEvent({
      type: 'checkpoint_created',
      checkpoint
    });
  }

  /**
   * Update processing progress
   */
  private updateProgress(completedBatches: number, processedNotes: number, lastBatchTime: number): void {
    this.batchTimes.push(lastBatchTime);
    
    // Calculate average batch time (last 10 batches for better accuracy)
    const recentBatchTimes = this.batchTimes.slice(-10);
    const averageBatchTime = recentBatchTimes.reduce((sum, time) => sum + time, 0) / recentBatchTimes.length;
    
    // Estimate remaining time
    const remainingBatches = this.currentProgress.totalBatches - completedBatches;
    const estimatedTimeRemaining = remainingBatches * averageBatchTime;

    this.currentProgress = {
      ...this.currentProgress,
      completedBatches,
      currentBatch: completedBatches,
      processedNotes,
      averageBatchTime,
      estimatedTimeRemaining,
      currentStep: `Processing batch ${completedBatches + 1} of ${this.currentProgress.totalBatches}`
    };

    this.emitEvent({
      type: 'progress_updated',
      progress: { ...this.currentProgress }
    });
  }

  /**
   * Interrupt current processing
   */
  interruptProcessing(): void {
    this.performanceOptimizer.interruptProcessing();
  }

  /**
   * Get current processing progress
   */
  getProgress(): BatchProgress {
    return { ...this.currentProgress };
  }

  /**
   * Check if currently processing
   */
  isCurrentlyProcessing(): boolean {
    return this.isProcessing;
  }

  /**
   * Check if processing is paused
   */
  isCurrentlyPaused(): boolean {
    return this.isPaused;
  }

  /**
   * Add event listener
   */
  addEventListener(listener: (event: BatchProcessingEvent) => void): void {
    this.eventListeners.push(listener);
  }

  /**
   * Remove event listener
   */
  removeEventListener(listener: (event: BatchProcessingEvent) => void): void {
    const index = this.eventListeners.indexOf(listener);
    if (index > -1) {
      this.eventListeners.splice(index, 1);
    }
  }

  /**
   * Emit event to all listeners
   */
  private emitEvent(event: BatchProcessingEvent): void {
    this.eventListeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('Error in batch processing event listener:', error);
      }
    });
  }

  /**
   * Get processing statistics
   */
  getStatistics(): {
    totalProcessingTime: number;
    averageBatchTime: number;
    totalBatches: number;
    successfulBatches: number;
    failedBatches: number;
  } {
    const totalProcessingTime = this.processingStartTime ? 
      Date.now() - this.processingStartTime.getTime() : 0;
    
    return {
      totalProcessingTime,
      averageBatchTime: this.currentProgress.averageBatchTime,
      totalBatches: this.currentProgress.totalBatches,
      successfulBatches: this.currentProgress.completedBatches,
      failedBatches: this.currentProgress.errors.length
    };
  }

  /**
   * Update configuration
   */
  updateConfiguration(newConfig: Partial<BatchProcessingConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   */
  getConfiguration(): BatchProcessingConfig {
    return { ...this.config };
  }
}
