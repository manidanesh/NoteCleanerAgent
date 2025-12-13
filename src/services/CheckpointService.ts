import { Note } from '../models/Note';
import { UtilityScore } from '../models/UtilityScore';
import { Recommendation } from '../models/Recommendation';
import { SecureCacheService } from './SecureCacheService';

/**
 * Processing stage for checkpoint tracking
 */
export enum ProcessingStage {
  INITIALIZATION = 'initialization',
  NOTE_LOADING = 'note_loading',
  CONTENT_EXTRACTION = 'content_extraction',
  UTILITY_SCORING = 'utility_scoring',
  DUPLICATE_DETECTION = 'duplicate_detection',
  ORGANIZATION_ANALYSIS = 'organization_analysis',
  RECOMMENDATION_GENERATION = 'recommendation_generation',
  COMPLETED = 'completed'
}

/**
 * Checkpoint data structure
 */
export interface ProcessingCheckpoint {
  id: string;
  sessionId: string;
  timestamp: Date;
  stage: ProcessingStage;
  progress: {
    totalNotes: number;
    processedNotes: number;
    currentNoteIndex: number;
    completedStages: ProcessingStage[];
  };
  data: {
    processedNotes: string[]; // Note IDs
    extractedContent: Record<string, any>;
    utilityScores: Record<string, UtilityScore>;
    recommendations: Record<string, Recommendation>;
    errors: string[]; // Error IDs
  };
  metadata: {
    startTime: Date;
    estimatedCompletion?: Date;
    deviceInfo: string;
    appVersion: string;
  };
}

/**
 * Recovery information for resuming processing
 */
export interface RecoveryInfo {
  canRecover: boolean;
  lastCheckpoint?: ProcessingCheckpoint;
  resumeFromStage: ProcessingStage;
  resumeFromNoteIndex: number;
  recoveredData: {
    notes: Note[];
    scores: UtilityScore[];
    recommendations: Recommendation[];
  };
  dataIntegrityCheck: {
    passed: boolean;
    issues: string[];
  };
}

/**
 * Checkpoint and recovery service for crash recovery
 * Requirement 15.3: Crash recovery with checkpoint resumption
 */
export class CheckpointService {
  private cacheService: SecureCacheService;
  private currentCheckpoint?: ProcessingCheckpoint;
  private checkpointInterval: number = 30000; // 30 seconds
  private maxCheckpoints: number = 10;
  private checkpointTimer?: NodeJS.Timeout;

  constructor(cacheService: SecureCacheService) {
    this.cacheService = cacheService;
  }

  /**
   * Start a new processing session with checkpoint tracking
   */
  async startProcessingSession(sessionId: string, totalNotes: number): Promise<void> {
    const checkpoint: ProcessingCheckpoint = {
      id: this.generateCheckpointId(),
      sessionId,
      timestamp: new Date(),
      stage: ProcessingStage.INITIALIZATION,
      progress: {
        totalNotes,
        processedNotes: 0,
        currentNoteIndex: 0,
        completedStages: []
      },
      data: {
        processedNotes: [],
        extractedContent: {},
        utilityScores: {},
        recommendations: {},
        errors: []
      },
      metadata: {
        startTime: new Date(),
        deviceInfo: this.getDeviceInfo(),
        appVersion: this.getAppVersion()
      }
    };

    await this.saveCheckpoint(checkpoint);
    this.currentCheckpoint = checkpoint;
    this.startPeriodicCheckpointing();
  }

  /**
   * Update checkpoint with current progress
   */
  async updateCheckpoint(
    stage: ProcessingStage,
    noteIndex?: number,
    data?: Partial<ProcessingCheckpoint['data']>
  ): Promise<void> {
    if (!this.currentCheckpoint) {
      throw new Error('No active processing session');
    }

    // Update stage and progress
    this.currentCheckpoint.stage = stage;
    this.currentCheckpoint.timestamp = new Date();
    
    if (noteIndex !== undefined) {
      this.currentCheckpoint.progress.currentNoteIndex = noteIndex;
      this.currentCheckpoint.progress.processedNotes = noteIndex;
    }

    // Mark stage as completed if moving to next stage
    if (!this.currentCheckpoint.progress.completedStages.includes(stage)) {
      this.currentCheckpoint.progress.completedStages.push(stage);
    }

    // Update data if provided
    if (data) {
      this.currentCheckpoint.data = {
        ...this.currentCheckpoint.data,
        ...data
      };
    }

    // Update estimated completion
    this.updateEstimatedCompletion();

    await this.saveCheckpoint(this.currentCheckpoint);
  }

