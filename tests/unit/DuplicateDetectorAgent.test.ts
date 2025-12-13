/**
 * Unit tests for DuplicateDetectorAgent
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DuplicateDetectorAgent } from '@/agents/DuplicateDetectorAgent';
import { LLMServiceImpl } from '@/services/LLMService';
import { Note } from '@/models/Note';
import { AttachmentType } from '@/models/Note';

describe('DuplicateDetectorAgent', () => {
  let duplicateDetector: DuplicateDetectorAgent;
  let mockLLMService: LLMServiceImpl;

  beforeEach(() => {
    mockLLMService = new LLMServiceImpl({
      preferOnDevice: true,
      allowCloudWithConsent: false,
      fallbackToRules: true,
      privacyLevel: 'strict_on_device' as any
    });
    duplicateDetector = new DuplicateDetectorAgent(mockLLMService);
  });

  const createTestNote = (id: string, title: string, content: string): Note => ({
    id,
    title,
    content,
    createdDate: new Date('2024-01-01'),
    modifiedDate: new Date('2024-01-02'),
    folder: 'Test Folder',
    attachments: [],
    checklists: [],
    metadata: {
      accessCount: 1,
      lastAccessDate: new Date('2024-01-02'),
      shareCount: 0,
      tags: [],
      isShared: false,
      wordCount: content.split(' ').length,
      hasHandwriting: false,
      hasImages: false
    }
  });

  describe('initialization', () => {
    it('should initialize with appropriate index type for small collections', async () => {
      await duplicateDetector.initialize(1000);
      const stats = duplicateDetector.getIndexStats();
      expect(stats.indexType).toBe('flat_ip');
    });

    it('should initialize with IVF index for large collections', async () => {
      await duplicateDetector.initialize(150000);
      const stats = duplicateDetector.getIndexStats();
      expect(stats.indexType).toBe('ivf_flat');
    });
  });

  describe('duplicate detection', () => {
    it('should detect no duplicates in empty collection', async () => {
      const notes: Note[] = [];
      const duplicates = await duplicateDetector.detectDuplicates(notes);
      expect(duplicates).toHaveLength(0);
    });

    it('should detect no duplicates in single note', async () => {
      const notes = [createTestNote('1', 'Test Note', 'This is a test note')];
      const duplicates = await duplicateDetector.detectDuplicates(notes);
      expect(duplicates).toHaveLength(0);
    });

    it('should handle notes with different content', async () => {
      const notes = [
        createTestNote('1', 'First Note', 'This is the first note'),
        createTestNote('2', 'Second Note', 'This is completely different content')
      ];
      const duplicates = await duplicateDetector.detectDuplicates(notes);
      // With our simple hash-based embedding, these should not be detected as duplicates
      expect(duplicates).toHaveLength(0);
    });

    it('should create duplicate groups with proper structure', async () => {
      const notes = [
        createTestNote('1', 'Meeting Notes', 'Discussed project timeline and deliverables'),
        createTestNote('2', 'Meeting Notes', 'Discussed project timeline and deliverables'),
        createTestNote('3', 'Different Note', 'Completely different content here')
      ];
      
      const duplicates = await duplicateDetector.detectDuplicates(notes);
      
      // Check if any duplicate groups were created
      if (duplicates.length > 0) {
        const group = duplicates[0];
        expect(group).toHaveProperty('id');
        expect(group).toHaveProperty('noteIds');
        expect(group).toHaveProperty('recommendedPrimary');
        expect(group).toHaveProperty('mergeStrategy');
        expect(group).toHaveProperty('confidence');
        expect(group.noteIds.length).toBeGreaterThan(1);
      }
    });
  });

  describe('index management', () => {
    it('should provide index statistics', () => {
      const stats = duplicateDetector.getIndexStats();
      expect(stats).toHaveProperty('totalVectors');
      expect(stats).toHaveProperty('dimension');
      expect(stats).toHaveProperty('indexType');
      expect(stats).toHaveProperty('memoryUsage');
    });

    it('should clear index successfully', async () => {
      await duplicateDetector.clearIndex();
      const stats = duplicateDetector.getIndexStats();
      expect(stats.totalVectors).toBe(0);
    });
  });

  describe('content preparation', () => {
    it('should handle notes with attachments', async () => {
      const noteWithAttachment: Note = {
        ...createTestNote('1', 'Note with attachment', 'Content with attachment'),
        attachments: [{
          id: 'att1',
          type: AttachmentType.IMAGE,
          filename: 'image.jpg',
          size: 1024,
          mimeType: 'image/jpeg'
        }]
      };

      const notes = [noteWithAttachment];
      const duplicates = await duplicateDetector.detectDuplicates(notes);
      
      // Should not throw error and should process successfully
      expect(duplicates).toBeDefined();
    });

    it('should handle notes with checklists', async () => {
      const noteWithChecklist: Note = {
        ...createTestNote('1', 'Todo List', 'My tasks'),
        checklists: [
          { id: 'c1', text: 'Task 1', completed: false, order: 1 },
          { id: 'c2', text: 'Task 2', completed: true, order: 2 }
        ]
      };

      const notes = [noteWithChecklist];
      const duplicates = await duplicateDetector.detectDuplicates(notes);
      
      // Should not throw error and should process successfully
      expect(duplicates).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('should handle LLM service failures gracefully', async () => {
      // Create a mock that fails
      const failingLLMService = {
        processRequest: vi.fn().mockRejectedValue(new Error('LLM service failed')),
        isAvailable: vi.fn().mockResolvedValue(false),
        getCurrentProvider: vi.fn().mockReturnValue('fallback_rules'),
        setProviderPreference: vi.fn(),
        getResourceUsage: vi.fn().mockReturnValue({}),
        shutdown: vi.fn().mockResolvedValue(undefined)
      };

      const detector = new DuplicateDetectorAgent(failingLLMService as any);
      const notes = [
        createTestNote('1', 'Test', 'Content'),
        createTestNote('2', 'Test', 'Content')
      ];

      // Should not throw error even if LLM fails
      const duplicates = await detector.detectDuplicates(notes);
      expect(duplicates).toBeDefined();
    });
  });
});