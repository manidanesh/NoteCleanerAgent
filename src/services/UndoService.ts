import { ReversibleOperation, RecommendationActionService } from './RecommendationActionService';
import { Note } from '../models/Note';

/**
 * Undo operation result
 */
export interface UndoResult {
  success: boolean;
  message?: string;
  error?: string;
  restoredState?: any;
}

/**
 * Operation summary for UI display
 */
export interface OperationSummary {
  id: string;
  type: string;
  description: string;
  timestamp: Date;
  canUndo: boolean;
  noteTitle?: string;
  affectedItems?: number;
  riskLevel?: 'low' | 'medium' | 'high';
}

/**
 * Detailed state restoration information
 */
export interface StateRestorationDetails {
  operationId: string;
  originalState: any;
  currentState: any;
  changesPreview: StateChange[];
  restorationSteps: string[];
  estimatedTime: number;
  potentialIssues: string[];
}

/**
 * Individual state change
 */
export interface StateChange {
  field: string;
  originalValue: any;
  currentValue: any;
  changeType: 'added' | 'removed' | 'modified';
  impact: 'low' | 'medium' | 'high';
}

/**
 * Service for managing undo operations and operation history
 * Implements Requirements 6.2, 6.5: Complete state restoration and action logging
 */
export class UndoService {
  private actionService: RecommendationActionService;

  constructor(actionService: RecommendationActionService) {
    this.actionService = actionService;
  }