  /**
   * Add processed note data to checkpoint
   */
  async addProcessedNote(
    noteId: string,
    extractedContent?: any,
    utilityScore?: UtilityScore,
    recommendations?: Recommendation[]
  ): Promise<void> {
    if (!this.currentCheckpoint) {
      throw new Error('No active processing session');
    }

    // Add note ID to processed list
    if (!this.currentCheckpoint.data.processedNotes.includes(noteId)) {
      this.currentCheckpoint.data.processedNotes.push(noteId);
    }

    // Store extracted content
    if (extractedContent) {
      this.currentCheckpoint.data.extractedContent[noteId] = extractedContent;
    }

    // Store utility score
    if (utilityScore) {
      this.currentCheckpoint.data.utilityScores[noteId] = utilityScore;
    }

    // Store recommendations
    if (recommendations) {
      recommendations.forEach(rec => {
        this.currentCheckpoint!.data.recommendations[rec.id] = rec;
      });
    }

    // Update progress
    this.currentCheckpoint.progress.processedNotes = this.currentCheckpoint.data.processedNotes.length;
  }

  /**
   * Add error to checkpoint for recovery analysis
   */
  async addError(errorId: string): Promise<void> {
    if (!this.currentCheckpoint) {
      return;
    }

    if (!this.currentCheckpoint.data.errors.includes(errorId)) {
      this.currentCheckpoint.data.errors.push(errorId);
      await this.saveCheckpoint(this.currentCheckpoint);
    }
  }

  /**
   * Complete processing session
   */
  async completeProcessingSession(): Promise<void> {
    if (!this.currentCheckpoint) {
      return;
    }

    this.currentCheckpoint.stage = ProcessingStage.COMPLETED;
    this.currentCheckpoint.timestamp = new Date();
    
    await this.saveCheckpoint(this.currentCheckpoint);
    this.stopPeriodicCheckpointing();
    this.currentCheckpoint = undefined;
  }

  /**
   * Check for recoverable processing session
   */
  async checkForRecovery(sessionId?: string): Promise<RecoveryInfo> {
    try {
      const checkpoints = await this.getRecentCheckpoints();
      
      if (checkpoints.length === 0) {
        return {
          canRecover: false,
          resumeFromStage: ProcessingStage.INITIALIZATION,
          resumeFromNoteIndex: 0,
          recoveredData: { notes: [], scores: [], recommendations: [] },
          dataIntegrityCheck: { passed: true, issues: [] }
        };
      }

      // Find the most recent incomplete checkpoint
      let targetCheckpoint: ProcessingCheckpoint | undefined;
      
      if (sessionId) {
        targetCheckpoint = checkpoints.find(cp => 
          cp.sessionId === sessionId && cp.stage !== ProcessingStage.COMPLETED
        );
      } else {
        targetCheckpoint = checkpoints.find(cp => cp.stage !== ProcessingStage.COMPLETED);
      }

      if (!targetCheckpoint) {
        return {
          canRecover: false,
          resumeFromStage: ProcessingStage.INITIALIZATION,
          resumeFromNoteIndex: 0,
          recoveredData: { notes: [], scores: [], recommendations: [] },
          dataIntegrityCheck: { passed: true, issues: [] }
        };
      }

      // Perform data integrity check
      const integrityCheck = await this.performDataIntegrityCheck(targetCheckpoint);
      
      if (!integrityCheck.passed) {
        console.warn('Data integrity check failed:', integrityCheck.issues);
        // Still allow recovery but with warnings
      }

      // Recover data from checkpoint
      const recoveredData = await this.recoverDataFromCheckpoint(targetCheckpoint);

      // Determine resume point
      const resumeFromStage = this.determineResumeStage(targetCheckpoint);
      const resumeFromNoteIndex = targetCheckpoint.progress.currentNoteIndex;

      return {
        canRecover: true,
        lastCheckpoint: targetCheckpoint,
        resumeFromStage,
        resumeFromNoteIndex,
        recoveredData,
        dataIntegrityCheck: integrityCheck
      };

    } catch (error) {
      console.error('Recovery check failed:', error);
      return {
        canRecover: false,
        resumeFromStage: ProcessingStage.INITIALIZATION,
        resumeFromNoteIndex: 0,
        recoveredData: { notes: [], scores: [], recommendations: [] },
        dataIntegrityCheck: { passed: false, issues: [`Recovery check failed: ${error}`] }
      };
    }
  }

