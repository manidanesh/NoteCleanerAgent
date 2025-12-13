import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { UtilityScorerAgent, UtilityScorerConfig } from '../../src/agents/UtilityScorerAgent';
import { Note, AttachmentType, ChecklistItem } from '../../src/models/Note';
import { LLMService } from '../../src/services/LLMService';
import { LLMRequestType } from '../../src/models/LLMModels';

describe('UtilityScorerAgent', () => {
  let utilityScorerAgent: UtilityScorerAgent;
  let mockLLMService: LLMService;

  beforeEach(() => {
    // Create a mock LLM service
    mockLLMService = {
      processRequest: vi.fn().mockResolvedValue({
        requestId: 'test-request',
        response: 'SCORE: 75 REASONING: This note contains valuable meeting information with clear action items.',
        confidence: 0.85,
        tokensUsed: 50,
        processingTime: 100,
        model: 'test-model',
        fallbackUsed: false
      }),
      isAvailable: vi.fn().mockResolvedValue(true),
      getCurrentProvider: vi.fn().mockReturnValue('core_ml'),
      setProviderPreference: vi.fn(),
      getResourceUsage: vi.fn().mockReturnValue({
        totalRequests: 0,
        onDeviceRequests: 0,
        cloudRequests: 0,
        failedRequests: 0,
        averageResponseTime: 0,
        memoryUsage: 0,
        cpuUsage: 0
      }),
      shutdown: vi.fn().mockResolvedValue(undefined)
    };

    utilityScorerAgent = new UtilityScorerAgent(mockLLMService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Functionality', () => {
    it('should initialize with default configuration', () => {
      const agent = new UtilityScorerAgent(mockLLMService);
      expect(agent).toBeDefined();
    });

    it('should score a simple note', async () => {
      const note: Note = {
        id: 'test-note-1',
        title: 'Meeting Notes',
        content: 'Important meeting about project planning. Action items: 1. Review budget 2. Schedule follow-up',
        createdDate: new Date('2024-01-01'),
        modifiedDate: new Date('2024-01-02'),
        folder: 'Work',
        attachments: [],
        checklists: [],
        metadata: {
          accessCount: 5,
          lastAccessDate: new Date('2024-01-02'),
          shareCount: 1,
          tags: ['work', 'meeting'],
          isShared: true,
          wordCount: 15,
          hasHandwriting: false,
          hasImages: false
        }
      };

      const result = await utilityScorerAgent.scoreNote(note);

      expect(result).toBeDefined();
      expect(result.noteId).toBe('test-note-1');
      expect(result.overallScore).toBeGreaterThanOrEqual(0);
      expect(result.overallScore).toBeLessThanOrEqual(100);
      expect(result.contentScore).toBeGreaterThanOrEqual(0);
      expect(result.behavioralScore).toBeGreaterThanOrEqual(0);
      expect(result.semanticScore).toBeGreaterThanOrEqual(0);
      expect(result.ruleBasedScore).toBeGreaterThanOrEqual(0);
      expect(result.explanation).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.factors).toHaveLength(5);
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it('should handle notes with checklists', async () => {
      const checklistItems: ChecklistItem[] = [
        { id: 'item-1', text: 'Task 1', completed: true, order: 1 },
        { id: 'item-2', text: 'Task 2', completed: false, order: 2 }
      ];

      const note: Note = {
        id: 'test-note-2',
        title: 'Project Tasks',
        content: 'Project checklist for completion',
        createdDate: new Date('2024-01-01'),
        modifiedDate: new Date('2024-01-02'),
        folder: 'Work',
        attachments: [],
        checklists: checklistItems,
        metadata: {
          accessCount: 3,
          shareCount: 0,
          tags: ['project'],
          isShared: false,
          wordCount: 5,
          hasHandwriting: false,
          hasImages: false
        }
      };

      const result = await utilityScorerAgent.scoreNote(note);

      expect(result).toBeDefined();
      expect(result.overallScore).toBeGreaterThanOrEqual(0);
      expect(result.overallScore).toBeLessThanOrEqual(100);
    });

    it('should handle notes with attachments', async () => {
      const note: Note = {
        id: 'test-note-3',
        title: 'Document Review',
        content: 'Review the attached document for feedback',
        createdDate: new Date('2024-01-01'),
        modifiedDate: new Date('2024-01-02'),
        folder: 'Work',
        attachments: [{
          id: 'att-1',
          type: AttachmentType.PDF,
          filename: 'report.pdf',
          size: 1024000,
          mimeType: 'application/pdf'
        }],
        checklists: [],
        metadata: {
          accessCount: 2,
          shareCount: 0,
          tags: ['review'],
          isShared: false,
          wordCount: 8,
          hasHandwriting: false,
          hasImages: false
        }
      };

      const result = await utilityScorerAgent.scoreNote(note);

      expect(result).toBeDefined();
      expect(result.overallScore).toBeGreaterThanOrEqual(0);
      expect(result.overallScore).toBeLessThanOrEqual(100);
    });
  });

  describe('Scoring Algorithms', () => {
    it('should give higher scores to frequently accessed notes', async () => {
      const highAccessNote: Note = {
        id: 'high-access',
        title: 'Important Reference',
        content: 'Frequently accessed important information',
        createdDate: new Date('2024-01-01'),
        modifiedDate: new Date('2024-01-02'),
        folder: 'Reference',
        attachments: [],
        checklists: [],
        metadata: {
          accessCount: 50,
          lastAccessDate: new Date('2024-01-02'),
          shareCount: 5,
          tags: ['important'],
          isShared: true,
          wordCount: 6,
          hasHandwriting: false,
          hasImages: false
        }
      };

      const lowAccessNote: Note = {
        id: 'low-access',
        title: 'Old Note',
        content: 'Rarely accessed old information',
        createdDate: new Date('2023-01-01'),
        modifiedDate: new Date('2023-01-01'),
        folder: 'Archive',
        attachments: [],
        checklists: [],
        metadata: {
          accessCount: 1,
          shareCount: 0,
          tags: [],
          isShared: false,
          wordCount: 5,
          hasHandwriting: false,
          hasImages: false
        }
      };

      const highScore = await utilityScorerAgent.scoreNote(highAccessNote);
      const lowScore = await utilityScorerAgent.scoreNote(lowAccessNote);

      expect(highScore.behavioralScore).toBeGreaterThan(lowScore.behavioralScore);
    });

    it('should give higher scores to recently modified notes', async () => {
      const recentNote: Note = {
        id: 'recent-note',
        title: 'Recent Update',
        content: 'Recently updated content with new information',
        createdDate: new Date('2024-01-01'),
        modifiedDate: new Date(), // Today
        folder: 'Current',
        attachments: [],
        checklists: [],
        metadata: {
          accessCount: 5,
          shareCount: 0,
          tags: ['current'],
          isShared: false,
          wordCount: 8,
          hasHandwriting: false,
          hasImages: false
        }
      };

      const oldNote: Note = {
        id: 'old-note',
        title: 'Old Content',
        content: 'Old content that hasnt been updated',
        createdDate: new Date('2022-01-01'),
        modifiedDate: new Date('2022-01-01'),
        folder: 'Archive',
        attachments: [],
        checklists: [],
        metadata: {
          accessCount: 5,
          shareCount: 0,
          tags: ['old'],
          isShared: false,
          wordCount: 7,
          hasHandwriting: false,
          hasImages: false
        }
      };

      const recentScore = await utilityScorerAgent.scoreNote(recentNote);
      const oldScore = await utilityScorerAgent.scoreNote(oldNote);

      expect(recentScore.ruleBasedScore).toBeGreaterThan(oldScore.ruleBasedScore);
    });
  });

  describe('LLM Integration', () => {
    it('should call LLM service for content assessment', async () => {
      const note: Note = {
        id: 'test-note-4',
        title: 'Test Note',
        content: 'This is test content for LLM assessment',
        createdDate: new Date('2024-01-01'),
        modifiedDate: new Date('2024-01-02'),
        folder: 'Test',
        attachments: [],
        checklists: [],
        metadata: {
          accessCount: 1,
          shareCount: 0,
          tags: [],
          isShared: false,
          wordCount: 8,
          hasHandwriting: false,
          hasImages: false
        }
      };

      await utilityScorerAgent.scoreNote(note);

      expect(mockLLMService.processRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          agentId: 'utility-scorer',
          requestType: LLMRequestType.CONTENT_ANALYSIS,
          noteContent: expect.stringContaining('This is test content')
        })
      );
    });

    it('should handle LLM service failures gracefully', async () => {
      // Mock LLM service to fail
      const failingLLMService = {
        ...mockLLMService,
        processRequest: vi.fn().mockRejectedValue(new Error('LLM service unavailable'))
      };

      const agent = new UtilityScorerAgent(failingLLMService);

      const note: Note = {
        id: 'test-note-5',
        title: 'Test Note',
        content: 'This note will test LLM failure handling',
        createdDate: new Date('2024-01-01'),
        modifiedDate: new Date('2024-01-02'),
        folder: 'Test',
        attachments: [],
        checklists: [],
        metadata: {
          accessCount: 1,
          shareCount: 0,
          tags: [],
          isShared: false,
          wordCount: 9,
          hasHandwriting: false,
          hasImages: false
        }
      };

      const result = await agent.scoreNote(note);

      // Should still return a valid result even with LLM failure
      expect(result).toBeDefined();
      expect(result.overallScore).toBeGreaterThanOrEqual(0);
      expect(result.overallScore).toBeLessThanOrEqual(100);
      expect(result.explanation).toContain('fallback');
    });
  });

  describe('Configuration and Preferences', () => {
    it('should allow updating user preferences', () => {
      const newPreferences = {
        recencyImportance: 0.9,
        accessFrequencyImportance: 0.5
      };

      utilityScorerAgent.updateUserPreferences(newPreferences);

      // Test that preferences are applied by scoring a note
      // (This is a basic test - in practice you'd verify the actual impact)
      expect(() => utilityScorerAgent.updateUserPreferences(newPreferences)).not.toThrow();
    });

    it('should allow updating algorithm weights', () => {
      const newWeights = {
        tfIdfWeight: 0.3,
        behavioralWeight: 0.3,
        semanticWeight: 0.2,
        ruleBasedWeight: 0.1,
        llmWeight: 0.1
      };

      utilityScorerAgent.updateAlgorithmWeights(newWeights);

      // Test that weights are applied
      expect(() => utilityScorerAgent.updateAlgorithmWeights(newWeights)).not.toThrow();
    });

    it('should initialize vocabulary from note corpus', () => {
      const notes: Note[] = [
        {
          id: 'note-1',
          title: 'Meeting Notes',
          content: 'Important meeting about project planning',
          createdDate: new Date('2024-01-01'),
          modifiedDate: new Date('2024-01-02'),
          folder: 'Work',
          attachments: [],
          checklists: [],
          metadata: {
            accessCount: 1,
            shareCount: 0,
            tags: [],
            isShared: false,
            wordCount: 6,
            hasHandwriting: false,
            hasImages: false
          }
        },
        {
          id: 'note-2',
          title: 'Project Update',
          content: 'Project status and next steps',
          createdDate: new Date('2024-01-01'),
          modifiedDate: new Date('2024-01-02'),
          folder: 'Work',
          attachments: [],
          checklists: [],
          metadata: {
            accessCount: 1,
            shareCount: 0,
            tags: [],
            isShared: false,
            wordCount: 5,
            hasHandwriting: false,
            hasImages: false
          }
        }
      ];

      expect(() => utilityScorerAgent.initializeVocabulary(notes)).not.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should return fallback score on critical errors', async () => {
      // Create a problematic note that might cause errors
      const problematicNote: Note = {
        id: 'problematic-note',
        title: '',
        content: '',
        createdDate: new Date('2024-01-01'),
        modifiedDate: new Date('2024-01-02'),
        folder: '',
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
      };

      const result = await utilityScorerAgent.scoreNote(problematicNote);

      // Should still return a valid result
      expect(result).toBeDefined();
      expect(result.overallScore).toBeGreaterThanOrEqual(0);
      expect(result.overallScore).toBeLessThanOrEqual(100);
      expect(result.confidence).toBeGreaterThan(0);
    });
  });
});