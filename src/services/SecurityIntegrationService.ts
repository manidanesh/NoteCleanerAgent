import { SecurityService } from './SecurityService';
import { SecureCacheService } from './SecureCacheService';
import { SecureNetworkService } from './SecureNetworkService';
import { SecureMemoryManager } from './SecureMemoryManager';
import { Note } from '../models/Note';
import { UtilityScore } from '../models/UtilityScore';
import { Recommendation } from '../models/Recommendation';

/**
 * SecurityIntegrationService coordinates all security services
 * Implements requirements 13.1-13.5 for comprehensive security and privacy
 */
export class SecurityIntegrationService {
  private static instance: SecurityIntegrationService;
  private securityService: SecurityService;
  private cacheService: SecureCacheService;
  private networkService: SecureNetworkService;
  private memoryManager: SecureMemoryManager;
  private isInitialized = false;

  private constructor() {
    this.securityService = SecurityService.getInstance();
    this.cacheService = SecureCacheService.getInstance();
    this.networkService = SecureNetworkService.getInstance();
    this.memoryManager = SecureMemoryManager.getInstance();
  }

  public static getInstance(): SecurityIntegrationService {
    if (!SecurityIntegrationService.instance) {
      SecurityIntegrationService.instance = new SecurityIntegrationService();
    }
    return SecurityIntegrationService.instance;
  }

  /**
   * Initialize all security services
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Initialize memory pools for different data types
      this.memoryManager.createMemoryPool('notes', 1000, 300);
      this.memoryManager.createMemoryPool('utility_scores', 1000, 300);
      this.memoryManager.createMemoryPool('recommendations', 500, 300);
      this.memoryManager.createMemoryPool('processing_sessions', 50, 600);
      this.memoryManager.createMemoryPool('network_sessions', 10, 1800);

      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize security services:', error);
      throw new Error('Security initialization failed');
    }
  }

  /**
   * Requirement 13.5: Authenticate user with biometrics
   */
  public async authenticateUser(): Promise<boolean> {
    try {
      return await this.securityService.authenticateWithBiometrics();
    } catch (error) {
      console.error('User authentication failed:', error);
      return false;
    }
  }

  /**
   * Requirement 13.5: Check if biometric authentication is available
   */
  public async isBiometricAuthAvailable(): Promise<boolean> {
    return await this.securityService.isBiometricAuthenticationAvailable();
  }

  /**
   * Requirement 13.1 & 13.2: Securely store note data
   */
  public async storeNoteSecurely(note: Note, useCache: boolean = true, useMemory: boolean = true): Promise<void> {
    try {
      // Store in secure memory for fast access
      if (useMemory) {
        this.memoryManager.storeNoteSecurely(note, 300);
      }

      // Store in encrypted cache for persistence
      if (useCache) {
        await this.cacheService.cacheNote(note);
      }
    } catch (error) {
      console.error('Failed to store note securely:', error);
      throw new Error('Secure note storage failed');
    }
  }

  /**
   * Requirement 13.1 & 13.2: Securely retrieve note data
   */
  public async retrieveNoteSecurely(noteId: string): Promise<Note | null> {
    try {
      // Try memory first (fastest)
      let note = this.memoryManager.retrieveNoteSecurely(noteId);
      if (note) {
        return note;
      }

      // Try cache if not in memory
      note = await this.cacheService.getCachedNote(noteId);
      if (note) {
        // Store back in memory for future access
        this.memoryManager.storeNoteSecurely(note, 300);
        return note;
      }

      return null;
    } catch (error) {
      console.error('Failed to retrieve note securely:', error);
      return null;
    }
  }

  /**
   * Requirement 13.1 & 13.2: Securely store utility score
   */
  public async storeUtilityScoreSecurely(score: UtilityScore, useCache: boolean = true, useMemory: boolean = true): Promise<void> {
    try {
      if (useMemory) {
        this.memoryManager.storeUtilityScoreSecurely(score, 300);
      }

      if (useCache) {
        await this.cacheService.cacheUtilityScore(score);
      }
    } catch (error) {
      console.error('Failed to store utility score securely:', error);
      throw new Error('Secure utility score storage failed');
    }
  }

  /**
   * Requirement 13.1 & 13.2: Securely retrieve utility score
   */
  public async retrieveUtilityScoreSecurely(noteId: string): Promise<UtilityScore | null> {
    try {
      // Try memory first
      let score = this.memoryManager.retrieveUtilityScoreSecurely(noteId);
      if (score) {
        return score;
      }

      // Try cache if not in memory
      score = await this.cacheService.getCachedUtilityScore(noteId);
      if (score) {
        this.memoryManager.storeUtilityScoreSecurely(score, 300);
        return score;
      }

      return null;
    } catch (error) {
      console.error('Failed to retrieve utility score securely:', error);
      return null;
    }
  }

