import { Note } from '../models/Note';
import { UtilityScore } from '../models/UtilityScore';
import { Recommendation } from '../models/Recommendation';
import { SecureCacheService } from './SecureCacheService';
import { ErrorHandlingService, ErrorCategory } from './ErrorHandlingService';

/**
 * Offline operation types
 */
export enum OfflineOperationType {
  NOTE_UPDATE = 'note_update',
  NOTE_DELETE = 'note_delete',
  RECOMMENDATION_ACCEPT = 'recommendation_accept',
  RECOMMENDATION_REJECT = 'recommendation_reject',
  PREFERENCE_UPDATE = 'preference_update',
  PROCESSING_REQUEST = 'processing_request'
}

/**
 * Queued offline operation
 */
export interface OfflineOperation {
  id: string;
  type: OfflineOperationType;
  timestamp: Date;
  data: any;
  retryCount: number;
  maxRetries: number;
  priority: number; // Higher number = higher priority
}

/**
 * Offline data availability status
 */
export interface OfflineDataStatus {
  notesAvailable: number;
  scoresAvailable: number;
  recommendationsAvailable: number;
  lastSyncTime?: Date;
  cacheSize: number;
  operationsQueued: number;
}

/**
 * Sync conflict resolution
 */
export interface SyncConflict {
  id: string;
  type: 'note_modified' | 'note_deleted' | 'preference_changed';
  localData: any;
  remoteData: any;
  timestamp: Date;
  resolution?: 'use_local' | 'use_remote' | 'merge' | 'manual';
}

/**
 * Offline operation service for handling cached data and queued operations
 * Requirement 15.4: Offline operation with locally cached data
 */
export class OfflineOperationService {
  private cacheService: SecureCacheService;
  private errorHandlingService: ErrorHandlingService;
  private operationQueue: OfflineOperation[] = [];
  private isOnline: boolean = true;
  private syncInProgress: boolean = false;
  private onlineCallbacks: (() => void)[] = [];
  private offlineCallbacks: (() => void)[] = [];
  private maxQueueSize: number = 1000;
  private syncInterval?: NodeJS.Timeout;

  constructor(
    cacheService: SecureCacheService,
    errorHandlingService: ErrorHandlingService
  ) {
    this.cacheService = cacheService;
    this.errorHandlingService = errorHandlingService;
    this.initializeNetworkMonitoring();
  }

  /**
   * Check if the system is currently online
   */
  isSystemOnline(): boolean {
    return this.isOnline;
  }

  /**
   * Get cached notes for offline operation
   */
  async getCachedNotes(): Promise<Note[]> {
    try {
      // In a real implementation, this would retrieve all cached notes
      // For now, we'll simulate getting cached notes
      const cachedNotes: Note[] = [];
      
      // Try to get cached notes from recent sessions
      for (let i = 0; i < 10; i++) {
        try {
          const noteId = `cached_note_${i}`;
          const note = await this.cacheService.getCachedNote(noteId);
          if (note) {
            cachedNotes.push(note);
          }
        } catch (error) {
          // Ignore individual failures
        }
      }

      return cachedNotes;
    } catch (error) {
      this.errorHandlingService.handleProcessingFailure(
        'OfflineOperationService',
        error as Error,
        { operation: 'getCachedNotes' }
      );
      return [];
    }
  }

  /**
   * Get cached utility scores for offline operation
   */
  async getCachedUtilityScores(): Promise<UtilityScore[]> {
    try {
      const scores: UtilityScore[] = [];
      
      // Try to get cached scores
      for (let i = 0; i < 10; i++) {
        try {
          const noteId = `cached_note_${i}`;
          const score = await this.cacheService.getCachedUtilityScore(noteId);
          if (score) {
            scores.push(score);
          }
        } catch (error) {
          // Ignore individual failures
        }
      }

      return scores;
    } catch (error) {
      this.errorHandlingService.handleProcessingFailure(
        'OfflineOperationService',
        error as Error,
        { operation: 'getCachedUtilityScores' }
      );
      return [];
    }
  }

  /**
   * Get cached recommendations for offline operation
   */
  async getCachedRecommendations(): Promise<Recommendation[]> {
    try {
      const recommendations: Recommendation[] = [];
      
      // Try to get cached recommendations
      for (let i = 0; i < 10; i++) {
        try {
          const recId = `cached_rec_${i}`;
          const recommendation = await this.cacheService.getCachedRecommendation(recId);
          if (recommendation) {
            recommendations.push(recommendation);
          }
        } catch (error) {
          // Ignore individual failures
        }
      }

      return recommendations;
    } catch (error) {
      this.errorHandlingService.handleProcessingFailure(
        'OfflineOperationService',
        error as Error,
        { operation: 'getCachedRecommendations' }
      );
      return [];
    }
  }

