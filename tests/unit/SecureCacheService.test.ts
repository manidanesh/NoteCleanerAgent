import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SecureCacheService } from '../../src/services/SecureCacheService';
import { Note } from '../../src/models/Note';
import { UtilityScore } from '../../src/models/UtilityScore';
import { Recommendation } from '../../src/models/Recommendation';

// Mock dependencies
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    multiRemove: vi.fn(),
    getAllKeys: vi.fn().mockResolvedValue([])
  }
}));

vi.mock('../../src/services/SecurityService', () => ({
  SecurityService: {
    getInstance: vi.fn(() => ({
      storeSecureData: vi.fn(),
      retrieveSecureData: vi.fn(),
    }))
  }
}));

describe('SecureCacheService', () => {
  let secureCacheService: SecureCacheService;
  let mockSecurityService: any;

  beforeEach(() => {
    secureCacheService = SecureCacheService.getInstance();
    mockSecurityService = {
      storeSecureData: vi.fn(),
      retrieveSecureData: vi.fn(),
    };
    
    // Mock the SecurityService getInstance to return our mock
    const { SecurityService } = require('../../src/services/SecurityService');
    SecurityService.getInstance = vi.fn(() => mockSecurityService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Note Caching (Requirement 13.1)', () => {
    it('should cache a note with encryption', async () => {
      const testNote: Note = {
        id: 'test-note-1',
        title: 'Test Note',
        content: 'This is test content',
        createdDate: new Date(),
        modifiedDate: new Date(),
        folder: 'Test Folder',
        attachments: [],
        checklists: [],
        metadata: {}
      };

      mockSecurityService.storeSecureData.mockResolvedValue(undefined);

      await secureCacheService.cacheNote(testNote);

      expect(mockSecurityService.storeSecureData).toHaveBeenCalledWith(
        '@notes_ai_secure_cache_note_test-note-1',
        testNote
      );
    });

    it('should retrieve a cached note with decryption', async () => {
      const testNote: Note = {
        id: 'test-note-1',
        title: 'Test Note',
        content: 'This is test content',
        createdDate: new Date(),
        modifiedDate: new Date(),
        folder: 'Test Folder',
        attachments: [],
        checklists: [],
        metadata: {}
      };

      mockSecurityService.retrieveSecureData.mockResolvedValue(testNote);

      const retrieved = await secureCacheService.getCachedNote('test-note-1');

      expect(mockSecurityService.retrieveSecureData).toHaveBeenCalledWith(
        '@notes_ai_secure_cache_note_test-note-1'
      );
      expect(retrieved).toEqual(testNote);
    });

    it('should return null for non-existent cached note', async () => {
      mockSecurityService.retrieveSecureData.mockResolvedValue(null);

      const retrieved = await secureCacheService.getCachedNote('non-existent');

      expect(retrieved).toBeNull();
    });

    it('should cache multiple notes', async () => {
      const testNotes: Note[] = [
        {
          id: 'note-1',
          title: 'Note 1',
          content: 'Content 1',
          createdDate: new Date(),
          modifiedDate: new Date(),
          folder: 'Folder',
          attachments: [],
          checklists: [],
          metadata: {}
        },
        {
          id: 'note-2',
          title: 'Note 2',
          content: 'Content 2',
          createdDate: new Date(),
          modifiedDate: new Date(),
          folder: 'Folder',
          attachments: [],
          checklists: [],
          metadata: {}
        }
      ];

      mockSecurityService.storeSecureData.mockResolvedValue(undefined);

      await secureCacheService.cacheNotes(testNotes);

      expect(mockSecurityService.storeSecureData).toHaveBeenCalledTimes(2);
    });
  });

  describe('Utility Score Caching (Requirement 13.1)', () => {
    it('should cache a utility score with encryption', async () => {
      const testScore: UtilityScore = {
        noteId: 'test-note-1',
        overallScore: 85,
        contentScore: 80,
        behavioralScore: 90,
        semanticScore: 85,
        ruleBasedScore: 85,
        explanation: 'High utility note',
        confidence: 0.9,
        factors: []
      };

      mockSecurityService.storeSecureData.mockResolvedValue(undefined);

      await secureCacheService.cacheUtilityScore(testScore);

      expect(mockSecurityService.storeSecureData).toHaveBeenCalledWith(
        '@notes_ai_secure_cache_score_test-note-1',
        testScore
      );
    });

    it('should retrieve a cached utility score with decryption', async () => {
      const testScore: UtilityScore = {
        noteId: 'test-note-1',
        overallScore: 85,
        contentScore: 80,
        behavioralScore: 90,
        semanticScore: 85,
        ruleBasedScore: 85,
        explanation: 'High utility note',
        confidence: 0.9,
        factors: []
      };

      mockSecurityService.retrieveSecureData.mockResolvedValue(testScore);

      const retrieved = await secureCacheService.getCachedUtilityScore('test-note-1');

      expect(retrieved).toEqual(testScore);
    });
  });

  describe('Recommendation Caching (Requirement 13.1)', () => {
    it('should cache a recommendation with encryption', async () => {
      const testRecommendation: Recommendation = {
        id: 'rec-1',
        noteId: 'note-1',
        action: 'archive',
        confidence: 0.8,
        reasoning: 'Low utility score',
        impact: 'medium',
        reversible: true
      };

      mockSecurityService.storeSecureData.mockResolvedValue(undefined);

      await secureCacheService.cacheRecommendation(testRecommendation);

      expect(mockSecurityService.storeSecureData).toHaveBeenCalledWith(
        '@notes_ai_secure_cache_recommendation_rec-1',
        testRecommendation
      );
    });

    it('should retrieve a cached recommendation with decryption', async () => {
      const testRecommendation: Recommendation = {
        id: 'rec-1',
        noteId: 'note-1',
        action: 'archive',
        confidence: 0.8,
        reasoning: 'Low utility score',
        impact: 'medium',
        reversible: true
      };

      mockSecurityService.retrieveSecureData.mockResolvedValue(testRecommendation);

      const retrieved = await secureCacheService.getCachedRecommendation('rec-1');

      expect(retrieved).toEqual(testRecommendation);
    });
  });

  describe('Processing Results Caching (Requirement 13.1)', () => {
    it('should cache processing results with timestamp', async () => {
      const testResults = { processed: 100, recommendations: 25 };
      const sessionId = 'session-1';

      mockSecurityService.storeSecureData.mockResolvedValue(undefined);

      await secureCacheService.cacheProcessingResults(sessionId, testResults);

      expect(mockSecurityService.storeSecureData).toHaveBeenCalledWith(
        '@notes_ai_secure_cache_results_session-1',
        expect.objectContaining({
          results: testResults,
          sessionId,
          timestamp: expect.any(Number)
        })
      );
    });

    it('should retrieve valid cached processing results', async () => {
      const testResults = { processed: 100, recommendations: 25 };
      const cachedData = {
        results: testResults,
        timestamp: Date.now() - 1000, // 1 second ago
        sessionId: 'session-1'
      };

      mockSecurityService.retrieveSecureData.mockResolvedValue(cachedData);

      const retrieved = await secureCacheService.getCachedProcessingResults('session-1');

      expect(retrieved).toEqual(testResults);
    });

    it('should return null for expired cached processing results', async () => {
      const testResults = { processed: 100, recommendations: 25 };
      const cachedData = {
        results: testResults,
        timestamp: Date.now() - (25 * 60 * 60 * 1000), // 25 hours ago (expired)
        sessionId: 'session-1'
      };

      mockSecurityService.retrieveSecureData.mockResolvedValue(cachedData);

      const retrieved = await secureCacheService.getCachedProcessingResults('session-1');

      expect(retrieved).toBeNull();
    });
  });

  describe('Cache Management (Requirement 13.1)', () => {
    it('should get cache statistics', async () => {
      const AsyncStorage = await import('@react-native-async-storage/async-storage');
      AsyncStorage.default.getAllKeys = vi.fn().mockResolvedValue([
        '@notes_ai_secure_cache_note_1',
        '@notes_ai_secure_cache_note_2',
        '@notes_ai_secure_cache_score_1',
        '@notes_ai_secure_cache_recommendation_1',
        '@notes_ai_secure_cache_results_1',
        'other_key'
      ]);

      const stats = await secureCacheService.getCacheStats();

      expect(stats).toEqual({
        totalItems: 5,
        notes: 2,
        scores: 1,
        recommendations: 1,
        results: 1
      });
    });

    it('should clear all cache', async () => {
      const AsyncStorage = await import('@react-native-async-storage/async-storage');
      AsyncStorage.default.getAllKeys = vi.fn().mockResolvedValue([
        '@notes_ai_secure_cache_note_1',
        '@notes_ai_secure_cache_score_1',
        'other_key'
      ]);
      AsyncStorage.default.multiRemove = vi.fn().mockResolvedValue(undefined);

      await secureCacheService.clearAllCache();

      expect(AsyncStorage.default.multiRemove).toHaveBeenCalledWith([
        '@notes_ai_secure_cache_note_1',
        '@notes_ai_secure_cache_score_1'
      ]);
    });
  });

  describe('Error Handling', () => {
    it('should handle cache storage errors gracefully', async () => {
      const testNote: Note = {
        id: 'test-note-1',
        title: 'Test Note',
        content: 'This is test content',
        createdDate: new Date(),
        modifiedDate: new Date(),
        folder: 'Test Folder',
        attachments: [],
        checklists: [],
        metadata: {}
      };

      mockSecurityService.storeSecureData.mockRejectedValue(new Error('Storage failed'));

      await expect(secureCacheService.cacheNote(testNote)).rejects.toThrow('Note caching failed');
    });

    it('should handle cache retrieval errors gracefully', async () => {
      mockSecurityService.retrieveSecureData.mockRejectedValue(new Error('Retrieval failed'));

      const retrieved = await secureCacheService.getCachedNote('test-note-1');

      expect(retrieved).toBeNull();
    });
  });
});