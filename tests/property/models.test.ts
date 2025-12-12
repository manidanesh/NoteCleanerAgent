/**
 * Property-based tests for core data models
 * Feature: notes-ai-organizer
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { noteArb, validNoteArb } from '../generators/NoteGenerators';
import { recommendationArb, validRecommendationArb } from '../generators/RecommendationGenerators';
import { Note } from '@/models/Note';
import { Recommendation } from '@/models/Recommendation';

describe('Core Data Models Properties', () => {
  
  it('should generate valid Note objects', () => {
    fc.assert(
      fc.property(validNoteArb, (note: Note) => {
        // Basic validation properties
        expect(note.id).toBeDefined();
        expect(note.title.trim()).not.toBe('');
        expect(note.folder.trim()).not.toBe('');
        expect(note.modifiedDate.getTime()).toBeGreaterThanOrEqual(note.createdDate.getTime());
        expect(note.attachments).toBeInstanceOf(Array);
        expect(note.checklists).toBeInstanceOf(Array);
        expect(note.metadata).toBeDefined();
        
        // Metadata validation
        expect(note.metadata.accessCount).toBeGreaterThanOrEqual(0);
        expect(note.metadata.shareCount).toBeGreaterThanOrEqual(0);
        expect(note.metadata.wordCount).toBeGreaterThanOrEqual(0);
        expect(note.metadata.tags).toBeInstanceOf(Array);
        
        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('should generate valid Recommendation objects', () => {
    fc.assert(
      fc.property(validRecommendationArb, (recommendation: Recommendation) => {
        // Basic validation properties
        expect(recommendation.id).toBeDefined();
        expect(recommendation.noteId).toBeDefined();
        expect(recommendation.action).toBeDefined();
        expect(recommendation.confidence).toBeGreaterThanOrEqual(0);
        expect(recommendation.confidence).toBeLessThanOrEqual(1);
        expect(recommendation.reasoning.length).toBeGreaterThan(0);
        expect(recommendation.impact).toBeDefined();
        expect(typeof recommendation.reversible).toBe('boolean');
        expect(recommendation.timestamp).toBeInstanceOf(Date);
        
        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('should maintain Note ID consistency', () => {
    fc.assert(
      fc.property(validNoteArb, (note: Note) => {
        // ID should be consistent and non-empty
        expect(note.id).toBeTruthy();
        expect(typeof note.id).toBe('string');
        
        // All attachment IDs should be unique within the note
        const attachmentIds = note.attachments.map(a => a.id);
        const uniqueAttachmentIds = new Set(attachmentIds);
        expect(uniqueAttachmentIds.size).toBe(attachmentIds.length);
        
        // All checklist IDs should be unique within the note
        const checklistIds = note.checklists.map(c => c.id);
        const uniqueChecklistIds = new Set(checklistIds);
        expect(uniqueChecklistIds.size).toBe(checklistIds.length);
        
        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('should maintain Recommendation-Note relationship integrity', () => {
    fc.assert(
      fc.property(
        fc.tuple(validNoteArb, validRecommendationArb),
        ([note, recommendation]: [Note, Recommendation]) => {
          // If we set the recommendation to reference this note
          const linkedRecommendation = { ...recommendation, noteId: note.id };
          
          // The relationship should be maintained
          expect(linkedRecommendation.noteId).toBe(note.id);
          
          // Related notes (if any) should be different from the main note
          if (linkedRecommendation.relatedNotes) {
            expect(linkedRecommendation.relatedNotes).not.toContain(note.id);
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});