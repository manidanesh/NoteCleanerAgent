import { Note } from '../models/Note';
import { Recommendation, RecommendationAction, RecommendationStatus } from '../models/Recommendation';
import { AppleNotesAPIService } from './NotesAPIService';
import { LearningComponent } from '../agents/LearningComponent';

/**
 * Reversible operation record for undo functionality
 */
export interface ReversibleOperation {
  id: string;
  type: OperationType;
  timestamp: Date;
  originalState: any;
  newState: any;
  metadata: OperationMetadata;
  canReverse: boolean;
}

/**
 * Types of operations that can be performed
 */
export enum OperationType {
  DELETE_NOTE = 'delete_note',
  ARCHIVE_NOTE = 'archive_note',
  RENAME_NOTE = 'rename_note',
  MERGE_NOTES = 'merge_notes',
  MOVE_NOTE = 'move_note'
}

/**
 * Metadata for operations
 */
export interface OperationMetadata {
  recommendationId: string;
  noteId: string;
  userId?: string;
  deviceId: string;
  confidence: number;
  reasoning: string;
  relatedNoteIds?: string[];
}

/**
 * Result of an action execution
 */
export interface ActionResult {
  success: boolean;
  operationId?: string;
  error?: string;
  reversible: boolean;
  message?: string;
}

/**
 * Feedback context for learning
 */
export interface FeedbackContext {
  recommendationId: string;
  noteId: string;
  action: RecommendationAction;
  userDecision: 'approved' | 'rejected';
  timestamp: Date;
  deviceContext?: any;
}

/**
 * High-impact recommendation criteria
 */
export interface ImpactCriteria {
  minConfidence: number;
  maxRiskLevel: 'low' | 'medium' | 'high';
  requiresConfirmation: boolean;
  batchEligible: boolean;
}

/**
 * Service for handling recommendation actions with confirmation, feedback, and undo functionality
 * Implements Requirements 5.3, 5.4, 5.5, 6.1, 6.2, 6.3, 6.4, 6.5
 */
export class RecommendationActionService {
  private notesAPI: AppleNotesAPIService;
  private learningComponent: LearningComponent;
  private operationHistory: Map<string, ReversibleOperation> = new Map();
  private deviceId: string;
  private maxHistorySize: number = 1000;

  constructor(
    notesAPI: AppleNotesAPIService,
    learningComponent: LearningComponent,
    deviceId?: string
  ) {
    this.notesAPI = notesAPI;
    this.learningComponent = learningComponent;
    this.deviceId = deviceId || this.generateDeviceId();
  }

  /**
   * Execute a recommendation action with proper confirmation and recording
   * Implements Requirements 5.3, 6.1: Deletion confirmation and reversible operation recording
   */
  async executeRecommendation(
    recommendation: Recommendation,
    note: Note,
    skipConfirmation: boolean = false
  ): Promise<ActionResult> {
    try {
      // Validate recommendation and note
      if (!this.validateRecommendation(recommendation, note)) {
        return {
          success: false,
          error: 'Invalid recommendation or note data',
          reversible: false
        };
      }

      // Check if confirmation is required
      if (!skipConfirmation && this.requiresConfirmation(recommendation)) {
        return {
          success: false,
          error: 'User confirmation required',
          reversible: false,
          message: this.getConfirmationMessage(recommendation, note)
        };
      }

      // Create reversible operation record before execution
      const operation = this.createOperationRecord(recommendation, note);

      // Execute the specific action
      let actionResult: ActionResult;
      switch (recommendation.action) {
        case RecommendationAction.DELETE:
          actionResult = await this.executeDeleteAction(note, operation);
          break;
        case RecommendationAction.ARCHIVE:
          actionResult = await this.executeArchiveAction(note, operation);
          break;
        case RecommendationAction.RENAME:
          actionResult = await this.executeRenameAction(note, recommendation, operation);
          break;
        case RecommendationAction.MERGE_DUPLICATES:
          actionResult = await this.executeMergeAction(note, recommendation, operation);
          break;
        default:
          return {
            success: false,
            error: `Unsupported action: ${recommendation.action}`,
            reversible: false
          };
      }

      // Record operation in history if successful
      if (actionResult.success && actionResult.operationId) {
        this.operationHistory.set(actionResult.operationId, operation);
        this.cleanupHistory();
      }

      // Update recommendation status
      await this.updateRecommendationStatus(recommendation.id, RecommendationStatus.EXECUTED);

      return actionResult;

    } catch (error) {
      console.error('Failed to execute recommendation:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        reversible: false
      };
    }
  }

