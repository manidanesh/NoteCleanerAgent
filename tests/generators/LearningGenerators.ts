/**
 * Property-based test generators for Learning Component models
 */
import fc from 'fast-check';
import { UserFeedback } from '../../src/models';
import { validNoteArb, validUtilityScoreArb } from './NoteGenerators';
import { validRecommendationArb } from './RecommendationGenerators';

/**
 * Generator for UserFeedback action
 */
export const feedbackActionArb = fc.constantFrom('approved', 'rejected');

/**
 * Generator for basic UserFeedback objects
 */
export const userFeedbackArb: fc.Arbitrary<UserFeedback> = fc.record({
  recommendationId: fc.uuid(),
  action: feedbackActionArb,
  timestamp: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }),
  context: fc.option(fc.string({ minLength: 1, maxLength: 1000 }))
});

/**
 * Generator for valid UserFeedback objects
 */
export const validUserFeedbackArb: fc.Arbitrary<UserFeedback> = userFeedbackArb.filter(feedback => {
  return feedback.recommendationId.length > 0 &&
         (feedback.action === 'approved' || feedback.action === 'rejected');
});

/**
 * Generator for feedback context objects
 */
export const feedbackContextArb = fc.record({
  recommendation: fc.option(validRecommendationArb),
  note: fc.option(validNoteArb),
  utilityScore: fc.option(validUtilityScoreArb),
  userReason: fc.option(fc.string({ minLength: 1, maxLength: 200 })),
  sessionId: fc.option(fc.uuid())
});

/**
 * Generator for valid feedback context (at least one field present)
 */
export const validFeedbackContextArb = feedbackContextArb.filter(context => {
  return context.recommendation !== null || 
         context.note !== null || 
         context.utilityScore !== null ||
         context.userReason !== null ||
         context.sessionId !== null;
});

/**
 * Generator for arrays of UserFeedback
 */
export const userFeedbackArrayArb = (minLength = 0, maxLength = 100): fc.Arbitrary<UserFeedback[]> =>
  fc.array(validUserFeedbackArb, { minLength, maxLength });

/**
 * Generator for recommendation IDs
 */
export const recommendationIdArb = fc.uuid();

/**
 * Generator for feedback recording parameters
 */
export const feedbackRecordingParamsArb = fc.record({
  recommendationId: recommendationIdArb,
  action: feedbackActionArb,
  context: fc.option(validFeedbackContextArb)
});