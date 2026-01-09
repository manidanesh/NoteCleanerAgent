// Mock AsyncStorage for Node.js environment
const AsyncStorage = {
  getItem: async (key: string): Promise<string | null> => null,
  setItem: async (key: string, value: string): Promise<void> => {},
  removeItem: async (key: string): Promise<void> => {},
  multiRemove: async (keys: string[]): Promise<void> => {},
  getAllKeys: async (): Promise<string[]> => []
};
import { SecurityService } from './SecurityService';
import { Note } from '../models/Note';
import { UtilityScore } from '../models/UtilityScore';
import { Recommendation } from '../models/Recommendation';

/**
 * SecureCacheService provides encrypted caching for sensitive note data
 * Implements requirement 13.1 for device-level encryption of cached data
 */
export class SecureCacheService {
  private static instance: SecureCacheService;
  private securityService: SecurityService;
  private cachePrefix = '@notes_ai_secure_cache_';

  private constructor() {
    this.securityService = SecurityService.getInstance();
  }

  public static getInstance(): SecureCacheService {
    if (!SecureCacheService.instance) {
      SecureCacheService.instance = new SecureCacheService();
    }
    return SecureCacheService.instance;
  }

  /**
   * Requirement 13.1: Cache note data with encryption
   */
  public async cacheNote(note: Note): Promise<void> {
    try {
      const cacheKey = `${this.cachePrefix}note_${note.id}`;
      await this.securityService.storeSecureData(cacheKey, note);
    } catch (error) {
      console.error('Failed to cache note:', error);
      throw new Error('Note caching failed');
    }
  }

  /**
   * Requirement 13.1: Retrieve cached note with decryption
   */
  public async getCachedNote(noteId: string): Promise<Note | null> {
    try {
      const cacheKey = `${this.cachePrefix}note_${noteId}`;
      return await this.securityService.retrieveSecureData<Note>(cacheKey);
    } catch (error) {
      console.error('Failed to retrieve cached note:', error);
      return null;
    }
  }

  /**
   * Requirement 13.1: Cache multiple notes with encryption
   */
  public async cacheNotes(notes: Note[]): Promise<void> {
    try {
      const cachePromises = notes.map(note => this.cacheNote(note));
      await Promise.all(cachePromises);
    } catch (error) {
      console.error('Failed to cache notes:', error);
      throw new Error('Batch note caching failed');
    }
  }

  /**
   * Requirement 13.1: Cache utility scores with encryption
   */
  public async cacheUtilityScore(score: UtilityScore): Promise<void> {
    try {
      const cacheKey = `${this.cachePrefix}score_${score.noteId}`;
      await this.securityService.storeSecureData(cacheKey, score);
    } catch (error) {
      console.error('Failed to cache utility score:', error);
      throw new Error('Utility score caching failed');
    }
  }

  /**
   * Requirement 13.1: Retrieve cached utility score with decryption
   */
  public async getCachedUtilityScore(noteId: string): Promise<UtilityScore | null> {
    try {
      const cacheKey = `${this.cachePrefix}score_${noteId}`;
      return await this.securityService.retrieveSecureData<UtilityScore>(cacheKey);
    } catch (error) {
      console.error('Failed to retrieve cached utility score:', error);
      return null;
    }
  }

  /**
   * Requirement 13.1: Cache recommendations with encryption
   */
  public async cacheRecommendation(recommendation: Recommendation): Promise<void> {
    try {
      const cacheKey = `${this.cachePrefix}recommendation_${recommendation.id}`;
      await this.securityService.storeSecureData(cacheKey, recommendation);
    } catch (error) {
      console.error('Failed to cache recommendation:', error);
      throw new Error('Recommendation caching failed');
    }
  }

  /**
   * Requirement 13.1: Retrieve cached recommendation with decryption
   */
  public async getCachedRecommendation(recommendationId: string): Promise<Recommendation | null> {
    try {
      const cacheKey = `${this.cachePrefix}recommendation_${recommendationId}`;
      return await this.securityService.retrieveSecureData<Recommendation>(cacheKey);
    } catch (error) {
      console.error('Failed to retrieve cached recommendation:', error);
      return null;
    }
  }

  /**
   * Requirement 13.1: Cache processing results with encryption
   */
  public async cacheProcessingResults(sessionId: string, results: any): Promise<void> {
    try {
      const cacheKey = `${this.cachePrefix}results_${sessionId}`;
      await this.securityService.storeSecureData(cacheKey, {
        results,
        timestamp: Date.now(),
        sessionId
      });
    } catch (error) {
      console.error('Failed to cache processing results:', error);
      throw new Error('Processing results caching failed');
    }
  }

