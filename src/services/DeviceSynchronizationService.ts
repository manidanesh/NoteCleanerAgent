import { SecureNetworkService } from './SecureNetworkService';
import { SecurityService } from './SecurityService';
import { OfflineOperationService, OfflineOperation, OfflineOperationType } from './OfflineOperationService';
import { ErrorHandlingService } from './ErrorHandlingService';

/**
 * Device pairing status
 */
export enum PairingStatus {
  NOT_PAIRED = 'not_paired',
  PAIRING_IN_PROGRESS = 'pairing_in_progress',
  PAIRED = 'paired',
  PAIRING_FAILED = 'pairing_failed',
  CONNECTION_LOST = 'connection_lost'
}

/**
 * Sync status for different data types
 */
export enum SyncStatus {
  IDLE = 'idle',
  SYNCING = 'syncing',
  SUCCESS = 'success',
  FAILED = 'failed',
  CONFLICT = 'conflict'
}

/**
 * Device information for pairing
 */
export interface DeviceInfo {
  id: string;
  name: string;
  platform: 'ios' | 'macos';
  version: string;
  capabilities: string[];
  lastSeen: Date;
}

/**
 * Sync conflict information
 */
export interface SyncConflict {
  id: string;
  type: 'preference' | 'progress' | 'learning_data';
  localValue: any;
  remoteValue: any;
  timestamp: Date;
  resolution?: 'use_local' | 'use_remote' | 'merge';
}

/**
 * Progress update information
 */
export interface ProgressUpdate {
  taskId: string;
  taskType: string;
  progress: number; // 0-100
  status: 'running' | 'completed' | 'failed' | 'paused';
  message?: string;
  timestamp: Date;
}

/**
 * User preferences that sync between devices
 */
export interface SyncablePreferences {
  utilityScoreThresholds: {
    high: number;
    medium: number;
    low: number;
  };
  recommendationSettings: {
    autoApproveHighConfidence: boolean;
    showExplanations: boolean;
    batchSize: number;
  };
  learningPreferences: {
    adaptToFeedback: boolean;
    shareAcrossDevices: boolean;
    retentionDays: number;
  };
  privacySettings: {
    requireBiometricAuth: boolean;
    clearDataOnBackground: boolean;
    encryptionLevel: 'standard' | 'high';
  };
}

/**
 * Sync notification callback types
 */
export type SyncNotificationCallback = (notification: SyncNotification) => void;

export interface SyncNotification {
  type: 'pairing_success' | 'pairing_failed' | 'sync_started' | 'sync_completed' | 'sync_failed' | 'conflict_detected' | 'connection_lost';
  message: string;
  data?: any;
  timestamp: Date;
}

/**
 * Device Synchronization Service
 * Implements Requirements 16.1-16.5 for device synchronization
 */
export class DeviceSynchronizationService {
  private static instance: DeviceSynchronizationService;
  private networkService: SecureNetworkService;
  private securityService: SecurityService;
  private offlineService: OfflineOperationService;
  private errorHandlingService: ErrorHandlingService;

  private pairingStatus: PairingStatus = PairingStatus.NOT_PAIRED;
  private pairedDevices: Map<string, DeviceInfo> = new Map();
  private syncStatus: Map<string, SyncStatus> = new Map();
  private pendingConflicts: Map<string, SyncConflict> = new Map();
  private progressUpdates: Map<string, ProgressUpdate> = new Map();
  private preferences: SyncablePreferences;
  private notificationCallbacks: SyncNotificationCallback[] = [];
  
  private syncInterval?: NodeJS.Timeout;
  private heartbeatInterval?: NodeJS.Timeout;
  private readonly SYNC_INTERVAL_MS = 30000; // 30 seconds as per requirement 16.3
  private readonly HEARTBEAT_INTERVAL_MS = 10000; // 10 seconds
  private readonly PAIRING_TIMEOUT_MS = 60000; // 1 minute

  private constructor(
    networkService: SecureNetworkService,
    securityService: SecurityService,
    offlineService: OfflineOperationService,
    errorHandlingService: ErrorHandlingService
  ) {
    this.networkService = networkService;
    this.securityService = securityService;
    this.offlineService = offlineService;
    this.errorHandlingService = errorHandlingService;
    
    this.preferences = this.getDefaultPreferences();
    this.initializeMessageHandlers();
    this.loadPersistedState();
  }