  /**
   * Requirement 13.1 & 13.2: Securely store recommendation
   */
  public async storeRecommendationSecurely(recommendation: Recommendation, useCache: boolean = true, useMemory: boolean = true): Promise<void> {
    try {
      if (useMemory) {
        this.memoryManager.storeRecommendationSecurely(recommendation, 300);
      }

      if (useCache) {
        await this.cacheService.cacheRecommendation(recommendation);
      }
    } catch (error) {
      console.error('Failed to store recommendation securely:', error);
      throw new Error('Secure recommendation storage failed');
    }
  }

  /**
   * Requirement 13.1 & 13.2: Securely retrieve recommendation
   */
  public async retrieveRecommendationSecurely(recommendationId: string): Promise<Recommendation | null> {
    try {
      // Try memory first
      let recommendation = this.memoryManager.retrieveRecommendationSecurely(recommendationId);
      if (recommendation) {
        return recommendation;
      }

      // Try cache if not in memory
      recommendation = await this.cacheService.getCachedRecommendation(recommendationId);
      if (recommendation) {
        this.memoryManager.storeRecommendationSecurely(recommendation, 300);
        return recommendation;
      }

      return null;
    } catch (error) {
      console.error('Failed to retrieve recommendation securely:', error);
      return null;
    }
  }

  /**
   * Requirement 13.3: Establish secure connection with peer device
   */
  public async establishSecureConnection(peerAddress: string, port?: number): Promise<boolean> {
    try {
      return await this.networkService.establishSecureConnection(peerAddress, port);
    } catch (error) {
      console.error('Failed to establish secure connection:', error);
      return false;
    }
  }

  /**
   * Requirement 13.3: Send secure message to peer device
   */
  public async sendSecureMessage(type: string, data: any): Promise<boolean> {
    try {
      return await this.networkService.sendSecureMessage(type, data);
    } catch (error) {
      console.error('Failed to send secure message:', error);
      return false;
    }
  }

  /**
   * Requirement 13.3: Register handler for incoming secure messages
   */
  public registerSecureMessageHandler(type: string, handler: (data: any) => void): void {
    this.networkService.registerMessageHandler(type, handler);
  }

  /**
   * Requirement 13.3: Check if secure connection is active
   */
  public isSecureConnectionActive(): boolean {
    return this.networkService.isConnected();
  }

  /**
   * Requirement 13.4: Handle app going to background
   */
  public handleAppBackground(): void {
    // Clear sensitive data from memory
    this.memoryManager.clearAllSensitiveData();
    this.securityService.onAppBackground();
  }

  /**
   * Requirement 13.4: Handle app coming to foreground
   */
  public handleAppForeground(): void {
    this.securityService.onAppForeground();
  }

  /**
   * Requirement 13.2: Store processing session data securely
   */
  public storeProcessingSession(sessionId: string, data: any, ttlSeconds: number = 600): void {
    this.memoryManager.storeSessionDataSecurely(sessionId, data, ttlSeconds);
  }

  /**
   * Requirement 13.2: Retrieve processing session data securely
   */
  public retrieveProcessingSession(sessionId: string): any | null {
    return this.memoryManager.retrieveSessionDataSecurely(sessionId);
  }

  /**
   * Clear all cached and memory data
   */
  public async clearAllSecureData(): Promise<void> {
    try {
      // Clear memory
      this.memoryManager.clearAllSensitiveData();
      
      // Clear cache
      await this.cacheService.clearAllCache();
      
      // Clear security service data
      this.securityService.clearAllSensitiveData();
    } catch (error) {
      console.error('Failed to clear all secure data:', error);
    }
  }

  /**
   * Get comprehensive security statistics
   */
  public async getSecurityStats(): Promise<SecurityStats> {
    try {
      const memoryStats = this.memoryManager.getMemoryStats();
      const cacheStats = await this.cacheService.getCacheStats();
      
      return {
        memory: memoryStats,
        cache: cacheStats,
        network: {
          isConnected: this.networkService.isConnected(),
          peerDeviceId: this.networkService.getPeerDeviceId()
        },
        biometric: {
          isAvailable: await this.securityService.isBiometricAuthenticationAvailable()
        }
      };
    } catch (error) {
      console.error('Failed to get security stats:', error);
      return {
        memory: {},
        cache: { totalItems: 0, notes: 0, scores: 0, recommendations: 0, results: 0 },
        network: { isConnected: false, peerDeviceId: null },
        biometric: { isAvailable: false }
      };
    }
  }

  /**
   * Cleanup all security services
   */
  public cleanup(): void {
    try {
      this.memoryManager.cleanup();
      this.networkService.disconnect();
      this.securityService.cleanup();
      this.isInitialized = false;
    } catch (error) {
      console.error('Failed to cleanup security services:', error);
    }
  }
}

/**
 * Security statistics interface
 */
interface SecurityStats {
  memory: { [poolId: string]: any };
  cache: {
    totalItems: number;
    notes: number;
    scores: number;
    recommendations: number;
    results: number;
  };
  network: {
    isConnected: boolean;
    peerDeviceId: string | null;
  };
  biometric: {
    isAvailable: boolean;
  };
}

export default SecurityIntegrationService;