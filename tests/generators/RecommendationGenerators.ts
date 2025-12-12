/**
 * Property-based test generators for Recommendation models
 */
import fc from 'fast-check';
import { 
  Recommendation, 
  RecommendationAction, 
  ImpactLevel, 
  RecommendationStatus 
} from '@/models/Recommendation';

/**
 * Generator for RecommendationAction enum
 */
export const recommendationActionArb = fc.constantFrom(
  RecommendationAction.KEEP,
  RecommendationAction.REVIEW,
  RecommendationAction.ARCHIVE,
  RecommendationAction.DELETE,
  RecommendationAction.MERGE_DUPLICATES,
  RecommendationAction.RENAME
);

/**
 * Generator for ImpactLevel enum
 */
export const impactLevelArb = fc.constantFrom(
  ImpactLevel.LOW,
  ImpactLevel.MEDIUM,
  ImpactLevel.HIGH
);

/**
 * Generator for RecommendationStatus enum
 */
export const recommendationStatusArb = fc.constantFrom(
  RecommendationStatus.PENDING,
  RecommendationStatus.APPROVED,
  RecommendationStatus.REJECTED,
  RecommendationStatus.EXECUTED
);

/**
 * Generator for Recommendation objects
 */
export const recommendationArb: fc.Arbitrary<Recommendation> = fc.record({
  id: fc.uuid(),
  noteId: fc.uuid(),
  action: recommendationActionArb,
  confidence: fc.float({ min: 0, max: 1, noNaN: true }),
  reasoning: fc.string({ minLength: 10, maxLength: 500 }),
  impact: impactLevelArb,
  reversible: fc.boolean(),
  relatedNotes: fc.option(fc.array(fc.uuid(), { maxLength: 5 })),
  suggestedTitle: fc.option(fc.string({ minLength: 1, maxLength: 200 })),
  suggestedFolder: fc.option(fc.string({ minLength: 1, maxLength: 100 })),
  timestamp: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') })
});

/**
 * Generator for valid Recommendation objects (with constraints)
 */
export const validRecommendationArb: fc.Arbitrary<Recommendation> = recommendationArb.filter(rec => {
  // Merge recommendations should have related notes
  if (rec.action === RecommendationAction.MERGE_DUPLICATES) {
    return !!(rec.relatedNotes && rec.relatedNotes.length > 0);
  }
  // Rename recommendations should have suggested title
  if (rec.action === RecommendationAction.RENAME) {
    return !!(rec.suggestedTitle && rec.suggestedTitle.trim().length > 0);
  }
  return true;
});

/**
 * Generator for arrays of Recommendations
 */
export const recommendationsArrayArb = (minLength = 0, maxLength = 50): fc.Arbitrary<Recommendation[]> =>
  fc.array(validRecommendationArb, { minLength, maxLength });