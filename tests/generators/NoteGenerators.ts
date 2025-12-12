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
} from '@/models/Note';

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
export const validNoteArb: fc.Arbitrary<Note> = noteArb.filter(note => {
  // Ensure modifiedDate >= createdDate
  return note.modifiedDate >= note.createdDate &&
         note.title.trim().length > 0 &&
         note.folder.trim().length > 0;
});

/**
 * Generator for arrays of Notes
 */
export const notesArrayArb = (minLength = 0, maxLength = 100): fc.Arbitrary<Note[]> =>
  fc.array(validNoteArb, { minLength, maxLength });