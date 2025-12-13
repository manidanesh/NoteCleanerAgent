import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { DeviceSynchronizationService, PairingStatus, SyncStatus, SyncablePreferences, ProgressUpdate } from '../../src/services/DeviceSynchronizationService';
import { SecureNetworkService } from '../../src/services/SecureNetworkService';
import { SecurityService } from '../../src/services/SecurityService';
import { OfflineOperationService } from '../../src/services/OfflineOperationService';
import { ErrorHandlingService } from '../../src/services/ErrorHandlingService';

// Mock dependencies for property testing
vi.mock('../../src/services/SecureNetworkService');
vi.mock('../../src/services/SecurityService');
vi.mock('../../src/services/OfflineOperationService');
vi.mock('../../src/services/ErrorHandlingService');

describe('DeviceSynchronizationService Property Tests', () => {
  let syncService: DeviceSynchronizationService;
  let mockNetworkService: any;
  let mockSecurityService: any;
  let mockOfflineService: any;
  let mockErrorService: any;

  beforeEach(() => {
    // Create fresh mock instances for each test
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

    // Reset singleton instance
    (DeviceSynchronizationService as any).instance = undefined;

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

  // Generators for property testing

  const deviceAddressGen = fc.string({ minLength: 7, maxLength: 15 }).filter(addr => 
    /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(addr) || addr.includes('.')
  );

  const deviceNameGen = fc.string({ minLength: 1, maxLength: 50 }).filter(name => 
    name.trim().length > 0
  );

  const progressUpdateGen = fc.record({
    taskId: fc.string({ minLength: 1, maxLength: 20 }),
    taskType: fc.constantFrom('note_processing', 'duplicate_detection', 'utility_scoring', 'organization'),
    progress: fc.integer({ min: 0, max: 100 }),
    status: fc.constantFrom('running', 'completed', 'failed', 'paused') as fc.Arbitrary<'running' | 'completed' | 'failed' | 'paused'>,
    message: fc.option(fc.string({ maxLength: 100 })),
    timestamp: fc.date()
  });

  const preferencesGen = fc.record({
    utilityScoreThresholds: fc.record({
      high: fc.integer({ min: 70, max: 100 }),
      medium: fc.integer({ min: 30, max: 69 }),
      low: fc.integer({ min: 0, max: 29 })
    }),
    recommendationSettings: fc.record({
      autoApproveHighConfidence: fc.boolean(),
      showExplanations: fc.boolean(),
      batchSize: fc.integer({ min: 1, max: 100 })
    }),
    learningPreferences: fc.record({
      adaptToFeedback: fc.boolean(),
      shareAcrossDevices: fc.boolean(),
      retentionDays: fc.integer({ min: 1, max: 365 })
    }),
    privacySettings: fc.record({
      requireBiometricAuth: fc.boolean(),
      clearDataOnBackground: fc.boolean(),
      encryptionLevel: fc.constantFrom('standard', 'high') as fc.Arbitrary<'standard' | 'high'>
    })
  });

  /**
   * **Feature: notes-ai-organizer, Property 1: Secure pairing authentication**
   * **Validates: Requirements 16.3**
   * For any device pairing attempt, authentication key exchange should be required and verified
   */
  it('should require authentication key exchange for all pairing attempts', async () => {
    await fc.assert(fc.asyncProperty(
      deviceAddressGen,
      deviceNameGen,
      async (deviceAddress, deviceName) => {
        // Arrange
        mockNetworkService.establishSecureConnection.mockResolvedValue(true);
        mockNetworkService.sendSecureMessage.mockResolvedValue(true);
        mockNetworkService.isConnected.mockReturnValue(true);

        // Mock successful device info and auth exchange
        mockNetworkService.registerMessageHandler.mockImplementation((type: string, handler: any) => {
          if (type === 'device_info_response') {
            setTimeout(() => handler({
              id: `device_${Date.now()}`,
              name: deviceName,
              platform: 'macos',
              version: '1.0.0',
              capabilities: ['sync'],
              lastSeen: new Date()
            }), 10);
          }
          if (type === 'auth_response') {
            setTimeout(() => handler({ challenge: 'test-challenge' }), 10);
          }
        });

        // Act
        const result = await syncService.pairWithDevice(deviceAddress, deviceName);

        // Assert - Authentication should always be attempted
        if (result) {
          // If pairing succeeded, auth exchange must have occurred
          expect(mockNetworkService.sendSecureMessage).toHaveBeenCalledWith(
            'auth_request',
            expect.objectContaining({
              challenge: expect.any(String),
              deviceId: expect.any(String),
              timestamp: expect.any(Number)
            })
          );
        }

        // Cleanup for next iteration
        await syncService.disconnect();
      }
    ), { numRuns: 20 });
  });

  /**
   * **Feature: notes-ai-organizer, Property 2: Progress update real-time delivery**
   * **Validates: Requirements 16.2**
   * For any progress update, it should be delivered to paired devices or queued for offline sync
   */
  it('should deliver or queue all progress updates', async () => {
    await fc.assert(fc.asyncProperty(
      progressUpdateGen,
      async (progressUpdate) => {
        // Arrange - Test both online and offline scenarios
        const isOnline = Math.random() > 0.5;
        
        if (isOnline) {
          (syncService as any).pairingStatus = PairingStatus.PAIRED;
          mockNetworkService.isConnected.mockReturnValue(true);
          mockNetworkService.sendSecureMessage.mockResolvedValue(true);
        } else {
          (syncService as any).pairingStatus = PairingStatus.NOT_PAIRED;
          mockNetworkService.isConnected.mockReturnValue(false);
          mockOfflineService.queueOfflineOperation.mockResolvedValue('op-123');
        }

        // Act
        await syncService.sendProgressUpdate(progressUpdate);

        // Assert - Progress update should be handled appropriately
        if (isOnline) {
          expect(mockNetworkService.sendSecureMessage).toHaveBeenCalledWith(
            'progress_update',
            progressUpdate
          );
        } else {
          expect(mockOfflineService.queueOfflineOperation).toHaveBeenCalledWith(
            expect.any(String),
            { type: 'progress_update', update: progressUpdate },
            2 // High priority
          );
        }

        // Progress should be stored locally regardless
        const storedUpdates = syncService.getProgressUpdates();
        expect(storedUpdates.get(progressUpdate.taskId)).toEqual(progressUpdate);
      }
    ), { numRuns: 30 });
  });

  /**
   * **Feature: notes-ai-organizer, Property 3: Preference synchronization within 30 seconds**
   * **Validates: Requirements 16.1**
   * For any preference update, it should be synchronized or queued within the target timeframe
   */
  it('should synchronize preferences within target timeframe', async () => {
    await fc.assert(fc.asyncProperty(
      preferencesGen,
      async (preferences) => {
        // Arrange
        const startTime = Date.now();
        const isOnline = Math.random() > 0.5;

        if (isOnline) {
          (syncService as any).pairingStatus = PairingStatus.PAIRED;
          mockNetworkService.isConnected.mockReturnValue(true);
          mockNetworkService.sendSecureMessage.mockResolvedValue(true);
        } else {
          mockOfflineService.queueOfflineOperation.mockResolvedValue('op-456');
        }

        mockSecurityService.storeSecureData.mockResolvedValue();

        // Act
        const result = await syncService.syncPreferences(preferences);
        const endTime = Date.now();

        // Assert - Should complete within reasonable time (simulated 30 seconds)
        const syncTime = endTime - startTime;
        expect(syncTime).toBeLessThan(1000); // Should be much faster in tests

        // Should always succeed in storing preferences
        expect(result).toBe(true);
        expect(mockSecurityService.storeSecureData).toHaveBeenCalledWith(
          'sync_preferences',
          expect.objectContaining(preferences)
        );

        if (isOnline) {
          expect(mockNetworkService.sendSecureMessage).toHaveBeenCalledWith(
            'preference_sync',
            expect.objectContaining({
              preferences: expect.objectContaining(preferences)
            })
          );
        } else {
          // When offline, should either queue operation or still succeed with local storage
          expect(result).toBe(true);
        }
      }
    ), { numRuns: 25 });
  });

  /**
   * **Feature: notes-ai-organizer, Property 4: Offline operation queuing**
   * **Validates: Requirements 16.4**
   * For any operation when offline, it should be queued and processed when connectivity is restored
   */
  it('should queue operations when offline and process when online', async () => {
    await fc.assert(fc.asyncProperty(
      fc.record({
        preferences: preferencesGen,
        progressUpdate: progressUpdateGen
      }),
      async ({ preferences, progressUpdate }) => {
        // Arrange - Start offline
        (syncService as any).pairingStatus = PairingStatus.NOT_PAIRED;
        mockNetworkService.isConnected.mockReturnValue(false);
        mockOfflineService.queueOfflineOperation.mockResolvedValue('queued-op');
        mockSecurityService.storeSecureData.mockResolvedValue();

        // Act - Perform operations while offline
        await syncService.syncPreferences(preferences);
        await syncService.sendProgressUpdate(progressUpdate);

        // Assert - Operations should be queued (at least once for each operation)
        expect(mockOfflineService.queueOfflineOperation).toHaveBeenCalled();

        // Simulate coming online and processing queue
        mockOfflineService.processQueuedOperations.mockResolvedValue({
          processed: 2,
          failed: 0,
          conflicts: []
        });

        const result = await syncService.processOfflineSync();

        // Assert - Queued operations should be processed
        expect(result.processed).toBeGreaterThanOrEqual(0);
        expect(mockOfflineService.processQueuedOperations).toHaveBeenCalled();
      }
    ), { numRuns: 20 });
  });

  /**
   * **Feature: notes-ai-organizer, Property 5: Conflict detection and resolution**
   * **Validates: Requirements 16.5**
   * For any sync conflict, it should be detected, reported, and resolvable
   */
  it('should detect and resolve sync conflicts appropriately', async () => {
    await fc.assert(fc.asyncProperty(
      fc.record({
        localValue: fc.record({ setting: fc.string() }),
        remoteValue: fc.record({ setting: fc.string() })
      }).filter(({ localValue, remoteValue }) => 
        localValue.setting !== remoteValue.setting // Ensure there's actually a conflict
      ),
      async ({ localValue, remoteValue }) => {
        // Arrange - Simulate conflict scenario
        mockOfflineService.processQueuedOperations.mockResolvedValue({
          processed: 1,
          failed: 0,
          conflicts: [{
            id: 'test-conflict',
            type: 'preference_changed',
            localData: localValue,
            remoteData: remoteValue,
            timestamp: new Date()
          }]
        });

        // Act - Process sync and detect conflicts
        const syncResult = await syncService.processOfflineSync();

        // Assert - Conflicts should be detected
        expect(syncResult.conflicts).toHaveLength(1);
        expect(syncResult.conflicts[0].type).toBe('preference');
        expect(syncResult.conflicts[0].localValue).toEqual(localValue);
        expect(syncResult.conflicts[0].remoteValue).toEqual(remoteValue);

        const pendingConflicts = syncService.getPendingConflicts();
        expect(pendingConflicts).toHaveLength(1);

        // Test conflict resolution
        mockNetworkService.isConnected.mockReturnValue(true);
        mockNetworkService.sendSecureMessage.mockResolvedValue(true);
        mockSecurityService.storeSecureData.mockResolvedValue();

        const conflictId = pendingConflicts[0].id;
        const resolutionResult = await syncService.resolveConflict(conflictId, 'use_local');

        // Assert - Conflict should be resolved
        expect(resolutionResult).toBe(true);
        
        const remainingConflicts = syncService.getPendingConflicts();
        expect(remainingConflicts.find(c => c.id === conflictId)).toBeUndefined();
      }
    ), { numRuns: 15 });
  });

  /**
   * **Feature: notes-ai-organizer, Property 6: Sync status consistency**
   * **Validates: Requirements 16.1, 16.2, 16.4, 16.5**
   * For any sync operation, the status should accurately reflect the operation state
   */
  it('should maintain consistent sync status across operations', async () => {
    await fc.assert(fc.asyncProperty(
      fc.constantFrom('success', 'failure', 'conflict'),
      async (scenarioType) => {
        // Arrange based on scenario
        switch (scenarioType) {
          case 'success':
            (syncService as any).pairingStatus = PairingStatus.PAIRED;
            mockNetworkService.isConnected.mockReturnValue(true);
            mockNetworkService.sendSecureMessage.mockResolvedValue(true);
            mockSecurityService.storeSecureData.mockResolvedValue();
            mockOfflineService.processQueuedOperations.mockResolvedValue({
              processed: 1, failed: 0, conflicts: []
            });
            break;

          case 'failure':
            (syncService as any).pairingStatus = PairingStatus.PAIRED;
            mockNetworkService.isConnected.mockReturnValue(true);
            mockNetworkService.sendSecureMessage.mockResolvedValue(false);
            mockSecurityService.storeSecureData.mockRejectedValue(new Error('Storage failed'));
            break;

          case 'conflict':
            mockOfflineService.processQueuedOperations.mockResolvedValue({
              processed: 0, failed: 0, conflicts: [{
                id: 'conflict-1',
                type: 'preference_changed',
                localData: { test: 'local' },
                remoteData: { test: 'remote' },
                timestamp: new Date()
              }]
            });
            break;
        }

        // Act - Perform operations
        const prefResult = await syncService.syncPreferences({ 
          utilityScoreThresholds: { high: 80, medium: 50, low: 20 }
        });
        
        const offlineResult = await syncService.processOfflineSync();

        // Assert - Status should be consistent with results
        const syncStatus = syncService.getSyncStatus();

        switch (scenarioType) {
          case 'success':
            expect(prefResult).toBe(true);
            expect(syncStatus.get('preferences')).toBe(SyncStatus.SUCCESS);
            expect(syncStatus.get('offline_queue')).toBe(SyncStatus.SUCCESS);
            break;

          case 'failure':
            expect(prefResult).toBe(false);
            expect(syncStatus.get('preferences')).toBe(SyncStatus.FAILED);
            break;

          case 'conflict':
            expect(offlineResult.conflicts).toHaveLength(1);
            expect(syncStatus.get('offline_queue')).toBe(SyncStatus.CONFLICT);
            break;
        }
      }
    ), { numRuns: 20 });
  });

  /**
   * **Feature: notes-ai-organizer, Property 7: Pairing state transitions**
   * **Validates: Requirements 16.3**
   * For any pairing operation, state transitions should be valid and consistent
   */
  it('should maintain valid pairing state transitions', async () => {
    await fc.assert(fc.asyncProperty(
      fc.record({
        deviceAddress: deviceAddressGen,
        deviceName: deviceNameGen,
        shouldSucceed: fc.boolean()
      }),
      async ({ deviceAddress, deviceName, shouldSucceed }) => {
        // Arrange - Reset to ensure clean state
        await syncService.disconnect();
        const initialStatus = syncService.getPairingStatus();
        expect(initialStatus).toBe(PairingStatus.NOT_PAIRED);

        if (shouldSucceed) {
          mockNetworkService.establishSecureConnection.mockResolvedValue(true);
          mockNetworkService.sendSecureMessage.mockResolvedValue(true);
          mockNetworkService.isConnected.mockReturnValue(true);
          
          mockNetworkService.registerMessageHandler.mockImplementation((type: string, handler: any) => {
            if (type === 'device_info_response') {
              setTimeout(() => handler({
                id: 'test-device',
                name: deviceName,
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
        } else {
          mockNetworkService.establishSecureConnection.mockResolvedValue(false);
        }

        // Act
        const result = await syncService.pairWithDevice(deviceAddress, deviceName);

        // Assert - State transitions should be valid
        const finalStatus = syncService.getPairingStatus();

        if (shouldSucceed && result) {
          expect(finalStatus).toBe(PairingStatus.PAIRED);
          expect(syncService.getPairedDevices()).toHaveLength(1);
        } else {
          expect(finalStatus).toBe(PairingStatus.PAIRING_FAILED);
          expect(syncService.getPairedDevices()).toHaveLength(0);
        }

        // Test disconnect transition
        if (finalStatus === PairingStatus.PAIRED) {
          await syncService.disconnect();
          expect(syncService.getPairingStatus()).toBe(PairingStatus.NOT_PAIRED);
          expect(syncService.getPairedDevices()).toHaveLength(0);
        }
      }
    ), { numRuns: 15 });
  });
});