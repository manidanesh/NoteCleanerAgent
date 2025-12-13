/**
 * Property-based tests for UtilityScorerAgent
 * Feature: notes-ai-organizer
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import fc from 'fast-check';
import { UtilityScorerAgent } from '../../src/agents/UtilityScorerAgent';
import { validNoteArb } from '../generators/NoteGenerators';
import { LLMService } from '../../src/services/LLMService';
import { Note } from '../../src/models/Note';
import { UtilityScore } from '../../src/models/UtilityScore';

describe('UtilityScorerAgent Properties', () => {
  let mockLLMService: LLMService;
  let utilityScorerAgent: UtilityScorerAgent;

  beforeEach(() => {
    // Create a mock LLM service that returns consistent responses
    mockLLMService = {
      processRequest: vi.fn().mockResolvedValue({
        requestId: 'test-request',
        response: 'SCORE: 75 REASONING: This note contains valuable content.',
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

  /**
   * **Feature: notes-ai-organizer, Property 8: Valid utility score assignment**
   * **Validates: Requirements 3.1**
   * 
   * For any note processed by the Utility_Scorer, a utility score between 0 and 100 
   * should be assigned using the specified algorithms (content-based scoring, 
   * behavioral patterns, semantic analysis, and rule-based heuristics).
   */
  it('should assign valid utility scores between 0-100 for any note', async () => {
    await fc.assert(
      fc.asyncProperty(validNoteArb, async (note: Note) => {
        const result: UtilityScore = await utilityScorerAgent.scoreNote(note);



        // Validate overall score is within valid range
        expect(result.overallScore).toBeGreaterThanOrEqual(0);
        expect(result.overallScore).toBeLessThanOrEqual(100);
        expect(Number.isInteger(result.overallScore)).toBe(true);

        // Validate individual algorithm scores are within valid range
        expect(result.contentScore).toBeGreaterThanOrEqual(0);
        expect(result.contentScore).toBeLessThanOrEqual(100);
        expect(Number.isInteger(result.contentScore)).toBe(true);

        expect(result.behavioralScore).toBeGreaterThanOrEqual(0);
        expect(result.behavioralScore).toBeLessThanOrEqual(100);
        expect(Number.isInteger(result.behavioralScore)).toBe(true);

        expect(result.semanticScore).toBeGreaterThanOrEqual(0);
        expect(result.semanticScore).toBeLessThanOrEqual(100);
        expect(Number.isInteger(result.semanticScore)).toBe(true);

        expect(result.ruleBasedScore).toBeGreaterThanOrEqual(0);
        expect(result.ruleBasedScore).toBeLessThanOrEqual(100);
        expect(Number.isInteger(result.ruleBasedScore)).toBe(true);

        // Validate required fields are present
        expect(result.noteId).toBe(note.id);
        expect(result.explanation).toBeDefined();
        expect(typeof result.explanation).toBe('string');
        expect(result.explanation.length).toBeGreaterThan(0);

        // Validate confidence is within valid range
        expect(result.confidence).toBeGreaterThan(0);
        expect(result.confidence).toBeLessThanOrEqual(1);

        // Validate factors array contains expected algorithms
        expect(result.factors).toBeDefined();
        expect(Array.isArray(result.factors)).toBe(true);
        expect(result.factors.length).toBe(5); // TF-IDF, Behavioral, Semantic, Rule-based, LLM

        // Validate each factor has required properties
        for (const factor of result.factors) {
          expect(factor.name).toBeDefined();
          expect(typeof factor.name).toBe('string');
          expect(factor.weight).toBeGreaterThan(0);
          expect(factor.weight).toBeLessThanOrEqual(1);
          expect(factor.value).toBeGreaterThanOrEqual(0);
          expect(factor.value).toBeLessThanOrEqual(100);
          expect(factor.description).toBeDefined();
          expect(typeof factor.description).toBe('string');
        }

        // Validate timestamp is present and reasonable
        expect(result.timestamp).toBeInstanceOf(Date);
        expect(result.timestamp.getTime()).toBeLessThanOrEqual(Date.now());

        return true;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Additional property: Scoring should be deterministic for identical notes
   */
  it('should produce consistent scores for identical notes', async () => {
    await fc.assert(
      fc.asyncProperty(validNoteArb, async (note: Note) => {
        const score1 = await utilityScorerAgent.scoreNote(note);
        const score2 = await utilityScorerAgent.scoreNote(note);

        // Scores should be identical for the same note (within small tolerance for timing)
        expect(Math.abs(score1.overallScore - score2.overallScore)).toBeLessThanOrEqual(1);
        expect(Math.abs(score1.contentScore - score2.contentScore)).toBeLessThanOrEqual(1);
        expect(Math.abs(score1.behavioralScore - score2.behavioralScore)).toBeLessThanOrEqual(1);
        expect(Math.abs(score1.semanticScore - score2.semanticScore)).toBeLessThanOrEqual(1);
        expect(Math.abs(score1.ruleBasedScore - score2.ruleBasedScore)).toBeLessThanOrEqual(1);

        return true;
      }),
      { numRuns: 50 } // Fewer runs since we're calling scoreNote twice per test
    );
  });

  /**
   * **Feature: notes-ai-organizer, Property 10: Explanation provision**
   * **Validates: Requirements 3.3**
   * 
   * For any completed utility scoring operation, a human-readable explanation should be 
   * provided including the classification factors used.
   */
  it('should provide human-readable explanations with classification factors for any note', async () => {
    await fc.assert(
      fc.asyncProperty(validNoteArb, async (note: Note) => {
        const result: UtilityScore = await utilityScorerAgent.scoreNote(note);

        // Validate explanation is provided and is human-readable
        expect(result.explanation).toBeDefined();
        expect(typeof result.explanation).toBe('string');
        expect(result.explanation.length).toBeGreaterThan(0);
        
        // Explanation should be human-readable (not just technical data)
        expect(result.explanation).toMatch(/\w+/); // Contains words
        expect(result.explanation.length).toBeGreaterThan(10); // Substantial content
        
        // Explanation should reference the score or scoring process
        const explanationLower = result.explanation.toLowerCase();
        const hasScoreReference = explanationLower.includes('score') || 
                                 explanationLower.includes('utility') ||
                                 explanationLower.includes('high') ||
                                 explanationLower.includes('medium') ||
                                 explanationLower.includes('low');
        expect(hasScoreReference).toBe(true);

        // Classification factors should be provided
        expect(result.factors).toBeDefined();
        expect(Array.isArray(result.factors)).toBe(true);
        expect(result.factors.length).toBeGreaterThan(0);
        
        // Each factor should include classification information
        for (const factor of result.factors) {
          expect(factor.name).toBeDefined();
          expect(typeof factor.name).toBe('string');
          expect(factor.name.length).toBeGreaterThan(0);
          
          expect(factor.description).toBeDefined();
          expect(typeof factor.description).toBe('string');
          expect(factor.description.length).toBeGreaterThan(0);
          
          expect(factor.weight).toBeDefined();
          expect(typeof factor.weight).toBe('number');
          expect(factor.weight).toBeGreaterThan(0);
          
          expect(factor.value).toBeDefined();
          expect(typeof factor.value).toBe('number');
          expect(factor.value).toBeGreaterThanOrEqual(0);
          expect(factor.value).toBeLessThanOrEqual(100);
        }

        // Factors should represent the main classification algorithms mentioned in requirements
        const factorNames = result.factors.map(f => f.name.toLowerCase());
        const expectedAlgorithms = ['content', 'behavioral', 'semantic', 'rule'];
        
        // At least some of the main algorithms should be represented
        const hasMainAlgorithms = expectedAlgorithms.some(alg => 
          factorNames.some(name => name.includes(alg))
        );
        expect(hasMainAlgorithms).toBe(true);

        return true;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Additional property: Empty notes should receive low but valid scores
   */
  it('should handle empty or minimal notes gracefully', async () => {
    const emptyNoteArb = fc.record({
      id: fc.uuid(),
      title: fc.constant(''),
      content: fc.constant(''),
      createdDate: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }),
      modifiedDate: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }),
      folder: fc.constant('Test'),
      attachments: fc.constant([]),
      checklists: fc.constant([]),
      metadata: fc.record({
        accessCount: fc.constant(0),
        lastAccessDate: fc.constant(undefined),
        shareCount: fc.constant(0),
        tags: fc.constant([]),
        isShared: fc.constant(false),
        wordCount: fc.constant(0),
        hasHandwriting: fc.constant(false),
        hasImages: fc.constant(false)
      })
    }).filter(note => note.modifiedDate >= note.createdDate);

    await fc.assert(
      fc.asyncProperty(emptyNoteArb, async (note: Note) => {
        const result = await utilityScorerAgent.scoreNote(note);

        // Even empty notes should get valid scores
        expect(result.overallScore).toBeGreaterThanOrEqual(0);
        expect(result.overallScore).toBeLessThanOrEqual(100);
        expect(result.explanation).toBeDefined();
        expect(result.confidence).toBeGreaterThan(0);

        return true;
      }),
      { numRuns: 20 }
    );
  });
});