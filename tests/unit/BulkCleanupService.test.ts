import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { BulkCleanupService, SafetyConfidence } from '../../src/services/BulkCleanupService';
import { AgentCoordinator } from '../../src/agents/AgentCoordinator';
import { AppleNotesAPIService } from '../../src/services/NotesAPIService';
import { RecommendationActionService } from '../../src/services/RecommendationActionService';
import { CheckpointService } from '../../src/services/CheckpointService';
import { Note } from '../../src/models/Note';
import { RecommendationAction, ImpactLevel } from '../../src/models/Recommendation';

// Mock dependencies
vi.mock('../../src/agents/AgentCoordinator');
vi.mock('../../src/services/NotesAPIService');
vi.mock('../../src/services/RecommendationActionService');
vi.mock('../../src/services/CheckpointService');

describe('BulkCleanupService', () => {
  let bulkCleanupService: BulkCleanupService;
  let mockAgentCoordinator: vi.Mocked<AgentCoordinator>;
  let mockNotesAPI: vi.Mocked<AppleNotesAPIService>;
  let mockActionService: vi.Mocked<RecommendationActionService>;
  let mockCheckpointService: vi.Mocked<CheckpointService>;

  // Sample test data
  const sampleNotes: Note[] = [
    {
      id: 'note1',
      title: 'Important Meeting Notes',
      content: 'This is important content for a meeting',
      createdDate: new Date('2024-01-01'),
      modifiedDate: new Date('2024-01-15'),
      folder: 'Work',
      attachments: [],
      checklists: [],
      metadata: {
        accessCount: 15,
        lastAccessDate: new Date('2024-01-15'),
        shareCount: 2,
        tags: ['work', 'meeting'],
        isShared: true,
        wordCount: 50,
        hasHandwriting: false,
        hasImages: false
      }
    },
    {
      id: 'note2',
      title: 'Old Shopping List',
      content: 'milk, bread, eggs',
      createdDate: new Date('2023-06-01'),
      modifiedDate: new Date('2023-06-01'),
      folder: 'Personal',
      attachments: [],
      checklists: [
        { id: 'item1', text: 'milk', completed: true, order: 1 },
        { id: 'item2', text: 'bread', completed: true, order: 2 },
        { id: 'item3', text: 'eggs', completed: true, order: 3 }
      ],
      metadata: {
        accessCount: 1,
        lastAccessDate: new Date('2023-06-01'),
        shareCount: 0,
        tags: ['shopping'],
        isShared: false,
        wordCount: 10,
        hasHandwriting: false,
        hasImages: false
      }
    },
    {
      id: 'note3',
      title: 'Empty Note',
      content: '',
      createdDate: new Date('2023-12-01'),
      modifiedDate: new Date('2023-12-01'),
      folder: 'Notes',
      attachments: [],
      checklists: [],
      metadata: {
        accessCount: 0,
        shareCount: 0,
        tags: [],
        isShared: false,
        wordCount: 0,
        hasHandwriting: false,
        hasImages: false
      }
    }
  ];

  beforeEach(() => {
    // Create mocked instances
    mockAgentCoordinator = {
      processNotes: vi.fn(),
    } as any;

    mockNotesAPI = {
      getAllNotes: vi.fn(),
    } as any;

    mockActionService = {
      executeRecommendation: vi.fn(),
    } as any;

    mockCheckpointService = {
      createCheckpoint: vi.fn(),
      getCheckpoint: vi.fn(),
    } as any;

    // Create service instance
    bulkCleanupService = new BulkCleanupService(
      mockAgentCoordinator,
      mockNotesAPI,
      mockActionService,
      mockCheckpointService
    );
  });

  describe('analyzeNotesLibrary', () => {
    it('should analyze entire notes library and return bulk analysis result', async () => {
      // Setup mocks
      mockNotesAPI.getAllNotes.mockResolvedValue({
        success: true,
        data: sampleNotes
      });
      
      mockAgentCoordinator.processNotes.mockResolvedValue([
        {
          noteId: 'note1',
          utilityScore: {
            noteId: 'note1',
            overallScore: 85,
            contentScore: 80,
            behavioralScore: 90,
            semanticScore: 85,
            ruleBasedScore: 80,
            explanation: 'High utility note',
            confidence: 0.9,
            factors: [],
            timestamp: new Date()
          },
          recommendations: [
            {
              id: 'rec1',
              noteId: 'note1',
              action: RecommendationAction.KEEP,
              confidence: 0.9,
              reasoning: 'High utility, keep this note',
              impact: ImpactLevel.LOW,
              reversible: true,
              timestamp: new Date(),
              status: 'pending' as any
            }
          ],
          errors: [],
          processingTime: 100,
          timestamp: new Date()
        },
        {
          noteId: 'note2',
          utilityScore: {
            noteId: 'note2',
            overallScore: 15,
            contentScore: 10,
            behavioralScore: 20,
            semanticScore: 15,
            ruleBasedScore: 15,
            explanation: 'Low utility note - old shopping list',
            confidence: 0.8,
            factors: [],
            timestamp: new Date()
          },
          recommendations: [
            {
              id: 'rec2',
              noteId: 'note2',
              action: RecommendationAction.DELETE,
              confidence: 0.85,
              reasoning: 'Old completed shopping list, safe to delete',
              impact: ImpactLevel.LOW,
              reversible: true,
              timestamp: new Date(),
              status: 'pending' as any
            }
          ],
          errors: [],
          processingTime: 50,
          timestamp: new Date()
        },
        {
          noteId: 'note3',
          utilityScore: {
            noteId: 'note3',
            overallScore: 5,
            contentScore: 0,
            behavioralScore: 10,
            semanticScore: 5,
            ruleBasedScore: 5,
            explanation: 'Empty note with no content',
            confidence: 0.95,
            factors: [],
            timestamp: new Date()
          },
          recommendations: [
            {
              id: 'rec3',
              noteId: 'note3',
              action: RecommendationAction.DELETE,
              confidence: 0.95,
              reasoning: 'Empty note, safe to delete',
              impact: ImpactLevel.LOW,
              reversible: true,
              timestamp: new Date(),
              status: 'pending' as any
            }
          ],
          errors: [],
          processingTime: 25,
          timestamp: new Date()
        }
      ]);

      // No checkpoint service mocks needed since we're not using them in the simplified implementation

      // Execute
      const result = await bulkCleanupService.analyzeNotesLibrary();

      // Verify
      expect(result).toBeDefined();
      expect(result.totalNotes).toBe(3);
      expect(result.safetyGroups).toHaveLength(3); // HIGH, MEDIUM, REVIEW_NEEDED
      expect(result.storageEstimate).toBeDefined();
      expect(result.backupInfo).toBeDefined();
      expect(result.backupInfo.verified).toBe(true);

      // Verify safety groups contain appropriate notes
      const highConfidenceGroup = result.safetyGroups.find(g => g.confidence === SafetyConfidence.HIGH);
      expect(highConfidenceGroup).toBeDefined();
      expect(highConfidenceGroup!.notes.length).toBeGreaterThan(0);

      // Verify API calls
      expect(mockNotesAPI.getAllNotes).toHaveBeenCalledOnce();
      expect(mockAgentCoordinator.processNotes).toHaveBeenCalledWith(sampleNotes);
    });

    it('should handle processing errors gracefully', async () => {
      // Setup mocks with errors
      mockNotesAPI.getAllNotes.mockResolvedValue({
        success: true,
        data: sampleNotes
      });
      
      mockAgentCoordinator.processNotes.mockResolvedValue([
        {
          noteId: 'note1',
          errors: [
            {
              step: 'extraction',
              agentId: 'content-extractor',
              error: 'OCR processing failed',
              severity: 'warning' as any,
              recoverable: true
            }
          ],
          processingTime: 100,
          timestamp: new Date()
        }
      ]);

      // No checkpoint service mocks needed since we're not using them in the simplified implementation

      // Execute
      const result = await bulkCleanupService.analyzeNotesLibrary();

      // Verify errors are captured
      expect(result.processingErrors).toContain('extraction: OCR processing failed');
    });

    it('should throw error if already analyzing', async () => {
      // Start first analysis
      mockNotesAPI.getAllNotes.mockImplementation(() => new Promise(() => {})); // Never resolves
      
      const firstAnalysis = bulkCleanupService.analyzeNotesLibrary();
      
      // Try to start second analysis
      await expect(bulkCleanupService.analyzeNotesLibrary()).rejects.toThrow('Analysis already in progress');
      
      // Cleanup
      firstAnalysis.catch(() => {}); // Prevent unhandled rejection
    });
  });

  describe('executeBulkCleanup', () => {
    const mockAnalysisResult = {
      totalNotes: 2,
      analysisTimestamp: new Date(),
      safetyGroups: [
        {
          confidence: SafetyConfidence.HIGH,
          notes: [
            {
              note: sampleNotes[1], // Old shopping list
              utilityScore: {
                noteId: 'note2',
                overallScore: 15,
                contentScore: 10,
                behavioralScore: 20,
                semanticScore: 15,
                ruleBasedScore: 15,
                explanation: 'Low utility note',
                confidence: 0.8,
                factors: [],
                timestamp: new Date()
              },
              recommendations: [
                {
                  id: 'rec2',
                  noteId: 'note2',
                  action: RecommendationAction.DELETE,
                  confidence: 0.85,
                  reasoning: 'Old shopping list',
                  impact: ImpactLevel.LOW,
                  reversible: true,
                  timestamp: new Date(),
                  status: 'pending' as any
                }
              ],
              safetyRating: 0.9,
              estimatedSize: 1024,
              riskFactors: []
            }
          ],
          totalCount: 1,
          estimatedSavings: 1024,
          recommendedActions: [RecommendationAction.DELETE]
        }
      ],
      storageEstimate: {
        totalLibrarySize: 10240,
        potentialSavings: 1024,
        savingsPercentage: 10,
        breakdown: {
          highConfidence: 1024,
          mediumConfidence: 0,
          reviewNeeded: 0
        }
      },
      backupInfo: {
        backupId: 'backup123',
        createdAt: new Date(),
        backupPath: 'backups/test',
        totalSize: 10240,
        noteCount: 2,
        verified: true
      },
      processingErrors: []
    };

    it('should execute bulk cleanup successfully', async () => {
      // Setup mocks
      mockActionService.executeRecommendation.mockResolvedValue({
        success: true,
        operationId: 'op123',
        reversible: true,
        message: 'Note deleted successfully'
      });

      // Execute
      const result = await bulkCleanupService.executeBulkCleanup(
        mockAnalysisResult,
        [SafetyConfidence.HIGH]
      );

      // Verify
      expect(result.success).toBe(true);
      expect(result.totalProcessed).toBe(1);
      expect(result.successfulOperations).toBe(1);
      expect(result.failedOperations).toBe(0);
      expect(result.backupId).toBe('backup123');
      expect(result.undoAvailable).toBe(true);

      // Verify action service was called
      expect(mockActionService.executeRecommendation).toHaveBeenCalledWith(
        expect.objectContaining({
          action: RecommendationAction.DELETE,
          noteId: 'note2'
        }),
        sampleNotes[1],
        true // Skip confirmation
      );
    });

    it('should handle execution failures gracefully', async () => {
      // Setup mocks with failure
      mockActionService.executeRecommendation.mockResolvedValue({
        success: false,
        error: 'API error',
        reversible: false
      });

      // Execute
      const result = await bulkCleanupService.executeBulkCleanup(
        mockAnalysisResult,
        [SafetyConfidence.HIGH]
      );

      // Verify
      expect(result.success).toBe(false);
      expect(result.totalProcessed).toBe(1);
      expect(result.successfulOperations).toBe(0);
      expect(result.failedOperations).toBe(1);
      expect(result.errors).toContain('Failed to execute delete for note Old Shopping List: API error');
    });

    it('should throw error if backup is not verified', async () => {
      const invalidAnalysisResult = {
        ...mockAnalysisResult,
        backupInfo: {
          ...mockAnalysisResult.backupInfo,
          verified: false
        }
      };

      await expect(
        bulkCleanupService.executeBulkCleanup(invalidAnalysisResult, [SafetyConfidence.HIGH])
      ).rejects.toThrow('Backup verification failed');
    });

    it('should throw error if already executing', async () => {
      // Start first execution
      mockActionService.executeRecommendation.mockImplementation(() => new Promise(() => {})); // Never resolves
      
      const firstExecution = bulkCleanupService.executeBulkCleanup(
        mockAnalysisResult,
        [SafetyConfidence.HIGH]
      );
      
      // Try to start second execution
      await expect(
        bulkCleanupService.executeBulkCleanup(mockAnalysisResult, [SafetyConfidence.HIGH])
      ).rejects.toThrow('Bulk execution already in progress');
      
      // Cleanup
      firstExecution.catch(() => {}); // Prevent unhandled rejection
    });
  });

  describe('progress tracking', () => {
    it('should track and report execution progress', async () => {
      const progressUpdates: any[] = [];
      
      // Setup progress listener
      bulkCleanupService.onProgress((progress) => {
        progressUpdates.push({ ...progress });
      });

      // Setup mocks
      mockActionService.executeRecommendation.mockResolvedValue({
        success: true,
        operationId: 'op123',
        reversible: true
      });

      const mockAnalysisResult = {
        totalNotes: 1,
        analysisTimestamp: new Date(),
        safetyGroups: [
          {
            confidence: SafetyConfidence.HIGH,
            notes: [
              {
                note: sampleNotes[1],
                utilityScore: {} as any,
                recommendations: [
                  {
                    id: 'rec1',
                    noteId: 'note2',
                    action: RecommendationAction.DELETE,
                    confidence: 0.9,
                    reasoning: 'Test',
                    impact: ImpactLevel.LOW,
                    reversible: true,
                    timestamp: new Date(),
                    status: 'pending' as any
                  }
                ],
                safetyRating: 0.9,
                estimatedSize: 1024,
                riskFactors: []
              }
            ],
            totalCount: 1,
            estimatedSavings: 1024,
            recommendedActions: [RecommendationAction.DELETE]
          }
        ],
        storageEstimate: {} as any,
        backupInfo: {
          backupId: 'backup123',
          createdAt: new Date(),
          backupPath: 'test',
          totalSize: 1024,
          noteCount: 1,
          verified: true
        },
        processingErrors: []
      };

      // Execute
      await bulkCleanupService.executeBulkCleanup(mockAnalysisResult, [SafetyConfidence.HIGH]);

      // Verify progress updates were sent
      expect(progressUpdates.length).toBeGreaterThan(0);
      
      // Check that we have progress updates with the expected structure
      const hasValidProgress = progressUpdates.some(p => 
        p.totalOperations === 1 && 
        p.completedOperations >= 0 &&
        typeof p.currentOperation === 'string'
      );
      expect(hasValidProgress).toBe(true);
    });
  });

  describe('utility methods', () => {
    it('should correctly identify if currently processing', () => {
      expect(bulkCleanupService.isCurrentlyProcessing()).toBe(false);
    });

    it('should return null progress when not executing', () => {
      expect(bulkCleanupService.getExecutionProgress()).toBeNull();
    });
  });
});