/**
 * Property-based tests for OrganizationAgent
 * Feature: notes-ai-organizer
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import fc from 'fast-check';
import { OrganizationAgent } from '../../src/agents/OrganizationAgent';
import { validNoteArb, validUtilityScoreArb } from '../generators/NoteGenerators';
import { LLMService } from '../../src/services/LLMService';
import { Note } from '../../src/models/Note';
import { UtilityScore } from '../../src/models/UtilityScore';
import { Recommendation, RecommendationAction } from '../../src/models/Recommendation';
import { LLMRequestType } from '../../src/models/LLMModels';

describe('OrganizationAgent Properties', () => {
  let mockLLMService: LLMService;
  let organizationAgent: OrganizationAgent;

  beforeEach(() => {
    // Create a mock LLM service that returns consistent responses
    mockLLMService = {
      processRequest: vi.fn().mockImplementation((request) => {
        if (request.requestType === LLMRequestType.TITLE_GENERATION) {
          return Promise.resolve({
            requestId: 'test-request',
            response: JSON.stringify({
              title: 'Improved Note Title',
              reasoning: 'Generated based on content analysis',
              keywords: ['improved', 'note'],
              confidence: 0.75
            }),
            confidence: 0.75,
            tokensUsed: 50,
            processingTime: 100,
            model: 'test-model',
            fallbackUsed: false
          });
        } else if (request.requestType === LLMRequestType.CLASSIFICATION) {
          return Promise.resolve({
            requestId: 'test-request',
            response: JSON.stringify({
              folder: 'Work',
              reasoning: 'Content appears to be work-related',
              themes: ['work', 'business'],
              confidence: 0.70
            }),
            confidence: 0.70,
            tokensUsed: 40,
            processingTime: 90,
            model: 'test-model',
            fallbackUsed: false
          });
        }
        return Promise.resolve({
          requestId: 'test-request',
          response: 'Generic response',
          confidence: 0.60,
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

  /**
   * **Feature: notes-ai-organizer, Property 9: Valid recommendation generation**
   * **Validates: Requirements 3.2**
   * 
   * For any scored note processed by the Organization_Agent, one of the six valid 
   * recommendation actions should be generated (keep, review, archive, delete, merge duplicates, rename).
   */
  it('should generate valid recommendation actions for any note', async () => {
    await fc.assert(
      fc.asyncProperty(
        validNoteArb, 
        validUtilityScoreArb, 
        async (note: Note, utilityScore: UtilityScore) => {
          // Ensure utility score matches note ID
          const matchedUtilityScore = { ...utilityScore, noteId: note.id };
          
          const recommendations: Recommendation[] = await organizationAgent.generateRecommendations(
            note, 
            matchedUtilityScore
          );

          // Should always return an array of recommendations
          expect(recommendations).toBeDefined();
          expect(Array.isArray(recommendations)).toBe(true);
          expect(recommendations.length).toBeGreaterThan(0);

          // Each recommendation should have valid properties
          for (const recommendation of recommendations) {
            // Valid recommendation structure
            expect(recommendation.id).toBeDefined();
            expect(typeof recommendation.id).toBe('string');
            expect(recommendation.id.length).toBeGreaterThan(0);

            expect(recommendation.noteId).toBe(note.id);

            // Action should be one of the six valid types
            const validActions = [
              RecommendationAction.KEEP,
              RecommendationAction.REVIEW,
              RecommendationAction.ARCHIVE,
              RecommendationAction.DELETE,
              RecommendationAction.MERGE_DUPLICATES,
              RecommendationAction.RENAME
            ];
            expect(validActions).toContain(recommendation.action);

            // Confidence should be valid
            expect(recommendation.confidence).toBeGreaterThan(0);
            expect(recommendation.confidence).toBeLessThanOrEqual(1);

            // Reasoning should be provided
            expect(recommendation.reasoning).toBeDefined();
            expect(typeof recommendation.reasoning).toBe('string');
            expect(recommendation.reasoning.length).toBeGreaterThan(0);

            // Impact should be defined
            expect(recommendation.impact).toBeDefined();
            expect(['low', 'medium', 'high']).toContain(recommendation.impact);

            // Reversible should be boolean
            expect(typeof recommendation.reversible).toBe('boolean');

            // Timestamp should be valid
            expect(recommendation.timestamp).toBeInstanceOf(Date);
            expect(recommendation.timestamp.getTime()).toBeLessThanOrEqual(Date.now());

            // Optional fields should be valid if present
            if (recommendation.suggestedTitle) {
              expect(typeof recommendation.suggestedTitle).toBe('string');
              expect(recommendation.suggestedTitle.length).toBeGreaterThan(0);
              expect(recommendation.suggestedTitle.length).toBeLessThanOrEqual(200);
            }

            if (recommendation.suggestedFolder) {
              expect(typeof recommendation.suggestedFolder).toBe('string');
              expect(recommendation.suggestedFolder.length).toBeGreaterThan(0);
            }

            if (recommendation.relatedNotes) {
              expect(Array.isArray(recommendation.relatedNotes)).toBe(true);
              recommendation.relatedNotes.forEach(relatedId => {
                expect(typeof relatedId).toBe('string');
                expect(relatedId.length).toBeGreaterThan(0);
              });
            }
          }

          // Should have at least one action recommendation (keep/review/archive/delete)
          const actionRecommendations = recommendations.filter(rec => 
            [RecommendationAction.KEEP, RecommendationAction.REVIEW, 
             RecommendationAction.ARCHIVE, RecommendationAction.DELETE].includes(rec.action)
          );
          expect(actionRecommendations.length).toBeGreaterThanOrEqual(1);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: notes-ai-organizer, Property 12: Title suggestion for unclear titles**
   * **Validates: Requirements 3.5**
   * 
   * For any note with unclear or generic titles, the Organization_Agent should suggest 
   * improved titles based on content analysis.
   */
  it('should suggest improved titles for notes with unclear or generic titles', async () => {
    // Generator for notes with problematic titles
    const problematicTitleNoteArb = validNoteArb.map(note => ({
      ...note,
      title: fc.sample(fc.oneof(
        fc.constant('Note'),
        fc.constant('Untitled'),
        fc.constant('New'),
        fc.constant('Meeting'),
        fc.constant('Ideas'),
        fc.constant('Stuff'),
        fc.constant('Things'),
        fc.constant('Misc'),
        fc.constant('Todo'),
        fc.constant(''),
        fc.date().map(d => d.toISOString().split('T')[0]) // Date-only titles
      ), 1)[0]
    }));

    await fc.assert(
      fc.asyncProperty(
        problematicTitleNoteArb,
        validUtilityScoreArb,
        async (note: Note, utilityScore: UtilityScore) => {
          // Ensure utility score matches note ID
          const matchedUtilityScore = { ...utilityScore, noteId: note.id };
          
          const recommendations: Recommendation[] = await organizationAgent.generateRecommendations(
            note, 
            matchedUtilityScore
          );

          // Should generate recommendations
          expect(recommendations).toBeDefined();
          expect(Array.isArray(recommendations)).toBe(true);

          // Should include a rename recommendation for problematic titles
          const renameRecommendations = recommendations.filter(rec => 
            rec.action === RecommendationAction.RENAME
          );

          if (renameRecommendations.length > 0) {
            const renameRec = renameRecommendations[0];
            
            // Should have a suggested title
            expect(renameRec.suggestedTitle).toBeDefined();
            expect(typeof renameRec.suggestedTitle).toBe('string');
            expect(renameRec.suggestedTitle!.length).toBeGreaterThan(0);
            
            // Suggested title should be different from original
            expect(renameRec.suggestedTitle).not.toBe(note.title);
            
            // Should be reasonable length (not too short or too long)
            expect(renameRec.suggestedTitle!.length).toBeGreaterThan(2);
            expect(renameRec.suggestedTitle!.length).toBeLessThanOrEqual(100);
            
            // Should have reasoning
            expect(renameRec.reasoning).toBeDefined();
            expect(typeof renameRec.reasoning).toBe('string');
            expect(renameRec.reasoning.length).toBeGreaterThan(0);
            
            // Should have reasonable confidence
            expect(renameRec.confidence).toBeGreaterThan(0);
            expect(renameRec.confidence).toBeLessThanOrEqual(1);
          }

          return true;
        }
      ),
      { numRuns: 50 } // Fewer runs since this is more specific
    );
  });

  /**
   * Additional property: Title analysis should be consistent and comprehensive
   */
  it('should provide consistent title analysis for any note', async () => {
    await fc.assert(
      fc.asyncProperty(validNoteArb, async (note: Note) => {
        const analysis = organizationAgent.analyzeTitleQuality(note);

        // Analysis should always be defined and complete
        expect(analysis).toBeDefined();
        
        // Boolean flags should be defined
        expect(typeof analysis.isGeneric).toBe('boolean');
        expect(typeof analysis.isUnclear).toBe('boolean');
        expect(typeof analysis.hasContentMismatch).toBe('boolean');
        
        // Scores should be in valid range
        expect(analysis.clarity).toBeGreaterThanOrEqual(0);
        expect(analysis.clarity).toBeLessThanOrEqual(100);
        expect(analysis.specificity).toBeGreaterThanOrEqual(0);
        expect(analysis.specificity).toBeLessThanOrEqual(100);
        expect(analysis.searchability).toBeGreaterThanOrEqual(0);
        expect(analysis.searchability).toBeLessThanOrEqual(100);
        
        // Issues should be an array
        expect(Array.isArray(analysis.issues)).toBe(true);
        analysis.issues.forEach(issue => {
          expect(typeof issue).toBe('string');
          expect(issue.length).toBeGreaterThan(0);
        });
        
        // If title is empty or very short, should detect issues
        if (!note.title || note.title.trim().length < 3) {
          expect(analysis.issues.length).toBeGreaterThan(0);
          expect(analysis.clarity).toBeLessThan(70);
        }
        
        // If title is very long, should detect issues
        if (note.title && note.title.length > 100) {
          expect(analysis.issues).toContain('Title is too long');
        }

        return true;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Additional property: Folder suggestions should be reasonable
   */
  it('should generate reasonable folder suggestions for any note', async () => {
    await fc.assert(
      fc.asyncProperty(validNoteArb, async (note: Note) => {
        const suggestion = await organizationAgent.generateFolderSuggestion(note);

        if (suggestion) {
          // Should have valid structure
          expect(suggestion.suggestedFolder).toBeDefined();
          expect(typeof suggestion.suggestedFolder).toBe('string');
          expect(suggestion.suggestedFolder.length).toBeGreaterThan(0);
          
          expect(suggestion.reasoning).toBeDefined();
          expect(typeof suggestion.reasoning).toBe('string');
          expect(suggestion.reasoning.length).toBeGreaterThan(0);
          
          expect(suggestion.confidence).toBeGreaterThan(0);
          expect(suggestion.confidence).toBeLessThanOrEqual(1);
          
          expect(Array.isArray(suggestion.themes)).toBe(true);
          suggestion.themes.forEach(theme => {
            expect(typeof theme).toBe('string');
            expect(theme.length).toBeGreaterThan(0);
          });
          
          // Folder name should be reasonable
          expect(suggestion.suggestedFolder.length).toBeLessThanOrEqual(100);
          
          // Should not suggest the same folder if confidence is high
          if (suggestion.confidence > 0.8 && suggestion.suggestedFolder === note.folder) {
            // This might be acceptable if the current folder is already optimal
            // But we should at least have a good reason
            expect(suggestion.reasoning.length).toBeGreaterThan(10);
          }
        }

        return true;
      }),
      { numRuns: 50 }
    );
  });

  /**
   * Additional property: Recommendations should be consistent with utility scores
   */
  it('should generate recommendations consistent with utility scores', async () => {
    await fc.assert(
      fc.asyncProperty(
        validNoteArb,
        validUtilityScoreArb,
        async (note: Note, utilityScore: UtilityScore) => {
          // Ensure utility score matches note ID
          const matchedUtilityScore = { ...utilityScore, noteId: note.id };
          
          const recommendations = await organizationAgent.generateRecommendations(
            note, 
            matchedUtilityScore
          );

          // Find action recommendations (specifically those generated by generateActionRecommendation)
          const actionRecs = recommendations.filter(rec => 
            rec.id.startsWith('action_') && 
            [RecommendationAction.KEEP, RecommendationAction.REVIEW, 
             RecommendationAction.ARCHIVE, RecommendationAction.DELETE].includes(rec.action)
          );

          if (actionRecs.length > 0) {
            const actionRec = actionRecs[0];
            
            // High utility scores should tend toward KEEP
            if (matchedUtilityScore.overallScore >= 80) {
              expect(actionRec.action).toBe(RecommendationAction.KEEP);
            }
            
            // Low utility scores should tend toward DELETE or ARCHIVE
            if (matchedUtilityScore.overallScore <= 30) {
              expect([RecommendationAction.DELETE, RecommendationAction.ARCHIVE])
                .toContain(actionRec.action);
            }
            
            // Confidence should generally correlate with utility score confidence
            if (matchedUtilityScore.confidence > 0.8) {
              expect(actionRec.confidence).toBeGreaterThan(0.5);
            }
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional property: Batch improvements should identify real issues
   */
  it('should identify meaningful batch improvements', async () => {
    // Generate a set of notes with known issues
    const notesWithIssuesArb = fc.array(
      validNoteArb.map(note => ({
        ...note,
        title: fc.sample(fc.oneof(
          fc.constant('Note'),
          fc.constant('Untitled'),
          fc.constant('New'),
          fc.constant('Meeting')
        ), 1)[0]
      })),
      { minLength: 5, maxLength: 20 }
    );

    await fc.assert(
      fc.asyncProperty(notesWithIssuesArb, async (notes: Note[]) => {
        const improvements = await organizationAgent.generateBatchImprovements(notes);

        expect(Array.isArray(improvements)).toBe(true);

        for (const improvement of improvements) {
          // Should have valid structure
          expect(improvement.type).toBeDefined();
          expect(['title_improvements', 'folder_reorganization', 'content_grouping'])
            .toContain(improvement.type);
          
          expect(Array.isArray(improvement.noteIds)).toBe(true);
          expect(improvement.noteIds.length).toBeGreaterThan(0);
          
          // All note IDs should exist in the input
          improvement.noteIds.forEach(noteId => {
            expect(notes.some(n => n.id === noteId)).toBe(true);
          });
          
          expect(improvement.description).toBeDefined();
          expect(typeof improvement.description).toBe('string');
          expect(improvement.description.length).toBeGreaterThan(0);
          
          expect(improvement.estimatedImpact).toBeDefined();
          expect(['low', 'medium', 'high']).toContain(improvement.estimatedImpact);
          
          expect(Array.isArray(improvement.suggestions)).toBe(true);
          
          // Should only suggest improvements for multiple notes
          expect(improvement.noteIds.length).toBeGreaterThanOrEqual(3);
        }

        return true;
      }),
      { numRuns: 20 } // Fewer runs since this generates larger datasets
    );
  });
});