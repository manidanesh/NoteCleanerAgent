/**
 * Property-based test generators for Note models
 */
import fc from 'fast-check';
import { 
  Note, 
  Attachment, 
  ChecklistItem, 
  NoteMetadata, 
  AttachmentType 
} from '../../src/models/Note';
import { UtilityScore, ScoringFactor } from '../../src/models/UtilityScore';

/**
 * Generator for AttachmentType enum
 */
export const attachmentTypeArb = fc.constantFrom(
  AttachmentType.IMAGE,
  AttachmentType.PDF,
  AttachmentType.DOCUMENT,
  AttachmentType.AUDIO,
  AttachmentType.VIDEO,
  AttachmentType.OTHER
);

/**
 * Generator for Attachment objects
 */
export const attachmentArb: fc.Arbitrary<Attachment> = fc.record({
  id: fc.uuid(),
  type: attachmentTypeArb,
  filename: fc.string({ minLength: 1, maxLength: 100 }),
  size: fc.integer({ min: 0, max: 100_000_000 }), // Up to 100MB
  mimeType: fc.string({ minLength: 3, maxLength: 50 }),
  content: fc.option(fc.string({ maxLength: 10000 }))
});

/**
 * Generator for ChecklistItem objects
 */
export const checklistItemArb: fc.Arbitrary<ChecklistItem> = fc.record({
  id: fc.uuid(),
  text: fc.string({ minLength: 1, maxLength: 500 }),
  completed: fc.boolean(),
  order: fc.integer({ min: 0, max: 1000 })
});

/**
 * Generator for NoteMetadata objects
 */
export const noteMetadataArb: fc.Arbitrary<NoteMetadata> = fc.record({
  accessCount: fc.integer({ min: 0, max: 10000 }),
  lastAccessDate: fc.option(fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') })),
  shareCount: fc.integer({ min: 0, max: 100 }),
  tags: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { maxLength: 10 }),
  isShared: fc.boolean(),
  wordCount: fc.integer({ min: 0, max: 50000 }),
  hasHandwriting: fc.boolean(),
  hasImages: fc.boolean()
});

/**
 * Generator for Note objects
 */
export const noteArb: fc.Arbitrary<Note> = fc.record({
  id: fc.uuid(),
  title: fc.string({ minLength: 1, maxLength: 200 }),
  content: fc.string({ minLength: 0, maxLength: 50000 }),
  createdDate: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }),
  modifiedDate: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }),
  folder: fc.string({ minLength: 1, maxLength: 100 }),
  attachments: fc.array(attachmentArb, { maxLength: 10 }),
  checklists: fc.array(checklistItemArb, { maxLength: 20 }),
  metadata: noteMetadataArb
});

/**
 * Generator for valid Note objects (with constraints)
 */
export const validNoteArb: fc.Arbitrary<Note> = fc.record({
  id: fc.uuid(),
  title: fc.string({ minLength: 1, maxLength: 200 }).filter(s => s.trim().length > 0),
  content: fc.string({ minLength: 0, maxLength: 50000 }),
  createdDate: fc.date({ min: new Date('2020-01-01'), max: new Date('2029-12-31') }),
  modifiedDate: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }),
  folder: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
  attachments: fc.array(attachmentArb, { maxLength: 10 }),
  checklists: fc.array(checklistItemArb, { maxLength: 20 }),
  metadata: noteMetadataArb
}).filter(note => note.modifiedDate >= note.createdDate);

/**
 * Generator for arrays of Notes
 */
export const notesArrayArb = (minLength = 0, maxLength = 100): fc.Arbitrary<Note[]> =>
  fc.array(validNoteArb, { minLength, maxLength });

/**
 * Generator for ScoringFactor objects
 */
export const scoringFactorArb: fc.Arbitrary<ScoringFactor> = fc.record({
  name: fc.string({ minLength: 1, maxLength: 50 }),
  weight: fc.float({ min: Math.fround(0.01), max: Math.fround(1.0) }),
  value: fc.integer({ min: 0, max: 100 }),
  description: fc.string({ minLength: 1, maxLength: 200 })
});

/**
 * Generator for UtilityScore objects
 */
export const utilityScoreArb: fc.Arbitrary<UtilityScore> = fc.record({
  noteId: fc.uuid(),
  overallScore: fc.integer({ min: 0, max: 100 }),
  contentScore: fc.integer({ min: 0, max: 100 }),
  behavioralScore: fc.integer({ min: 0, max: 100 }),
  semanticScore: fc.integer({ min: 0, max: 100 }),
  ruleBasedScore: fc.integer({ min: 0, max: 100 }),
  explanation: fc.string({ minLength: 10, maxLength: 500 }),
  confidence: fc.float({ min: Math.fround(0.1), max: Math.fround(1.0) }),
  factors: fc.array(scoringFactorArb, { minLength: 1, maxLength: 10 }),
  timestamp: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') })
});

/**
 * Generator for valid UtilityScore objects (with constraints)
 */
export const validUtilityScoreArb: fc.Arbitrary<UtilityScore> = utilityScoreArb.filter(score => {
  // Ensure all scores are within valid range and explanation is meaningful
  return score.overallScore >= 0 && score.overallScore <= 100 &&
         score.contentScore >= 0 && score.contentScore <= 100 &&
         score.behavioralScore >= 0 && score.behavioralScore <= 100 &&
         score.semanticScore >= 0 && score.semanticScore <= 100 &&
         score.ruleBasedScore >= 0 && score.ruleBasedScore <= 100 &&
         score.confidence > 0 && score.confidence <= 1 &&
         score.explanation.trim().length >= 10 &&
         score.factors.length > 0;
});