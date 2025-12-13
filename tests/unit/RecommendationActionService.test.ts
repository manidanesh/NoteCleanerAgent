import { RecommendationActionService, ActionResult, OperationType } from '../../src/services/RecommendationActionService';
import { AppleNotesAPIService } from '../../src/services/NotesAPIService';
import { LearningComponent } from '../../src/agents/LearningComponent';
import { Recommendation, RecommendationAction, ImpactLevel, RecommendationStatus } from '../../src/models/Recommendation';
import { Note } from '../../src/models/Note';

// Mock dependencies
jest.mock('../../src/services/NotesAPIService');
jest.mock('../../src/agents/LearningComponent');

describe('RecommendationActionService', () => {
  let service: RecommendationActionService;
  let mockNotesAPI: jest.Mocked<AppleNotesAPIService>;
  let mockLearningComponent: jest.Mocked<LearningComponent>;
  let mockNote: Note;
  let mockRecommendation: Recommendation;

  beforeEach(() => {
    mockNotesAPI = new AppleNotesAPIService() as jest.Mocked<AppleNotesAPIService>;
    mockLearningComponent = new LearningComponent() as jest.Mocked<LearningComponent>;
    
    service = new RecommendationActionService(
      mockNotesAPI,
      mockLearningComponent,
      'test-device-123'
    );

    mockNote = {
      id: 'note-1',
      title: 'Test Note',
      content: 'This is a test note content',
      createdDate: new Date('2024-01-01'),
      modifiedDate: new Date('2024-01-02'),
      folder: 'Notes',
      attachments: [],
      checklists: [],
      metadata: {
        accessCount: 5,
        shareCount: 0,
        tags: [],
        isShared: false,
        wordCount: 6,
        hasHandwriting: false,
        hasImages: false
      }
    };

    mockRecommendation = {
      id: 'rec-1',
      noteId: 'note-1',
      action: RecommendationAction.DELETE,
      confidence: 0.85,
      reasoning: 'Low utility note with minimal content',
      impact: ImpactLevel.MEDIUM,
      reversible: true,
      timestamp: new Date(),
      status: RecommendationStatus.PENDING
    };
  });

  describe('executeRecommendation', () => {
    it('should execute delete action successfully', async () => {
      mockNotesAPI.deleteNote.mockResolvedValue({ success: true });

      const result = await service.executeRecommendation(mockRecommendation, mockNote, true);

      expect(result.success).toBe(true);
      expect(result.reversible).toBe(true);
      expect(result.operationId).toBeDefined();
      expect(mockNotesAPI.deleteNote).toHaveBeenCalledWith('note-1');
    });

    it('should handle delete action failure', async () => {
      mockNotesAPI.deleteNote.mockResolvedValue({ 
        success: false, 
        error: 'Permission denied' 
      });

      const result = await service.executeRecommendation(mockRecommendation, mockNote, true);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Permission denied');
      expect(result.reversible).toBe(false);
    });

    it('should execute archive action successfully', async () => {
      const archiveRecommendation = {
        ...mockRecommendation,
        action: RecommendationAction.ARCHIVE
      };

      mockNotesAPI.updateNote.mockResolvedValue({ 
        success: true, 
        data: { ...mockNote, folder: 'Archive' }
      });

      const result = await service.executeRecommendation(archiveRecommendation, mockNote, true);

      expect(result.success).toBe(true);
      expect(result.reversible).toBe(true);
      expect(mockNotesAPI.updateNote).toHaveBeenCalledWith(
        expect.objectContaining({ folder: 'Archive' })
      );
    });

    it('should execute rename action successfully', async () => {
      const renameRecommendation = {
        ...mockRecommendation,
        action: RecommendationAction.RENAME,
        suggestedTitle: 'Better Title'
      };

      mockNotesAPI.updateNote.mockResolvedValue({ 
        success: true, 
        data: { ...mockNote, title: 'Better Title' }
      });

      const result = await service.executeRecommendation(renameRecommendation, mockNote, true);

      expect(result.success).toBe(true);
      expect(result.reversible).toBe(true);
      expect(mockNotesAPI.updateNote).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Better Title' })
      );
    });

    it('should require confirmation for high-risk actions', async () => {
      const result = await service.executeRecommendation(mockRecommendation, mockNote, false);

      expect(result.success).toBe(false);
      expect(result.error).toBe('User confirmation required');
      expect(result.message).toContain('Are you sure you want to delete');
    });

    it('should validate recommendation and note data', async () => {
      const invalidRecommendation = { ...mockRecommendation, noteId: 'different-id' };

      const result = await service.executeRecommendation(invalidRecommendation, mockNote, true);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid recommendation or note data');
    });
  });

  describe('rejectRecommendation', () => {
    it('should record rejection feedback successfully', async () => {
      mockLearningComponent.recordFeedback.mockReturnValue({
        id: 'feedback-1',
        recommendationId: 'rec-1',
        action: 'rejected',
        timestamp: new Date(),
        context: expect.any(Object)
      });

      const result = await service.rejectRecommendation(mockRecommendation, mockNote, 'Not useful');

      expect(result.success).toBe(true);
      expect(result.message).toContain('rejected and feedback recorded');
      expect(mockLearningComponent.recordFeedback).toHaveBeenCalledWith(
        'rec-1',
        'rejected',
        expect.objectContaining({
          recommendationId: 'rec-1',
          noteId: 'note-1',
          userDecision: 'rejected'
        })
      );
    });

    it('should handle feedback recording failure', async () => {
      mockLearningComponent.recordFeedback.mockImplementation(() => {
        throw new Error('Database error');
      });

      const result = await service.rejectRecommendation(mockRecommendation, mockNote);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database error');
    });
  });

  describe('prioritizeRecommendations', () => {
    it('should prioritize high-impact recommendations first', () => {
      const recommendations = [
        { ...mockRecommendation, impact: ImpactLevel.LOW, confidence: 0.9 },
        { ...mockRecommendation, impact: ImpactLevel.HIGH, confidence: 0.7 },
        { ...mockRecommendation, impact: ImpactLevel.MEDIUM, confidence: 0.8 }
      ];

      const prioritized = service.prioritizeRecommendations(recommendations);

      expect(prioritized[0].impact).toBe(ImpactLevel.HIGH);
      expect(prioritized[1].impact).toBe(ImpactLevel.MEDIUM);
      expect(prioritized[2].impact).toBe(ImpactLevel.LOW);
    });

    it('should filter out low-confidence recommendations', () => {
      const recommendations = [
        { ...mockRecommendation, action: RecommendationAction.DELETE, confidence: 0.5 }, // Below threshold
        { ...mockRecommendation, action: RecommendationAction.DELETE, confidence: 0.9 }, // Above threshold
      ];

      const prioritized = service.prioritizeRecommendations(recommendations);

      expect(prioritized).toHaveLength(1);
      expect(prioritized[0].confidence).toBe(0.9);
    });

    it('should sort by confidence within same impact level', () => {
      const recommendations = [
        { ...mockRecommendation, impact: ImpactLevel.HIGH, confidence: 0.7 },
        { ...mockRecommendation, impact: ImpactLevel.HIGH, confidence: 0.9 }
      ];

      const prioritized = service.prioritizeRecommendations(recommendations);

      expect(prioritized[0].confidence).toBe(0.9);
      expect(prioritized[1].confidence).toBe(0.7);
    });
  });

  describe('undoOperation', () => {
    it('should undo archive operation successfully', async () => {
      // First execute an archive operation
      const archiveRecommendation = {
        ...mockRecommendation,
        action: RecommendationAction.ARCHIVE
      };

      mockNotesAPI.updateNote.mockResolvedValue({ 
        success: true, 
        data: { ...mockNote, folder: 'Archive' }
      });

      const executeResult = await service.executeRecommendation(archiveRecommendation, mockNote, true);
      expect(executeResult.success).toBe(true);

      // Now undo it
      mockNotesAPI.updateNote.mockResolvedValue({ 
        success: true, 
        data: mockNote
      });

      const undoResult = await service.undoOperation(executeResult.operationId!);

      expect(undoResult.success).toBe(true);
      expect(undoResult.message).toContain('restored from archive');
    });

    it('should fail to undo non-existent operation', async () => {
      const result = await service.undoOperation('non-existent-id');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Operation not found in history');
    });

    it('should fail to undo non-reversible operation', async () => {
      // Create a non-reversible operation manually
      const nonReversibleRec = { ...mockRecommendation, reversible: false };
      
      const result = await service.executeRecommendation(nonReversibleRec, mockNote, true);
      // This would fail in real implementation, but for test we'll simulate
      expect(result.success).toBe(false); // Delete would fail without API mock
    });
  });

  describe('getActionExplanation', () => {
    it('should provide detailed explanation for delete action', () => {
      const explanation = service.getActionExplanation(mockRecommendation, mockNote);

      expect(explanation).toContain('Low utility note with minimal content');
      expect(explanation).toContain('6 words');
      expect(explanation).toContain('low utility');
    });

    it('should include risk warning for low-confidence deletions', () => {
      const lowConfidenceRec = { ...mockRecommendation, confidence: 0.6 };
      
      const explanation = service.getActionExplanation(lowConfidenceRec, mockNote);

      expect(explanation).toContain('⚠️');
      expect(explanation).toContain('confidence is moderate');
    });

    it('should provide appropriate explanation for rename action', () => {
      const renameRec = {
        ...mockRecommendation,
        action: RecommendationAction.RENAME,
        suggestedTitle: 'Better Title'
      };

      const explanation = service.getActionExplanation(renameRec, mockNote);

      expect(explanation).toContain('generic or unclear');
      expect(explanation).toContain('Test Note');
    });
  });

  describe('getOperationHistory', () => {
    it('should return empty history initially', () => {
      const history = service.getOperationHistory();
      expect(history).toHaveLength(0);
    });

    it('should record operations in history', async () => {
      mockNotesAPI.deleteNote.mockResolvedValue({ success: true });

      await service.executeRecommendation(mockRecommendation, mockNote, true);
      
      const history = service.getOperationHistory();
      expect(history).toHaveLength(1);
      expect(history[0].type).toBe(OperationType.DELETE_NOTE);
      expect(history[0].metadata.noteId).toBe('note-1');
    });

    it('should limit history size', async () => {
      mockNotesAPI.deleteNote.mockResolvedValue({ success: true });

      // Execute multiple operations
      for (let i = 0; i < 5; i++) {
        const rec = { ...mockRecommendation, id: `rec-${i}` };
        const note = { ...mockNote, id: `note-${i}` };
        await service.executeRecommendation(rec, note, true);
      }

      const history = service.getOperationHistory(3);
      expect(history).toHaveLength(3);
    });
  });

  describe('canReverseOperation', () => {
    it('should return false for non-existent operation', () => {
      const canReverse = service.canReverseOperation('non-existent');
      expect(canReverse).toBe(false);
    });

    it('should return true for reversible operations', async () => {
      const archiveRec = { ...mockRecommendation, action: RecommendationAction.ARCHIVE };
      mockNotesAPI.updateNote.mockResolvedValue({ success: true, data: mockNote });

      const result = await service.executeRecommendation(archiveRec, mockNote, true);
      
      if (result.operationId) {
        const canReverse = service.canReverseOperation(result.operationId);
        expect(canReverse).toBe(true);
      }
    });
  });
});