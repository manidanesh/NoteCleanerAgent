import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { CheckpointService, ProcessingStage } from '../../src/services/CheckpointService';
import { SecureCacheService } from '../../src/services/SecureCacheService';
import { UtilityScore } from '../../src/models/UtilityScore';
import { Recommendation } from '../../src/models/Recommendation';

// Mock SecureCacheService
vi.mock('../../src/services/SecureCacheService');

describe('CheckpointService', () => {
  let checkpointService: CheckpointService;
  let mockCacheService: vi.Mocked<SecureCacheService>;

  beforeEach(() => {
    mockCacheService = {
      cacheProcessingResults: vi.fn().mockResolvedValue(undefined),
      getCachedProcessingResults: vi.fn().mockResolvedValue(null)
    } as any;

    checkpointService = new CheckpointService(mockCacheService);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Processing Session Management', () => {
    it('should start a new processing session', async () => {
      const sessionId = 'test-session-123';
      const totalNotes = 100;

      await checkpointService.startProcessingSession(sessionId, totalNotes);

      expect(mockCacheService.cacheProcessingResults).toHaveBeenCalledWith(
        expect.stringContaining('checkpoint_'),
        expect.objectContaining({
          sessionId,
          stage: ProcessingStage.INITIALIZATION,
          progress: expect.objectContaining({
            totalNotes,
            processedNotes: 0,
            currentNoteIndex: 0
          })
        })
      );

      // Should also save as latest checkpoint for session
      expect(mockCacheService.cacheProcessingResults).toHaveBeenCalledWith(
        `latest_checkpoint_${sessionId}`,
        expect.any(Object)
      );
    });

    it('should update checkpoint with progress', async () => {
      const sessionId = 'test-session-123';
      await checkpointService.startProcessingSession(sessionId, 100);

      await checkpointService.updateCheckpoint(
        ProcessingStage.CONTENT_EXTRACTION,
        25
      );

      expect(mockCacheService.cacheProcessingResults).toHaveBeenCalledWith(
        expect.stringContaining('checkpoint_'),
        expect.objectContaining({
          stage: ProcessingStage.CONTENT_EXTRACTION,
          progress: expect.objectContaining({
            currentNoteIndex: 25,
            processedNotes: 25
          })
        })
      );
    });

    it('should complete processing session', async () => {
      const sessionId = 'test-session-123';
      await checkpointService.startProcessingSession(sessionId, 100);

      await checkpointService.completeProcessingSession();

      expect(mockCacheService.cacheProcessingResults).toHaveBeenCalledWith(
        expect.stringContaining('checkpoint_'),
        expect.objectContaining({
          stage: ProcessingStage.COMPLETED
        })
      );
    });
  });

  describe('Data Management', () => {
    it('should add processed note data to checkpoint', async () => {
      const sessionId = 'test-session-123';
      await checkpointService.startProcessingSession(sessionId, 100);

      const noteId = 'note-123';
      const extractedContent = { text: 'extracted content' };
      const utilityScore: UtilityScore = {
        noteId,
        overallScore: 85,
        contentScore: 80,
        behavioralScore: 90,
        semanticScore: 85,
        ruleBasedScore: 80,
        explanation: 'High utility note',
        confidence: 0.9,
        factors: []
      };

      await checkpointService.addProcessedNote(
        noteId,
        extractedContent,
        utilityScore
      );

      expect(mockCacheService.cacheProcessingResults).toHaveBeenCalledWith(
        expect.stringContaining('checkpoint_'),
        expect.objectContaining({
          data: expect.objectContaining({
            processedNotes: [noteId],
            extractedContent: { [noteId]: extractedContent },
            utilityScores: { [noteId]: utilityScore }
          })
        })
      );
    });

    it('should add error to checkpoint', async () => {
      const sessionId = 'test-session-123';
      await checkpointService.startProcessingSession(sessionId, 100);

      const errorId = 'error-123';
      await checkpointService.addError(errorId);

      expect(mockCacheService.cacheProcessingResults).toHaveBeenCalledWith(
        expect.stringContaining('checkpoint_'),
        expect.objectContaining({
          data: expect.objectContaining({
            errors: [errorId]
          })
        })
      );
    });
  });

  describe('Recovery Functionality', () => {
    it('should return no recovery when no checkpoints exist', async () => {
      mockCacheService.getCachedProcessingResults.mockResolvedValue(null);

      const recoveryInfo = await checkpointService.checkForRecovery();

      expect(recoveryInfo.canRecover).toBe(false);
      expect(recoveryInfo.resumeFromStage).toBe(ProcessingStage.INITIALIZATION);
      expect(recoveryInfo.resumeFromNoteIndex).toBe(0);
    });

    it('should find recoverable checkpoint', async () => {
      const mockCheckpoint = {
        id: 'checkpoint-123',
        sessionId: 'session-123',
        timestamp: new Date(),
        stage: ProcessingStage.UTILITY_SCORING,
        progress: {
          totalNotes: 100,
          processedNotes: 50,
          currentNoteIndex: 50,
          completedStages: [ProcessingStage.INITIALIZATION, ProcessingStage.CONTENT_EXTRACTION]
        },
        data: {
          processedNotes: ['note1', 'note2'],
          extractedContent: {},
          utilityScores: {},
          recommendations: {},
          errors: []
        },
        metadata: {
          startTime: new Date(),
          deviceInfo: 'test-device',
          appVersion: '1.0.0'
        }
      };

      mockCacheService.getCachedProcessingResults
        .mockResolvedValueOnce(mockCheckpoint)
        .mockResolvedValue(null);

      const recoveryInfo = await checkpointService.checkForRecovery();

      expect(recoveryInfo.canRecover).toBe(true);
      expect(recoveryInfo.lastCheckpoint).toEqual(mockCheckpoint);
      expect(recoveryInfo.resumeFromStage).toBe(ProcessingStage.UTILITY_SCORING);
      expect(recoveryInfo.resumeFromNoteIndex).toBe(50);
    });

    it('should perform data integrity check', async () => {
      const mockCheckpoint = {
        id: 'checkpoint-123',
        sessionId: 'session-123',
        timestamp: new Date(),
        stage: ProcessingStage.UTILITY_SCORING,
        progress: {
          totalNotes: 100,
          processedNotes: 2,
          currentNoteIndex: 2,
          completedStages: []
        },
        data: {
          processedNotes: ['note1', 'note2'],
          extractedContent: {},
          utilityScores: {},
          recommendations: {},
          errors: []
        },
        metadata: {
          startTime: new Date(),
          deviceInfo: 'test-device',
          appVersion: '1.0.0'
        }
      };

      mockCacheService.getCachedProcessingResults
        .mockResolvedValueOnce(mockCheckpoint)
        .mockResolvedValue(null);

      const recoveryInfo = await checkpointService.checkForRecovery();

      expect(recoveryInfo.dataIntegrityCheck.passed).toBe(true);
      expect(recoveryInfo.dataIntegrityCheck.issues).toHaveLength(0);
    });

    it('should detect data integrity issues', async () => {
      const mockCheckpoint = {
        id: 'checkpoint-123',
        sessionId: 'session-123',
        timestamp: new Date(),
        stage: ProcessingStage.UTILITY_SCORING,
        progress: {
          totalNotes: 100,
          processedNotes: 5, // Mismatch with actual processed notes
          currentNoteIndex: 5,
          completedStages: []
        },
        data: {
          processedNotes: ['note1', 'note2'], // Only 2 notes, but progress says 5
          extractedContent: {},
          utilityScores: {},
          recommendations: {},
          errors: []
        },
        metadata: {
          startTime: new Date(),
          deviceInfo: 'test-device',
          appVersion: '1.0.0'
        }
      };

      mockCacheService.getCachedProcessingResults
        .mockResolvedValueOnce(mockCheckpoint)
        .mockResolvedValue(null);

      const recoveryInfo = await checkpointService.checkForRecovery();

      expect(recoveryInfo.dataIntegrityCheck.passed).toBe(false);
      expect(recoveryInfo.dataIntegrityCheck.issues).toContain('Processed notes count mismatch');
    });

    it('should resume from checkpoint', async () => {
      const mockCheckpoint = {
        id: 'checkpoint-123',
        sessionId: 'session-123',
        timestamp: new Date(),
        stage: ProcessingStage.UTILITY_SCORING,
        progress: {
          totalNotes: 100,
          processedNotes: 50,
          currentNoteIndex: 50,
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
          deviceInfo: 'test-device',
          appVersion: '1.0.0'
        }
      };

      const recoveryInfo = {
        canRecover: true,
        lastCheckpoint: mockCheckpoint,
        resumeFromStage: ProcessingStage.UTILITY_SCORING,
        resumeFromNoteIndex: 50,
        recoveredData: { notes: [], scores: [], recommendations: [] },
        dataIntegrityCheck: { passed: true, issues: [] }
      };

      await checkpointService.resumeFromCheckpoint(recoveryInfo);

      // Should restore the checkpoint state internally
      const progress = checkpointService.getProcessingProgress();
      expect(progress).toMatchObject({
        stage: ProcessingStage.UTILITY_SCORING,
        progress: 0.5, // 50/100
        processedNotes: 50,
        totalNotes: 100
      });
      // estimatedTimeRemaining may be undefined initially
    });
  });

  describe('Progress Tracking', () => {
    it('should return null progress when no active session', () => {
      const progress = checkpointService.getProcessingProgress();
      expect(progress).toBeNull();
    });

    it('should return current progress when session is active', async () => {
      const sessionId = 'test-session-123';
      const totalNotes = 100;
      
      await checkpointService.startProcessingSession(sessionId, totalNotes);
      await checkpointService.updateCheckpoint(ProcessingStage.CONTENT_EXTRACTION, 25);

      const progress = checkpointService.getProcessingProgress();

      expect(progress).toEqual({
        stage: ProcessingStage.CONTENT_EXTRACTION,
        progress: 0.25, // 25/100
        estimatedTimeRemaining: expect.any(Number),
        processedNotes: 25,
        totalNotes: 100
      });
    });
  });

  describe('Cleanup Operations', () => {
    it('should clear old checkpoints', async () => {
      // Mock getting checkpoints (empty for simplicity)
      mockCacheService.getCachedProcessingResults.mockResolvedValue(null);

      await checkpointService.clearOldCheckpoints(24);

      // Should attempt to get checkpoints for cleanup
      expect(mockCacheService.getCachedProcessingResults).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle checkpoint save failures gracefully', async () => {
      mockCacheService.cacheProcessingResults.mockRejectedValue(new Error('Cache failed'));

      await expect(
        checkpointService.startProcessingSession('session-123', 100)
      ).rejects.toThrow('Cache failed');
    });

    it('should handle recovery check failures gracefully', async () => {
      mockCacheService.getCachedProcessingResults.mockRejectedValue(new Error('Cache read failed'));

      const recoveryInfo = await checkpointService.checkForRecovery();

      expect(recoveryInfo.canRecover).toBe(false);
      // When recovery check fails, it returns a default recovery info with passed=true but no checkpoints
      expect(recoveryInfo.dataIntegrityCheck.passed).toBe(true);
      expect(recoveryInfo.dataIntegrityCheck.issues).toHaveLength(0);
    });
  });
});