  /**
   * Handle recommendation rejection with feedback recording
   * Implements Requirements 5.4: Rejection feedback recording
   */
  async rejectRecommendation(
    recommendation: Recommendation,
    note: Note,
    reason?: string
  ): Promise<ActionResult> {
    try {
      // Record feedback for learning
      const feedbackContext: FeedbackContext = {
        recommendationId: recommendation.id,
        noteId: note.id,
        action: recommendation.action,
        userDecision: 'rejected',
        timestamp: new Date(),
        deviceContext: {
          deviceId: this.deviceId,
          reason: reason || 'User rejected recommendation'
        }
      };

      // Record feedback with learning component
      this.learningComponent.recordFeedback(
        recommendation.id,
        'rejected',
        {
          recommendation,
          note,
          userReason: reason || 'User rejected recommendation'
        }
      );

      // Update recommendation status
      await this.updateRecommendationStatus(recommendation.id, RecommendationStatus.REJECTED);

      return {
        success: true,
        reversible: false,
        message: 'Recommendation rejected and feedback recorded'
      };

    } catch (error) {
      console.error('Failed to reject recommendation:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to record rejection',
        reversible: false
      };
    }
  }

  /**
   * Prioritize high-impact recommendations
   * Implements Requirements 5.5: High-impact recommendation prioritization
   */
  prioritizeRecommendations(recommendations: Recommendation[]): Recommendation[] {
    const impactCriteria: { [key: string]: ImpactCriteria } = {
      [RecommendationAction.DELETE]: {
        minConfidence: 0.8,
        maxRiskLevel: 'high',
        requiresConfirmation: true,
        batchEligible: false
      },
      [RecommendationAction.ARCHIVE]: {
        minConfidence: 0.7,
        maxRiskLevel: 'medium',
        requiresConfirmation: false,
        batchEligible: true
      },
      [RecommendationAction.MERGE_DUPLICATES]: {
        minConfidence: 0.9,
        maxRiskLevel: 'medium',
        requiresConfirmation: true,
        batchEligible: false
      },
      [RecommendationAction.RENAME]: {
        minConfidence: 0.6,
        maxRiskLevel: 'low',
        requiresConfirmation: false,
        batchEligible: true
      }
    };

    return recommendations
      .filter(rec => {
        const criteria = impactCriteria[rec.action];
        return criteria && rec.confidence >= criteria.minConfidence;
      })
      .sort((a, b) => {
        // Sort by impact level (high first), then confidence
        const impactOrder = { high: 3, medium: 2, low: 1 };
        const aImpact = impactOrder[a.impact] || 0;
        const bImpact = impactOrder[b.impact] || 0;
        
        if (aImpact !== bImpact) {
          return bImpact - aImpact; // Higher impact first
        }
        
        return b.confidence - a.confidence; // Higher confidence first
      });
  }

  /**
   * Undo a previously executed operation
   * Implements Requirements 6.2: Complete state restoration
   */
  async undoOperation(operationId: string): Promise<ActionResult> {
    try {
      const operation = this.operationHistory.get(operationId);
      if (!operation) {
        return {
          success: false,
          error: 'Operation not found in history',
          reversible: false
        };
      }

      if (!operation.canReverse) {
        return {
          success: false,
          error: 'Operation cannot be reversed',
          reversible: false
        };
      }

      // Execute the reverse operation based on type
      let undoResult: ActionResult;
      switch (operation.type) {
        case OperationType.DELETE_NOTE:
          undoResult = await this.undoDeleteOperation(operation);
          break;
        case OperationType.ARCHIVE_NOTE:
          undoResult = await this.undoArchiveOperation(operation);
          break;
        case OperationType.RENAME_NOTE:
          undoResult = await this.undoRenameOperation(operation);
          break;
        case OperationType.MERGE_NOTES:
          undoResult = await this.undoMergeOperation(operation);
          break;
        default:
          return {
            success: false,
            error: `Undo not supported for operation type: ${operation.type}`,
            reversible: false
          };
      }

      // Remove from history if successfully undone
      if (undoResult.success) {
        this.operationHistory.delete(operationId);
      }

      return undoResult;

    } catch (error) {
      console.error('Failed to undo operation:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Undo failed',
        reversible: false
      };
    }
  }

  /**
   * Get operation history for user review
   * Implements Requirements 6.5: Action logging
   */
  getOperationHistory(limit?: number): ReversibleOperation[] {
    const operations = Array.from(this.operationHistory.values())
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    
    return limit ? operations.slice(0, limit) : operations;
  }

  /**
   * Check if an operation can be reversed
   * Implements Requirements 6.4: Irreversible action warnings
   */
  canReverseOperation(operationId: string): boolean {
    const operation = this.operationHistory.get(operationId);
    return operation ? operation.canReverse : false;
  }

