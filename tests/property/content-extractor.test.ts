/**
 * Property-based tests for ContentExtractorAgent
 * Feature: notes-ai-organizer
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import fc from 'fast-check';
import { ContentExtractorAgent } from '@/agents/ContentExtractorAgent';
import { Note } from '@/models/Note';
import { LLMService } from '@/services/LLMService';
import { validNoteArb } from '../generators/NoteGenerators';

describe('ContentExtractorAgent Properties', () => {
  let mockLLMService: LLMService;
  let contentExtractor: ContentExtractorAgent;

  beforeEach(() => {
    // Create a mock LLM service for consistent testing
    mockLLMService = {
      processRequest: vi.fn().mockResolvedValue({
        requestId: 'test-request',
        response: 'Topics: general\nType: other\nSummary: Test content analysis.',
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

    contentExtractor = new ContentExtractorAgent(mockLLMService);
  });

  /**
   * Feature: notes-ai-organizer, Property 3: OCR processing for handwritten content
   * Validates: Requirements 2.1
   */
  it('should apply OCR to convert handwriting to searchable text for any note with handwritten content', () => {
    // Generator for notes that have handwriting
    const noteWithHandwritingArb = validNoteArb.map(note => ({
      ...note,
      metadata: {
        ...note.metadata,
        hasHandwriting: true
      }
    }));

    fc.assert(
      fc.asyncProperty(noteWithHandwritingArb, async (note: Note) => {
        // Ensure OCR is enabled
        contentExtractor.setOCREnabled(true);
        
        // Process the note
        const result = await contentExtractor.extractContent(note);
        
        // Property: For any note with handwriting, OCR should be applied
        // This means ocrText should be defined and contain some content
        expect(result.ocrText).toBeDefined();
        expect(result.ocrText).not.toBe('');
        expect(typeof result.ocrText).toBe('string');
        
        // The OCR text should indicate that OCR processing occurred
        // (In the mock implementation, it includes "OCR:" prefix)
        expect(result.ocrText).toContain('OCR');
        
        // No critical errors should occur during OCR processing
        const ocrErrors = result.processingErrors.filter(
          error => error.component === 'OCR' && error.severity === 'error'
        );
        expect(ocrErrors).toHaveLength(0);
        
        return true;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Additional property: OCR should be skipped when disabled
   */
  it('should skip OCR processing when OCR is disabled, regardless of handwriting presence', () => {
    const noteWithHandwritingArb = validNoteArb.map(note => ({
      ...note,
      metadata: {
        ...note.metadata,
        hasHandwriting: true
      }
    }));

    fc.assert(
      fc.asyncProperty(noteWithHandwritingArb, async (note: Note) => {
        // Disable OCR
        contentExtractor.setOCREnabled(false);
        
        // Process the note
        const result = await contentExtractor.extractContent(note);
        
        // Property: When OCR is disabled, ocrText should be undefined
        // even if the note has handwriting
        expect(result.ocrText).toBeUndefined();
        
        return true;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Additional property: OCR should be skipped when no handwriting is present
   */
  it('should skip OCR processing when note has no handwriting', () => {
    const noteWithoutHandwritingArb = validNoteArb.map(note => ({
      ...note,
      metadata: {
        ...note.metadata,
        hasHandwriting: false
      }
    }));

    fc.assert(
      fc.asyncProperty(noteWithoutHandwritingArb, async (note: Note) => {
        // Ensure OCR is enabled
        contentExtractor.setOCREnabled(true);
        
        // Process the note
        const result = await contentExtractor.extractContent(note);
        
        // Property: When no handwriting is present, ocrText should be undefined
        // even if OCR is enabled
        expect(result.ocrText).toBeUndefined();
        
        return true;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: notes-ai-organizer, Property 4: Image content analysis
   * Validates: Requirements 2.2
   */
  it('should analyze image content and extract relevant metadata for any note with images', () => {
    // Generator for notes that have images
    const noteWithImagesArb = validNoteArb.map(note => ({
      ...note,
      metadata: {
        ...note.metadata,
        hasImages: true
      }
    }));

    fc.assert(
      fc.asyncProperty(noteWithImagesArb, async (note: Note) => {
        // Ensure image analysis is enabled
        contentExtractor.setImageAnalysisEnabled(true);
        
        // Process the note
        const result = await contentExtractor.extractContent(note);
        
        // Property: For any note with images, image analysis should be performed
        // This means imageMetadata should be defined and contain analysis results
        expect(result.imageMetadata).toBeDefined();
        expect(Array.isArray(result.imageMetadata)).toBe(true);
        expect(result.imageMetadata.length).toBeGreaterThan(0);
        
        // Each image metadata should have required properties
        for (const imageData of result.imageMetadata) {
          expect(imageData.id).toBeDefined();
          expect(typeof imageData.id).toBe('string');
          expect(imageData.id.length).toBeGreaterThan(0);
          
          expect(imageData.description).toBeDefined();
          expect(typeof imageData.description).toBe('string');
          expect(imageData.description.length).toBeGreaterThan(0);
          
          expect(imageData.objects).toBeDefined();
          expect(Array.isArray(imageData.objects)).toBe(true);
          
          expect(imageData.confidence).toBeDefined();
          expect(typeof imageData.confidence).toBe('number');
          expect(imageData.confidence).toBeGreaterThanOrEqual(0);
          expect(imageData.confidence).toBeLessThanOrEqual(1);
        }
        
        // No critical errors should occur during image analysis
        const imageErrors = result.processingErrors.filter(
          error => error.component === 'ImageAnalysis' && error.severity === 'error'
        );
        expect(imageErrors).toHaveLength(0);
        
        return true;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Additional property: Image analysis should be skipped when disabled
   */
  it('should skip image analysis when disabled, regardless of image presence', () => {
    const noteWithImagesArb = validNoteArb.map(note => ({
      ...note,
      metadata: {
        ...note.metadata,
        hasImages: true
      }
    }));

    fc.assert(
      fc.asyncProperty(noteWithImagesArb, async (note: Note) => {
        // Disable image analysis
        contentExtractor.setImageAnalysisEnabled(false);
        
        // Process the note
        const result = await contentExtractor.extractContent(note);
        
        // Property: When image analysis is disabled, imageMetadata should be empty
        // even if the note has images
        expect(result.imageMetadata).toBeDefined();
        expect(Array.isArray(result.imageMetadata)).toBe(true);
        expect(result.imageMetadata).toHaveLength(0);
        
        return true;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Additional property: Image analysis should be skipped when no images are present
   */
  it('should skip image analysis when note has no images', () => {
    const noteWithoutImagesArb = validNoteArb.map(note => ({
      ...note,
      metadata: {
        ...note.metadata,
        hasImages: false
      }
    }));

    fc.assert(
      fc.asyncProperty(noteWithoutImagesArb, async (note: Note) => {
        // Ensure image analysis is enabled
        contentExtractor.setImageAnalysisEnabled(true);
        
        // Process the note
        const result = await contentExtractor.extractContent(note);
        
        // Property: When no images are present, imageMetadata should be empty
        // even if image analysis is enabled
        expect(result.imageMetadata).toBeDefined();
        expect(Array.isArray(result.imageMetadata)).toBe(true);
        expect(result.imageMetadata).toHaveLength(0);
        
        return true;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: notes-ai-organizer, Property 5: Attachment processing
   * Validates: Requirements 2.3
   */
  it('should identify attachment types and extract accessible content for any note containing attachments', () => {
    // Generator for notes that have attachments
    const noteWithAttachmentsArb = validNoteArb.filter(note => note.attachments.length > 0);

    fc.assert(
      fc.asyncProperty(noteWithAttachmentsArb, async (note: Note) => {
        // Process the note
        const result = await contentExtractor.extractContent(note);
        
        // Property: For any note with attachments, attachment processing should occur
        // This means attachmentContent should be defined and contain processing results
        expect(result.attachmentContent).toBeDefined();
        expect(Array.isArray(result.attachmentContent)).toBe(true);
        expect(result.attachmentContent.length).toBe(note.attachments.length);
        
        // Each attachment should be processed and have required properties
        for (let i = 0; i < note.attachments.length; i++) {
          const originalAttachment = note.attachments[i];
          const processedAttachment = result.attachmentContent[i];
          
          // Should have matching attachment ID
          expect(processedAttachment.attachmentId).toBe(originalAttachment.id);
          
          // Should have processing success indicator
          expect(processedAttachment.processingSuccess).toBeDefined();
          expect(typeof processedAttachment.processingSuccess).toBe('boolean');
          
          // Should have metadata containing attachment information
          expect(processedAttachment.metadata).toBeDefined();
          expect(typeof processedAttachment.metadata).toBe('object');
          expect(processedAttachment.metadata.filename).toBe(originalAttachment.filename);
          expect(processedAttachment.metadata.size).toBe(originalAttachment.size);
          expect(processedAttachment.metadata.mimeType).toBe(originalAttachment.mimeType);
          
          // If processing was successful, should have extracted text or error message
          if (processedAttachment.processingSuccess) {
            expect(processedAttachment.extractedText).toBeDefined();
            expect(typeof processedAttachment.extractedText).toBe('string');
            expect(processedAttachment.error).toBeUndefined();
          } else {
            expect(processedAttachment.error).toBeDefined();
            expect(typeof processedAttachment.error).toBe('string');
            expect(processedAttachment.error.length).toBeGreaterThan(0);
          }
        }
        
        // No critical errors should occur during attachment processing
        const attachmentErrors = result.processingErrors.filter(
          error => error.component === 'AttachmentProcessing' && error.severity === 'error'
        );
        expect(attachmentErrors).toHaveLength(0);
        
        return true;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Additional property: Attachment processing should be skipped when no attachments are present
   */
  it('should skip attachment processing when note has no attachments', () => {
    const noteWithoutAttachmentsArb = validNoteArb.map(note => ({
      ...note,
      attachments: []
    }));

    fc.assert(
      fc.asyncProperty(noteWithoutAttachmentsArb, async (note: Note) => {
        // Process the note
        const result = await contentExtractor.extractContent(note);
        
        // Property: When no attachments are present, attachmentContent should be empty
        expect(result.attachmentContent).toBeDefined();
        expect(Array.isArray(result.attachmentContent)).toBe(true);
        expect(result.attachmentContent).toHaveLength(0);
        
        return true;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: notes-ai-organizer, Property 6: Checklist structure preservation
   * Validates: Requirements 2.4
   */
  it('should preserve checklist structure and completion status for any note containing checklists', () => {
    // Generator for notes that have checklists
    const noteWithChecklistsArb = validNoteArb.filter(note => note.checklists.length > 0);

    fc.assert(
      fc.asyncProperty(noteWithChecklistsArb, async (note: Note) => {
        // Process the note
        const result = await contentExtractor.extractContent(note);
        
        // Property: For any note with checklists, structure and completion status should be preserved
        expect(result.checklists).toBeDefined();
        expect(Array.isArray(result.checklists)).toBe(true);
        expect(result.checklists.length).toBeGreaterThan(0);
        
        // Verify that all original checklist items are preserved
        const originalItems = note.checklists;
        const processedChecklist = result.checklists[0]; // Current implementation groups all items into one checklist
        
        expect(processedChecklist.items).toBeDefined();
        expect(processedChecklist.items.length).toBe(originalItems.length);
        
        // Verify each original item is preserved with correct properties
        const sortedOriginalItems = [...originalItems].sort((a, b) => a.order - b.order);
        for (let i = 0; i < sortedOriginalItems.length; i++) {
          const originalItem = sortedOriginalItems[i];
          const processedItem = processedChecklist.items[i];
          
          // Verify item properties are preserved
          expect(processedItem.id).toBe(originalItem.id);
          expect(processedItem.text).toBe(originalItem.text);
          expect(processedItem.completed).toBe(originalItem.completed);
          expect(processedItem.order).toBe(originalItem.order);
        }
        
        // Verify completion status is correctly calculated
        const completedCount = originalItems.filter(item => item.completed).length;
        const expectedCompletionRate = completedCount / originalItems.length;
        expect(processedChecklist.completionRate).toBe(expectedCompletionRate);
        
        // Verify structure information is preserved
        expect(processedChecklist.structure).toBeDefined();
        expect(processedChecklist.structure.totalItems).toBe(originalItems.length);
        expect(processedChecklist.structure.completedItems).toBe(completedCount);
        
        // Verify structure detection works correctly
        expect(typeof processedChecklist.structure.isNested).toBe('boolean');
        expect(typeof processedChecklist.structure.hasCategories).toBe('boolean');
        
        // No critical errors should occur during checklist processing
        const checklistErrors = result.processingErrors.filter(
          error => error.component === 'ChecklistParser' && error.severity === 'error'
        );
        expect(checklistErrors).toHaveLength(0);
        
        return true;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Additional property: Checklist processing should be skipped when no checklists are present
   */
  it('should skip checklist processing when note has no checklists', () => {
    const noteWithoutChecklistsArb = validNoteArb.map(note => ({
      ...note,
      checklists: []
    }));

    fc.assert(
      fc.asyncProperty(noteWithoutChecklistsArb, async (note: Note) => {
        // Process the note
        const result = await contentExtractor.extractContent(note);
        
        // Property: When no checklists are present, checklists should be empty
        expect(result.checklists).toBeDefined();
        expect(Array.isArray(result.checklists)).toBe(true);
        expect(result.checklists).toHaveLength(0);
        
        return true;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: notes-ai-organizer, Property 7: Extraction failure resilience
   * Validates: Requirements 2.5
   */
  it('should log failures and continue processing other elements when content extraction fails', () => {
    fc.assert(
      fc.asyncProperty(validNoteArb, async (note: Note) => {
        // Create a mock LLM service that will fail for semantic analysis
        const failingLLMService = {
          processRequest: vi.fn().mockRejectedValue(new Error('LLM service unavailable')),
          isAvailable: vi.fn().mockResolvedValue(false),
          getCurrentProvider: vi.fn().mockReturnValue('none'),
          setProviderPreference: vi.fn(),
          getResourceUsage: vi.fn().mockReturnValue({
            totalRequests: 0,
            onDeviceRequests: 0,
            cloudRequests: 0,
            failedRequests: 1,
            averageResponseTime: 0,
            memoryUsage: 0,
            cpuUsage: 0
          }),
          shutdown: vi.fn().mockResolvedValue(undefined)
        };

        // Create content extractor with failing LLM service
        const failingContentExtractor = new ContentExtractorAgent(failingLLMService);
        
        // Process the note
        const result = await failingContentExtractor.extractContent(note);
        
        // Property: When content extraction fails for any element, the system should:
        // 1. Log the failure in processingErrors
        // 2. Continue processing other elements
        // 3. Return a valid result structure
        
        // Verify that processing errors are logged
        expect(result.processingErrors).toBeDefined();
        expect(Array.isArray(result.processingErrors)).toBe(true);
        
        // Should have at least one error from the failing LLM service
        const semanticErrors = result.processingErrors.filter(
          error => error.component === 'SemanticAnalysis'
        );
        expect(semanticErrors.length).toBeGreaterThan(0);
        
        // Verify that the error contains meaningful information
        const semanticError = semanticErrors[0];
        expect(semanticError.error).toBeDefined();
        expect(typeof semanticError.error).toBe('string');
        expect(semanticError.error.length).toBeGreaterThan(0);
        expect(semanticError.severity).toBeDefined();
        expect(['warning', 'error']).toContain(semanticError.severity);
        expect(typeof semanticError.recoverable).toBe('boolean');
        
        // Verify that other processing continues despite the failure
        // The system should still return a valid structure
        expect(result.normalizedText).toBeDefined();
        expect(typeof result.normalizedText).toBe('string');
        
        expect(result.imageMetadata).toBeDefined();
        expect(Array.isArray(result.imageMetadata)).toBe(true);
        
        expect(result.attachmentContent).toBeDefined();
        expect(Array.isArray(result.attachmentContent)).toBe(true);
        
        expect(result.checklists).toBeDefined();
        expect(Array.isArray(result.checklists)).toBe(true);
        
        // Semantic analysis should have fallback result despite LLM failure
        expect(result.semanticAnalysis).toBeDefined();
        expect(result.semanticAnalysis.topics).toBeDefined();
        expect(Array.isArray(result.semanticAnalysis.topics)).toBe(true);
        expect(result.semanticAnalysis.summary).toBeDefined();
        expect(typeof result.semanticAnalysis.summary).toBe('string');
        
        // Verify that processing of other components (that don't depend on LLM) still works
        if (note.metadata.hasHandwriting) {
          // OCR should still work (it doesn't depend on the failing LLM service)
          expect(result.ocrText).toBeDefined();
          expect(typeof result.ocrText).toBe('string');
        }
        
        if (note.metadata.hasImages) {
          // Image analysis should still work
          expect(result.imageMetadata.length).toBeGreaterThan(0);
        }
        
        if (note.attachments.length > 0) {
          // Attachment processing should still work
          expect(result.attachmentContent.length).toBe(note.attachments.length);
        }
        
        if (note.checklists.length > 0) {
          // Checklist processing should still work (doesn't depend on LLM)
          expect(result.checklists.length).toBeGreaterThan(0);
        }
        
        return true;
      }),
      { numRuns: 100 }
    );
  });
});