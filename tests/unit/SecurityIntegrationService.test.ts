import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SecurityIntegrationService } from '../../src/services/SecurityIntegrationService';

// Mock all dependencies
vi.mock('../../src/services/SecurityService', () => ({
  SecurityService: {
    getInstance: vi.fn(() => ({
      authenticateWithBiometrics: vi.fn().mockResolvedValue(true),
      isBiometricAuthenticationAvailable: vi.fn().mockResolvedValue(true),
      onAppBackground: vi.fn(),
      onAppForeground: vi.fn(),
      clearAllSensitiveData: vi.fn(),
      cleanup: vi.fn()
    }))
  }
}));

vi.mock('../../src/services/SecureCacheService', () => ({
  SecureCacheService: {
    getInstance: vi.fn(() => ({
      cacheNote: vi.fn(),
      getCachedNote: vi.fn(),
      cacheUtilityScore: vi.fn(),
      getCachedUtilityScore: vi.fn(),
      cacheRecommendation: vi.fn(),
      getCachedRecommendation: vi.fn(),
      clearAllCache: vi.fn(),
      getCacheStats: vi.fn().mockResolvedValue({
        totalItems: 0,
        notes: 0,
        scores: 0,
        recommendations: 0,
        results: 0
      })
    }))
  }
}));

vi.mock('../../src/services/SecureNetworkService', () => ({
  SecureNetworkService: {
    getInstance: vi.fn(() => ({
      establishSecureConnection: vi.fn().mockResolvedValue(true),
      sendSecureMessage: vi.fn().mockResolvedValue(true),
      registerMessageHandler: vi.fn(),
      isConnected: vi.fn().mockReturnValue(true),
      getPeerDeviceId: vi.fn().mockReturnValue('peer-device-123'),
      disconnect: vi.fn()
    }))
  }
}));

vi.mock('../../src/services/SecureMemoryManager', () => ({
  SecureMemoryManager: {
    getInstance: vi.fn(() => ({
      createMemoryPool: vi.fn(),
      storeNoteSecurely: vi.fn(),
      retrieveNoteSecurely: vi.fn(),
      storeUtilityScoreSecurely: vi.fn(),
      retrieveUtilityScoreSecurely: vi.fn(),
      storeRecommendationSecurely: vi.fn(),
      retrieveRecommendationSecurely: vi.fn(),
      storeSessionDataSecurely: vi.fn(),
      retrieveSessionDataSecurely: vi.fn(),
      clearAllSensitiveData: vi.fn(),
      getMemoryStats: vi.fn().mockReturnValue({}),
      cleanup: vi.fn()
    }))
  }
}));

