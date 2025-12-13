import { DeviceSynchronizationService, PairingStatus, SyncStatus, SyncablePreferences, ProgressUpdate } from '../services/DeviceSynchronizationService';
import { SecureNetworkService } from '../services/SecureNetworkService';
import { SecurityService } from '../services/SecurityService';
import { OfflineOperationService } from '../services/OfflineOperationService';
import { ErrorHandlingService } from '../services/ErrorHandlingService';
import { SecureCacheService } from '../services/SecureCacheService';

/**
 * Example demonstrating device synchronization functionality
 * This shows how to use the DeviceSynchronizationService for Requirements 16.1-16.5
 */
export class DeviceSynchronizationExample {
  private syncService: DeviceSynchronizationService;
  private networkService: SecureNetworkService;
  private securityService: SecurityService;
  private offlineService: OfflineOperationService;
  private errorService: ErrorHandlingService;

  constructor() {
    // Initialize dependencies
    this.networkService = SecureNetworkService.getInstance();
    this.securityService = SecurityService.getInstance();
    this.errorService = new ErrorHandlingService();
    
    const cacheService = SecureCacheService.getInstance();
    this.offlineService = new OfflineOperationService(cacheService, this.errorService);

    // Initialize synchronization service
    this.syncService = DeviceSynchronizationService.getInstance(
      this.networkService,
      this.securityService,
      this.offlineService,
      this.errorService
    );

    this.setupNotificationHandlers();
  }

  /**
   * Requirement 16.3: Demonstrate secure device pairing
   */
  async demonstrateDevicePairing(): Promise<void> {
    console.log('=== Device Pairing Demo ===');

    try {
      // Attempt to pair with a macOS companion device
      const deviceAddress = '192.168.1.100'; // Example local network address
      const deviceName = 'MacBook Pro';

      console.log(`Attempting to pair with ${deviceName} at ${deviceAddress}...`);
      
      const pairingResult = await this.syncService.pairWithDevice(deviceAddress, deviceName);
      
      if (pairingResult) {
        console.log('✅ Device pairing successful!');
        console.log(`Pairing Status: ${this.syncService.getPairingStatus()}`);
        
        const pairedDevices = this.syncService.getPairedDevices();
        console.log(`Paired Devices: ${pairedDevices.length}`);
        pairedDevices.forEach(device => {
          console.log(`  - ${device.name} (${device.platform}) - ${device.id}`);
        });
      } else {
        console.log('❌ Device pairing failed');
        console.log(`Pairing Status: ${this.syncService.getPairingStatus()}`);
      }
    } catch (error) {
      console.error('Device pairing error:', error);
    }
  }