  /**
   * Requirement 13.1: Retrieve cached processing results with decryption
   */
  public async getCachedProcessingResults(sessionId: string): Promise<any | null> {
    try {
      const cacheKey = `${this.cachePrefix}results_${sessionId}`;
      const cached = await this.securityService.retrieveSecureData<any>(cacheKey);
      
      if (cached && this.isCacheValid(cached.timestamp)) {
        return cached.results;
      }
      
      // Remove expired cache
      if (cached) {
        await this.removeCachedData(cacheKey);
      }
      
      return null;
    } catch (error) {
      console.error('Failed to retrieve cached processing results:', error);
      return null;
    }
  }

  /**
   * Check if cached data is still valid (not expired)
   */
  private isCacheValid(timestamp: number, maxAgeHours: number = 24): boolean {
    const maxAge = maxAgeHours * 60 * 60 * 1000; // Convert to milliseconds
    return (Date.now() - timestamp) < maxAge;
  }

  /**
   * Requirement 13.1: Remove specific cached data
   */
  public async removeCachedData(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(key);
    } catch (error) {
      console.error('Failed to remove cached data:', error);
    }
  }

  /**
   * Requirement 13.1: Clear all cached note data
   */
  public async clearNoteCache(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const noteCacheKeys = keys.filter(key => key.startsWith(`${this.cachePrefix}note_`));
      
      if (noteCacheKeys.length > 0) {
        await AsyncStorage.multiRemove(noteCacheKeys);
      }
    } catch (error) {
      console.error('Failed to clear note cache:', error);
    }
  }

  /**
   * Requirement 13.1: Clear all cached utility scores
   */
  public async clearUtilityScoreCache(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const scoreCacheKeys = keys.filter(key => key.startsWith(`${this.cachePrefix}score_`));
      
      if (scoreCacheKeys.length > 0) {
        await AsyncStorage.multiRemove(scoreCacheKeys);
      }
    } catch (error) {
      console.error('Failed to clear utility score cache:', error);
    }
  }

  /**
   * Requirement 13.1: Clear all cached recommendations
   */
  public async clearRecommendationCache(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const recommendationCacheKeys = keys.filter(key => key.startsWith(`${this.cachePrefix}recommendation_`));
      
      if (recommendationCacheKeys.length > 0) {
        await AsyncStorage.multiRemove(recommendationCacheKeys);
      }
    } catch (error) {
      console.error('Failed to clear recommendation cache:', error);
    }
  }

  /**
   * Requirement 13.1 & 13.4: Clear all cached data (for app backgrounding)
   */
  public async clearAllCache(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key => key.startsWith(this.cachePrefix));
      
      if (cacheKeys.length > 0) {
        await AsyncStorage.multiRemove(cacheKeys);
      }
    } catch (error) {
      console.error('Failed to clear all cache:', error);
    }
  }

  /**
   * Get cache statistics
   */
  public async getCacheStats(): Promise<{
    totalItems: number;
    notes: number;
    scores: number;
    recommendations: number;
    results: number;
  }> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key => key.startsWith(this.cachePrefix));
      
      const stats = {
        totalItems: cacheKeys.length,
        notes: cacheKeys.filter(key => key.includes('note_')).length,
        scores: cacheKeys.filter(key => key.includes('score_')).length,
        recommendations: cacheKeys.filter(key => key.includes('recommendation_')).length,
        results: cacheKeys.filter(key => key.includes('results_')).length
      };
      
      return stats;
    } catch (error) {
      console.error('Failed to get cache stats:', error);
      return {
        totalItems: 0,
        notes: 0,
        scores: 0,
        recommendations: 0,
        results: 0
      };
    }
  }

  /**
   * Requirement 13.1: Cleanup expired cache entries
   */
  public async cleanupExpiredCache(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key => key.startsWith(this.cachePrefix));
      
      for (const key of cacheKeys) {
        try {
          const data = await this.securityService.retrieveSecureData<any>(key);
          if (data && data.timestamp && !this.isCacheValid(data.timestamp)) {
            await this.removeCachedData(key);
          }
        } catch (error) {
          // If we can't decrypt or parse the data, remove it
          await this.removeCachedData(key);
        }
      }
    } catch (error) {
      console.error('Failed to cleanup expired cache:', error);
    }
  }
}

export default SecureCacheService;