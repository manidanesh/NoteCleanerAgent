import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SecurityService } from '../../src/services/SecurityService';

// Mock dependencies
vi.mock('react-native', () => ({
  Platform: { OS: 'ios' }
}));

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    multiRemove: vi.fn(),
    getAllKeys: vi.fn()
  }
}));

vi.mock('react-native-touch-id', () => ({
  default: {
    isSupported: vi.fn(),
    authenticate: vi.fn()
  }
}));

vi.mock('react-native-background-timer', () => ({
  default: {
    setInterval: vi.fn(),
    clearInterval: vi.fn()
  }
}));

describe('SecurityService', () => {
  let securityService: SecurityService;

  beforeEach(() => {
    securityService = SecurityService.getInstance();
  });

  afterEach(() => {
    securityService.cleanup();
  });

  describe('Data Encryption (Requirement 13.1)', () => {
    it('should encrypt and decrypt data correctly', () => {
      const testData = { message: 'test data', number: 123 };
      
      const encrypted = securityService.encryptData(testData);
      expect(encrypted).toBeDefined();
      expect(typeof encrypted).toBe('string');
      expect(encrypted).not.toContain('test data');

      const decrypted = securityService.decryptData(encrypted);
      expect(decrypted).toEqual(testData);
    });

    it('should handle encryption of different data types', () => {
      const testCases = [
        'simple string',
        { complex: { nested: { object: 'value' } } },
        [1, 2, 3, 'array'],
        null,
        undefined,
        123,
        true
      ];

      testCases.forEach(testData => {
        const encrypted = securityService.encryptData(testData);
        const decrypted = securityService.decryptData(encrypted);
        expect(decrypted).toEqual(testData);
      });
    });

    it('should throw error when encrypting without initialization', () => {
      // Create a new instance that hasn't been initialized
      const uninitializedService = Object.create(SecurityService.prototype);
      
      expect(() => {
        uninitializedService.encryptData('test');
      }).toThrow('Encryption not initialized');
    });
  });

  describe('Secure Memory Management (Requirement 13.2)', () => {
    it('should store and retrieve sensitive data from memory', () => {
      const testData = { sensitive: 'information' };
      const key = 'test-key';

      securityService.storeSensitiveData(key, testData, 10);
      const retrieved = securityService.getSensitiveData(key);
      
      expect(retrieved).toEqual(testData);
    });

    it('should automatically expire sensitive data after TTL', async () => {
      const testData = { sensitive: 'information' };
      const key = 'test-key';

      securityService.storeSensitiveData(key, testData, 0.1); // 0.1 seconds TTL
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 150));
      
      const retrieved = securityService.getSensitiveData(key);
      expect(retrieved).toBeNull();
    });

    it('should clear sensitive data on demand', () => {
      const testData = { sensitive: 'information' };
      const key = 'test-key';

      securityService.storeSensitiveData(key, testData, 10);
      expect(securityService.getSensitiveData(key)).toEqual(testData);

      securityService.clearSensitiveData(key);
      expect(securityService.getSensitiveData(key)).toBeNull();
    });

    it('should clear all sensitive data', () => {
      const testData1 = { sensitive: 'information1' };
      const testData2 = { sensitive: 'information2' };

      securityService.storeSensitiveData('key1', testData1, 10);
      securityService.storeSensitiveData('key2', testData2, 10);

      expect(securityService.getSensitiveData('key1')).toEqual(testData1);
      expect(securityService.getSensitiveData('key2')).toEqual(testData2);

      securityService.clearAllSensitiveData();

      expect(securityService.getSensitiveData('key1')).toBeNull();
      expect(securityService.getSensitiveData('key2')).toBeNull();
    });
  });

  describe('Background Handling (Requirement 13.4)', () => {
    it('should clear sensitive data when app goes to background', () => {
      const testData = { sensitive: 'information' };
      const key = 'test-key';

      securityService.storeSensitiveData(key, testData, 10);
      expect(securityService.getSensitiveData(key)).toEqual(testData);

      securityService.onAppBackground();
      expect(securityService.getSensitiveData(key)).toBeNull();
    });

    it('should handle app foreground transition', () => {
      // This should not throw any errors
      expect(() => {
        securityService.onAppForeground();
      }).not.toThrow();
    });
  });

  describe('Biometric Authentication (Requirement 13.5)', () => {
    it('should check biometric availability', async () => {
      const TouchID = await import('react-native-touch-id');
      TouchID.default.isSupported = vi.fn().mockResolvedValue('TouchID');

      const isAvailable = await securityService.isBiometricAuthenticationAvailable();
      expect(isAvailable).toBe(true);
    });

    it('should handle biometric authentication success', async () => {
      const TouchID = await import('react-native-touch-id');
      TouchID.default.isSupported = vi.fn().mockResolvedValue('TouchID');
      TouchID.default.authenticate = vi.fn().mockResolvedValue(true);

      const result = await securityService.authenticateWithBiometrics();
      expect(result).toBe(true);
    });

    it('should handle biometric authentication failure', async () => {
      const TouchID = await import('react-native-touch-id');
      TouchID.default.isSupported = vi.fn().mockResolvedValue('TouchID');
      TouchID.default.authenticate = vi.fn().mockRejectedValue(new Error('Authentication failed'));

      const result = await securityService.authenticateWithBiometrics();
      expect(result).toBe(false);
    });

    it('should handle unavailable biometric authentication', async () => {
      const TouchID = await import('react-native-touch-id');
      TouchID.default.isSupported = vi.fn().mockResolvedValue(false);

      const isAvailable = await securityService.isBiometricAuthenticationAvailable();
      expect(isAvailable).toBe(false);

      const result = await securityService.authenticateWithBiometrics();
      expect(result).toBe(false);
    });
  });

  describe('Cleanup', () => {
    it('should cleanup resources properly', () => {
      const testData = { sensitive: 'information' };
      securityService.storeSensitiveData('test-key', testData, 10);

      expect(() => {
        securityService.cleanup();
      }).not.toThrow();

      // Data should be cleared after cleanup
      expect(securityService.getSensitiveData('test-key')).toBeNull();
    });
  });
});