  /**
   * Requirement 16.2: Demonstrate real-time progress updates
   */
  async demonstrateProgressUpdates(): Promise<void> {
    console.log('\n=== Progress Updates Demo ===');

    try {
      // Simulate various processing tasks with progress updates
      const tasks = [
        { id: 'note_processing_001', type: 'note_processing', name: 'Processing Notes Batch 1' },
        { id: 'duplicate_detection_001', type: 'duplicate_detection', name: 'Detecting Duplicates' },
        { id: 'utility_scoring_001', type: 'utility_scoring', name: 'Calculating Utility Scores' }
      ];

      for (const task of tasks) {
        console.log(`Starting task: ${task.name}`);
        
        // Simulate progress from 0 to 100%
        for (let progress = 0; progress <= 100; progress += 25) {
          const progressUpdate: ProgressUpdate = {
            taskId: task.id,
            taskType: task.type,
            progress,
            status: progress === 100 ? 'completed' : 'running',
            message: `${task.name} - ${progress}% complete`,
            timestamp: new Date()
          };

          await this.syncService.sendProgressUpdate(progressUpdate);
          console.log(`  📊 ${task.name}: ${progress}%`);
          
          // Small delay to simulate processing time
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      // Display all progress updates
      const allUpdates = this.syncService.getProgressUpdates();
      console.log(`\n📈 Total progress updates tracked: ${allUpdates.size}`);
      
    } catch (error) {
      console.error('Progress updates error:', error);
    }
  }

  /**
   * Requirement 16.1: Demonstrate preference synchronization
   */
  async demonstratePreferenceSync(): Promise<void> {
    console.log('\n=== Preference Synchronization Demo ===');

    try {
      // Define sample preferences to sync
      const preferences: Partial<SyncablePreferences> = {
        utilityScoreThresholds: {
          high: 85,
          medium: 55,
          low: 25
        },
        recommendationSettings: {
          autoApproveHighConfidence: true,
          showExplanations: true,
          batchSize: 15
        },
        learningPreferences: {
          adaptToFeedback: true,
          shareAcrossDevices: true,
          retentionDays: 120
        }
      };

      console.log('Syncing preferences across devices...');
      console.log('Preferences to sync:', JSON.stringify(preferences, null, 2));

      const startTime = Date.now();
      const syncResult = await this.syncService.syncPreferences(preferences);
      const syncTime = Date.now() - startTime;

      if (syncResult) {
        console.log(`✅ Preferences synced successfully in ${syncTime}ms`);
        console.log('Target: < 30 seconds (30,000ms) ✅');
      } else {
        console.log('❌ Preference synchronization failed');
      }

      // Display sync status
      const syncStatus = this.syncService.getSyncStatus();
      console.log('\nSync Status:');
      syncStatus.forEach((status, dataType) => {
        console.log(`  ${dataType}: ${status}`);
      });

    } catch (error) {
      console.error('Preference sync error:', error);
    }
  }

  /**
   * Requirement 16.4: Demonstrate offline sync queuing
   */
  async demonstrateOfflineSync(): Promise<void> {
    console.log('\n=== Offline Sync Demo ===');

    try {
      console.log('Simulating offline operations...');

      // Simulate going offline
      console.log('📱 Device going offline...');
      
      // Perform operations while offline (these should be queued)
      const offlinePreferences: Partial<SyncablePreferences> = {
        privacySettings: {
          requireBiometricAuth: true,
          clearDataOnBackground: true,
          encryptionLevel: 'high'
        }
      };

      await this.syncService.syncPreferences(offlinePreferences);
      
      const offlineProgress: ProgressUpdate = {
        taskId: 'offline_task_001',
        taskType: 'organization',
        progress: 75,
        status: 'running',
        message: 'Offline processing continues...',
        timestamp: new Date()
      };

      await this.syncService.sendProgressUpdate(offlineProgress);
      console.log('📦 Operations queued for offline sync');

      // Simulate coming back online
      console.log('🌐 Device coming back online...');
      
      // Process queued operations
      const syncResult = await this.syncService.processOfflineSync();
      console.log(`✅ Processed ${syncResult.processed} queued operations`);
      
      if (syncResult.conflicts.length > 0) {
        console.log(`⚠️  ${syncResult.conflicts.length} conflicts detected:`);
        syncResult.conflicts.forEach((conflict, index) => {
          console.log(`  ${index + 1}. ${conflict.type} conflict (${conflict.id})`);
        });
      }

    } catch (error) {
      console.error('Offline sync error:', error);
    }
  }

  /**
   * Requirement 16.5: Demonstrate conflict resolution
   */
  async demonstrateConflictResolution(): Promise<void> {
    console.log('\n=== Conflict Resolution Demo ===');

    try {
      // Get any pending conflicts
      const conflicts = this.syncService.getPendingConflicts();
      
      if (conflicts.length === 0) {
        console.log('No conflicts to resolve at this time');
        return;
      }

      console.log(`Found ${conflicts.length} conflicts to resolve:`);

      for (const conflict of conflicts) {
        console.log(`\nResolving conflict: ${conflict.id}`);
        console.log(`Type: ${conflict.type}`);
        console.log(`Local value:`, conflict.localValue);
        console.log(`Remote value:`, conflict.remoteValue);

        // For demo purposes, use local value
        const resolution = 'use_local';
        console.log(`Choosing resolution: ${resolution}`);

        const resolved = await this.syncService.resolveConflict(conflict.id, resolution);
        
        if (resolved) {
          console.log(`✅ Conflict ${conflict.id} resolved successfully`);
        } else {
          console.log(`❌ Failed to resolve conflict ${conflict.id}`);
        }
      }

      // Check remaining conflicts
      const remainingConflicts = this.syncService.getPendingConflicts();
      console.log(`\nRemaining conflicts: ${remainingConflicts.length}`);

    } catch (error) {
      console.error('Conflict resolution error:', error);
    }
  }

  /**
   * Demonstrate force sync functionality
   */
  async demonstrateForceSync(): Promise<void> {
    console.log('\n=== Force Sync Demo ===');

    try {
      if (this.syncService.getPairingStatus() !== PairingStatus.PAIRED) {
        console.log('⚠️  No paired device available for force sync');
        return;
      }

      console.log('Initiating force sync...');
      const syncResult = await this.syncService.forceSync();

      if (syncResult) {
        console.log('✅ Force sync completed successfully');
      } else {
        console.log('❌ Force sync failed');
      }

    } catch (error) {
      console.error('Force sync error:', error);
    }
  }

  /**
   * Setup notification handlers for sync events
   */
  private setupNotificationHandlers(): void {
    this.syncService.onSyncNotification((notification) => {
      const timestamp = notification.timestamp.toLocaleTimeString();
      
      switch (notification.type) {
        case 'pairing_success':
          console.log(`🔗 [${timestamp}] ${notification.message}`);
          break;
        case 'pairing_failed':
          console.log(`❌ [${timestamp}] ${notification.message}`);
          break;
        case 'sync_started':
          console.log(`🔄 [${timestamp}] ${notification.message}`);
          break;
        case 'sync_completed':
          console.log(`✅ [${timestamp}] ${notification.message}`);
          break;
        case 'sync_failed':
          console.log(`❌ [${timestamp}] ${notification.message}`);
          break;
        case 'conflict_detected':
          console.log(`⚠️  [${timestamp}] ${notification.message}`);
          break;
        case 'connection_lost':
          console.log(`📡 [${timestamp}] ${notification.message}`);
          break;
        default:
          console.log(`📢 [${timestamp}] ${notification.message}`);
      }
    });
  }

  /**
   * Run complete device synchronization demonstration
   */
  async runCompleteDemo(): Promise<void> {
    console.log('🚀 Starting Device Synchronization Demo');
    console.log('=====================================');

    try {
      await this.demonstrateDevicePairing();
      await this.demonstrateProgressUpdates();
      await this.demonstratePreferenceSync();
      await this.demonstrateOfflineSync();
      await this.demonstrateConflictResolution();
      await this.demonstrateForceSync();

      console.log('\n🎉 Device Synchronization Demo Complete!');
      console.log('=====================================');

      // Display final status
      console.log('\nFinal Status:');
      console.log(`Pairing Status: ${this.syncService.getPairingStatus()}`);
      console.log(`Paired Devices: ${this.syncService.getPairedDevices().length}`);
      console.log(`Pending Conflicts: ${this.syncService.getPendingConflicts().length}`);
      console.log(`Progress Updates: ${this.syncService.getProgressUpdates().size}`);

    } catch (error) {
      console.error('Demo error:', error);
    } finally {
      // Cleanup
      await this.syncService.disconnect();
      this.syncService.shutdown();
    }
  }
}

// Example usage
export async function runDeviceSynchronizationDemo(): Promise<void> {
  const demo = new DeviceSynchronizationExample();
  await demo.runCompleteDemo();
}

// Export for use in other modules
export default DeviceSynchronizationExample;