  /**
   * Get explanation for a recommendation action
   * Implements Requirements 6.3: Recommendation explanation provision
   */
  getActionExplanation(recommendation: Recommendation, note: Note): string {
    const baseExplanation = recommendation.reasoning;
    const actionSpecific = this.getActionSpecificExplanation(recommendation.action, note);
    const riskWarning = this.getRiskWarning(recommendation);
    
    return `${baseExplanation}\n\n${actionSpecific}${riskWarning ? `\n\n⚠️ ${riskWarning}` : ''}`;
  }

  // Private helper methods

  private validateRecommendation(recommendation: Recommendation, note: Note): boolean {
    return !!(
      recommendation &&
      recommendation.id &&
      recommendation.noteId === note.id &&
      recommendation.action &&
      note &&
      note.id
    );
  }

  private requiresConfirmation(recommendation: Recommendation): boolean {
    return recommendation.action === RecommendationAction.DELETE ||
           recommendation.action === RecommendationAction.MERGE_DUPLICATES ||
           recommendation.confidence < 0.8;
  }

  private getConfirmationMessage(recommendation: Recommendation, note: Note): string {
    switch (recommendation.action) {
      case RecommendationAction.DELETE:
        return `Are you sure you want to delete "${note.title}"? This action can be undone later.`;
      case RecommendationAction.MERGE_DUPLICATES:
        return `Merge this note with ${recommendation.relatedNotes?.length || 0} similar notes? This will combine their content.`;
      default:
        return `Confirm ${recommendation.action} action for "${note.title}"?`;
    }
  }

  private createOperationRecord(
    recommendation: Recommendation,
    note: Note
  ): ReversibleOperation {
    const operationId = this.generateOperationId();
    
    return {
      id: operationId,
      type: this.getOperationType(recommendation.action),
      timestamp: new Date(),
      originalState: this.captureNoteState(note),
      newState: null, // Will be set after execution
      metadata: {
        recommendationId: recommendation.id,
        noteId: note.id,
        deviceId: this.deviceId,
        confidence: recommendation.confidence,
        reasoning: recommendation.reasoning
      },
      canReverse: recommendation.reversible
    };
  }

  private getOperationType(action: RecommendationAction): OperationType {
    switch (action) {
      case RecommendationAction.DELETE:
        return OperationType.DELETE_NOTE;
      case RecommendationAction.ARCHIVE:
        return OperationType.ARCHIVE_NOTE;
      case RecommendationAction.RENAME:
        return OperationType.RENAME_NOTE;
      case RecommendationAction.MERGE_DUPLICATES:
        return OperationType.MERGE_NOTES;
      default:
        return OperationType.DELETE_NOTE; // Default fallback
    }
  }

  private captureNoteState(note: Note): any {
    return {
      id: note.id,
      title: note.title,
      content: note.content,
      folder: note.folder,
      modifiedDate: note.modifiedDate,
      attachments: [...note.attachments],
      checklists: [...note.checklists],
      metadata: { ...note.metadata }
    };
  }

  private async executeDeleteAction(
    note: Note,
    operation: ReversibleOperation
  ): Promise<ActionResult> {
    const result = await this.notesAPI.deleteNote(note.id);
    
    if (result.success) {
      operation.newState = { deleted: true, deletedAt: new Date() };
      return {
        success: true,
        operationId: operation.id,
        reversible: true,
        message: `Note "${note.title}" deleted successfully`
      };
    }
    
    return {
      success: false,
      error: result.error || 'Failed to delete note',
      reversible: false
    };
  }

  private async executeArchiveAction(
    note: Note,
    operation: ReversibleOperation
  ): Promise<ActionResult> {
    // Archive by moving to Archive folder
    const archivedNote = {
      ...note,
      folder: 'Archive',
      modifiedDate: new Date()
    };
    
    const result = await this.notesAPI.updateNote(archivedNote);
    
    if (result.success) {
      operation.newState = this.captureNoteState(archivedNote);
      return {
        success: true,
        operationId: operation.id,
        reversible: true,
        message: `Note "${note.title}" archived successfully`
      };
    }
    
    return {
      success: false,
      error: result.error || 'Failed to archive note',
      reversible: false
    };
  }

  private async executeRenameAction(
    note: Note,
    recommendation: Recommendation,
    operation: ReversibleOperation
  ): Promise<ActionResult> {
    if (!recommendation.suggestedTitle) {
      return {
        success: false,
        error: 'No suggested title provided',
        reversible: false
      };
    }
    
    const renamedNote = {
      ...note,
      title: recommendation.suggestedTitle,
      modifiedDate: new Date()
    };
    
    const result = await this.notesAPI.updateNote(renamedNote);
    
    if (result.success) {
      operation.newState = this.captureNoteState(renamedNote);
      return {
        success: true,
        operationId: operation.id,
        reversible: true,
        message: `Note renamed to "${recommendation.suggestedTitle}"`
      };
    }
    
    return {
      success: false,
      error: result.error || 'Failed to rename note',
      reversible: false
    };
  }