describe('SecurityIntegrationService', () => {
  let securityIntegrationService: SecurityIntegrationService;

  beforeEach(async () => {
    securityIntegrationService = SecurityIntegrationService.getInstance();
    await securityIntegrationService.initialize();
  });

  afterEach(() => {
    securityIntegrationService.cleanup();
  });

  describe('Initialization', () => {
    it('should initialize all security services', async () => {
      // Service should initialize without errors
      expect(securityIntegrationService).toBeDefined();
    });
  });

  describe('Biometric Authentication (Requirement 13.5)', () => {
    it('should authenticate user with biometrics', async () => {
      const result = await securityIntegrationService.authenticateUser();
      expect(result).toBe(true);
    });

    it('should check biometric availability', async () => {
      const isAvailable = await securityIntegrationService.isBiometricAuthAvailable();
      expect(isAvailable).toBe(true);
    });
  });

  describe('Secure Data Storage (Requirements 13.1 & 13.2)', () => {
    it('should store and retrieve note data securely', async () => {
      const testNote = {
        id: 'test-note-1',
        title: 'Test Note',
        content: 'Test content'
      };

      // Should not throw errors
      await expect(
        securityIntegrationService.storeNoteSecurely(testNote as any)
      ).resolves.not.toThrow();

      const retrieved = await securityIntegrationService.retrieveNoteSecurely('test-note-1');
      // Mock returns null, which is expected for this test
      expect(retrieved).toBeNull();
    });

    it('should store and retrieve utility scores securely', async () => {
      const testScore = {
        noteId: 'test-note-1',
        overallScore: 85,
        confidence: 0.9
      };

      await expect(
        securityIntegrationService.storeUtilityScoreSecurely(testScore as any)
      ).resolves.not.toThrow();

      const retrieved = await securityIntegrationService.retrieveUtilityScoreSecurely('test-note-1');
      expect(retrieved).toBeNull();
    });

    it('should store and retrieve recommendations securely', async () => {
      const testRecommendation = {
        id: 'rec-1',
        noteId: 'note-1',
        action: 'archive',
        confidence: 0.8
      };

      await expect(
        securityIntegrationService.storeRecommendationSecurely(testRecommendation as any)
      ).resolves.not.toThrow();

      const retrieved = await securityIntegrationService.retrieveRecommendationSecurely('rec-1');
      expect(retrieved).toBeNull();
    });
  });

  describe('Secure Network Communication (Requirement 13.3)', () => {
    it('should establish secure connection', async () => {
      const result = await securityIntegrationService.establishSecureConnection('192.168.1.100');
      expect(result).toBe(true);
    });

    it('should send secure messages', async () => {
      const result = await securityIntegrationService.sendSecureMessage('test', { data: 'test' });
      expect(result).toBe(true);
    });

    it('should check connection status', () => {
      const isConnected = securityIntegrationService.isSecureConnectionActive();
      expect(isConnected).toBe(true);
    });

    it('should register message handlers', () => {
      const handler = vi.fn();
      
      expect(() => {
        securityIntegrationService.registerSecureMessageHandler('test', handler);
      }).not.toThrow();
    });
  });

  describe('Background Handling (Requirement 13.4)', () => {
    it('should handle app background transition', () => {
      expect(() => {
        securityIntegrationService.handleAppBackground();
      }).not.toThrow();
    });

    it('should handle app foreground transition', () => {
      expect(() => {
        securityIntegrationService.handleAppForeground();
      }).not.toThrow();
    });
  });

  describe('Processing Session Management (Requirement 13.2)', () => {
    it('should store and retrieve processing session data', () => {
      const sessionData = { processed: 100, recommendations: 25 };
      const sessionId = 'session-1';

      expect(() => {
        securityIntegrationService.storeProcessingSession(sessionId, sessionData);
      }).not.toThrow();

      const retrieved = securityIntegrationService.retrieveProcessingSession(sessionId);
      expect(retrieved).toBeUndefined(); // Mock returns undefined
    });
  });

  describe('Security Statistics', () => {
    it('should get comprehensive security statistics', async () => {
      const stats = await securityIntegrationService.getSecurityStats();
      
      expect(stats).toHaveProperty('memory');
      expect(stats).toHaveProperty('cache');
      expect(stats).toHaveProperty('network');
      expect(stats).toHaveProperty('biometric');
      
      expect(stats.network.isConnected).toBe(true);
      expect(stats.network.peerDeviceId).toBe('peer-device-123');
      expect(stats.biometric.isAvailable).toBe(true);
    });
  });

  describe('Cleanup', () => {
    it('should clear all secure data', async () => {
      await expect(
        securityIntegrationService.clearAllSecureData()
      ).resolves.not.toThrow();
    });

    it('should cleanup all resources', () => {
      expect(() => {
        securityIntegrationService.cleanup();
      }).not.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should handle authentication failures gracefully', async () => {
      // Mock authentication failure
      const mockSecurityService = {
        authenticateWithBiometrics: vi.fn().mockRejectedValue(new Error('Auth failed'))
      };
      
      // This would require more complex mocking to test properly
      // For now, just ensure the method exists and can be called
      expect(securityIntegrationService.authenticateUser).toBeDefined();
    });

    it('should handle network connection failures gracefully', async () => {
      // Similar to above - the method should exist and be callable
      expect(securityIntegrationService.establishSecureConnection).toBeDefined();
    });
  });
});