  /**
   * Queue an operation for when connectivity is restored
   */
  async queueOfflineOperation(
    type: OfflineOperationType,
    data: any,
    priority: number = 1
  ): Promise<string> {
    const operation: OfflineOperation = {
      id: this.generateOperationId(),
      type,
      timestamp: new Date(),
      data,
      retryCount: 0,
      maxRetries: 3,
      priority
    };

    // Check queue size limit
    if (this.operationQueue.length >= this.maxQueueSize) {
      // Remove oldest low-priority operations
      this.operationQueue = this.operationQueue
        .sort((a, b) => b.priority - a.priority || a.timestamp.getTime() - b.timestamp.getTime())
        .slice(0, this.maxQueueSize - 1);
    }

    this.operationQueue.push(operation);
    
    // Sort queue by priority and timestamp
    this.operationQueue.sort((a, b) => 
      b.priority - a.priority || a.timestamp.getTime() - b.timestamp.getTime()
    );

    // Cache the operation queue
    await this.cacheOperationQueue();

    console.info(`Queued offline operation: ${type} (${operation.id})`);
    return operation.id;
  }

  /**
   * Process queued operations when connectivity is restored
   */
  async processQueuedOperations(): Promise<{
    processed: number;
    failed: number;
    conflicts: SyncConflict[];
  }> {
    if (!this.isOnline || this.syncInProgress) {
      return { processed: 0, failed: 0, conflicts: [] };
    }

    this.syncInProgress = true;
    let processed = 0;
    let failed = 0;
    const conflicts: SyncConflict[] = [];

    try {
      console.info(`Processing ${this.operationQueue.length} queued operations`);

      // Process operations in priority order
      const operationsToProcess = [...this.operationQueue];
      this.operationQueue = [];

      for (const operation of operationsToProcess) {
        try {
          const result = await this.processOperation(operation);
          
          if (result.success) {
            processed++;
          } else if (result.conflict) {
            conflicts.push(result.conflict);
          } else {
            // Retry if possible
            operation.retryCount++;
            if (operation.retryCount < operation.maxRetries) {
              this.operationQueue.push(operation);
            } else {
              failed++;
              console.error(`Operation failed after max retries: ${operation.id}`);
            }
          }
        } catch (error) {
          failed++;
          console.error(`Operation processing failed: ${operation.id}`, error);
        }
      }

      // Update cached queue
      await this.cacheOperationQueue();

      console.info(`Sync completed: ${processed} processed, ${failed} failed, ${conflicts.length} conflicts`);

    } finally {
      this.syncInProgress = false;
    }

    return { processed, failed, conflicts };
  }

  /**
   * Get offline data availability status
   */
  async getOfflineDataStatus(): Promise<OfflineDataStatus> {
    try {
      const notes = await this.getCachedNotes();
      const scores = await this.getCachedUtilityScores();
      const recommendations = await this.getCachedRecommendations();

      // Estimate cache size (simplified)
      const cacheSize = (notes.length + scores.length + recommendations.length) * 1024; // Rough estimate

      return {
        notesAvailable: notes.length,
        scoresAvailable: scores.length,
        recommendationsAvailable: recommendations.length,
        lastSyncTime: this.getLastSyncTime(),
        cacheSize,
        operationsQueued: this.operationQueue.length
      };
    } catch (error) {
      this.errorHandlingService.handleProcessingFailure(
        'OfflineOperationService',
        error as Error,
        { operation: 'getOfflineDataStatus' }
      );

      return {
        notesAvailable: 0,
        scoresAvailable: 0,
        recommendationsAvailable: 0,
        cacheSize: 0,
        operationsQueued: this.operationQueue.length
      };
    }
  }

  /**
   * Handle network connectivity change
   */
  async handleConnectivityChange(isOnline: boolean): Promise<void> {
    const wasOnline = this.isOnline;
    this.isOnline = isOnline;

    if (isOnline && !wasOnline) {
      // Just came online
      console.info('Network connectivity restored');
      
      // Notify callbacks
      this.onlineCallbacks.forEach(callback => {
        try {
          callback();
        } catch (error) {
          console.error('Online callback failed:', error);
        }
      });

      // Start processing queued operations
      setTimeout(() => {
        this.processQueuedOperations().catch(error => {
          console.error('Failed to process queued operations:', error);
        });
      }, 1000); // Small delay to ensure connection is stable

    } else if (!isOnline && wasOnline) {
      // Just went offline
      console.warn('Network connectivity lost');
      
      const errorInfo = this.errorHandlingService.handleNetworkFailure(
        'system operation',
        true // Cache is available
      );

      // Notify callbacks
      this.offlineCallbacks.forEach(callback => {
        try {
          callback();
        } catch (error) {
          console.error('Offline callback failed:', error);
        }
      });
    }
  }

  /**
   * Register callback for when system comes online
   */
  onOnline(callback: () => void): void {
    this.onlineCallbacks.push(callback);
  }

  /**
   * Register callback for when system goes offline
   */
  onOffline(callback: () => void): void {
    this.offlineCallbacks.push(callback);
  }

  /**
   * Clear old cached data to free up space
   */
  async clearOldCachedData(olderThanHours: number = 72): Promise<void> {
    try {
      // In a real implementation, this would clear old cached data
      console.info(`Clearing cached data older than ${olderThanHours} hours`);
      
      // Clear old operations from queue
      const cutoff = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
      this.operationQueue = this.operationQueue.filter(op => op.timestamp > cutoff);
      
      await this.cacheOperationQueue();
    } catch (error) {
      console.error('Failed to clear old cached data:', error);
    }
  }

