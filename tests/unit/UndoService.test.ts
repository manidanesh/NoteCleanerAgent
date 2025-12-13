import { UndoService, UndoResult, OperationSummary } from '../../src/services/UndoService';
import { RecommendationActionService, ReversibleOperation, OperationType } from '../../src/services/RecommendationActionService';

// Mock the RecommendationActionService
jest.mock('../../src/services/RecommendationActionService');

describe('UndoService', () => {
  let undoService: UndoService;
  let mockActionService: jest.Mocked<RecommendationActionService>;

  beforeEach(() => {
    mockActionService = {
      canReverseOperation: jest.fn(),
      undoOperation: jest.fn(),
      getOperationHistory: jest.fn(),
    } as any;

    undoService = new UndoService(mockActionService);
  });

  describe('undoOperation', () => {
    it('should successfully undo a reversible operation', async () => {
      mockActionService.canReverseOperation.mockReturnValue(true);
      mockActionService.undoOperation.mockResolvedValue({
        success: true,
        message: 'Operation undone successfully',
        reversible: false
      });

      const result = await undoService.undoOperation('op-123');

      expect(result.success).toBe(true);
      expect(result.message).toBe('Operation undone successfully');
      expect(mockActionService.canReverseOperation).toHaveBeenCalledWith('op-123');
      expect(mockActionService.undoOperation).toHaveBeenCalledWith('op-123');
    });

    it('should fail to undo non-reversible operation', async () => {
      mockActionService.canReverseOperation.mockReturnValue(false);

      const result = await undoService.undoOperation('op-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('This operation cannot be undone');
      expect(mockActionService.undoOperation).not.toHaveBeenCalled();
    });

    it('should handle undo operation failure', async () => {
      mockActionService.canReverseOperation.mockReturnValue(true);
      mockActionService.undoOperation.mockResolvedValue({
        success: false,
        error: 'Undo failed due to API error',
        reversible: false
      });

      const result = await undoService.undoOperation('op-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Undo failed due to API error');
    });

    it('should handle unexpected errors', async () => {
      mockActionService.canReverseOperation.mockReturnValue(true);
      mockActionService.undoOperation.mockRejectedValue(new Error('Network error'));

      const result = await undoService.undoOperation('op-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });
  });

  describe('getOperationHistory', () => {
    it('should return formatted operation summaries', () => {
      const mockOperations: ReversibleOperation[] = [
        {
          id: 'op-1',
          type: OperationType.DELETE_NOTE,
          timestamp: new Date('2024-01-01T10:00:00Z'),
          originalState: { title: 'Test Note 1' },
          newState: { deleted: true },
          metadata: {
            recommendationId: 'rec-1',
            noteId: 'note-1',
            deviceId: 'device-1',
            confidence: 0.9,
            reasoning: 'Low utility'
          },
          canReverse: true
        },
        {
          id: 'op-2',
          type: OperationType.RENAME_NOTE,
          timestamp: new Date('2024-01-01T11:00:00Z'),
          originalState: { title: 'Old Title' },
          newState: { title: 'New Title' },
          metadata: {
            recommendationId: 'rec-2',
            noteId: 'note-2',
            deviceId: 'device-1',
            confidence: 0.8,
            reasoning: 'Better title'
          },
          canReverse: true
        }
      ];

      mockActionService.getOperationHistory.mockReturnValue(mockOperations);

      const summaries = undoService.getOperationHistory(50);

      expect(summaries).toHaveLength(2);
      
      expect(summaries[0]).toEqual({
        id: 'op-1',
        type: OperationType.DELETE_NOTE,
        description: 'Deleted "Test Note 1"',
        timestamp: new Date('2024-01-01T10:00:00Z'),
        canUndo: true,
        noteTitle: 'Test Note 1'
      });

      expect(summaries[1]).toEqual({
        id: 'op-2',
        type: OperationType.RENAME_NOTE,
        description: 'Renamed "Old Title" to "New Title"',
        timestamp: new Date('2024-01-01T11:00:00Z'),
        canUndo: true,
        noteTitle: 'Old Title'
      });

      expect(mockActionService.getOperationHistory).toHaveBeenCalledWith(50);
    });

    it('should handle operations with missing titles', () => {
      const mockOperations: ReversibleOperation[] = [
        {
          id: 'op-1',
          type: OperationType.ARCHIVE_NOTE,
          timestamp: new Date(),
          originalState: {}, // No title
          newState: {},
          metadata: {
            recommendationId: 'rec-1',
            noteId: 'note-1',
            deviceId: 'device-1',
            confidence: 0.7,
            reasoning: 'Archive old note'
          },
          canReverse: false
        }
      ];

      mockActionService.getOperationHistory.mockReturnValue(mockOperations);

      const summaries = undoService.getOperationHistory();

      expect(summaries[0].description).toBe('Archived "Unknown Note"');
      expect(summaries[0].canUndo).toBe(false);
    });
  });

  describe('getUndoableOperations', () => {
    it('should return only reversible operations', () => {
      const mockOperations: ReversibleOperation[] = [
        {
          id: 'op-1',
          type: OperationType.DELETE_NOTE,
          timestamp: new Date(),
          originalState: { title: 'Note 1' },
          newState: {},
          metadata: {
            recommendationId: 'rec-1',
            noteId: 'note-1',
            deviceId: 'device-1',
            confidence: 0.9,
            reasoning: 'Test'
          },
          canReverse: true
        },
        {
          id: 'op-2',
          type: OperationType.MERGE_NOTES,
          timestamp: new Date(),
          originalState: { title: 'Note 2' },
          newState: {},
          metadata: {
            recommendationId: 'rec-2',
            noteId: 'note-2',
            deviceId: 'device-1',
            confidence: 0.8,
            reasoning: 'Test'
          },
          canReverse: false
        }
      ];

      mockActionService.getOperationHistory.mockReturnValue(mockOperations);

      const undoable = undoService.getUndoableOperations();

      expect(undoable).toHaveLength(1);
      expect(undoable[0].id).toBe('op-1');
      expect(undoable[0].canUndo).toBe(true);
    });

    it('should respect the limit parameter', () => {
      const mockOperations: ReversibleOperation[] = Array.from({ length: 15 }, (_, i) => ({
        id: `op-${i}`,
        type: OperationType.ARCHIVE_NOTE,
        timestamp: new Date(),
        originalState: { title: `Note ${i}` },
        newState: {},
        metadata: {
          recommendationId: `rec-${i}`,
          noteId: `note-${i}`,
          deviceId: 'device-1',
          confidence: 0.7,
          reasoning: 'Test'
        },
        canReverse: true
      }));

      mockActionService.getOperationHistory.mockReturnValue(mockOperations);

      const undoable = undoService.getUndoableOperations(5);

      expect(undoable).toHaveLength(5);
      expect(mockActionService.getOperationHistory).toHaveBeenCalledWith(5);
    });
  });

  describe('hasUndoableOperations', () => {
    it('should return true when undoable operations exist', () => {
      const mockOperations: ReversibleOperation[] = [
        {
          id: 'op-1',
          type: OperationType.DELETE_NOTE,
          timestamp: new Date(),
          originalState: { title: 'Note 1' },
          newState: {},
          metadata: {
            recommendationId: 'rec-1',
            noteId: 'note-1',
            deviceId: 'device-1',
            confidence: 0.9,
            reasoning: 'Test'
          },
          canReverse: true
        }
      ];

      mockActionService.getOperationHistory.mockReturnValue(mockOperations);

      const hasUndoable = undoService.hasUndoableOperations();

      expect(hasUndoable).toBe(true);
    });

    it('should return false when no undoable operations exist', () => {
      const mockOperations: ReversibleOperation[] = [
        {
          id: 'op-1',
          type: OperationType.DELETE_NOTE,
          timestamp: new Date(),
          originalState: { title: 'Note 1' },
          newState: {},
          metadata: {
            recommendationId: 'rec-1',
            noteId: 'note-1',
            deviceId: 'device-1',
            confidence: 0.9,
            reasoning: 'Test'
          },
          canReverse: false
        }
      ];

      mockActionService.getOperationHistory.mockReturnValue(mockOperations);

      const hasUndoable = undoService.hasUndoableOperations();

      expect(hasUndoable).toBe(false);
    });

    it('should return false when no operations exist', () => {
      mockActionService.getOperationHistory.mockReturnValue([]);

      const hasUndoable = undoService.hasUndoableOperations();

      expect(hasUndoable).toBe(false);
    });
  });

  describe('getLastUndoableOperation', () => {
    it('should return the most recent undoable operation', () => {
      const mockOperations: ReversibleOperation[] = [
        {
          id: 'op-1',
          type: OperationType.DELETE_NOTE,
          timestamp: new Date('2024-01-01T10:00:00Z'),
          originalState: { title: 'Note 1' },
          newState: {},
          metadata: {
            recommendationId: 'rec-1',
            noteId: 'note-1',
            deviceId: 'device-1',
            confidence: 0.9,
            reasoning: 'Test'
          },
          canReverse: true
        }
      ];

      mockActionService.getOperationHistory.mockReturnValue(mockOperations);

      const lastUndoable = undoService.getLastUndoableOperation();

      expect(lastUndoable).not.toBeNull();
      expect(lastUndoable!.id).toBe('op-1');
      expect(lastUndoable!.canUndo).toBe(true);
    });

    it('should return null when no undoable operations exist', () => {
      mockActionService.getOperationHistory.mockReturnValue([]);

      const lastUndoable = undoService.getLastUndoableOperation();

      expect(lastUndoable).toBeNull();
    });
  });

  describe('clearHistory', () => {
    it('should log history clearing', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      undoService.clearHistory();

      expect(consoleSpy).toHaveBeenCalledWith('Operation history cleared');
      
      consoleSpy.mockRestore();
    });
  });

  describe('operation description formatting', () => {
    it('should format delete operation description', () => {
      const mockOperations: ReversibleOperation[] = [
        {
          id: 'op-1',
          type: OperationType.DELETE_NOTE,
          timestamp: new Date(),
          originalState: { title: 'My Important Note' },
          newState: {},
          metadata: {
            recommendationId: 'rec-1',
            noteId: 'note-1',
            deviceId: 'device-1',
            confidence: 0.9,
            reasoning: 'Test'
          },
          canReverse: true
        }
      ];

      mockActionService.getOperationHistory.mockReturnValue(mockOperations);

      const summaries = undoService.getOperationHistory();

      expect(summaries[0].description).toBe('Deleted "My Important Note"');
    });

    it('should format archive operation description', () => {
      const mockOperations: ReversibleOperation[] = [
        {
          id: 'op-1',
          type: OperationType.ARCHIVE_NOTE,
          timestamp: new Date(),
          originalState: { title: 'Old Note' },
          newState: {},
          metadata: {
            recommendationId: 'rec-1',
            noteId: 'note-1',
            deviceId: 'device-1',
            confidence: 0.8,
            reasoning: 'Test'
          },
          canReverse: true
        }
      ];

      mockActionService.getOperationHistory.mockReturnValue(mockOperations);

      const summaries = undoService.getOperationHistory();

      expect(summaries[0].description).toBe('Archived "Old Note"');
    });

    it('should format merge operation description', () => {
      const mockOperations: ReversibleOperation[] = [
        {
          id: 'op-1',
          type: OperationType.MERGE_NOTES,
          timestamp: new Date(),
          originalState: { title: 'Duplicate Note' },
          newState: {},
          metadata: {
            recommendationId: 'rec-1',
            noteId: 'note-1',
            deviceId: 'device-1',
            confidence: 0.9,
            reasoning: 'Test'
          },
          canReverse: false
        }
      ];

      mockActionService.getOperationHistory.mockReturnValue(mockOperations);

      const summaries = undoService.getOperationHistory();

      expect(summaries[0].description).toBe('Merged "Duplicate Note" with other notes');
    });

    it('should format move operation description', () => {
      const mockOperations: ReversibleOperation[] = [
        {
          id: 'op-1',
          type: OperationType.MOVE_NOTE,
          timestamp: new Date(),
          originalState: { title: 'Moved Note' },
          newState: { folder: 'Archive' },
          metadata: {
            recommendationId: 'rec-1',
            noteId: 'note-1',
            deviceId: 'device-1',
            confidence: 0.7,
            reasoning: 'Test'
          },
          canReverse: true
        }
      ];

      mockActionService.getOperationHistory.mockReturnValue(mockOperations);

      const summaries = undoService.getOperationHistory();

      expect(summaries[0].description).toBe('Moved "Moved Note" to "Archive"');
    });

    it('should handle unknown operation types', () => {
      const mockOperations: ReversibleOperation[] = [
        {
          id: 'op-1',
          type: 'unknown_operation' as OperationType,
          timestamp: new Date(),
          originalState: { title: 'Some Note' },
          newState: {},
          metadata: {
            recommendationId: 'rec-1',
            noteId: 'note-1',
            deviceId: 'device-1',
            confidence: 0.5,
            reasoning: 'Test'
          },
          canReverse: true
        }
      ];

      mockActionService.getOperationHistory.mockReturnValue(mockOperations);

      const summaries = undoService.getOperationHistory();

      expect(summaries[0].description).toBe('Modified "Some Note"');
    });
  });
});