import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DeviceSynchronizationService, PairingStatus, SyncStatus, SyncConflict, ProgressUpdate, SyncablePreferences } from '../../src/services/DeviceSynchronizationService';
import { SecureNetworkService } from '../../src/services/SecureNetworkService';
import { SecurityService } from '../../src/services/SecurityService';
import { OfflineOperationService } from '../../src/services/OfflineOperationService';
import { ErrorHandlingService } from '../../src/services/ErrorHandlingService';
import { SecureCacheService } from '../../src/services/SecureCacheService';

// Mock dependencies
vi.mock('../../src/services/SecureNetworkService');
vi.mock('../../src/services/SecurityService');
vi.mock('../../src/services/OfflineOperationService');
vi.mock('../../src/services/ErrorHandlingService');

describe('DeviceSynchronizationService', () => {
  let syncService: DeviceSynchronizationService;
  let mockNetworkService: any;
  let mockSecurityService: any;
  let mockOfflineService: any;
  let mockErrorService: any;

  beforeEach(() => {
    // Reset singleton instance to allow fresh mocks
    (DeviceSynchronizationService as any).instance = undefined;

    // Create mock instances
    mockNetworkService = {
      establishSecureConnection: vi.fn(),
      sendSecureMessage: vi.fn(),
      registerMessageHandler: vi.fn(),
      unregisterMessageHandler: vi.fn(),
      isConnected: vi.fn(),
      disconnect: vi.fn(),
      getPeerDeviceId: vi.fn()
    };

    mockSecurityService = {
      storeSecureData: vi.fn(),
      retrieveSecureData: vi.fn(),
      encryptData: vi.fn(),
      decryptData: vi.fn()
    };

    mockOfflineService = {
      queueOfflineOperation: vi.fn(),
      processQueuedOperations: vi.fn(),
      isSystemOnline: vi.fn()
    };

    mockErrorService = {
      handleProcessingFailure: vi.fn(),
      handleNetworkFailure: vi.fn()
    };

    // Create service instance
    syncService = DeviceSynchronizationService.getInstance(
      mockNetworkService,
      mockSecurityService,
      mockOfflineService,
      mockErrorService
    );
  });

  afterEach(() => {
    syncService.shutdown();
    vi.clearAllMocks();
  });

  describe('Device Pairing', () => {
    it('should successfully pair with a device', async () => {
      // Arrange
      mockNetworkService.establishSecureConnection.mockResolvedValue(true);
      mockNetworkService.sendSecureMessage.mockResolvedValue(true);
      mockNetworkService.isConnected.mockReturnValue(true);

      // Mock device info exchange
      const mockDeviceInfo = {
        id: 'test-device-123',
        name: 'Test MacBook',
        platform: 'macos' as const,
        version: '1.0.0',
        capabilities: ['sync', 'progress_updates'],
        lastSeen: new Date()
      };

      // Simulate successful message handling
      let messageHandler: ((data: any) => void) | null = null;
      mockNetworkService.registerMessageHandler.mockImplementation((type: string, handler: any) => {
        if (type === 'device_info_response') {
          messageHandler = handler;
          // Simulate immediate response
          setTimeout(() => handler(mockDeviceInfo), 10);
        }
        if (type === 'auth_response') {
          // Simulate auth response
          setTimeout(() => handler({ challenge: 'test-challenge' }), 10);
        }
      });

      // Act
      const result = await syncService.pairWithDevice('192.168.1.100', 'Test MacBook');

      // Assert
      expect(result).toBe(true);
      expect(syncService.getPairingStatus()).toBe(PairingStatus.PAIRED);
      expect(mockNetworkService.establishSecureConnection).toHaveBeenCalledWith('192.168.1.100');
      expect(mockNetworkService.sendSecureMessage).toHaveBeenCalled();
    });

    it('should fail pairing when network connection fails', async () => {
      // Arrange
      mockNetworkService.establishSecureConnection.mockResolvedValue(false);

      // Act
      const result = await syncService.pairWithDevice('192.168.1.100', 'Test MacBook');

      // Assert
      expect(result).toBe(false);
      expect(syncService.getPairingStatus()).toBe(PairingStatus.PAIRING_FAILED);
      expect(mockErrorService.handleProcessingFailure).toHaveBeenCalled();
    });

    it('should handle pairing timeout', async () => {
      // Arrange
      mockNetworkService.establishSecureConnection.mockResolvedValue(true);
      mockNetworkService.sendSecureMessage.mockResolvedValue(true);
      
      // Don't simulate any response (timeout scenario)
      mockNetworkService.registerMessageHandler.mockImplementation(() => {});

      // Act
      const result = await syncService.pairWithDevice('192.168.1.100', 'Test MacBook');

      // Assert
      expect(result).toBe(false);
      expect(syncService.getPairingStatus()).toBe(PairingStatus.PAIRING_FAILED);
    });
  });

  describe('Progress Updates', () => {
    it('should send progress updates to paired device', async () => {
      // Arrange
      const progressUpdate: ProgressUpdate = {
        taskId: 'task-123',
        taskType: 'note_processing',
        progress: 50,
        status: 'running',
        message: 'Processing notes...',
        timestamp: new Date()
      };

      // Mock paired state
      (syncService as any).pairingStatus = PairingStatus.PAIRED;
      mockNetworkService.isConnected.mockReturnValue(true);
      mockNetworkService.sendSecureMessage.mockResolvedValue(true);

      // Act
      await syncService.sendProgressUpdate(progressUpdate);

      // Assert
      expect(mockNetworkService.sendSecureMessage).toHaveBeenCalledWith('progress_update', progressUpdate);
      
      const updates = syncService.getProgressUpdates();
      expect(updates.get('task-123')).toEqual(progressUpdate);
    });

    it('should queue progress updates when offline', async () => {
      // Arrange
      const progressUpdate: ProgressUpdate = {
        taskId: 'task-456',
        taskType: 'duplicate_detection',
        progress: 75,
        status: 'running',
        timestamp: new Date()
      };

      // Mock offline state
      (syncService as any).pairingStatus = PairingStatus.NOT_PAIRED;
      mockNetworkService.isConnected.mockReturnValue(false);
      mockOfflineService.queueOfflineOperation.mockResolvedValue('op-123');

      // Act
      await syncService.sendProgressUpdate(progressUpdate);

      // Assert
      expect(mockOfflineService.queueOfflineOperation).toHaveBeenCalledWith(
        expect.any(String), // OfflineOperationType.PROCESSING_REQUEST
        { type: 'progress_update', update: progressUpdate },
        2 // High priority
      );
    });
  });

  describe('Preference Synchronization', () => {
    it('should sync preferences successfully', async () => {
      // Arrange
      const preferences: Partial<SyncablePreferences> = {
        utilityScoreThresholds: {
          high: 85,
          medium: 55,
          low: 25
        }
      };

      // Mock paired state
      (syncService as any).pairingStatus = PairingStatus.PAIRED;
      mockNetworkService.isConnected.mockReturnValue(true);
      mockNetworkService.sendSecureMessage.mockResolvedValue(true);
      mockSecurityService.storeSecureData.mockResolvedValue();

      // Act
      const result = await syncService.syncPreferences(preferences);

      // Assert
      expect(result).toBe(true);
      expect(mockSecurityService.storeSecureData).toHaveBeenCalledWith('sync_preferences', expect.any(Object));
      expect(mockNetworkService.sendSecureMessage).toHaveBeenCalledWith('preference_sync', expect.any(Object));
      
      const syncStatus = syncService.getSyncStatus();
      expect(syncStatus.get('preferences')).toBe(SyncStatus.SUCCESS);
    });

    it('should queue preferences when offline', async () => {
      // Arrange
      const preferences: Partial<SyncablePreferences> = {
        recommendationSettings: {
          autoApproveHighConfidence: true,
          showExplanations: false,
          batchSize: 20
        }
      };

      // Mock offline state
      (syncService as any).pairingStatus = PairingStatus.NOT_PAIRED;
      mockNetworkService.isConnected.mockReturnValue(false);
      mockOfflineService.queueOfflineOperation.mockResolvedValue('op-456');
      mockSecurityService.storeSecureData.mockResolvedValue();

      // Act
      const result = await syncService.syncPreferences(preferences);

      // Assert
      expect(result).toBe(true);
      expect(mockOfflineService.queueOfflineOperation).toHaveBeenCalledWith(
        expect.any(String), // OfflineOperationType.PREFERENCE_UPDATE
        { preferences: expect.any(Object) },
        3 // Highest priority
      );
    });

    it('should handle preference sync failures', async () => {
      // Arrange
      const preferences: Partial<SyncablePreferences> = {
        privacySettings: {
          requireBiometricAuth: false,
          clearDataOnBackground: false,
          encryptionLevel: 'standard'
        }
      };

      // Mock paired state but network failure
      (syncService as any).pairingStatus = PairingStatus.PAIRED;
      mockNetworkService.isConnected.mockReturnValue(true);
      mockNetworkService.sendSecureMessage.mockResolvedValue(false);
      mockSecurityService.storeSecureData.mockResolvedValue();

      // Act
      const result = await syncService.syncPreferences(preferences);

      // Assert
      expect(result).toBe(false);
      expect(mockErrorService.handleProcessingFailure).toHaveBeenCalled();
      
      const syncStatus = syncService.getSyncStatus();
      expect(syncStatus.get('preferences')).toBe(SyncStatus.FAILED);
    });
  });

  describe('Offline Sync Processing', () => {
    it('should process offline sync successfully', async () => {
      // Arrange
      const mockResult = {
        processed: 5,
        failed: 0,
        conflicts: []
      };

      mockOfflineService.processQueuedOperations.mockResolvedValue(mockResult);

      // Act
      const result = await syncService.processOfflineSync();

      // Assert
      expect(result.processed).toBe(5);
      expect(result.conflicts).toHaveLength(0);
      expect(mockOfflineService.processQueuedOperations).toHaveBeenCalled();
      
      const syncStatus = syncService.getSyncStatus();
      expect(syncStatus.get('offline_queue')).toBe(SyncStatus.SUCCESS);
    });

    it('should handle sync conflicts', async () => {
      // Arrange
      const mockResult = {
        processed: 3,
        failed: 0,
        conflicts: [{
          id: 'conflict-1',
          type: 'preference_changed',
          localData: { setting: 'local_value' },
          remoteData: { setting: 'remote_value' },
          timestamp: new Date()
        }]
      };

      mockOfflineService.processQueuedOperations.mockResolvedValue(mockResult);

      // Act
      const result = await syncService.processOfflineSync();

      // Assert
      expect(result.processed).toBe(3);
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].type).toBe('preference');
      
      const syncStatus = syncService.getSyncStatus();
      expect(syncStatus.get('offline_queue')).toBe(SyncStatus.CONFLICT);
      
      const pendingConflicts = syncService.getPendingConflicts();
      expect(pendingConflicts).toHaveLength(1);
    });

    it('should handle offline sync failures', async () => {
      // Arrange
      mockOfflineService.processQueuedOperations.mockRejectedValue(new Error('Sync failed'));

      // Act
      const result = await syncService.processOfflineSync();

      // Assert
      expect(result.processed).toBe(0);
      expect(result.conflicts).toHaveLength(0);
      expect(mockErrorService.handleProcessingFailure).toHaveBeenCalled();
      
      const syncStatus = syncService.getSyncStatus();
      expect(syncStatus.get('offline_queue')).toBe(SyncStatus.FAILED);
    });
  });

  describe('Conflict Resolution', () => {
    it('should resolve conflicts using local value', async () => {
      // Arrange
      const conflict: SyncConflict = {
        id: 'conflict-123',
        type: 'preference',
        localValue: { setting: 'local_value' },
        remoteValue: { setting: 'remote_value' },
        timestamp: new Date()
      };

      // Add conflict to pending list
      (syncService as any).pendingConflicts.set(conflict.id, conflict);
      mockNetworkService.isConnected.mockReturnValue(true);
      mockNetworkService.sendSecureMessage.mockResolvedValue(true);
      mockSecurityService.storeSecureData.mockResolvedValue();

      // Act
      const result = await syncService.resolveConflict(conflict.id, 'use_local');

      // Assert
      expect(result).toBe(true);
      expect(mockNetworkService.sendSecureMessage).toHaveBeenCalledWith('conflict_resolved', expect.any(Object));
      
      const pendingConflicts = syncService.getPendingConflicts();
      expect(pendingConflicts.find(c => c.id === conflict.id)).toBeUndefined();
    });

    it('should resolve conflicts using remote value', async () => {
      // Arrange
      const conflict: SyncConflict = {
        id: 'conflict-456',
        type: 'preference',
        localValue: { setting: 'local_value' },
        remoteValue: { setting: 'remote_value' },
        timestamp: new Date()
      };

      (syncService as any).pendingConflicts.set(conflict.id, conflict);
      mockNetworkService.isConnected.mockReturnValue(true);
      mockNetworkService.sendSecureMessage.mockResolvedValue(true);
      mockSecurityService.storeSecureData.mockResolvedValue();

      // Act
      const result = await syncService.resolveConflict(conflict.id, 'use_remote');

      // Assert
      expect(result).toBe(true);
      expect(mockSecurityService.storeSecureData).toHaveBeenCalled();
    });

    it('should handle conflict resolution failures', async () => {
      // Arrange
      const conflictId = 'nonexistent-conflict';

      // Act
      const result = await syncService.resolveConflict(conflictId, 'use_local');

      // Assert
      expect(result).toBe(false);
      expect(mockErrorService.handleProcessingFailure).toHaveBeenCalled();
    });
  });

  describe('Sync Notifications', () => {
    it('should notify listeners of sync events', async () => {
      // Arrange
      const mockCallback = vi.fn();
      syncService.onSyncNotification(mockCallback);

      // Mock successful pairing to trigger notification
      mockNetworkService.establishSecureConnection.mockResolvedValue(true);
      mockNetworkService.sendSecureMessage.mockResolvedValue(true);
      mockNetworkService.isConnected.mockReturnValue(true);

      // Mock device info exchange
      mockNetworkService.registerMessageHandler.mockImplementation((type: string, handler: any) => {
        if (type === 'device_info_response') {
          setTimeout(() => handler({
            id: 'test-device',
            name: 'Test Device',
            platform: 'macos',
            version: '1.0.0',
            capabilities: [],
            lastSeen: new Date()
          }), 10);
        }
        if (type === 'auth_response') {
          setTimeout(() => handler({ challenge: 'test-challenge' }), 10);
        }
      });

      // Act
      await syncService.pairWithDevice('192.168.1.100', 'Test Device');

      // Assert
      expect(mockCallback).toHaveBeenCalledWith(expect.objectContaining({
        type: 'pairing_success',
        message: expect.stringContaining('Successfully paired')
      }));
    });

    it('should allow unregistering notification callbacks', () => {
      // Arrange
      const mockCallback = vi.fn();
      syncService.onSyncNotification(mockCallback);

      // Act
      syncService.offSyncNotification(mockCallback);

      // Verify callback is removed (no direct way to test, but ensures no errors)
      expect(() => syncService.offSyncNotification(mockCallback)).not.toThrow();
    });
  });

  describe('Force Sync', () => {
    it('should perform force sync when paired', async () => {
      // Arrange
      (syncService as any).pairingStatus = PairingStatus.PAIRED;
      mockNetworkService.isConnected.mockReturnValue(true);
      mockNetworkService.sendSecureMessage.mockResolvedValue(true);
      mockSecurityService.storeSecureData.mockResolvedValue();
      mockOfflineService.processQueuedOperations.mockResolvedValue({
        processed: 2,
        failed: 0,
        conflicts: []
      });

      // Act
      const result = await syncService.forceSync();

      // Assert
      expect(result).toBe(true);
      expect(mockOfflineService.processQueuedOperations).toHaveBeenCalled();
    });

    it('should fail force sync when not paired', async () => {
      // Arrange
      (syncService as any).pairingStatus = PairingStatus.NOT_PAIRED;

      // Act
      const result = await syncService.forceSync();

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('Disconnect', () => {
    it('should disconnect cleanly', async () => {
      // Arrange
      (syncService as any).pairingStatus = PairingStatus.PAIRED;
      mockNetworkService.isConnected.mockReturnValue(true);
      mockNetworkService.sendSecureMessage.mockResolvedValue(true);

      // Act
      await syncService.disconnect();

      // Assert
      expect(mockNetworkService.sendSecureMessage).toHaveBeenCalledWith('disconnect', expect.any(Object));
      expect(mockNetworkService.disconnect).toHaveBeenCalled();
      expect(syncService.getPairingStatus()).toBe(PairingStatus.NOT_PAIRED);
    });
  });

  describe('Status and Information', () => {
    it('should return current pairing status', () => {
      // Act & Assert
      expect(syncService.getPairingStatus()).toBe(PairingStatus.NOT_PAIRED);
    });

    it('should return paired devices', () => {
      // Act
      const devices = syncService.getPairedDevices();

      // Assert
      expect(Array.isArray(devices)).toBe(true);
      expect(devices).toHaveLength(0);
    });

    it('should return sync status', () => {
      // Act
      const status = syncService.getSyncStatus();

      // Assert
      expect(status instanceof Map).toBe(true);
    });

    it('should return pending conflicts', () => {
      // Act
      const conflicts = syncService.getPendingConflicts();

      // Assert
      expect(Array.isArray(conflicts)).toBe(true);
      expect(conflicts).toHaveLength(0);
    });

    it('should return progress updates', () => {
      // Act
      const updates = syncService.getProgressUpdates();

      // Assert
      expect(updates instanceof Map).toBe(true);
    });
  });
});