  public static getInstance(
    networkService: SecureNetworkService,
    securityService: SecurityService,
    offlineService: OfflineOperationService,
    errorHandlingService: ErrorHandlingService
  ): DeviceSynchronizationService {
    if (!DeviceSynchronizationService.instance) {
      DeviceSynchronizationService.instance = new DeviceSynchronizationService(
        networkService,
        securityService,
        offlineService,
        errorHandlingService
      );
    }
    return DeviceSynchronizationService.instance;
  }

  /**
   * Requirement 16.3: Secure device pairing with authentication key exchange
   */
  public async pairWithDevice(deviceAddress: string, deviceName: string): Promise<boolean> {
    try {
      this.pairingStatus = PairingStatus.PAIRING_IN_PROGRESS;
      this.notifyListeners({
        type: 'sync_started',
        message: `Starting pairing with ${deviceName}`,
        timestamp: new Date()
      });

      // Establish secure connection
      const connected = await this.networkService.establishSecureConnection(deviceAddress);
      if (!connected) {
        throw new Error('Failed to establish secure connection');
      }

      // Exchange device information and capabilities
      const deviceInfo = await this.exchangeDeviceInfo(deviceName);
      if (!deviceInfo) {
        throw new Error('Failed to exchange device information');
      }

      // Perform authentication key exchange
      const authenticated = await this.performAuthenticationKeyExchange(deviceInfo);
      if (!authenticated) {
        throw new Error('Authentication key exchange failed');
      }

      // Store paired device information
      this.pairedDevices.set(deviceInfo.id, deviceInfo);
      this.pairingStatus = PairingStatus.PAIRED;

      // Start sync and heartbeat
      this.startSyncProcess();
      this.startHeartbeat();

      // Persist pairing state
      await this.persistPairingState();

      this.notifyListeners({
        type: 'pairing_success',
        message: `Successfully paired with ${deviceName}`,
        data: { deviceInfo },
        timestamp: new Date()
      });

      return true;
    } catch (error) {
      this.pairingStatus = PairingStatus.PAIRING_FAILED;
      this.errorHandlingService.handleProcessingFailure(
        'DeviceSynchronizationService',
        error as Error,
        { operation: 'pairWithDevice', deviceAddress }
      );

      this.notifyListeners({
        type: 'pairing_failed',
        message: `Failed to pair with device: ${(error as Error).message}`,
        timestamp: new Date()
      });

      return false;
    }
  }

  /**
   * Requirement 16.3: Exchange authentication keys securely
   */
  private async performAuthenticationKeyExchange(deviceInfo: DeviceInfo): Promise<boolean> {
    try {
      // Generate authentication challenge
      const challenge = this.generateAuthChallenge();
      
      // Send authentication request
      const authRequest = {
        challenge,
        deviceId: this.getLocalDeviceId(),
        timestamp: Date.now()
      };

      const success = await this.networkService.sendSecureMessage('auth_request', authRequest);
      if (!success) {
        throw new Error('Failed to send authentication request');
      }

      // Wait for authentication response
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          resolve(false);
        }, this.PAIRING_TIMEOUT_MS);

