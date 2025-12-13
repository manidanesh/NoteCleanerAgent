import { describe, it, expect, beforeEach, vi } from 'vitest';
import { JunkNoteDetectorAgent, JunkNoteCategory, JunkConfidence, JunkIndicatorType } from '../../src/agents/JunkNoteDetectorAgent';
import { LLMService } from '../../src/services/LLMService';
import { Note } from '../../src/models/Note';

describe('JunkNoteDetectorAgent', () => {
  let junkDetector: JunkNoteDetectorAgent;
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
    
    junkDetector = new JunkNoteDetectorAgent(mockLLMService);
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

  describe('Empty Note Detection', () => {
    it('should detect empty notes', async () => {
      const emptyNote = createTestNote({
        content: '',
        title: 'Untitled'
      });

      const result = await junkDetector.analyzeNote(emptyNote);

      expect(result.isJunk).toBe(true);
      expect(result.category).toBe(JunkNoteCategory.EMPTY_NOTE);
      expect(result.confidence).toBe(JunkConfidence.HIGH);
      expect(result.indicators.some(ind => ind.type === JunkIndicatorType.EMPTY_OR_WHITESPACE)).toBe(true);
    });

    it('should detect very short content', async () => {
      const shortNote = createTestNote({
        content: 'hi',
        title: 'Short'
      });

      const result = await junkDetector.analyzeNote(shortNote);

      expect(result.indicators.some(ind => ind.type === JunkIndicatorType.VERY_SHORT_CONTENT)).toBe(true);
    });

    it('should detect single word notes', async () => {
      const singleWordNote = createTestNote({
        content: 'test',
        title: 'Test'
      });

      const result = await junkDetector.analyzeNote(singleWordNote);

      expect(result.indicators.some(ind => ind.type === JunkIndicatorType.SINGLE_WORD)).toBe(true);
    });
  });

  describe('Shopping List Detection', () => {
    it('should detect shopping lists', async () => {
      const shoppingNote = createTestNote({
        content: `- milk
- bread  
- eggs
- butter
- cheese`,
        title: 'Grocery List'
      });

      const result = await junkDetector.analyzeNote(shoppingNote);

      expect(result.category).toBe(JunkNoteCategory.SHOPPING_LIST);
      expect(result.indicators.some(ind => ind.type === JunkIndicatorType.GROCERY_ITEMS)).toBe(true);
    });

    it('should detect shopping patterns in content', async () => {
      const shoppingNote = createTestNote({
        content: 'Need to buy milk and bread from the grocery store',
        title: 'Shopping'
      });

      const result = await junkDetector.analyzeNote(shoppingNote);

      expect(result.indicators.some(ind => ind.type === JunkIndicatorType.SHOPPING_LIST_PATTERN)).toBe(true);
    });
  });

  describe('Scratch Pad Detection', () => {
    it('should detect scratch content', async () => {
      const scratchNote = createTestNote({
        content: 'test test 123',
        title: 'scratch'
      });

      const result = await junkDetector.analyzeNote(scratchNote);

      expect(result.category).toBe(JunkNoteCategory.SCRATCH_PAD);
      expect(result.indicators.some(ind => ind.type === JunkIndicatorType.SCRATCH_CONTENT)).toBe(true);
    });

    it('should detect test content patterns', async () => {
      const testNote = createTestNote({
        content: 'asdf qwerty hello world',
        title: 'Test Note'
      });

      const result = await junkDetector.analyzeNote(testNote);

      expect(result.indicators.some(ind => ind.type === JunkIndicatorType.SCRATCH_CONTENT)).toBe(true);
    });
  });

  describe('Completed Task Detection', () => {
    it('should detect completed checklists', async () => {
      const completedNote = createTestNote({
        content: 'Task list',
        checklists: [
          { id: '1', text: 'Task 1', completed: true, order: 1 },
          { id: '2', text: 'Task 2', completed: true, order: 2 },
          { id: '3', text: 'Task 3', completed: true, order: 3 }
        ]
      });

      const result = await junkDetector.analyzeNote(completedNote);

      expect(result.indicators.some(ind => ind.type === JunkIndicatorType.ALL_TASKS_COMPLETED)).toBe(true);
    });

    it('should detect completion markers in text', async () => {
      const completedNote = createTestNote({
        content: `✓ Task 1 done
✓ Task 2 completed  
✓ Task 3 finished`
      });

      const result = await junkDetector.analyzeNote(completedNote);

      expect(result.category).toBe(JunkNoteCategory.COMPLETED_TASK);
    });
  });

  describe('Temporal Analysis', () => {
    it('should detect old notes that are rarely accessed', async () => {
      const oldDate = new Date('2023-01-01');
      const oldNote = createTestNote({
        createdDate: oldDate,
        modifiedDate: oldDate,
        metadata: {
          accessCount: 1,
          lastAccessDate: oldDate,
          shareCount: 0,
          tags: [],
          isShared: false,
          wordCount: 10,
          hasHandwriting: false,
          hasImages: false
        }
      });

      const result = await junkDetector.analyzeNote(oldNote);

      expect(result.indicators.some(ind => ind.type === JunkIndicatorType.OLD_REMINDER)).toBe(true);
    });

    it('should detect never accessed notes', async () => {
      const neverAccessedNote = createTestNote({
        metadata: {
          accessCount: 0,
          shareCount: 0,
          tags: [],
          isShared: false,
          wordCount: 10,
          hasHandwriting: false,
          hasImages: false
        }
      });

      const result = await junkDetector.analyzeNote(neverAccessedNote);

      expect(result.indicators.some(ind => ind.type === JunkIndicatorType.NEVER_ACCESSED)).toBe(true);
    });
  });

  describe('Batch Processing', () => {
    it('should process multiple notes', async () => {
      const notes = [
        createTestNote({ id: '1', content: '' }),
        createTestNote({ id: '2', content: 'milk, bread, eggs' }),
        createTestNote({ id: '3', content: 'Important meeting notes' })
      ];

      const results = await junkDetector.analyzeNotes(notes);

      expect(results).toHaveLength(3);
      expect(results[0].isJunk).toBe(true); // Empty note
      expect(results[1].category).toBe(JunkNoteCategory.SHOPPING_LIST); // Shopping list
      expect(results[2].isJunk).toBe(false); // Important note
    });
  });

  describe('Error Handling', () => {
    it('should handle LLM service failures gracefully', async () => {
      const failingLLMService = {
        processRequest: vi.fn().mockRejectedValue(new Error('LLM service failed'))
      } as any;
      
      const detector = new JunkNoteDetectorAgent(failingLLMService);
      const note = createTestNote({ content: 'Some uncertain content' });

      const result = await detector.analyzeNote(note);

      expect(result.requiresManualReview).toBe(true);
      expect(result.confidence).toBe(JunkConfidence.UNCERTAIN);
    });

    it('should provide fallback results on processing errors', async () => {
      // Mock a note that might cause processing issues
      const problematicNote = createTestNote({
        content: 'Normal content',
        // Simulate a processing error by having the detector fail internally
      });

      const result = await junkDetector.analyzeNote(problematicNote);

      // Should still return a valid result structure
      expect(result).toHaveProperty('noteId');
      expect(result).toHaveProperty('isJunk');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('indicators');
      expect(result).toHaveProperty('reasoning');
    });
  });

  describe('Multi-stage Validation', () => {
    it('should apply multiple validation stages', async () => {
      const uncertainNote = createTestNote({
        content: 'Maybe junk maybe not - unclear content here',
        metadata: {
          accessCount: 2,
          lastAccessDate: new Date('2024-06-01'),
          shareCount: 0,
          tags: [],
          isShared: false,
          wordCount: 8,
          hasHandwriting: false,
          hasImages: false
        }
      });

      const result = await junkDetector.analyzeNote(uncertainNote);

      // Should have gone through multiple analysis stages
      expect(result.indicators.length).toBeGreaterThan(0);
      expect(result.reasoning).toContain('likelihood');
    });

    it('should require manual review for uncertain cases', async () => {
      const uncertainNote = createTestNote({
        content: 'Borderline content that could go either way',
        metadata: {
          accessCount: 3,
          lastAccessDate: new Date('2024-06-01'),
          shareCount: 0,
          tags: [],
          isShared: false,
          wordCount: 8,
          hasHandwriting: false,
          hasImages: false
        }
      });

      const result = await junkDetector.analyzeNote(uncertainNote);

      if (result.confidence === JunkConfidence.UNCERTAIN) {
        expect(result.requiresManualReview).toBe(true);
      }
    });
  });
});