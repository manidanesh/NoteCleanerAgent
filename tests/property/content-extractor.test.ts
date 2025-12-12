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
});