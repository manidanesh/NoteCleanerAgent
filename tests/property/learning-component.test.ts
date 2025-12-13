/**
 * Property-based tests for LearningComponent
 * Feature: notes-ai-organizer
 */
import { describe, it, expect, beforeEach } from 'vitest';
import fc from 'fast-check';
import { LearningComponent } from '../../src/agents/LearningComponent';
import { 
  validUserFeedbackArb, 
  feedbackActionArb, 
  recommendationIdArb,
  validFeedbackContextArb,
  feedbackRecordingParamsArb
} from '../generators/LearningGenerators';
import { UserFeedback } from '../../src/models';

describe('LearningComponent Properties', () => {
  let learningComponent: LearningComponent;

  beforeEach(() => {
    learningComponent = new LearningComponent();
  });

  /**
   * **Feature: notes-ai-organizer, Property 28: Feedback recording with context**
   * **Validates: Requirements 7.1**
   * 
   * For any user acceptance or rejection of recommendations, the Learning_Component 
   * should record the feedback with context.
   */
  it('should record feedback with context for any user acceptance or rejection', () => {
    fc.assert(
      fc.property(
        feedbackRecordingParamsArb,
        (params) => {
          // Record the feedback
          const recordedFeedback = learningComponent.recordFeedback(
            params.recommendationId,
            params.action,
            params.context || undefined
          );

          // Verify the feedback was recorded correctly
          expect(recordedFeedback).toBeDefined();
          expect(recordedFeedback.recommendationId).toBe(params.recommendationId);
          expect(recordedFeedback.action).toBe(params.action);
          expect(recordedFeedback.timestamp).toBeInstanceOf(Date);
          expect(recordedFeedback.timestamp.getTime()).toBeLessThanOrEqual(Date.now());

          // Verify context is preserved
          if (params.context) {
            expect(recordedFeedback.context).toBeDefined();
            expect(typeof recordedFeedback.context).toBe('string');
            
            // Context should be valid JSON
            const parsedContext = JSON.parse(recordedFeedback.context!);
            expect(parsedContext).toBeDefined();
            
            // Verify context fields are preserved
            if (params.context.recommendation) {
              expect(parsedContext.recommendation).toBeDefined();
              expect(parsedContext.recommendation.id).toBe(params.context.recommendation.id);
            }
            if (params.context.note) {
              expect(parsedContext.note).toBeDefined();
              expect(parsedContext.note.id).toBe(params.context.note.id);
            }
            if (params.context.utilityScore) {
              expect(parsedContext.utilityScore).toBeDefined();
              expect(parsedContext.utilityScore.noteId).toBe(params.context.utilityScore.noteId);
            }
            if (params.context.userReason) {
              expect(parsedContext.userReason).toBe(params.context.userReason);
            }
            if (params.context.sessionId) {
              expect(parsedContext.sessionId).toBe(params.context.sessionId);
            }
          } else {
            expect(recordedFeedback.context).toBeUndefined();
          }

          // Verify feedback is stored in history
          const history = learningComponent.getFeedbackHistory();
          expect(history).toContain(recordedFeedback);
          
          // Verify feedback can be retrieved by recommendation ID
          const retrievedFeedback = learningComponent.getFeedbackForRecommendation(params.recommendationId);
          expect(retrievedFeedback).toEqual(recordedFeedback);

          // Verify feedback count is updated
          const count = learningComponent.getFeedbackCount();
          expect(count).toBeGreaterThan(0);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional property: Feedback recording should handle multiple entries correctly
   */
  it('should correctly handle multiple feedback entries', () => {
    fc.assert(
      fc.property(
        fc.array(feedbackRecordingParamsArb, { minLength: 1, maxLength: 20 }),
        (feedbackParams) => {
          // Create a fresh learning component for this test
          const testLearningComponent = new LearningComponent();
          const recordedFeedbacks: UserFeedback[] = [];

          // Record all feedback entries
          for (const params of feedbackParams) {
            const feedback = testLearningComponent.recordFeedback(
              params.recommendationId,
              params.action,
              params.context || undefined
            );
            recordedFeedbacks.push(feedback);
          }

          // Verify all feedback was recorded
          const history = testLearningComponent.getFeedbackHistory();
          expect(history.length).toBe(feedbackParams.length);

          // Verify each feedback entry
          for (let i = 0; i < feedbackParams.length; i++) {
            const params = feedbackParams[i];
            const recorded = recordedFeedbacks[i];
            
            expect(recorded.recommendationId).toBe(params.recommendationId);
            expect(recorded.action).toBe(params.action);
            expect(history).toContain(recorded);
          }

          // Verify feedback statistics
          const stats = testLearningComponent.getFeedbackStats();
          expect(stats.total).toBe(feedbackParams.length);
          
          const expectedApproved = feedbackParams.filter(p => p.action === 'approved').length;
          const expectedRejected = feedbackParams.filter(p => p.action === 'rejected').length;
          
          expect(stats.approved).toBe(expectedApproved);
          expect(stats.rejected).toBe(expectedRejected);
          expect(stats.approvalRate).toBe(expectedApproved / feedbackParams.length);

          return true;
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Additional property: Invalid feedback parameters should be rejected
   */
  it('should reject invalid feedback parameters', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant(''), // Empty recommendation ID
          fc.constant(null), // Null recommendation ID
          fc.constant(undefined) // Undefined recommendation ID
        ),
        fc.oneof(
          feedbackActionArb,
          fc.constant('invalid'), // Invalid action
          fc.constant(''), // Empty action
          fc.constant(null), // Null action
          fc.constant(undefined) // Undefined action
        ),
        (invalidRecommendationId, invalidAction) => {
          // Should throw error for invalid parameters
          expect(() => {
            learningComponent.recordFeedback(
              invalidRecommendationId as any,
              invalidAction as any
            );
          }).toThrow();

          // Verify no feedback was recorded
          expect(learningComponent.getFeedbackCount()).toBe(0);

          return true;
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Additional property: Learning preferences should be updated when enabled
   */
  it('should update learning preferences when learning is enabled', () => {
    fc.assert(
      fc.property(
        feedbackRecordingParamsArb.filter(p => 
          p.context !== null && 
          (p.context.recommendation !== null || p.context.utilityScore !== null)
        ),
        (params) => {
          // Create a fresh learning component for this test
          const testLearningComponent = new LearningComponent();
          
          // Ensure learning is enabled
          testLearningComponent.setLearningEnabled(true);
          expect(testLearningComponent.isLearningEnabled()).toBe(true);

          // Record feedback with context
          testLearningComponent.recordFeedback(
            params.recommendationId,
            params.action,
            params.context!
          );

          // Verify preferences were updated (should have at least one preference key)
          const preferences = testLearningComponent.getUserPreferences();
          expect(preferences.size).toBeGreaterThan(0);

          // Check for expected preference keys based on context
          if (params.context!.recommendation) {
            const recType = params.context!.recommendation.action;
            const typeKey = `recommendation_type_${recType}`;
            expect(preferences.has(typeKey)).toBe(true);
            
            const typePrefs = preferences.get(typeKey);
            expect(typePrefs).toBeDefined();
            expect(typePrefs.approved + typePrefs.rejected).toBe(1);
          }

          if (params.context!.utilityScore) {
            const scoreKey = 'utility_score_preferences';
            expect(preferences.has(scoreKey)).toBe(true);
            
            const scorePrefs = preferences.get(scoreKey);
            expect(Array.isArray(scorePrefs)).toBe(true);
            expect(scorePrefs.length).toBe(1);
          }

          return true;
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Additional property: Learning preferences should not be updated when disabled
   */
  it('should not update learning preferences when learning is disabled', () => {
    fc.assert(
      fc.property(
        feedbackRecordingParamsArb.filter(p => p.context !== null),
        (params) => {
          // Create a fresh learning component for this test
          const testLearningComponent = new LearningComponent();
          
          // Disable learning
          testLearningComponent.setLearningEnabled(false);
          expect(testLearningComponent.isLearningEnabled()).toBe(false);

          // Record feedback with context
          testLearningComponent.recordFeedback(
            params.recommendationId,
            params.action,
            params.context!
          );

          // Verify preferences were not updated
          const preferences = testLearningComponent.getUserPreferences();
          expect(preferences.size).toBe(0);

          // But feedback should still be recorded
          expect(testLearningComponent.getFeedbackCount()).toBe(1);

          return true;
        }
      ),
      { numRuns: 30 }
    );
  });

  /**
   * Additional property: Feedback history should be clearable
   */
  it('should allow clearing feedback history', () => {
    fc.assert(
      fc.property(
        fc.array(feedbackRecordingParamsArb, { minLength: 1, maxLength: 10 }),
        (feedbackParams) => {
          // Record multiple feedback entries
          for (const params of feedbackParams) {
            learningComponent.recordFeedback(
              params.recommendationId,
              params.action,
              params.context || undefined
            );
          }

          // Verify feedback was recorded
          expect(learningComponent.getFeedbackCount()).toBe(feedbackParams.length);

          // Clear history
          learningComponent.clearFeedbackHistory();

          // Verify history is cleared
          expect(learningComponent.getFeedbackCount()).toBe(0);
          expect(learningComponent.getFeedbackHistory()).toEqual([]);
          expect(learningComponent.getUserPreferences().size).toBe(0);

          return true;
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Additional property: Feedback timestamps should be chronologically ordered
   */
  it('should maintain chronological order of feedback timestamps', () => {
    fc.assert(
      fc.property(
        fc.array(feedbackRecordingParamsArb, { minLength: 2, maxLength: 10 }),
        (feedbackParams) => {
          const recordedFeedbacks: UserFeedback[] = [];

          // Record feedback with small delays to ensure different timestamps
          for (const params of feedbackParams) {
            const feedback = learningComponent.recordFeedback(
              params.recommendationId,
              params.action,
              params.context || undefined
            );
            recordedFeedbacks.push(feedback);
          }

          // Verify timestamps are in chronological order (or equal)
          for (let i = 1; i < recordedFeedbacks.length; i++) {
            expect(recordedFeedbacks[i].timestamp.getTime())
              .toBeGreaterThanOrEqual(recordedFeedbacks[i - 1].timestamp.getTime());
          }

          return true;
        }
      ),
      { numRuns: 30 }
    );
  });

  /**
   * **Feature: notes-ai-organizer, Property 32: Privacy-preserving learning**
   * **Validates: Requirements 7.5**
   * 
   * For any learning operation where learning data exists, user privacy should be 
   * preserved while improving recommendations.
   */
  it('should preserve user privacy while improving recommendations', () => {
    fc.assert(
      fc.property(
        fc.array(feedbackRecordingParamsArb.filter(p => p.context !== null), { minLength: 1, maxLength: 10 }),
        (feedbackParams) => {
          // Create a fresh learning component for this test
          const testLearningComponent = new LearningComponent();
          testLearningComponent.setLearningEnabled(true);

          // Record feedback with context containing potentially sensitive data
          for (const params of feedbackParams) {
            testLearningComponent.recordFeedback(
              params.recommendationId,
              params.action,
              params.context!
            );
          }

          // Verify privacy preservation: no raw note content should be stored in preferences
          const preferences = testLearningComponent.getUserPreferences();
          
          // Check that preferences contain only aggregated patterns, not raw content
          for (const [key, value] of preferences) {
            // Preferences should not contain raw note content
            if (typeof value === 'string') {
              // Should not contain full note content or titles
              expect(value).not.toMatch(/^Note \d+$/); // Generic note titles
              expect(value.length).toBeLessThan(100); // Should be short preference keys/values
            }
            
            if (Array.isArray(value)) {
              // Array preferences should contain only aggregated data
              for (const item of value) {
                if (typeof item === 'object' && item !== null) {
                  // Should contain only statistical/preference data, not raw content
                  expect(item).not.toHaveProperty('content');
                  expect(item).not.toHaveProperty('title');
                  
                  // Should have privacy-safe properties like scores, actions, timestamps
                  if ('overallScore' in item) {
                    expect(typeof item.overallScore).toBe('number');
                  }
                  if ('action' in item) {
                    expect(['approved', 'rejected']).toContain(item.action);
                  }
                  if ('confidence' in item) {
                    expect(typeof item.confidence).toBe('number');
                  }
                }
              }
            }
            
            if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
              // Object preferences should contain only aggregated counts/statistics
              expect(value).not.toHaveProperty('content');
              expect(value).not.toHaveProperty('title');
              
              // Should have statistical properties like approved/rejected counts
              if ('approved' in value) {
                expect(typeof value.approved).toBe('number');
                expect(value.approved).toBeGreaterThanOrEqual(0);
              }
              if ('rejected' in value) {
                expect(typeof value.rejected).toBe('number');
                expect(value.rejected).toBeGreaterThanOrEqual(0);
              }
            }
          }

          // Verify that learning can be disabled for privacy
          testLearningComponent.setLearningEnabled(false);
          expect(testLearningComponent.isLearningEnabled()).toBe(false);
          
          // Record additional feedback with learning disabled
          const initialPrefsSize = preferences.size;
          testLearningComponent.recordFeedback(
            'privacy-test-rec-id',
            'approved',
            feedbackParams[0].context!
          );
          
          // Preferences should not be updated when learning is disabled
          const newPreferences = testLearningComponent.getUserPreferences();
          expect(newPreferences.size).toBe(initialPrefsSize);

          // Verify that all learning data can be cleared for privacy
          testLearningComponent.clearFeedbackHistory();
          expect(testLearningComponent.getFeedbackCount()).toBe(0);
          expect(testLearningComponent.getUserPreferences().size).toBe(0);
          expect(testLearningComponent.getFeedbackHistory()).toEqual([]);

          // Verify that feedback context is stored as JSON string (not raw objects)
          testLearningComponent.setLearningEnabled(true);
          const testFeedback = testLearningComponent.recordFeedback(
            'privacy-context-test',
            'approved',
            feedbackParams[0].context!
          );
          
          if (testFeedback.context) {
            // Context should be stored as JSON string, not raw object
            expect(typeof testFeedback.context).toBe('string');
            
            // Should be valid JSON
            const parsedContext = JSON.parse(testFeedback.context);
            expect(parsedContext).toBeDefined();
            
            // Parsed context should not leak into preferences directly
            const finalPreferences = testLearningComponent.getUserPreferences();
            for (const [, prefValue] of finalPreferences) {
              expect(prefValue).not.toEqual(parsedContext);
            }
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});