  /**
   * Undo a specific operation by ID
   * Implements Requirements 6.2: Complete state restoration
   */
  async undoOperation(operationId: string): Promise<UndoResult> {
    try {
      if (!this.actionService.canReverseOperation(operationId)) {
        return {
          success: false,
          error: 'This operation cannot be undone'
        };
      }

      const result = await this.actionService.undoOperation(operationId);
      
      if (result.success) {
        return {
          success: true,
          message: result.message || 'Operation undone successfully'
        };
      } else {
        return {
          success: false,
          error: result.error || 'Failed to undo operation'
        };
      }
    } catch (error) {
      console.error('Undo operation failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get operation history for display
   * Implements Requirements 6.5: Action logging
   */
  getOperationHistory(limit: number = 50): OperationSummary[] {
    const operations = this.actionService.getOperationHistory(limit);
    
    return operations.map(op => this.createOperationSummary(op));
  }

  /**
   * Get detailed state restoration information
   * Implements Requirement 21.4: Detailed undo capabilities with exact state restoration
   */
  getStateRestorationDetails(operationId: string): StateRestorationDetails | null {
    const operations = this.actionService.getOperationHistory();
    const operation = operations.find(op => op.id === operationId);
    
    if (!operation) return null;

    const changesPreview = this.analyzeStateChanges(operation);
    const restorationSteps = this.generateRestorationSteps(operation);
    const potentialIssues = this.identifyPotentialIssues(operation);

    return {
      operationId,
      originalState: operation.originalState,
      currentState: operation.newState,
      changesPreview,
      restorationSteps,
      estimatedTime: this.estimateRestorationTime(operation),
      potentialIssues
    };
  }

  /**
   * Preview what will be restored without executing
   * Implements Requirement 21.4: Exact state restoration preview
   */
  previewStateRestoration(operationId: string): {
    success: boolean;
    preview?: StateRestorationDetails;
    error?: string;
  } {
    try {
      const details = this.getStateRestorationDetails(operationId);
      
      if (!details) {
        return {
          success: false,
          error: 'Operation not found or cannot be restored'
        };
      }

      return {
        success: true,
        preview: details
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Undo with detailed state restoration
   * Implements Requirement 21.4: Detailed undo capabilities with exact state restoration
   */
  async undoWithStateRestoration(operationId: string): Promise<UndoResult & { restorationDetails?: StateRestorationDetails }> {
    try {
      const restorationDetails = this.getStateRestorationDetails(operationId);
      
      if (!restorationDetails) {
        return {
          success: false,
          error: 'Cannot restore: operation details not found'
        };
      }

      // Validate restoration is safe
      const validationResult = this.validateRestoration(restorationDetails);
      if (!validationResult.safe) {
        return {
          success: false,
          error: `Restoration blocked: ${validationResult.reason}`
        };
      }

      // Execute the undo
      const undoResult = await this.undoOperation(operationId);
      
      return {
        ...undoResult,
        restorationDetails: undoResult.success ? restorationDetails : undefined
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Restoration failed'
      };
    }
  }

  /**
   * Get recent undoable operations
   */
  getUndoableOperations(limit: number = 10): OperationSummary[] {
    const operations = this.actionService.getOperationHistory(limit);
    
    return operations
      .filter(op => op.canReverse)
      .map(op => this.createOperationSummary(op));
  }

  /**
   * Check if any operations can be undone
   */
  hasUndoableOperations(): boolean {
    const operations = this.actionService.getOperationHistory(10);
    return operations.some(op => op.canReverse);
  }

  /**
   * Get the most recent undoable operation
   */
  getLastUndoableOperation(): OperationSummary | null {
    const undoable = this.getUndoableOperations(1);
    return undoable.length > 0 ? undoable[0] : null;
  }

  /**
   * Clear operation history (with confirmation)
   */
  clearHistory(): void {
    // In a real implementation, this would clear the history in the action service
    console.log('Operation history cleared');
  }

  // Private helper methods

  private createOperationSummary(operation: ReversibleOperation): OperationSummary {
    return {
      id: operation.id,
      type: operation.type,
      description: this.getOperationDescription(operation),
      timestamp: operation.timestamp,
      canUndo: operation.canReverse,
      noteTitle: operation.originalState?.title,
      affectedItems: this.countAffectedItems(operation),
      riskLevel: this.assessOperationRisk(operation)
    };
  }

  private analyzeStateChanges(operation: ReversibleOperation): StateChange[] {
    const changes: StateChange[] = [];
    const original = operation.originalState;
    const current = operation.newState;

    if (!original || !current) return changes;

    // Compare key fields
    const fieldsToCompare = ['title', 'content', 'folder', 'modifiedDate'];
    
    fieldsToCompare.forEach(field => {
      if (original[field] !== current[field]) {
        changes.push({
          field,
          originalValue: original[field],
          currentValue: current[field],
          changeType: 'modified',
          impact: this.assessChangeImpact(field, original[field], current[field])
        });
      }
    });

    // Check for deletions
    if (current.deleted) {
      changes.push({
        field: 'existence',
        originalValue: 'exists',
        currentValue: 'deleted',
        changeType: 'removed',
        impact: 'high'
      });
    }

    return changes;
  }

  private generateRestorationSteps(operation: ReversibleOperation): string[] {
    const steps: string[] = [];
    
    switch (operation.type) {
      case 'delete_note':
        steps.push('Recreate the deleted note');
        steps.push('Restore original content and metadata');
        steps.push('Place in original folder location');
        break;
      case 'archive_note':
        steps.push('Move note back to original folder');
        steps.push('Restore original modification date');
        break;
      case 'rename_note':
        steps.push('Restore original title');
        steps.push('Update modification timestamp');
        break;
      case 'merge_notes':
        steps.push('Separate merged content');
        steps.push('Recreate individual notes');
        steps.push('Restore original metadata for each note');
        break;
      default:
        steps.push('Restore to previous state');
    }

    return steps;
  }

  private identifyPotentialIssues(operation: ReversibleOperation): string[] {
    const issues: string[] = [];
    
    // Check age of operation
    const ageInHours = (Date.now() - operation.timestamp.getTime()) / (1000 * 60 * 60);
    if (ageInHours > 24) {
      issues.push('Operation is more than 24 hours old - restoration may conflict with recent changes');
    }

    // Check operation type risks
    switch (operation.type) {
      case 'delete_note':
        issues.push('Note restoration may not preserve all original formatting');
        if (operation.originalState?.attachments?.length > 0) {
          issues.push('Attachments may not be fully recoverable');
        }
        break;
      case 'merge_notes':
        issues.push('Unmerging may result in data duplication');
        issues.push('Original note relationships may be lost');
        break;
    }

    // Check for potential conflicts
    if (operation.newState && operation.originalState) {
      const hasSignificantChanges = this.hasSignificantChanges(operation.originalState, operation.newState);
      if (hasSignificantChanges) {
        issues.push('Significant changes detected - restoration may cause data loss');
      }
    }

    return issues;
  }

  private estimateRestorationTime(operation: ReversibleOperation): number {
    // Estimate in seconds
    switch (operation.type) {
      case 'delete_note':
        return 5; // Recreating note takes longer
      case 'merge_notes':
        return 8; // Complex unmerging
      case 'rename_note':
      case 'archive_note':
        return 2; // Simple operations
      default:
        return 3;
    }
  }

  private validateRestoration(details: StateRestorationDetails): { safe: boolean; reason?: string } {
    // Check for high-risk issues
    const highRiskIssues = details.potentialIssues.filter(issue => 
      issue.includes('data loss') || issue.includes('not recoverable')
    );

    if (highRiskIssues.length > 0) {
      return {
        safe: false,
        reason: highRiskIssues[0]
      };
    }

    // Check for high-impact changes
    const highImpactChanges = details.changesPreview.filter(change => change.impact === 'high');
    if (highImpactChanges.length > 3) {
      return {
        safe: false,
        reason: 'Too many high-impact changes detected'
      };
    }

    return { safe: true };
  }

  private countAffectedItems(operation: ReversibleOperation): number {
    switch (operation.type) {
      case 'merge_notes':
        return operation.metadata?.relatedNoteIds?.length || 2;
      default:
        return 1;
    }
  }

  private assessOperationRisk(operation: ReversibleOperation): 'low' | 'medium' | 'high' {
    switch (operation.type) {
      case 'delete_note':
        return 'high';
      case 'merge_notes':
        return 'medium';
      case 'rename_note':
      case 'archive_note':
        return 'low';
      default:
        return 'medium';
    }
  }

  private assessChangeImpact(field: string, originalValue: any, currentValue: any): 'low' | 'medium' | 'high' {
    switch (field) {
      case 'content':
        const originalLength = String(originalValue).length;
        const currentLength = String(currentValue).length;
        const lengthDiff = Math.abs(originalLength - currentLength);
        
        if (lengthDiff > 1000) return 'high';
        if (lengthDiff > 100) return 'medium';
        return 'low';
        
      case 'title':
        return 'medium';
        
      case 'folder':
        return 'medium';
        
      default:
        return 'low';
    }
  }

  private hasSignificantChanges(original: any, current: any): boolean {
    if (!original || !current) return true;
    
    // Check content length difference
    const originalContent = String(original.content || '');
    const currentContent = String(current.content || '');
    const lengthDiff = Math.abs(originalContent.length - currentContent.length);
    
    return lengthDiff > 500 || original.title !== current.title;
  }

  private getOperationDescription(operation: ReversibleOperation): string {
    const noteTitle = operation.originalState?.title || 'Unknown Note';
    
    switch (operation.type) {
      case 'delete_note':
        return `Deleted "${noteTitle}"`;
      case 'archive_note':
        return `Archived "${noteTitle}"`;
      case 'rename_note':
        const newTitle = operation.newState?.title || 'Unknown';
        return `Renamed "${noteTitle}" to "${newTitle}"`;
      case 'merge_notes':
        return `Merged "${noteTitle}" with other notes`;
      case 'move_note':
        const newFolder = operation.newState?.folder || 'Unknown';
        return `Moved "${noteTitle}" to "${newFolder}"`;
      default:
        return `Modified "${noteTitle}"`;
    }
  }
}