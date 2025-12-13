import { SecurityService } from './SecurityService';
import { Note } from '../models/Note';
import { UtilityScore } from '../models/UtilityScore';
import { Recommendation } from '../models/Recommendation';

/**
 * SecureMemoryManager implements requirement 13.2 for secure memory management
 * to prevent data leaks and ensure sensitive data is properly cleared
 */
export class SecureMemoryManager {
  private static instance: SecureMemoryManager;
  private securityService: SecurityService;
  private memoryPools: Map<string, MemoryPool> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  private constructor() {
    this.securityService = SecurityService.getInstance();
    this.startPeriodicCleanup();
  }

  public static getInstance(): SecureMemoryManager {
    if (!SecureMemoryManager.instance) {
      SecureMemoryManager.instance = new SecureMemoryManager();
    }
    return SecureMemoryManager.instance;
  }

  /**
   * Requirement 13.2: Create secure memory pool for sensitive data
   */
  public createMemoryPool(poolId: string, maxSize: number = 100, ttlSeconds: number = 300): void {
    if (this.memoryPools.has(poolId)) {
      throw new Error(`Memory pool ${poolId} already exists`);
    }

    const pool = new MemoryPool(poolId, maxSize, ttlSeconds);
    this.memoryPools.set(poolId, pool);
  }

  /**
   * Requirement 13.2: Store sensitive data in secure memory pool
   */
  public storeInPool<T>(poolId: string, key: string, data: T, ttlSeconds?: number): void {
    const pool = this.memoryPools.get(poolId);
    if (!pool) {
      throw new Error(`Memory pool ${poolId} not found`);
    }

    pool.store(key, data, ttlSeconds);
  }

  /**
   * Requirement 13.2: Retrieve data from secure memory pool
   */
  public retrieveFromPool<T>(poolId: string, key: string): T | null {
    const pool = this.memoryPools.get(poolId);
    if (!pool) {
      return null;
    }

    return pool.retrieve<T>(key);
  }

  /**
   * Requirement 13.2: Remove specific data from memory pool
   */
  public removeFromPool(poolId: string, key: string): void {
    const pool = this.memoryPools.get(poolId);
    if (pool) {
      pool.remove(key);
    }
  }

  /**
   * Requirement 13.2: Clear entire memory pool
   */
  public clearPool(poolId: string): void {
    const pool = this.memoryPools.get(poolId);
    if (pool) {
      pool.clear();
    }
  }

  /**
   * Requirement 13.2: Store note data securely in memory
   */
  public storeNoteSecurely(note: Note, ttlSeconds: number = 300): void {
    const poolId = 'notes';
    if (!this.memoryPools.has(poolId)) {
      this.createMemoryPool(poolId, 1000, ttlSeconds);
    }

    this.storeInPool(poolId, note.id, note, ttlSeconds);
  }

  /**
   * Requirement 13.2: Retrieve note data from secure memory
   */
  public retrieveNoteSecurely(noteId: string): Note | null {
    return this.retrieveFromPool<Note>('notes', noteId);
  }

  /**
   * Requirement 13.2: Store utility score securely in memory
   */
  public storeUtilityScoreSecurely(score: UtilityScore, ttlSeconds: number = 300): void {
    const poolId = 'utility_scores';
    if (!this.memoryPools.has(poolId)) {
      this.createMemoryPool(poolId, 1000, ttlSeconds);
    }

    this.storeInPool(poolId, score.noteId, score, ttlSeconds);
  }

  /**
   * Requirement 13.2: Retrieve utility score from secure memory
   */
  public retrieveUtilityScoreSecurely(noteId: string): UtilityScore | null {
    return this.retrieveFromPool<UtilityScore>('utility_scores', noteId);
  }

  /**
   * Requirement 13.2: Store recommendation securely in memory
   */
  public storeRecommendationSecurely(recommendation: Recommendation, ttlSeconds: number = 300): void {
    const poolId = 'recommendations';
    if (!this.memoryPools.has(poolId)) {
      this.createMemoryPool(poolId, 500, ttlSeconds);
    }

    this.storeInPool(poolId, recommendation.id, recommendation, ttlSeconds);
  }

  /**
   * Requirement 13.2: Retrieve recommendation from secure memory
   */
  public retrieveRecommendationSecurely(recommendationId: string): Recommendation | null {
    return this.retrieveFromPool<Recommendation>('recommendations', recommendationId);
  }

  /**
   * Requirement 13.2: Store processing session data securely
   */
  public storeSessionDataSecurely(sessionId: string, data: any, ttlSeconds: number = 600): void {
    const poolId = 'sessions';
    if (!this.memoryPools.has(poolId)) {
      this.createMemoryPool(poolId, 50, ttlSeconds);
    }

    this.storeInPool(poolId, sessionId, data, ttlSeconds);
  }

  /**
   * Requirement 13.2: Retrieve processing session data from secure memory
   */
  public retrieveSessionDataSecurely(sessionId: string): any | null {
    return this.retrieveFromPool<any>('sessions', sessionId);
  }

  /**
   * Requirement 13.2: Clear all sensitive data from memory (for app backgrounding)
   */
  public clearAllSensitiveData(): void {
    this.memoryPools.forEach((pool, poolId) => {
      pool.clear();
    });
  }