  /**
   * Force sync when connectivity allows
   */
  async forcSync(): Promise<boolean> {
    if (!this.isOnline) {
      throw new Error('Cannot sync while offline');
    }

    try {
      const result = await this.processQueuedOperations();
      return result.failed === 0;
    } catch (error) {
      console.error('Force sync failed:', error);
      return false;
    }
  }

  private async processOperation(operation: OfflineOperation): Promise<{
    success: boolean;
    conflict?: SyncConflict;
  }> {
    try {
      switch (operation.type) {
        case OfflineOperationType.NOTE_UPDATE:
          return await this.processNoteUpdate(operation);
        
        case OfflineOperationType.NOTE_DELETE:
          return await this.processNoteDelete(operation);
        
        case OfflineOperationType.RECOMMENDATION_ACCEPT:
          return await this.processRecommendationAccept(operation);
        
        case OfflineOperationType.RECOMMENDATION_REJECT:
          return await this.processRecommendationReject(operation);
        
        case OfflineOperationType.PREFERENCE_UPDATE:
          return await this.processPreferenceUpdate(operation);
        
        case OfflineOperationType.PROCESSING_REQUEST:
          return await this.processProcessingRequest(operation);
        
        default:
          console.warn(`Unknown operation type: ${operation.type}`);
          return { success: false };
      }
    } catch (error) {
      console.error(`Failed to process operation ${operation.id}:`, error);
      return { success: false };
    }
  }

  private async processNoteUpdate(operation: OfflineOperation): Promise<{
    success: boolean;
    conflict?: SyncConflict;
  }> {
    // In a real implementation, this would sync note updates with the server
    // For now, simulate success
    console.info(`Processing note update: ${operation.data.noteId}`);
    return { success: true };
  }

  private async processNoteDelete(operation: OfflineOperation): Promise<{
    success: boolean;
    conflict?: SyncConflict;
  }> {
    // In a real implementation, this would sync note deletions with the server
    console.info(`Processing note delete: ${operation.data.noteId}`);
    return { success: true };
  }

  private async processRecommendationAccept(operation: OfflineOperation): Promise<{
    success: boolean;
    conflict?: SyncConflict;
  }> {
    // In a real implementation, this would sync recommendation acceptance
    console.info(`Processing recommendation accept: ${operation.data.recommendationId}`);
    return { success: true };
  }

  private async processRecommendationReject(operation: OfflineOperation): Promise<{
    success: boolean;
    conflict?: SyncConflict;
  }> {
    // In a real implementation, this would sync recommendation rejection
    console.info(`Processing recommendation reject: ${operation.data.recommendationId}`);
    return { success: true };
  }

  private async processPreferenceUpdate(operation: OfflineOperation): Promise<{
    success: boolean;
    conflict?: SyncConflict;
  }> {
    // In a real implementation, this would sync preference updates
    console.info(`Processing preference update: ${operation.data.preferenceKey}`);
    return { success: true };
  }

  private async processProcessingRequest(operation: OfflineOperation): Promise<{
    success: boolean;
    conflict?: SyncConflict;
  }> {
    // In a real implementation, this would retry processing requests
    console.info(`Processing request: ${operation.data.requestType}`);
    return { success: true };
  }

  private async cacheOperationQueue(): Promise<void> {
    try {
      await this.cacheService.cacheProcessingResults('offline_operation_queue', {
        operations: this.operationQueue,
        timestamp: new Date()
      });
    } catch (error) {
      console.error('Failed to cache operation queue:', error);
    }
  }

  private async loadOperationQueue(): Promise<void> {
    try {
      const cached = await this.cacheService.getCachedProcessingResults('offline_operation_queue');
      if (cached && cached.operations) {
        this.operationQueue = cached.operations.map((op: any) => ({
          ...op,
          timestamp: new Date(op.timestamp)
        }));
        console.info(`Loaded ${this.operationQueue.length} queued operations from cache`);
      }
    } catch (error) {
      console.error('Failed to load operation queue:', error);
      this.operationQueue = [];
    }
  }

  private initializeNetworkMonitoring(): void {
    // Load existing operation queue
    this.loadOperationQueue();

    // In a real implementation, this would set up actual network monitoring
    // For now, we'll simulate network status
    this.isOnline = true;

    // Set up periodic sync when online
    this.syncInterval = setInterval(async () => {
      if (this.isOnline && this.operationQueue.length > 0 && !this.syncInProgress) {
        try {
          await this.processQueuedOperations();
        } catch (error) {
          console.error('Periodic sync failed:', error);
        }
      }
    }, 60000); // Sync every minute
  }

  private getLastSyncTime(): Date | undefined {
    // In a real implementation, this would track actual sync times
    return new Date(Date.now() - 5 * 60 * 1000); // 5 minutes ago
  }

  private generateOperationId(): string {
    return `offline_op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Cleanup resources
   */
  shutdown(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = undefined;
    }
  }
}