        this.networkService.registerMessageHandler('auth_response', (data) => {
          clearTimeout(timeout);
          this.networkService.unregisterMessageHandler('auth_response');
          
          // Verify authentication response
          const verified = this.verifyAuthResponse(data, challenge);
          resolve(verified);
        });
      });
    } catch (error) {
      console.error('Authentication key exchange failed:', error);
      return false;
    }
  }

  /**
   * Requirement 16.2: Real-time progress updates between iOS and macOS
   */
  public async sendProgressUpdate(update: ProgressUpdate): Promise<void> {
    try {
      // Store locally
      this.progressUpdates.set(update.taskId, update);

      // Send to paired devices if connected
      if (this.pairingStatus === PairingStatus.PAIRED && this.networkService.isConnected()) {
        await this.networkService.sendSecureMessage('progress_update', update);
      } else {
        // Queue for offline sync
        await this.offlineService.queueOfflineOperation(
          OfflineOperationType.PROCESSING_REQUEST,
          { type: 'progress_update', update },
          2 // High priority
        );
      }
    } catch (error) {
      console.error('Failed to send progress update:', error);
    }
  }

  /**
   * Requirement 16.2: Get real-time progress updates
   */
  public getProgressUpdates(): Map<string, ProgressUpdate> {
    return new Map(this.progressUpdates);
  }

  /**
   * Requirement 16.1: Sync learning preferences between devices within 30 seconds
   */
  public async syncPreferences(preferences: Partial<SyncablePreferences>): Promise<boolean> {
    try {
      // Update local preferences
      this.preferences = { ...this.preferences, ...preferences };

      // Store securely
      await this.securityService.storeSecureData('sync_preferences', this.preferences);

      // Send to paired devices
      if (this.pairingStatus === PairingStatus.PAIRED && this.networkService.isConnected()) {
        const syncData = {
          preferences: this.preferences,
          timestamp: Date.now(),
          deviceId: this.getLocalDeviceId()
        };

        const success = await this.networkService.sendSecureMessage('preference_sync', syncData);
        if (success) {
          this.setSyncStatus('preferences', SyncStatus.SUCCESS);
          return true;
        } else {
          throw new Error('Failed to send preferences to paired device');
        }
      } else {
        // Queue for offline sync
        await this.offlineService.queueOfflineOperation(
          OfflineOperationType.PREFERENCE_UPDATE,
          { preferences: this.preferences },
          3 // Highest priority
        );
        return true;
      }
    } catch (error) {
      this.setSyncStatus('preferences', SyncStatus.FAILED);
      this.errorHandlingService.handleProcessingFailure(
        'DeviceSynchronizationService',
        error as Error,
        { operation: 'syncPreferences' }
      );
      return false;
    }
  }

  /**
   * Requirement 16.4: Offline sync queuing with conflict resolution
   */
  public async processOfflineSync(): Promise<{
    processed: number;
    conflicts: SyncConflict[];
  }> {
    try {
      this.setSyncStatus('offline_queue', SyncStatus.SYNCING);

      // Process queued operations
      const result = await this.offlineService.processQueuedOperations();
      
      // Convert offline conflicts to sync conflicts
      const syncConflicts: SyncConflict[] = result.conflicts.map(conflict => ({
        id: this.generateConflictId(),
        type: this.mapConflictType(conflict.type),
        localValue: conflict.localData,
        remoteValue: conflict.remoteData,
        timestamp: new Date()
      }));

      // Store conflicts for resolution
      syncConflicts.forEach(conflict => {
        this.pendingConflicts.set(conflict.id, conflict);
      });

      if (syncConflicts.length > 0) {
        this.setSyncStatus('offline_queue', SyncStatus.CONFLICT);
        this.notifyListeners({
          type: 'conflict_detected',
          message: `${syncConflicts.length} sync conflicts detected`,
          data: { conflicts: syncConflicts },
          timestamp: new Date()
        });
      } else {
        this.setSyncStatus('offline_queue', SyncStatus.SUCCESS);
      }

      return {
        processed: result.processed,
        conflicts: syncConflicts
      };
    } catch (error) {
      this.setSyncStatus('offline_queue', SyncStatus.FAILED);
      this.errorHandlingService.handleProcessingFailure(
        'DeviceSynchronizationService',
        error as Error,
        { operation: 'processOfflineSync' }
      );
      return { processed: 0, conflicts: [] };
    }
  }

  /**
   * Requirement 16.5: Sync conflict resolution
   */
  public async resolveConflict(
    conflictId: string, 
    resolution: 'use_local' | 'use_remote' | 'merge'
  ): Promise<boolean> {
    try {
      const conflict = this.pendingConflicts.get(conflictId);
      if (!conflict) {
        throw new Error(`Conflict ${conflictId} not found`);
      }

      conflict.resolution = resolution;

      // Apply resolution based on type
      let resolvedValue: any;
      switch (resolution) {
        case 'use_local':
          resolvedValue = conflict.localValue;
          break;
        case 'use_remote':
          resolvedValue = conflict.remoteValue;
          break;
        case 'merge':
          resolvedValue = await this.mergeConflictValues(conflict);
          break;
      }

      // Apply resolved value
      await this.applyResolvedValue(conflict.type, resolvedValue);

      // Remove from pending conflicts
      this.pendingConflicts.delete(conflictId);

      // Notify paired devices of resolution
      if (this.networkService.isConnected()) {
        await this.networkService.sendSecureMessage('conflict_resolved', {
          conflictId,
          resolution,
          resolvedValue,
          timestamp: Date.now()
        });
      }

      return true;
    } catch (error) {
      this.errorHandlingService.handleProcessingFailure(
        'DeviceSynchronizationService',
        error as Error,
        { operation: 'resolveConflict', conflictId }
      );
      return false;
    }
  }

  /**
   * Requirement 16.5: Get pending sync conflicts
   */
  public getPendingConflicts(): SyncConflict[] {
    return Array.from(this.pendingConflicts.values());
  }

  /**
   * Get current sync status for all data types
   */
  public getSyncStatus(): Map<string, SyncStatus> {
    return new Map(this.syncStatus);
  }

  /**
   * Get current pairing status
   */
  public getPairingStatus(): PairingStatus {
    return this.pairingStatus;
  }

  /**
   * Get paired devices
   */
  public getPairedDevices(): DeviceInfo[] {
    return Array.from(this.pairedDevices.values());
  }

  /**
   * Register for sync notifications
   */
  public onSyncNotification(callback: SyncNotificationCallback): void {
    this.notificationCallbacks.push(callback);
  }

  /**
   * Unregister sync notification callback
   */
  public offSyncNotification(callback: SyncNotificationCallback): void {
    const index = this.notificationCallbacks.indexOf(callback);
    if (index > -1) {
      this.notificationCallbacks.splice(index, 1);
    }
  }

  /**
   * Force immediate sync
   */
  public async forceSync(): Promise<boolean> {
    try {
      if (this.pairingStatus !== PairingStatus.PAIRED) {
        throw new Error('No paired device available');
      }

      this.notifyListeners({
        type: 'sync_started',
        message: 'Starting forced sync',
        timestamp: new Date()
      });

      // Sync preferences
      await this.syncPreferences(this.preferences);

      // Process offline queue
      await this.processOfflineSync();

      // Sync progress updates
      await this.syncProgressUpdates();

      this.notifyListeners({
        type: 'sync_completed',
        message: 'Forced sync completed successfully',
        timestamp: new Date()
      });

      return true;
    } catch (error) {
      this.notifyListeners({
        type: 'sync_failed',
        message: `Forced sync failed: ${(error as Error).message}`,
        timestamp: new Date()
      });
      return false;
    }
  }

  /**
   * Disconnect from paired device
   */
  public async disconnect(): Promise<void> {
    try {
      // Stop sync processes
      this.stopSyncProcess();
      this.stopHeartbeat();

      // Notify paired devices
      if (this.networkService.isConnected()) {
        await this.networkService.sendSecureMessage('disconnect', {
          deviceId: this.getLocalDeviceId(),
          timestamp: Date.now()
        });
      }

      // Disconnect network
      this.networkService.disconnect();

      // Update status
      this.pairingStatus = PairingStatus.NOT_PAIRED;
      this.pairedDevices.clear();

      // Clear sync status
      this.syncStatus.clear();

      this.notifyListeners({
        type: 'connection_lost',
        message: 'Disconnected from paired device',
        timestamp: new Date()
      });
    } catch (error) {
      console.error('Error during disconnect:', error);
    }
  }

  // Private helper methods

  private initializeMessageHandlers(): void {
    this.networkService.registerMessageHandler('device_info_request', (data) => {
      this.handleDeviceInfoRequest(data);
    });

    this.networkService.registerMessageHandler('device_info_response', (data) => {
      this.handleDeviceInfoResponse(data);
    });

    this.networkService.registerMessageHandler('auth_request', (data) => {
      this.handleAuthRequest(data);
    });

    this.networkService.registerMessageHandler('preference_sync', (data) => {
      this.handlePreferenceSync(data);
    });

    this.networkService.registerMessageHandler('progress_update', (data) => {
      this.handleProgressUpdate(data);
    });

    this.networkService.registerMessageHandler('heartbeat', (data) => {
      this.handleHeartbeat(data);
    });

    this.networkService.registerMessageHandler('disconnect', (data) => {
      this.handleDisconnect(data);
    });
  }

  private async exchangeDeviceInfo(deviceName: string): Promise<DeviceInfo | null> {
    try {
      const localDeviceInfo = this.getLocalDeviceInfo(deviceName);
      
      // Send device info request
      await this.networkService.sendSecureMessage('device_info_request', localDeviceInfo);

      // Wait for response
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          resolve(null);
        }, 10000);

        this.networkService.registerMessageHandler('device_info_response', (data) => {
          clearTimeout(timeout);
          this.networkService.unregisterMessageHandler('device_info_response');
          resolve(data as DeviceInfo);
        });
      });
    } catch (error) {
      console.error('Device info exchange failed:', error);
      return null;
    }
  }

  private getLocalDeviceInfo(name: string): DeviceInfo {
    return {
      id: this.getLocalDeviceId(),
      name,
      platform: this.getLocalPlatform(),
      version: '1.0.0',
      capabilities: ['sync', 'progress_updates', 'offline_queue'],
      lastSeen: new Date()
    };
  }

  private getLocalDeviceId(): string {
    // In a real implementation, this would be a persistent device identifier
    return `device_${Date.now()}`;
  }

  private getLocalPlatform(): 'ios' | 'macos' {
    // In a real implementation, this would detect the actual platform
    return 'ios';
  }

  private generateAuthChallenge(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }

  private verifyAuthResponse(data: any, challenge: string): boolean {
    // In a real implementation, this would perform proper cryptographic verification
    return data && data.challenge === challenge;
  }

  private startSyncProcess(): void {
    this.syncInterval = setInterval(async () => {
      try {
        await this.performPeriodicSync();
      } catch (error) {
        console.error('Periodic sync failed:', error);
      }
    }, this.SYNC_INTERVAL_MS);
  }

  private stopSyncProcess(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = undefined;
    }
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(async () => {
      try {
        if (this.networkService.isConnected()) {
          await this.networkService.sendSecureMessage('heartbeat', {
            deviceId: this.getLocalDeviceId(),
            timestamp: Date.now()
          });
        }
      } catch (error) {
        console.error('Heartbeat failed:', error);
        this.handleConnectionLost();
      }
    }, this.HEARTBEAT_INTERVAL_MS);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = undefined;
    }
  }

  private async performPeriodicSync(): Promise<void> {
    if (this.pairingStatus !== PairingStatus.PAIRED || !this.networkService.isConnected()) {
      return;
    }

    // Sync preferences if they've changed
    await this.syncPreferences(this.preferences);

    // Process offline queue
    await this.processOfflineSync();

    // Sync progress updates
    await this.syncProgressUpdates();
  }

  private async syncProgressUpdates(): Promise<void> {
    try {
      const updates = Array.from(this.progressUpdates.values());
      if (updates.length > 0) {
        await this.networkService.sendSecureMessage('progress_sync', {
          updates,
          timestamp: Date.now()
        });
      }
    } catch (error) {
      console.error('Failed to sync progress updates:', error);
    }
  }

  private handleConnectionLost(): void {
    this.pairingStatus = PairingStatus.CONNECTION_LOST;
    this.notifyListeners({
      type: 'connection_lost',
      message: 'Connection to paired device lost',
      timestamp: new Date()
    });
  }

  private setSyncStatus(dataType: string, status: SyncStatus): void {
    this.syncStatus.set(dataType, status);
  }

  private notifyListeners(notification: SyncNotification): void {
    this.notificationCallbacks.forEach(callback => {
      try {
        callback(notification);
      } catch (error) {
        console.error('Sync notification callback failed:', error);
      }
    });
  }

  private getDefaultPreferences(): SyncablePreferences {
    return {
      utilityScoreThresholds: {
        high: 80,
        medium: 50,
        low: 20
      },
      recommendationSettings: {
        autoApproveHighConfidence: false,
        showExplanations: true,
        batchSize: 10
      },
      learningPreferences: {
        adaptToFeedback: true,
        shareAcrossDevices: true,
        retentionDays: 90
      },
      privacySettings: {
        requireBiometricAuth: true,
        clearDataOnBackground: true,
        encryptionLevel: 'high'
      }
    };
  }

  private async loadPersistedState(): Promise<void> {
    try {
      const preferences = await this.securityService.retrieveSecureData<SyncablePreferences>('sync_preferences');
      if (preferences) {
        this.preferences = preferences;
      }
    } catch (error) {
      console.error('Failed to load persisted state:', error);
    }
  }

  private async persistPairingState(): Promise<void> {
    try {
      const pairingData = {
        status: this.pairingStatus,
        devices: Array.from(this.pairedDevices.entries()),
        timestamp: Date.now()
      };
      await this.securityService.storeSecureData('pairing_state', pairingData);
    } catch (error) {
      console.error('Failed to persist pairing state:', error);
    }
  }

  private generateConflictId(): string {
    return `conflict_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private mapConflictType(offlineConflictType: string): 'preference' | 'progress' | 'learning_data' {
    switch (offlineConflictType) {
      case 'preference_changed':
        return 'preference';
      case 'note_modified':
        return 'progress';
      default:
        return 'learning_data';
    }
  }

  private async mergeConflictValues(conflict: SyncConflict): Promise<any> {
    // Simple merge strategy - in a real implementation, this would be more sophisticated
    if (conflict.type === 'preference') {
      return { ...conflict.remoteValue, ...conflict.localValue };
    }
    return conflict.localValue; // Default to local value
  }

  private async applyResolvedValue(type: 'preference' | 'progress' | 'learning_data', value: any): Promise<void> {
    switch (type) {
      case 'preference':
        this.preferences = value;
        await this.securityService.storeSecureData('sync_preferences', this.preferences);
        break;
      case 'progress':
        // Apply progress updates
        if (value.taskId) {
          this.progressUpdates.set(value.taskId, value);
        }
        break;
      case 'learning_data':
        // Apply learning data updates
        break;
    }
  }

  // Message handlers

  private async handleDeviceInfoRequest(data: DeviceInfo): Promise<void> {
    const response = this.getLocalDeviceInfo(data.name);
    await this.networkService.sendSecureMessage('device_info_response', response);
  }

  private handleDeviceInfoResponse(data: DeviceInfo): void {
    // This is handled in the exchangeDeviceInfo method
  }

  private async handleAuthRequest(data: any): Promise<void> {
    // Respond to authentication challenge
    const response = {
      challenge: data.challenge,
      deviceId: this.getLocalDeviceId(),
      timestamp: Date.now()
    };
    await this.networkService.sendSecureMessage('auth_response', response);
  }

  private async handlePreferenceSync(data: any): Promise<void> {
    try {
      // Check for conflicts
      const hasConflict = this.detectPreferenceConflict(data.preferences);
      
      if (hasConflict) {
        const conflict: SyncConflict = {
          id: this.generateConflictId(),
          type: 'preference',
          localValue: this.preferences,
          remoteValue: data.preferences,
          timestamp: new Date()
        };
        this.pendingConflicts.set(conflict.id, conflict);
        this.setSyncStatus('preferences', SyncStatus.CONFLICT);
      } else {
        // No conflict, apply remote preferences
        this.preferences = { ...this.preferences, ...data.preferences };
        await this.securityService.storeSecureData('sync_preferences', this.preferences);
        this.setSyncStatus('preferences', SyncStatus.SUCCESS);
      }
    } catch (error) {
      console.error('Failed to handle preference sync:', error);
      this.setSyncStatus('preferences', SyncStatus.FAILED);
    }
  }

  private handleProgressUpdate(data: ProgressUpdate): void {
    this.progressUpdates.set(data.taskId, data);
  }

  private handleHeartbeat(data: any): void {
    // Update last seen time for the device
    const deviceId = data.deviceId;
    const device = this.pairedDevices.get(deviceId);
    if (device) {
      device.lastSeen = new Date();
      this.pairedDevices.set(deviceId, device);
    }
  }

  private handleDisconnect(data: any): void {
    const deviceId = data.deviceId;
    this.pairedDevices.delete(deviceId);
    
    if (this.pairedDevices.size === 0) {
      this.pairingStatus = PairingStatus.NOT_PAIRED;
    }

    this.notifyListeners({
      type: 'connection_lost',
      message: `Device ${deviceId} disconnected`,
      timestamp: new Date()
    });
  }

  private detectPreferenceConflict(remotePreferences: SyncablePreferences): boolean {
    // Simple conflict detection - check if preferences have been modified recently
    // In a real implementation, this would use timestamps and version vectors
    return JSON.stringify(this.preferences) !== JSON.stringify(remotePreferences);
  }

  /**
   * Cleanup resources
   */
  public shutdown(): void {
    this.stopSyncProcess();
    this.stopHeartbeat();
    this.networkService.disconnect();
    this.notificationCallbacks.length = 0;
  }
}

export default DeviceSynchronizationService;