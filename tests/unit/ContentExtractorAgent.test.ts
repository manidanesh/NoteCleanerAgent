import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ContentExtractorAgent, ExtractedContent } from '../../src/agents/ContentExtractorAgent';
import { Note, AttachmentType, ChecklistItem } from '../../src/models/Note';
import { LLMService, LLMServiceImpl } from '../../src/services/LLMService';
import { LLMRequestType, ContentType } from '../../src/models/LLMModels';

describe('ContentExtractorAgent', () => {
  let contentExtractor: ContentExtractorAgent;
  let mockLLMService: LLMService;

  beforeEach(() => {
    // Create a mock LLM service
    mockLLMService = {
      processRequest: vi.fn().mockResolvedValue({
        requestId: 'test-request',
        response: 'Topics: meeting, planning\nType: meeting_notes\nSummary: This is a meeting note about project planning.',
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

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Functionality', () => {
    it('should initialize with default settings', () => {
      const agent = new ContentExtractorAgent();
      expect(agent).toBeDefined();
      
      const capabilities = agent.getCapabilities();
      expect(capabilities.ocrEnabled).toBe(true);
      expect(capabilities.imageAnalysisEnabled).toBe(true);
      expect(capabilities.supportedAttachmentTypes).toContain(AttachmentType.PDF);
    });

    it('should allow enabling/disabling OCR', () => {
      contentExtractor.setOCREnabled(false);
      expect(contentExtractor.getCapabilities().ocrEnabled).toBe(false);
      
      contentExtractor.setOCREnabled(true);
      expect(contentExtractor.getCapabilities().ocrEnabled).toBe(true);
    });

    it('should allow enabling/disabling image analysis', () => {
      contentExtractor.setImageAnalysisEnabled(false);
      expect(contentExtractor.getCapabilities().imageAnalysisEnabled).toBe(false);
      
      contentExtractor.setImageAnalysisEnabled(true);
      expect(contentExtractor.getCapabilities().imageAnalysisEnabled).toBe(true);
    });
  });

  describe('Text Processing', () => {
    it('should extract content from simple text note', async () => {
      const note: Note = {
        id: 'test-note-1',
        title: 'Test Note',
        content: 'This is a simple test note with some content.',
        createdDate: new Date('2024-01-01'),
        modifiedDate: new Date('2024-01-02'),
        folder: 'Test Folder',
        attachments: [],
        checklists: [],
        metadata: {
          accessCount: 5,
          shareCount: 0,
          tags: ['test'],
          isShared: false,
          wordCount: 10,
          hasHandwriting: false,
          hasImages: false
        }
      };

      const result = await contentExtractor.extractContent(note);

      expect(result).toBeDefined();
      expect(result.normalizedText).toBe('This is a simple test note with some content.');
      expect(result.semanticAnalysis).toBeDefined();
      expect(result.semanticAnalysis.topics).toContain('meeting');
      expect(result.processingErrors).toHaveLength(0);
    });

    it('should normalize text content properly', async () => {
      const note: Note = {
        id: 'test-note-2',
        title: 'Test Note',
        content: '  This   has    excessive   whitespace  \n\n\n\n  and   line breaks  ',
        createdDate: new Date('2024-01-01'),
        modifiedDate: new Date('2024-01-02'),
        folder: 'Test Folder',
        attachments: [],
        checklists: [],
        metadata: {
          accessCount: 1,
          shareCount: 0,
          tags: [],
          isShared: false,
          wordCount: 8,
          hasHandwriting: false,
          hasImages: false
        }
      };

      const result = await contentExtractor.extractContent(note);

      expect(result.normalizedText).toBe('This has excessive whitespace and line breaks');
      expect(result.normalizedText).not.toContain('   '); // No triple spaces
      expect(result.normalizedText).not.toContain('\n\n\n'); // No triple line breaks
    });
  });

  describe('OCR Processing', () => {
    it('should process handwriting when enabled and metadata indicates handwriting', async () => {
      const note: Note = {
        id: 'test-note-3',
        title: 'Handwritten Note',
        content: 'Some typed content',
        createdDate: new Date('2024-01-01'),
        modifiedDate: new Date('2024-01-02'),
        folder: 'Test Folder',
        attachments: [],
        checklists: [],
        metadata: {
          accessCount: 1,
          shareCount: 0,
          tags: [],
          isShared: false,
          wordCount: 3,
          hasHandwriting: true,
          hasImages: false
        }
      };

      const result = await contentExtractor.extractContent(note);

      expect(result.ocrText).toBeDefined();
      expect(result.ocrText).toContain('OCR: Handwritten content');
    });

    it('should skip OCR when disabled', async () => {
      contentExtractor.setOCREnabled(false);
      
      const note: Note = {
        id: 'test-note-4',
        title: 'Handwritten Note',
        content: 'Some typed content',
        createdDate: new Date('2024-01-01'),
        modifiedDate: new Date('2024-01-02'),
        folder: 'Test Folder',
        attachments: [],
        checklists: [],
        metadata: {
          accessCount: 1,
          shareCount: 0,
          tags: [],
          isShared: false,
          wordCount: 3,
          hasHandwriting: true,
          hasImages: false
        }
      };

      const result = await contentExtractor.extractContent(note);

      expect(result.ocrText).toBeUndefined();
    });
  });

  describe('Image Analysis', () => {
    it('should analyze images when enabled and metadata indicates images', async () => {
      const note: Note = {
        id: 'test-note-5',
        title: 'Note with Images',
        content: 'This note has images',
        createdDate: new Date('2024-01-01'),
        modifiedDate: new Date('2024-01-02'),
        folder: 'Test Folder',
        attachments: [],
        checklists: [],
        metadata: {
          accessCount: 1,
          shareCount: 0,
          tags: [],
          isShared: false,
          wordCount: 4,
          hasHandwriting: false,
          hasImages: true
        }
      };

      const result = await contentExtractor.extractContent(note);

      expect(result.imageMetadata).toBeDefined();
      expect(result.imageMetadata.length).toBeGreaterThan(0);
      expect(result.imageMetadata[0].description).toContain('Image');
      expect(result.imageMetadata[0].confidence).toBeGreaterThan(0);
    });

    it('should skip image analysis when disabled', async () => {
      contentExtractor.setImageAnalysisEnabled(false);
      
      const note: Note = {
        id: 'test-note-6',
        title: 'Note with Images',
        content: 'This note has images',
        createdDate: new Date('2024-01-01'),
        modifiedDate: new Date('2024-01-02'),
        folder: 'Test Folder',
        attachments: [],
        checklists: [],
        metadata: {
          accessCount: 1,
          shareCount: 0,
          tags: [],
          isShared: false,
          wordCount: 4,
          hasHandwriting: false,
          hasImages: true
        }
      };

      const result = await contentExtractor.extractContent(note);

      expect(result.imageMetadata).toHaveLength(0);
    });
  });

  describe('Attachment Processing', () => {
    it('should process PDF attachments', async () => {
      const note: Note = {
        id: 'test-note-7',
        title: 'Note with PDF',
        content: 'This note has a PDF attachment',
        createdDate: new Date('2024-01-01'),
        modifiedDate: new Date('2024-01-02'),
        folder: 'Test Folder',
        attachments: [{
          id: 'att-1',
          type: AttachmentType.PDF,
          filename: 'document.pdf',
          size: 1024000,
          mimeType: 'application/pdf',
          content: 'PDF content here'
        }],
        checklists: [],
        metadata: {
          accessCount: 1,
          shareCount: 0,
          tags: [],
          isShared: false,
          wordCount: 6,
          hasHandwriting: false,
          hasImages: false
        }
      };

      const result = await contentExtractor.extractContent(note);

      expect(result.attachmentContent).toHaveLength(1);
      expect(result.attachmentContent[0].attachmentId).toBe('att-1');
      expect(result.attachmentContent[0].processingSuccess).toBe(true);
      expect(result.attachmentContent[0].extractedText).toBeDefined();
    });

    it('should handle multiple attachment types', async () => {
      const note: Note = {
        id: 'test-note-8',
        title: 'Note with Multiple Attachments',
        content: 'This note has multiple attachments',
        createdDate: new Date('2024-01-01'),
        modifiedDate: new Date('2024-01-02'),
        folder: 'Test Folder',
        attachments: [
          {
            id: 'att-1',
            type: AttachmentType.PDF,
            filename: 'document.pdf',
            size: 1024000,
            mimeType: 'application/pdf'
          },
          {
            id: 'att-2',
            type: AttachmentType.IMAGE,
            filename: 'photo.jpg',
            size: 512000,
            mimeType: 'image/jpeg'
          },
          {
            id: 'att-3',
            type: AttachmentType.DOCUMENT,
            filename: 'report.docx',
            size: 256000,
            mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
          }
        ],
        checklists: [],
        metadata: {
          accessCount: 1,
          shareCount: 0,
          tags: [],
          isShared: false,
          wordCount: 6,
          hasHandwriting: false,
          hasImages: false
        }
      };

      const result = await contentExtractor.extractContent(note);

      expect(result.attachmentContent).toHaveLength(3);
      expect(result.attachmentContent.every(att => att.processingSuccess)).toBe(true);
    });
  });

  describe('Checklist Processing', () => {
    it('should parse simple checklists', async () => {
      const checklistItems: ChecklistItem[] = [
        { id: 'item-1', text: 'First task', completed: false, order: 1 },
        { id: 'item-2', text: 'Second task', completed: true, order: 2 },
        { id: 'item-3', text: 'Third task', completed: false, order: 3 }
      ];

      const note: Note = {
        id: 'test-note-9',
        title: 'Note with Checklist',
        content: 'This note has a checklist',
        createdDate: new Date('2024-01-01'),
        modifiedDate: new Date('2024-01-02'),
        folder: 'Test Folder',
        attachments: [],
        checklists: checklistItems,
        metadata: {
          accessCount: 1,
          shareCount: 0,
          tags: [],
          isShared: false,
          wordCount: 5,
          hasHandwriting: false,
          hasImages: false
        }
      };

      const result = await contentExtractor.extractContent(note);

      expect(result.checklists).toHaveLength(1);
      expect(result.checklists[0].items).toHaveLength(3);
      expect(result.checklists[0].completionRate).toBe(1/3); // 1 out of 3 completed
      expect(result.checklists[0].structure.totalItems).toBe(3);
      expect(result.checklists[0].structure.completedItems).toBe(1);
    });

    it('should detect nested checklist structure', async () => {
      const checklistItems: ChecklistItem[] = [
        { id: 'item-1', text: 'Main task', completed: false, order: 1 },
        { id: 'item-2', text: '  Subtask 1', completed: true, order: 2 },
        { id: 'item-3', text: '  Subtask 2', completed: false, order: 3 }
      ];

      const note: Note = {
        id: 'test-note-10',
        title: 'Note with Nested Checklist',
        content: 'This note has a nested checklist',
        createdDate: new Date('2024-01-01'),
        modifiedDate: new Date('2024-01-02'),
        folder: 'Test Folder',
        attachments: [],
        checklists: checklistItems,
        metadata: {
          accessCount: 1,
          shareCount: 0,
          tags: [],
          isShared: false,
          wordCount: 6,
          hasHandwriting: false,
          hasImages: false
        }
      };

      const result = await contentExtractor.extractContent(note);

      expect(result.checklists[0].structure.isNested).toBe(true);
    });
  });

  describe('Semantic Analysis', () => {
    it('should perform LLM-powered semantic analysis', async () => {
      const note: Note = {
        id: 'test-note-11',
        title: 'Meeting Notes',
        content: 'Meeting with team about project planning and next steps. Discussed deadlines and priorities.',
        createdDate: new Date('2024-01-01'),
        modifiedDate: new Date('2024-01-02'),
        folder: 'Work',
        attachments: [],
        checklists: [],
        metadata: {
          accessCount: 3,
          shareCount: 1,
          tags: ['work', 'meeting'],
          isShared: true,
          wordCount: 12,
          hasHandwriting: false,
          hasImages: false
        }
      };

      const result = await contentExtractor.extractContent(note);

      expect(mockLLMService.processRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          agentId: 'content-extractor',
          requestType: LLMRequestType.CONTENT_ANALYSIS,
          noteContent: expect.stringContaining('Meeting with team')
        })
      );

      expect(result.semanticAnalysis).toBeDefined();
      expect(result.semanticAnalysis.topics).toContain('meeting');
      expect(result.semanticAnalysis.contentType).toBe(ContentType.MEETING_NOTES);
      expect(result.semanticAnalysis.summary).toBeDefined();
    });

    it('should provide fallback analysis when LLM fails', async () => {
      // Mock LLM service to fail
      const failingLLMService = {
        ...mockLLMService,
        processRequest: vi.fn().mockRejectedValue(new Error('LLM service unavailable'))
      };

      const agent = new ContentExtractorAgent(failingLLMService);

      const note: Note = {
        id: 'test-note-12',
        title: 'Test Note',
        content: 'This is test content for fallback analysis.',
        createdDate: new Date('2024-01-01'),
        modifiedDate: new Date('2024-01-02'),
        folder: 'Test',
        attachments: [],
        checklists: [],
        metadata: {
          accessCount: 1,
          shareCount: 0,
          tags: [],
          isShared: false,
          wordCount: 8,
          hasHandwriting: false,
          hasImages: false
        }
      };

      const result = await agent.extractContent(note);

      expect(result.semanticAnalysis).toBeDefined();
      expect(result.semanticAnalysis.topics).toContain('general');
      expect(result.semanticAnalysis.contentType).toBe(ContentType.OTHER);
      expect(result.processingErrors.some(e => e.component === 'SemanticAnalysis')).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle critical failures gracefully', async () => {
      // Create a note that will cause processing errors
      const problematicNote: Note = {
        id: 'test-note-13',
        title: 'Problematic Note',
        content: 'This note will cause issues',
        createdDate: new Date('2024-01-01'),
        modifiedDate: new Date('2024-01-02'),
        folder: 'Test',
        attachments: [],
        checklists: [],
        metadata: {
          accessCount: 1,
          shareCount: 0,
          tags: [],
          isShared: false,
          wordCount: 5,
          hasHandwriting: false,
          hasImages: false
        }
      };

      const result = await contentExtractor.extractContent(problematicNote);

      // Should still return a result even with errors
      expect(result).toBeDefined();
      expect(result.normalizedText).toBeDefined();
      expect(result.semanticAnalysis).toBeDefined();
    });

    it('should record processing errors appropriately', async () => {
      // Mock LLM to fail for semantic analysis
      const partiallyFailingLLMService = {
        ...mockLLMService,
        processRequest: vi.fn().mockRejectedValue(new Error('Semantic analysis failed'))
      };

      const agent = new ContentExtractorAgent(partiallyFailingLLMService);

      const note: Note = {
        id: 'test-note-14',
        title: 'Test Note',
        content: 'Test content',
        createdDate: new Date('2024-01-01'),
        modifiedDate: new Date('2024-01-02'),
        folder: 'Test',
        attachments: [],
        checklists: [],
        metadata: {
          accessCount: 1,
          shareCount: 0,
          tags: [],
          isShared: false,
          wordCount: 2,
          hasHandwriting: false,
          hasImages: false
        }
      };

      const result = await agent.extractContent(note);

      expect(result.processingErrors).toHaveLength(1);
      expect(result.processingErrors[0].component).toBe('SemanticAnalysis');
      expect(result.processingErrors[0].severity).toBe('warning');
      expect(result.processingErrors[0].recoverable).toBe(true);
    });
  });
});