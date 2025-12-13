import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { OrganizationAgent, TitleAnalysis, TitleSuggestion, FolderSuggestion } from '../../src/agents/OrganizationAgent';
import { Note, AttachmentType } from '../../src/models/Note';
import { UtilityScore } from '../../src/models/UtilityScore';
import { RecommendationAction, ImpactLevel } from '../../src/models/Recommendation';
import { LLMService } from '../../src/services/LLMService';
import { LLMRequestType } from '../../src/models/LLMModels';

describe('OrganizationAgent', () => {
  let organizationAgent: OrganizationAgent;
  let mockLLMService: LLMService;

  beforeEach(() => {
    // Create a mock LLM service
    mockLLMService = {
      processRequest: vi.fn().mockImplementation((request) => {
        if (request.requestType === LLMRequestType.TITLE_GENERATION) {
          return Promise.resolve({
            requestId: 'test-request',
            response: JSON.stringify({
              title: 'Project Planning Meeting Notes',
              reasoning: 'Generated descriptive title based on content analysis',
              keywords: ['project', 'planning', 'meeting'],
              confidence: 0.85
            }),
            confidence: 0.85,
            tokensUsed: 50,
            processingTime: 100,
            model: 'test-model',
            fallbackUsed: false
          });
        } else if (request.requestType === LLMRequestType.CLASSIFICATION) {
          return Promise.resolve({
            requestId: 'test-request',
            response: JSON.stringify({
              folder: 'Work/Projects',
              reasoning: 'Content indicates work-related project planning activities',
              themes: ['work', 'planning', 'project'],
              confidence: 0.80
            }),
            confidence: 0.80,
            tokensUsed: 40,
            processingTime: 90,
            model: 'test-model',
            fallbackUsed: false
          });
        }
        return Promise.resolve({
          requestId: 'test-request',
          response: 'Generic LLM response',
          confidence: 0.70,
          tokensUsed: 30,
          processingTime: 80,
          model: 'test-model',
          fallbackUsed: false
        });
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

    organizationAgent = new OrganizationAgent(mockLLMService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Functionality', () => {
    it('should initialize correctly', () => {
      const agent = new OrganizationAgent(mockLLMService);
      expect(agent).toBeDefined();
    });

    it('should generate recommendations for a note', async () => {
      const note: Note = {
        id: 'test-note-1',
        title: 'Meeting',
        content: 'Important meeting about project planning. Action items: 1. Review budget 2. Schedule follow-up',
        createdDate: new Date('2024-01-01'),
        modifiedDate: new Date('2024-01-02'),
        folder: 'General',
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

      const utilityScore: UtilityScore = {
        noteId: 'test-note-1',
        overallScore: 75,
        contentScore: 80,
        behavioralScore: 70,
        semanticScore: 75,
        ruleBasedScore: 70,
        explanation: 'High utility note with good content',
        confidence: 0.85,
        factors: [],
        timestamp: new Date()
      };

      const recommendations = await organizationAgent.generateRecommendations(note, utilityScore);

      expect(recommendations).toBeDefined();
      expect(Array.isArray(recommendations)).toBe(true);
      expect(recommendations.length).toBeGreaterThan(0);

      // Check that recommendations have required properties
      recommendations.forEach(rec => {
        expect(rec.id).toBeDefined();
        expect(rec.noteId).toBe('test-note-1');
        expect(rec.action).toBeDefined();
        expect(rec.confidence).toBeGreaterThan(0);
        expect(rec.confidence).toBeLessThanOrEqual(1);
        expect(rec.reasoning).toBeDefined();
        expect(rec.impact).toBeDefined();
        expect(typeof rec.reversible).toBe('boolean');
        expect(rec.timestamp).toBeInstanceOf(Date);
      });
    });
  });

  describe('Title Analysis', () => {
    it('should detect generic titles', () => {
      const note: Note = {
        id: 'test-note-2',
        title: 'Note',
        content: 'This is some content about project planning',
        createdDate: new Date('2024-01-01'),
        modifiedDate: new Date('2024-01-02'),
        folder: 'General',
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

      const analysis = organizationAgent.analyzeTitleQuality(note);

      expect(analysis).toBeDefined();
      expect(analysis.isGeneric).toBe(true);
      expect(analysis.issues).toContain('Title is too generic');
      expect(analysis.clarity).toBeLessThan(70);
      expect(analysis.specificity).toBeLessThan(60);
    });

    it('should detect unclear titles', () => {
      const note: Note = {
        id: 'test-note-3',
        title: 'Misc stuff',
        content: 'Various things to remember',
        createdDate: new Date('2024-01-01'),
        modifiedDate: new Date('2024-01-02'),
        folder: 'General',
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

      const analysis = organizationAgent.analyzeTitleQuality(note);

      expect(analysis).toBeDefined();
      expect(analysis.isUnclear).toBe(true);
      expect(analysis.issues).toContain('Title contains vague terms');
    });

    it('should detect content mismatch', () => {
      const note: Note = {
        id: 'test-note-4',
        title: 'Shopping List',
        content: 'Meeting notes from the quarterly business review. Discussed budget allocations and strategic planning for next year.',
        createdDate: new Date('2024-01-01'),
        modifiedDate: new Date('2024-01-02'),
        folder: 'General',
        attachments: [],
        checklists: [],
        metadata: {
          accessCount: 1,
          shareCount: 0,
          tags: [],
          isShared: false,
          wordCount: 18,
          hasHandwriting: false,
          hasImages: false
        }
      };

      const analysis = organizationAgent.analyzeTitleQuality(note);

      expect(analysis).toBeDefined();
      expect(analysis.hasContentMismatch).toBe(true);
      expect(analysis.issues).toContain('Title does not match content');
    });

    it('should give high scores to good titles', () => {
      const note: Note = {
        id: 'test-note-5',
        title: 'Q4 Budget Planning Meeting Notes',
        content: 'Quarterly budget planning meeting with finance team. Discussed allocation strategies and cost optimization.',
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
          wordCount: 15,
          hasHandwriting: false,
          hasImages: false
        }
      };

      const analysis = organizationAgent.analyzeTitleQuality(note);

      expect(analysis).toBeDefined();
      expect(analysis.isGeneric).toBe(false);
      expect(analysis.isUnclear).toBe(false);
      expect(analysis.hasContentMismatch).toBe(false);
      expect(analysis.clarity).toBeGreaterThan(70);
      expect(analysis.specificity).toBeGreaterThanOrEqual(60);
      expect(analysis.searchability).toBeGreaterThan(60);
      expect(analysis.issues.length).toBe(0);
    });
  });

  describe('Title Generation', () => {
    it('should generate title suggestions for generic titles', async () => {
      const note: Note = {
        id: 'test-note-6',
        title: 'Note',
        content: 'Meeting about project planning and budget allocation for Q4',
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
          wordCount: 10,
          hasHandwriting: false,
          hasImages: false
        }
      };

      const analysis = organizationAgent.analyzeTitleQuality(note);
      const suggestion = await organizationAgent.generateTitleSuggestion(note, analysis);

      expect(suggestion).toBeDefined();
      expect(suggestion!.suggestedTitle).toBeDefined();
      expect(suggestion!.suggestedTitle.length).toBeGreaterThan(3);
      expect(suggestion!.suggestedTitle.length).toBeLessThanOrEqual(100);
      expect(suggestion!.reasoning).toBeDefined();
      expect(suggestion!.confidence).toBeGreaterThan(0);
      expect(suggestion!.confidence).toBeLessThanOrEqual(1);
      expect(Array.isArray(suggestion!.keywords)).toBe(true);
    });

    it('should call LLM service for title generation', async () => {
      const note: Note = {
        id: 'test-note-7',
        title: 'Untitled',
        content: 'Project status update and next steps for development team',
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
          wordCount: 10,
          hasHandwriting: false,
          hasImages: false
        }
      };

      const analysis = organizationAgent.analyzeTitleQuality(note);
      await organizationAgent.generateTitleSuggestion(note, analysis);

      expect(mockLLMService.processRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          agentId: 'organization-agent',
          requestType: LLMRequestType.TITLE_GENERATION,
          noteContent: expect.stringContaining('Project status update')
        })
      );
    });

    it('should handle LLM failures gracefully with fallback', async () => {
      // Mock LLM service to fail
      const failingLLMService = {
        ...mockLLMService,
        processRequest: vi.fn().mockRejectedValue(new Error('LLM service unavailable'))
      };

      const agent = new OrganizationAgent(failingLLMService);

      const note: Note = {
        id: 'test-note-8',
        title: 'Note',
        content: 'Important project meeting discussion about budget and timeline',
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
          wordCount: 9,
          hasHandwriting: false,
          hasImages: false
        }
      };

      const analysis = agent.analyzeTitleQuality(note);
      const suggestion = await agent.generateTitleSuggestion(note, analysis);

      // Should still return a suggestion using fallback method
      expect(suggestion).toBeDefined();
      expect(suggestion!.suggestedTitle).toBeDefined();
      expect(suggestion!.reasoning).toContain('Generated from key content words');
    });
  });

  describe('Folder Organization', () => {
    it('should generate folder suggestions', async () => {
      const note: Note = {
        id: 'test-note-9',
        title: 'Team Meeting',
        content: 'Weekly team meeting to discuss project progress and upcoming deadlines',
        createdDate: new Date('2024-01-01'),
        modifiedDate: new Date('2024-01-02'),
        folder: 'General',
        attachments: [],
        checklists: [],
        metadata: {
          accessCount: 1,
          shareCount: 0,
          tags: [],
          isShared: false,
          wordCount: 11,
          hasHandwriting: false,
          hasImages: false
        }
      };

      const suggestion = await organizationAgent.generateFolderSuggestion(note);

      expect(suggestion).toBeDefined();
      expect(suggestion!.suggestedFolder).toBeDefined();
      expect(suggestion!.reasoning).toBeDefined();
      expect(suggestion!.confidence).toBeGreaterThan(0);
      expect(suggestion!.confidence).toBeLessThanOrEqual(1);
      expect(Array.isArray(suggestion!.themes)).toBe(true);
    });

    it('should call LLM service for folder classification', async () => {
      const note: Note = {
        id: 'test-note-10',
        title: 'Budget Review',
        content: 'Financial review meeting for Q4 budget planning',
        createdDate: new Date('2024-01-01'),
        modifiedDate: new Date('2024-01-02'),
        folder: 'General',
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

      await organizationAgent.generateFolderSuggestion(note);

      expect(mockLLMService.processRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          agentId: 'organization-agent',
          requestType: LLMRequestType.CLASSIFICATION,
          noteContent: expect.stringContaining('Financial review meeting')
        })
      );
    });
  });

  describe('Batch Improvements', () => {
    it('should identify notes with title issues for batch improvement', async () => {
      const notes: Note[] = [
        {
          id: 'note-1',
          title: 'Note',
          content: 'Meeting content',
          createdDate: new Date('2024-01-01'),
          modifiedDate: new Date('2024-01-02'),
          folder: 'General',
          attachments: [],
          checklists: [],
          metadata: {
            accessCount: 1,
            shareCount: 0,
            tags: [],
            isShared: false,
            wordCount: 2,
            hasHandwriting: false,
            hasImages: false
          }
        },
        {
          id: 'note-2',
          title: 'Untitled',
          content: 'Project content',
          createdDate: new Date('2024-01-01'),
          modifiedDate: new Date('2024-01-02'),
          folder: 'General',
          attachments: [],
          checklists: [],
          metadata: {
            accessCount: 1,
            shareCount: 0,
            tags: [],
            isShared: false,
            wordCount: 2,
            hasHandwriting: false,
            hasImages: false
          }
        },
        {
          id: 'note-3',
          title: 'New',
          content: 'Task content',
          createdDate: new Date('2024-01-01'),
          modifiedDate: new Date('2024-01-02'),
          folder: 'General',
          attachments: [],
          checklists: [],
          metadata: {
            accessCount: 1,
            shareCount: 0,
            tags: [],
            isShared: false,
            wordCount: 2,
            hasHandwriting: false,
            hasImages: false
          }
        }
      ];

      const improvements = await organizationAgent.generateBatchImprovements(notes);

      expect(improvements).toBeDefined();
      expect(Array.isArray(improvements)).toBe(true);
      
      // Should identify title improvements
      const titleImprovement = improvements.find(imp => imp.type === 'title_improvements');
      expect(titleImprovement).toBeDefined();
      expect(titleImprovement!.noteIds).toHaveLength(3);
      expect(titleImprovement!.description).toContain('generic or unclear titles');
    });
  });

  describe('Before/After Comparisons', () => {
    it('should generate comparison for organizational changes', () => {
      const note: Note = {
        id: 'test-note-11',
        title: 'Meeting',
        content: 'Project planning discussion',
        createdDate: new Date('2024-01-01'),
        modifiedDate: new Date('2024-01-02'),
        folder: 'General',
        attachments: [],
        checklists: [],
        metadata: {
          accessCount: 1,
          shareCount: 0,
          tags: [],
          isShared: false,
          wordCount: 3,
          hasHandwriting: false,
          hasImages: false
        }
      };

      const titleSuggestion: TitleSuggestion = {
        suggestedTitle: 'Project Planning Meeting Notes',
        reasoning: 'More descriptive title based on content',
        confidence: 0.85,
        keywords: ['project', 'planning', 'meeting']
      };

      const folderSuggestion: FolderSuggestion = {
        suggestedFolder: 'Work/Projects',
        reasoning: 'Content indicates work-related project activities',
        confidence: 0.80,
        themes: ['work', 'project']
      };

      const comparison = organizationAgent.generateComparison(note, titleSuggestion, folderSuggestion);

      expect(comparison).toBeDefined();
      expect(comparison.noteId).toBe('test-note-11');
      expect(comparison.before.title).toBe('Meeting');
      expect(comparison.before.folder).toBe('General');
      expect(comparison.after.title).toBe('Project Planning Meeting Notes');
      expect(comparison.after.folder).toBe('Work/Projects');
      expect(comparison.improvements.length).toBeGreaterThan(0);
      expect(comparison.impact).toBeDefined();
    });
  });

  describe('Action Recommendations', () => {
    it('should recommend KEEP for high utility scores', async () => {
      const note: Note = {
        id: 'test-note-12',
        title: 'Important Document',
        content: 'Critical project information',
        createdDate: new Date('2024-01-01'),
        modifiedDate: new Date('2024-01-02'),
        folder: 'Work',
        attachments: [],
        checklists: [],
        metadata: {
          accessCount: 10,
          shareCount: 2,
          tags: ['important'],
          isShared: true,
          wordCount: 4,
          hasHandwriting: false,
          hasImages: false
        }
      };

      const highUtilityScore: UtilityScore = {
        noteId: 'test-note-12',
        overallScore: 80, // Adjusted to match the threshold
        contentScore: 80,
        behavioralScore: 90,
        semanticScore: 85,
        ruleBasedScore: 80,
        explanation: 'High utility note',
        confidence: 0.90,
        factors: [],
        timestamp: new Date()
      };

      const recommendations = await organizationAgent.generateRecommendations(note, highUtilityScore);
      
      const actionRec = recommendations.find(rec => 
        rec.id.startsWith('action_') && (
          rec.action === RecommendationAction.KEEP || 
          rec.action === RecommendationAction.REVIEW ||
          rec.action === RecommendationAction.ARCHIVE ||
          rec.action === RecommendationAction.DELETE
        )
      );
      
      expect(actionRec).toBeDefined();

      expect(actionRec!.action).toBe(RecommendationAction.KEEP);
    });

    it('should recommend DELETE for low utility scores', async () => {
      const note: Note = {
        id: 'test-note-13',
        title: 'Old Note',
        content: 'Outdated information',
        createdDate: new Date('2022-01-01'),
        modifiedDate: new Date('2022-01-01'),
        folder: 'Archive',
        attachments: [],
        checklists: [],
        metadata: {
          accessCount: 0,
          shareCount: 0,
          tags: [],
          isShared: false,
          wordCount: 2,
          hasHandwriting: false,
          hasImages: false
        }
      };

      const lowUtilityScore: UtilityScore = {
        noteId: 'test-note-13',
        overallScore: 20, // Adjusted to be below the threshold
        contentScore: 20,
        behavioralScore: 30,
        semanticScore: 25,
        ruleBasedScore: 25,
        explanation: 'Low utility note',
        confidence: 0.70,
        factors: [],
        timestamp: new Date()
      };

      const recommendations = await organizationAgent.generateRecommendations(note, lowUtilityScore);
      
      const actionRec = recommendations.find(rec => 
        rec.id.startsWith('action_') && (
          rec.action === RecommendationAction.KEEP || 
          rec.action === RecommendationAction.REVIEW ||
          rec.action === RecommendationAction.ARCHIVE ||
          rec.action === RecommendationAction.DELETE
        )
      );
      
      expect(actionRec).toBeDefined();

      expect(actionRec!.action).toBe(RecommendationAction.DELETE);
      expect(actionRec!.impact).toBe(ImpactLevel.HIGH);
    });
  });

  describe('Error Handling', () => {
    it('should handle errors gracefully and provide fallback recommendations', async () => {
      // Create a problematic note
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

      const utilityScore: UtilityScore = {
        noteId: 'problematic-note',
        overallScore: 50,
        contentScore: 50,
        behavioralScore: 50,
        semanticScore: 50,
        ruleBasedScore: 50,
        explanation: 'Neutral score',
        confidence: 0.50,
        factors: [],
        timestamp: new Date()
      };

      const recommendations = await organizationAgent.generateRecommendations(problematicNote, utilityScore);

      // Should still return valid recommendations
      expect(recommendations).toBeDefined();
      expect(Array.isArray(recommendations)).toBe(true);
      expect(recommendations.length).toBeGreaterThan(0);
      
      // All recommendations should have valid properties
      recommendations.forEach(rec => {
        expect(rec.id).toBeDefined();
        expect(rec.noteId).toBe('problematic-note');
        expect(rec.confidence).toBeGreaterThan(0);
        expect(rec.reasoning).toBeDefined();
      });
    });
  });
});