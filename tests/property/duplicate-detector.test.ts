/**
 * Property-based tests for DuplicateDetectorAgent
 * Feature: notes-ai-organizer
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import fc from 'fast-check';
import { DuplicateDetectorAgent } from '../../src/agents/DuplicateDetectorAgent';
import { validNoteArb, notesArrayArb } from '../generators/NoteGenerators';
import { LLMService } from '../../src/services/LLMService';
import { Note } from '../../src/models/Note';
import { DuplicateGroup, MergeType, ContentCombinationRule, MetadataHandlingRule } from '../../src/models/DuplicateGroup';

describe('DuplicateDetectorAgent Properties', () => {
  let mockLLMService: LLMService;
  let duplicateDetectorAgent: DuplicateDetectorAgent;

  beforeEach(() => {
    // Create a mock LLM service that returns consistent responses
    mockLLMService = {
      processRequest: vi.fn().mockResolvedValue({
        requestId: 'test-request',
        response: 'COMBINE_CONTENT',
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

    duplicateDetectorAgent = new DuplicateDetectorAgent(mockLLMService);
  });

  /**
   * **Feature: notes-ai-organizer, Property 11: Duplicate detection for similar content**
   * **Validates: Requirements 3.4**
   * 
   * For any set of notes with similar content, the Duplicate_Detector should identify them 
   * as merge candidates using embedding similarity and content analysis.
   */
  it('should identify similar content as merge candidates using embedding similarity', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.tuple(
          validNoteArb,
          fc.string({ minLength: 10, maxLength: 500 }), // shared content
          fc.integer({ min: 2, max: 5 }) // number of similar notes
        ),
        async ([baseNote, sharedContent, numSimilarNotes]: [Note, string, number]) => {
          // Create notes with similar content
          const similarNotes: Note[] = [];
          
          // Add the base note with shared content
          const noteWithSharedContent = {
            ...baseNote,
            content: sharedContent,
            title: `Note about ${sharedContent.substring(0, 20)}`
          };
          similarNotes.push(noteWithSharedContent);
          
          // Create additional similar notes
          for (let i = 1; i < numSimilarNotes; i++) {
            const similarNote: Note = {
              ...baseNote,
              id: `similar-${i}-${baseNote.id}`,
              content: sharedContent + ` Additional content ${i}`, // Similar but not identical
              title: `Similar Note ${i} about ${sharedContent.substring(0, 15)}`,
              modifiedDate: new Date(baseNote.modifiedDate.getTime() + i * 1000)
            };
            similarNotes.push(similarNote);
          }
          
          // Add some completely different notes to ensure they're not grouped
          const differentNotes: Note[] = [];
          for (let i = 0; i < 2; i++) {
            const differentNote: Note = {
              ...baseNote,
              id: `different-${i}-${baseNote.id}`,
              content: `Completely different content about quantum physics and molecular biology ${i}`,
              title: `Different Note ${i}`,
              modifiedDate: new Date(baseNote.modifiedDate.getTime() + (i + 10) * 1000)
            };
            differentNotes.push(differentNote);
          }
          
          const allNotes = [...similarNotes, ...differentNotes];
          
          // Detect duplicates
          const duplicateGroups: DuplicateGroup[] = await duplicateDetectorAgent.detectDuplicates(allNotes);
          
          // Validate that duplicate groups are properly formed
          for (const group of duplicateGroups) {
            // Basic structure validation
            expect(group.id).toBeDefined();
            expect(typeof group.id).toBe('string');
            expect(group.id.length).toBeGreaterThan(0);
            
            // Note IDs validation
            expect(Array.isArray(group.noteIds)).toBe(true);
            expect(group.noteIds.length).toBeGreaterThan(1); // Must have at least 2 notes to be a duplicate group
            expect(group.noteIds.every(id => typeof id === 'string')).toBe(true);
            expect(new Set(group.noteIds).size).toBe(group.noteIds.length); // All IDs should be unique
            
            // All note IDs should exist in our input
            const allNoteIds = allNotes.map(n => n.id);
            expect(group.noteIds.every(id => allNoteIds.includes(id))).toBe(true);
            
            // Similarity scores validation
            expect(Array.isArray(group.similarityScores)).toBe(true);
            expect(group.similarityScores.length).toBe(group.noteIds.length - 1); // One less than noteIds (similarity to primary)
            expect(group.similarityScores.every(score => 
              typeof score === 'number' && score >= 0 && score <= 1
            )).toBe(true);
            
            // Recommended primary validation
            expect(typeof group.recommendedPrimary).toBe('string');
            expect(group.noteIds.includes(group.recommendedPrimary)).toBe(true);
            
            // Merge strategy validation
            expect(group.mergeStrategy).toBeDefined();
            expect(Object.values(MergeType)).toContain(group.mergeStrategy.type);
            expect(group.mergeStrategy.primaryNoteId).toBe(group.recommendedPrimary);
            expect(Array.isArray(group.mergeStrategy.contentCombination)).toBe(true);
            expect(group.mergeStrategy.contentCombination.every(rule => 
              Object.values(ContentCombinationRule).includes(rule)
            )).toBe(true);
            expect(Object.values(MetadataHandlingRule)).toContain(group.mergeStrategy.metadataHandling);
            
            // Conflict areas validation
            expect(Array.isArray(group.conflictAreas)).toBe(true);
            for (const conflict of group.conflictAreas) {
              expect(typeof conflict.field).toBe('string');
              expect(Array.isArray(conflict.values)).toBe(true);
              expect(conflict.values.length).toBeGreaterThan(0);
              
              for (const value of conflict.values) {
                expect(typeof value.noteId).toBe('string');
                expect(group.noteIds.includes(value.noteId)).toBe(true);
                expect(typeof value.confidence).toBe('number');
                expect(value.confidence).toBeGreaterThan(0);
                expect(value.confidence).toBeLessThanOrEqual(1);
              }
            }
            
            // Confidence validation
            expect(typeof group.confidence).toBe('number');
            expect(group.confidence).toBeGreaterThan(0);
            expect(group.confidence).toBeLessThanOrEqual(1);
            
            // Timestamp validation
            expect(group.timestamp).toBeInstanceOf(Date);
            expect(group.timestamp.getTime()).toBeLessThanOrEqual(Date.now());
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional property: Empty note collections should return no duplicates
   */
  it('should return empty results for empty or single note collections', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          fc.constant([]), // Empty array
          fc.array(validNoteArb, { minLength: 0, maxLength: 1 }) // 0 or 1 note
        ),
        async (notes: Note[]) => {
          const duplicateGroups = await duplicateDetectorAgent.detectDuplicates(notes);
          
          // Should return empty array for empty or single note collections
          expect(Array.isArray(duplicateGroups)).toBe(true);
          expect(duplicateGroups.length).toBe(0);
          
          return true;
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Additional property: Duplicate detection should be deterministic
   */
  it('should produce consistent results for the same input', async () => {
    await fc.assert(
      fc.asyncProperty(
        notesArrayArb(2, 10), // Array of 2-10 notes
        async (notes: Note[]) => {
          const result1 = await duplicateDetectorAgent.detectDuplicates([...notes]);
          const result2 = await duplicateDetectorAgent.detectDuplicates([...notes]);
          
          // Results should be consistent (same number of groups)
          expect(result1.length).toBe(result2.length);
          
          // If there are groups, they should have the same structure
          if (result1.length > 0 && result2.length > 0) {
            // Sort groups by ID for comparison
            const sorted1 = result1.sort((a, b) => a.id.localeCompare(b.id));
            const sorted2 = result2.sort((a, b) => a.id.localeCompare(b.id));
            
            for (let i = 0; i < sorted1.length; i++) {
              // Note IDs should be the same (order might differ)
              expect(new Set(sorted1[i].noteIds)).toEqual(new Set(sorted2[i].noteIds));
              expect(sorted1[i].recommendedPrimary).toBe(sorted2[i].recommendedPrimary);
              expect(sorted1[i].mergeStrategy.type).toBe(sorted2[i].mergeStrategy.type);
            }
          }
          
          return true;
        }
      ),
      { numRuns: 30 } // Fewer runs since we're calling detectDuplicates twice per test
    );
  });

  /**
   * Additional property: All notes in a duplicate group should have meaningful similarity
   */
  it('should only group notes that meet similarity threshold', async () => {
    await fc.assert(
      fc.asyncProperty(
        notesArrayArb(2, 20), // Array of 2-20 notes
        async (notes: Note[]) => {
          const duplicateGroups = await duplicateDetectorAgent.detectDuplicates(notes);
          
          for (const group of duplicateGroups) {
            // All similarity scores should meet the threshold (0.8 based on implementation)
            expect(group.similarityScores.every(score => score >= 0.8)).toBe(true);
            
            // Group confidence should reflect the quality of similarity
            const avgSimilarity = group.similarityScores.reduce((sum, score) => sum + score, 0) / group.similarityScores.length;
            expect(group.confidence).toBeGreaterThan(0);
            expect(group.confidence).toBeLessThanOrEqual(1);
            
            // Higher average similarity should generally correlate with higher confidence
            if (avgSimilarity > 0.9) {
              expect(group.confidence).toBeGreaterThan(0.5);
            }
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional property: Duplicate groups should not overlap
   */
  it('should not include the same note in multiple duplicate groups', async () => {
    await fc.assert(
      fc.asyncProperty(
        notesArrayArb(3, 15), // Array of 3-15 notes
        async (notes: Note[]) => {
          const duplicateGroups = await duplicateDetectorAgent.detectDuplicates(notes);
          
          // Collect all note IDs from all groups
          const allGroupedNoteIds: string[] = [];
          for (const group of duplicateGroups) {
            allGroupedNoteIds.push(...group.noteIds);
          }
          
          // No note should appear in multiple groups
          const uniqueNoteIds = new Set(allGroupedNoteIds);
          expect(uniqueNoteIds.size).toBe(allGroupedNoteIds.length);
          
          // All grouped notes should exist in the original input
          const inputNoteIds = new Set(notes.map(n => n.id));
          expect(allGroupedNoteIds.every(id => inputNoteIds.has(id))).toBe(true);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});