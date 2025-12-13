import { describe, it, expect, beforeEach, vi } from 'vitest';
import { JunkNoteDetectionService } from '../../src/services/JunkNoteDetectionService';
import { JunkNoteDetectorAgent, JunkNoteCategory, JunkConfidence } from '../../src/agents/JunkNoteDetectorAgent';
import { LLMService } from '../../src/services/LLMService';
import { Note } from '../../src/models/Note';
import { RecommendationAction, ImpactLevel } from '../../src/models/Recommendation';

describe('JunkNoteDetectionService', () => {
  let service: JunkNoteDetectionService;
  let mockLLMService: LLMService;

  beforeEach(() => {
    mockLLMService = {
      processRequest: vi.fn().mockResolvedValue({
        response: JSON.stringify({
          isJunk: true,
          confidence: 0.8,
          reasoning: 'Test reasoning'
        })
      })
    } as any;
    
    service = new JunkNoteDetectionService(mockLLMService);
  });

  const createTestNote = (overrides: Partial<Note> = {}): Note => ({
    id: 'test-note-1',
    title: 'Test Note',
    content: 'Test content',
    createdDate: new Date('2024-01-01'),
    modifiedDate: new Date('2024-01-01'),
    folder: 'Notes',
    attachments: [],
    checklists: [],
    metadata: {
      accessCount: 1,
      lastAccessDate: new Date('2024-01-01'),
      shareCount: 0,
      tags: [],
      isShared: false,
      wordCount: 2,
      hasHandwriting: false,
      hasImages: false
    },
    ...overrides
  });

  describe('Single Note Analysis', () => {
    it('should analyze a single note', async () => {
      const note = createTestNote({ content: '' }); // Empty note

      const result = await service.analyzeNote(note);

      expect(result.noteId).toBe(note.id);
      expect(result.isJunk).toBe(true);
      expect(result.category).toBe(JunkNoteCategory.EMPTY_NOTE);
      expect(result.confidence).toBe(JunkConfidence.HIGH);
    });

    it('should return disabled result when auto-detection is off', async () => {
      const disabledService = new JunkNoteDetectionService(mockLLMService, {
        enableAutoDetection: false
      });
      
      const note = createTestNote();
      const result = await disabledService.analyzeNote(note);

      expect(result.isJunk).toBe(false);
      expect(result.confidence).toBe(JunkConfidence.UNCERTAIN);
      expect(result.reasoning).toContain('disabled');
    });
  });

  describe('Batch Analysis with Recommendations', () => {
    it('should analyze multiple notes and generate recommendations', async () => {
      const notes = [
        createTestNote({ id: '1', content: '', title: 'Empty' }),
        createTestNote({ id: '2', content: 'milk, bread, eggs', title: 'Shopping' }),
        createTestNote({ id: '3', content: 'Important meeting notes', title: 'Meeting' })
      ];

      const { results, recommendations, summary } = await service.analyzeNotesWithRecommendations(notes);

      expect(results).toHaveLength(3);
      expect(recommendations.length).toBeGreaterThan(0);
      expect(summary.totalNotesAnalyzed).toBe(3);
      expect(summary.junkNotesFound).toBeGreaterThan(0);
    });

    it('should create appropriate recommendations for high confidence junk', async () => {
      const junkNote = createTestNote({ 
        id: 'junk-1', 
        content: '', 
        title: 'Empty Note' 
      });

      const { recommendations } = await service.analyzeNotesWithRecommendations([junkNote]);

      const recommendation = recommendations.find(r => r.noteId === junkNote.id);
      expect(recommendation).toBeDefined();
      expect(recommendation?.action).toBe(RecommendationAction.DELETE);
      expect(recommendation?.reasoning).toContain('Junk Detection');
    });

    it('should create review recommendations for uncertain cases', async () => {
      const uncertainNote = createTestNote({
        id: 'uncertain-1',
        content: 'Maybe important maybe not',
        metadata: {
          accessCount: 2,
          shareCount: 0,
          tags: [],
          isShared: false,
          wordCount: 4,
          hasHandwriting: false,
          hasImages: false
        }
      });

      // Mock the detector to return uncertain result
      vi.spyOn(JunkNoteDetectorAgent.prototype, 'analyzeNote').mockResolvedValue({
        noteId: uncertainNote.id,
        isJunk: false,
        confidence: JunkConfidence.UNCERTAIN,
        confidenceScore: 35,
        indicators: [],
        reasoning: 'Uncertain classification',
        requiresManualReview: true,
        timestamp: new Date()
      });

      const { recommendations } = await service.analyzeNotesWithRecommendations([uncertainNote]);

      const recommendation = recommendations.find(r => r.noteId === uncertainNote.id);
      expect(recommendation?.action).toBe(RecommendationAction.REVIEW);
      expect(recommendation?.reasoning).toContain('Manual Review Needed');
    });
  });

  describe('Summary Generation', () => {
    it('should generate accurate summary statistics', async () => {
      const notes = [
        createTestNote({ id: '1', content: '' }), // Empty - junk
        createTestNote({ id: '2', content: 'milk, bread' }), // Shopping list - junk  
        createTestNote({ id: '3', content: 'Important work notes' }), // Not junk
        createTestNote({ id: '4', content: 'test test' }) // Scratch - junk
      ];

      const { summary } = await service.analyzeNotesWithRecommendations(notes);

      expect(summary.totalNotesAnalyzed).toBe(4);
      expect(summary.junkNotesFound).toBeGreaterThan(0);
      expect(summary.categoryCounts.size).toBeGreaterThan(0);
      expect(summary.confidenceDistribution.size).toBeGreaterThan(0);
      expect(summary.estimatedStorageSavings).toBeGreaterThan(0);
      expect(summary.processingTime).toBeGreaterThan(0);
    });

    it('should categorize junk notes correctly in summary', async () => {
      const notes = [
        createTestNote({ id: '1', content: '', title: 'Empty' }),
        createTestNote({ id: '2', content: 'milk\nbread\neggs', title: 'Groceries' })
      ];

      const { summary } = await service.analyzeNotesWithRecommendations(notes);

      expect(summary.categoryCounts.get(JunkNoteCategory.EMPTY_NOTE)).toBeGreaterThan(0);
      expect(summary.categoryCounts.get(JunkNoteCategory.SHOPPING_LIST)).toBeGreaterThan(0);
    });
  });

  describe('Configuration Management', () => {
    it('should update configuration correctly', () => {
      const newConfig = {
        confidenceThreshold: JunkConfidence.HIGH,
        batchSize: 50
      };

      service.updateConfig(newConfig);
      const config = service.getConfig();

      expect(config.confidenceThreshold).toBe(JunkConfidence.HIGH);
      expect(config.batchSize).toBe(50);
    });

    it('should respect confidence threshold in recommendations', async () => {
      // Set high confidence threshold
      service.updateConfig({ confidenceThreshold: JunkConfidence.HIGH });

      const mediumConfidenceNote = createTestNote({ id: 'medium', content: 'maybe junk' });
      
      // Mock medium confidence result
      vi.spyOn(JunkNoteDetectorAgent.prototype, 'analyzeNote').mockResolvedValue({
        noteId: mediumConfidenceNote.id,
        isJunk: true,
        confidence: JunkConfidence.MEDIUM,
        confidenceScore: 70,
        indicators: [],
        reasoning: 'Medium confidence junk',
        requiresManualReview: false,
        timestamp: new Date()
      });

      const { recommendations } = await service.analyzeNotesWithRecommendations([mediumConfidenceNote]);

      // Should not create recommendation due to high threshold
      expect(recommendations.length).toBe(0);
    });
  });

  describe('Statistics', () => {
    it('should provide accurate statistics', async () => {
      const mockResults = [
        {
          noteId: '1',
          isJunk: true,
          confidence: JunkConfidence.HIGH,
          category: JunkNoteCategory.EMPTY_NOTE,
          confidenceScore: 90,
          indicators: [],
          reasoning: 'Empty note',
          requiresManualReview: false,
          timestamp: new Date()
        },
        {
          noteId: '2',
          isJunk: true,
          confidence: JunkConfidence.MEDIUM,
          category: JunkNoteCategory.SHOPPING_LIST,
          confidenceScore: 70,
          indicators: [],
          reasoning: 'Shopping list',
          requiresManualReview: false,
          timestamp: new Date()
        },
        {
          noteId: '3',
          isJunk: false,
          confidence: JunkConfidence.UNCERTAIN,
          confidenceScore: 30,
          indicators: [],
          reasoning: 'Uncertain',
          requiresManualReview: true,
          timestamp: new Date()
        }
      ];

      const stats = service.getStatistics(mockResults);

      expect(stats.totalAnalyzed).toBe(3);
      expect(stats.junkFound).toBe(2);
      expect(stats.highConfidenceJunk).toBe(1);
      expect(stats.manualReviewNeeded).toBe(1);
      expect(stats.categoryBreakdown[JunkNoteCategory.EMPTY_NOTE]).toBe(1);
      expect(stats.categoryBreakdown[JunkNoteCategory.SHOPPING_LIST]).toBe(1);
    });
  });

  describe('Error Handling', () => {
    it('should handle processing errors gracefully', async () => {
      const problematicNote = createTestNote({ id: 'problem' });
      
      // Mock analyzer to throw error
      vi.spyOn(JunkNoteDetectorAgent.prototype, 'analyzeNote').mockRejectedValue(
        new Error('Processing failed')
      );

      const result = await service.analyzeNote(problematicNote);

      expect(result.noteId).toBe(problematicNote.id);
      expect(result.requiresManualReview).toBe(true);
    });
  });
});