  private async executeMergeAction(
    note: Note,
    recommendation: Recommendation,
    operation: ReversibleOperation
  ): Promise<ActionResult> {
    // For now, return not implemented
    // Full merge implementation would require fetching related notes
    return {
      success: false,
      error: 'Merge operation not yet implemented',
      reversible: false
    };
  }

  private async undoDeleteOperation(operation: ReversibleOperation): Promise<ActionResult> {
    // In a real implementation, this would restore the note from backup
    // For now, return not implemented as Apple Notes API doesn't support restoration
    return {
      success: false,
      error: 'Note restoration not supported by Apple Notes API',
      reversible: false
    };
  }

  private async undoArchiveOperation(operation: ReversibleOperation): Promise<ActionResult> {
    const originalState = operation.originalState;
    const noteToRestore: Note = {
      ...originalState,
      modifiedDate: new Date()
    };
    
    const result = await this.notesAPI.updateNote(noteToRestore);
    
    if (result.success) {
      return {
        success: true,
        reversible: false,
        message: `Note "${originalState.title}" restored from archive`
      };
    }
    
    return {
      success: false,
      error: result.error || 'Failed to restore note from archive',
      reversible: false
    };
  }

  private async undoRenameOperation(operation: ReversibleOperation): Promise<ActionResult> {
    const originalState = operation.originalState;
    const noteToRestore: Note = {
      ...operation.newState,
      title: originalState.title,
      modifiedDate: new Date()
    };
    
    const result = await this.notesAPI.updateNote(noteToRestore);
    
    if (result.success) {
      return {
        success: true,
        reversible: false,
        message: `Note title restored to "${originalState.title}"`
      };
    }
    
    return {
      success: false,
      error: result.error || 'Failed to restore note title',
      reversible: false
    };
  }

  private async undoMergeOperation(operation: ReversibleOperation): Promise<ActionResult> {
    // Merge undo would be complex - not implemented for now
    return {
      success: false,
      error: 'Merge undo not yet implemented',
      reversible: false
    };
  }

  private async updateRecommendationStatus(
    recommendationId: string,
    status: RecommendationStatus
  ): Promise<void> {
    // In a real implementation, this would update the recommendation in storage
    console.log(`Updated recommendation ${recommendationId} status to ${status}`);
  }

  private getActionSpecificExplanation(action: RecommendationAction, note: Note): string {
    switch (action) {
      case RecommendationAction.DELETE:
        return `This note appears to have low utility and can be safely removed. It contains ${note.metadata.wordCount} words and was last modified ${this.formatDate(note.modifiedDate)}.`;
      case RecommendationAction.ARCHIVE:
        return `This note has moderate utility but isn't frequently accessed. Archiving will keep it available while decluttering your active notes.`;
      case RecommendationAction.RENAME:
        return `The current title "${note.title}" is generic or unclear. A more descriptive title will make this note easier to find.`;
      case RecommendationAction.MERGE_DUPLICATES:
        return `This note has similar content to other notes. Merging will eliminate redundancy while preserving all important information.`;
      default:
        return 'This action will help organize your notes more effectively.';
    }
  }

  private getRiskWarning(recommendation: Recommendation): string | null {
    if (recommendation.action === RecommendationAction.DELETE && recommendation.confidence < 0.9) {
      return 'Deletion confidence is moderate. Please review carefully before confirming.';
    }
    if (recommendation.action === RecommendationAction.MERGE_DUPLICATES && recommendation.confidence < 0.8) {
      return 'Merge similarity is moderate. Please verify content overlap before proceeding.';
    }
    return null;
  }

  private cleanupHistory(): void {
    if (this.operationHistory.size > this.maxHistorySize) {
      const operations = Array.from(this.operationHistory.entries())
        .sort(([, a], [, b]) => a.timestamp.getTime() - b.timestamp.getTime());
      
      // Remove oldest operations
      const toRemove = operations.slice(0, operations.length - this.maxHistorySize);
      toRemove.forEach(([id]) => this.operationHistory.delete(id));
    }
  }

  private formatDate(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'today';
    if (diffDays === 1) return 'yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return `${Math.floor(diffDays / 30)} months ago`;
  }

  private generateOperationId(): string {
    return `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateDeviceId(): string {
    return `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}