  /**
   * Requirement 13.2: Start periodic cleanup of expired data
   */
  private startPeriodicCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      this.performCleanup();
    }, 60000); // Cleanup every minute
  }

  /**
   * Requirement 13.2: Perform cleanup of expired data
   */
  private performCleanup(): void {
    this.memoryPools.forEach((pool, poolId) => {
      pool.cleanup();
    });
  }

  /**
   * Get memory usage statistics
   */
  public getMemoryStats(): { [poolId: string]: MemoryPoolStats } {
    const stats: { [poolId: string]: MemoryPoolStats } = {};
    
    this.memoryPools.forEach((pool, poolId) => {
      stats[poolId] = pool.getStats();
    });
    
    return stats;
  }

  /**
   * Cleanup all resources
   */
  public cleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    
    this.clearAllSensitiveData();
    this.memoryPools.clear();
  }
}

/**
 * Secure memory pool for storing sensitive data with automatic cleanup
 */
class MemoryPool {
  private data: Map<string, MemoryItem> = new Map();
  private maxSize: number;
  private defaultTtl: number;

  constructor(
    public readonly id: string,
    maxSize: number = 100,
    defaultTtlSeconds: number = 300
  ) {
    this.maxSize = maxSize;
    this.defaultTtl = defaultTtlSeconds * 1000; // Convert to milliseconds
  }

  /**
   * Store data in the memory pool with TTL
   */
  store<T>(key: string, data: T, ttlSeconds?: number): void {
    // Remove existing data if present
    if (this.data.has(key)) {
      this.remove(key);
    }

    // Check if pool is at capacity
    if (this.data.size >= this.maxSize) {
      this.evictOldest();
    }

    const ttl = ttlSeconds ? ttlSeconds * 1000 : this.defaultTtl;
    const item: MemoryItem = {
      data,
      timestamp: Date.now(),
      ttl,
      accessed: Date.now()
    };

    this.data.set(key, item);
  }

  /**
   * Retrieve data from the memory pool
   */
  retrieve<T>(key: string): T | null {
    const item = this.data.get(key);
    if (!item) {
      return null;
    }

    // Check if item has expired
    if (Date.now() - item.timestamp > item.ttl) {
      this.remove(key);
      return null;
    }

    // Update access time
    item.accessed = Date.now();
    return item.data as T;
  }

  /**
   * Remove data from the memory pool with secure overwriting
   */
  remove(key: string): void {
    const item = this.data.get(key);
    if (item) {
      // Securely overwrite the data before removal
      this.secureOverwrite(item.data);
      this.data.delete(key);
    }
  }

  /**
   * Clear all data from the memory pool
   */
  clear(): void {
    this.data.forEach((item, key) => {
      this.secureOverwrite(item.data);
    });
    this.data.clear();
  }

  /**
   * Cleanup expired items
   */
  cleanup(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    this.data.forEach((item, key) => {
      if (now - item.timestamp > item.ttl) {
        expiredKeys.push(key);
      }
    });

    expiredKeys.forEach(key => this.remove(key));
  }

  /**
   * Evict oldest item when pool is at capacity
   */
  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Date.now();

    this.data.forEach((item, key) => {
      if (item.accessed < oldestTime) {
        oldestTime = item.accessed;
        oldestKey = key;
      }
    });

    if (oldestKey) {
      this.remove(oldestKey);
    }
  }

  /**
   * Securely overwrite data in memory
   */
  private secureOverwrite(data: any): void {
    if (data && typeof data === 'object') {
      for (const key in data) {
        if (data.hasOwnProperty(key)) {
          if (typeof data[key] === 'string') {
            // Overwrite string with random data
            data[key] = this.generateRandomString(data[key].length);
          } else if (typeof data[key] === 'object') {
            this.secureOverwrite(data[key]);
          } else {
            data[key] = null;
          }
        }
      }
    }
  }

  /**
   * Generate random string for overwriting
   */
  private generateRandomString(length: number): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Get memory pool statistics
   */
  getStats(): MemoryPoolStats {
    return {
      id: this.id,
      size: this.data.size,
      maxSize: this.maxSize,
      defaultTtl: this.defaultTtl / 1000, // Convert back to seconds
      oldestItem: this.getOldestItemAge(),
      newestItem: this.getNewestItemAge()
    };
  }

  /**
   * Get age of oldest item in seconds
   */
  private getOldestItemAge(): number {
    let oldest = 0;
    const now = Date.now();

    this.data.forEach((item) => {
      const age = (now - item.timestamp) / 1000;
      if (age > oldest) {
        oldest = age;
      }
    });

    return oldest;
  }

  /**
   * Get age of newest item in seconds
   */
  private getNewestItemAge(): number {
    let newest = Number.MAX_SAFE_INTEGER;
    const now = Date.now();

    this.data.forEach((item) => {
      const age = (now - item.timestamp) / 1000;
      if (age < newest) {
        newest = age;
      }
    });

    return newest === Number.MAX_SAFE_INTEGER ? 0 : newest;
  }
}

/**
 * Memory item stored in the pool
 */
interface MemoryItem {
  data: any;
  timestamp: number;
  ttl: number;
  accessed: number;
}

/**
 * Memory pool statistics
 */
interface MemoryPoolStats {
  id: string;
  size: number;
  maxSize: number;
  defaultTtl: number;
  oldestItem: number;
  newestItem: number;
}

export default SecureMemoryManager;