  /**
   * Resume processing from checkpoint
   */
  async resumeFromCheckpoint(recoveryInfo: RecoveryInfo): Promise<void> {
    if (!recoveryInfo.canRecover || !recoveryInfo.lastCheckpoint) {
      throw new Error('Cannot resume: no valid checkpoint found');
    }

    // Restore checkpoint as current
    this.currentCheckpoint = {
      ...recoveryInfo.lastCheckpoint,
      id: this.generateCheckpointId(), // New checkpoint ID for resumed session
      timestamp: new Date()
    };

    // Start periodic checkpointing
    this.startPeriodicCheckpointing();

    console.info(`Resumed processing from stage: ${recoveryInfo.resumeFromStage}, note index: ${recoveryInfo.resumeFromNoteIndex}`);
  }

  /**
   * Clear old checkpoints to manage storage
   */
  async clearOldCheckpoints(olderThanHours: number = 24): Promise<void> {
    try {
      const checkpoints = await this.getAllCheckpoints();
      const cutoff = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);

      for (const checkpoint of checkpoints) {
        if (checkpoint.timestamp < cutoff) {
          await this.deleteCheckpoint(checkpoint.id);
        }
      }
    } catch (error) {
      console.error('Failed to clear old checkpoints:', error);
    }
  }

  /**
   * Get processing progress from current checkpoint
   */
  getProcessingProgress(): {
    stage: ProcessingStage;
    progress: number; // 0-1
    estimatedTimeRemaining?: number;
    processedNotes: number;
    totalNotes: number;
  } | null {
    if (!this.currentCheckpoint) {
      return null;
    }

    const progress = this.currentCheckpoint.progress.totalNotes > 0
      ? this.currentCheckpoint.progress.processedNotes / this.currentCheckpoint.progress.totalNotes
      : 0;

    let estimatedTimeRemaining: number | undefined;
    if (this.currentCheckpoint.metadata.estimatedCompletion) {
      estimatedTimeRemaining = this.currentCheckpoint.metadata.estimatedCompletion.getTime() - Date.now();
      estimatedTimeRemaining = Math.max(0, estimatedTimeRemaining);
    }

    return {
      stage: this.currentCheckpoint.stage,
      progress,
      estimatedTimeRemaining,
      processedNotes: this.currentCheckpoint.progress.processedNotes,
      totalNotes: this.currentCheckpoint.progress.totalNotes
    };
  }

  private async saveCheckpoint(checkpoint: ProcessingCheckpoint): Promise<void> {
    try {
      const cacheKey = `checkpoint_${checkpoint.id}`;
      await this.cacheService.cacheProcessingResults(cacheKey, checkpoint);
      
      // Also save as latest checkpoint for the session
      const sessionKey = `latest_checkpoint_${checkpoint.sessionId}`;
      await this.cacheService.cacheProcessingResults(sessionKey, checkpoint);
    } catch (error) {
      console.error('Failed to save checkpoint:', error);
      throw error;
    }
  }

  private async getRecentCheckpoints(): Promise<ProcessingCheckpoint[]> {
    try {
      // In a real implementation, this would query the cache for all checkpoints
      // For now, we'll simulate by trying to get recent session checkpoints
      const checkpoints: ProcessingCheckpoint[] = [];
      
      // Try to get checkpoints from the last few sessions
      for (let i = 0; i < 5; i++) {
        try {
          const sessionId = `session_${Date.now() - i * 60000}`; // Mock session IDs
          const sessionKey = `latest_checkpoint_${sessionId}`;
          const checkpoint = await this.cacheService.getCachedProcessingResults(sessionKey);
          if (checkpoint) {
            checkpoints.push(checkpoint as ProcessingCheckpoint);
          }
        } catch (error) {
          // Ignore individual failures
        }
      }
      
      return checkpoints.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    } catch (error) {
      console.error('Failed to get recent checkpoints:', error);
      return [];
    }
  }

  private async getAllCheckpoints(): Promise<ProcessingCheckpoint[]> {
    // In a real implementation, this would get all checkpoints from cache
    return this.getRecentCheckpoints();
  }

  private async deleteCheckpoint(checkpointId: string): Promise<void> {
    try {
      // In a real implementation, this would delete from cache
      console.info(`Deleted old checkpoint: ${checkpointId}`);
    } catch (error) {
      console.error('Failed to delete checkpoint:', error);
    }
  }

  private async performDataIntegrityCheck(checkpoint: ProcessingCheckpoint): Promise<{
    passed: boolean;
    issues: string[];
  }> {
    const issues: string[] = [];

    try {
      // Check if processed notes count matches data
      const processedNotesCount = checkpoint.data.processedNotes.length;
      const scoresCount = Object.keys(checkpoint.data.utilityScores).length;
      const contentCount = Object.keys(checkpoint.data.extractedContent).length;

      if (processedNotesCount !== checkpoint.progress.processedNotes) {
        issues.push('Processed notes count mismatch');
      }

      // Check for reasonable data consistency
      if (scoresCount > processedNotesCount) {
        issues.push('More utility scores than processed notes');
      }

      if (contentCount > processedNotesCount) {
        issues.push('More extracted content than processed notes');
      }

      // Check timestamp validity
      if (checkpoint.timestamp > new Date()) {
        issues.push('Checkpoint timestamp is in the future');
      }

      // Check if checkpoint is too old (more than 7 days)
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      if (checkpoint.timestamp < sevenDaysAgo) {
        issues.push('Checkpoint is too old (>7 days)');
      }

    } catch (error) {
      issues.push(`Integrity check error: ${error}`);
    }

    return {
      passed: issues.length === 0,
      issues
    };
  }

  private async recoverDataFromCheckpoint(checkpoint: ProcessingCheckpoint): Promise<{
    notes: Note[];
    scores: UtilityScore[];
    recommendations: Recommendation[];
  }> {
    try {
      // In a real implementation, this would reconstruct data from checkpoint
      const scores = Object.values(checkpoint.data.utilityScores);
      const recommendations = Object.values(checkpoint.data.recommendations);
      
      // Notes would need to be retrieved from the original source or cache
      const notes: Note[] = []; // Would be populated from cache or API

      return { notes, scores, recommendations };
    } catch (error) {
      console.error('Failed to recover data from checkpoint:', error);
      return { notes: [], scores: [], recommendations: [] };
    }
  }

  private determineResumeStage(checkpoint: ProcessingCheckpoint): ProcessingStage {
    // Resume from the current stage, or the next stage if current is completed
    const completedStages = checkpoint.progress.completedStages;
    const currentStage = checkpoint.stage;

    // If current stage is completed, move to next stage
    if (completedStages.includes(currentStage)) {
      const stageOrder = Object.values(ProcessingStage);
      const currentIndex = stageOrder.indexOf(currentStage);
      if (currentIndex < stageOrder.length - 1) {
        return stageOrder[currentIndex + 1];
      }
    }

    return currentStage;
  }

  private startPeriodicCheckpointing(): void {
    this.stopPeriodicCheckpointing(); // Clear any existing timer
    
    this.checkpointTimer = setInterval(async () => {
      if (this.currentCheckpoint) {
        try {
          await this.saveCheckpoint(this.currentCheckpoint);
        } catch (error) {
          console.error('Periodic checkpoint save failed:', error);
        }
      }
    }, this.checkpointInterval);
  }

  private stopPeriodicCheckpointing(): void {
    if (this.checkpointTimer) {
      clearInterval(this.checkpointTimer);
      this.checkpointTimer = undefined;
    }
  }

  private updateEstimatedCompletion(): void {
    if (!this.currentCheckpoint) return;

    const { processedNotes, totalNotes } = this.currentCheckpoint.progress;
    const { startTime } = this.currentCheckpoint.metadata;

    if (processedNotes > 0) {
      const elapsedTime = Date.now() - startTime.getTime();
      const averageTimePerNote = elapsedTime / processedNotes;
      const remainingNotes = totalNotes - processedNotes;
      const estimatedRemainingTime = remainingNotes * averageTimePerNote;
      
      this.currentCheckpoint.metadata.estimatedCompletion = 
        new Date(Date.now() + estimatedRemainingTime);
    }
  }

  private generateCheckpointId(): string {
    return `checkpoint_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getDeviceInfo(): string {
    // In a real implementation, this would get actual device info
    return `${process.platform || 'unknown'}_${process.arch || 'unknown'}`;
  }

  private getAppVersion(): string {
    // In a real implementation, this would get actual app version
    return '1.0.0';
  }
}