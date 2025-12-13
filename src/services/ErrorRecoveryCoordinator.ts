import { ErrorHandlingService, ErrorInfo, ErrorCategory, ErrorSeverity } from './ErrorHandlingService';
import { CheckpointService, ProcessingStage, RecoveryInfo } from './CheckpointService';
import { OfflineOperationService, OfflineDataStatus } from './OfflineOperationService';
import { SecureCacheService } from './SecureCacheService';

/**
 * System health status
 */
export interface SystemHealthStatus {
  overall: 'healthy' | 'degraded' | 'critical';
  components: {
    api: 'online' | 'offline' | 'degraded';
    cache: 'available' | 'limited' | 'unavailable';
    processing: 'normal' | 'reduced' | 'suspended';
    network: 'connected' | 'disconnected' | 'unstable';
  };
  errors: {
    critical: number;
    warnings: number;
    recent: number;
  };
  recovery: {
    checkpointAvailable: boolean;
    offlineDataAvailable: boolean;
    queuedOperations: number;
  };
}

/**
 * Recovery strategy recommendation
 */
export interface RecoveryStrategy {
  immediate: string[];
  shortTerm: string[];
  longTerm: string[];
  userActions: string[];
  systemActions: string[];
}

/**
 * Error recovery coordinator that manages all error handling and recovery services
 * Implements comprehensive error handling for requirements 15.1-15.5
 */
export class ErrorRecoveryCoordinator {
  private errorHandlingService: ErrorHandlingService;
  private checkpointService: CheckpointService;
  private offlineOperationService: OfflineOperationService;
  private cacheService: SecureCacheService;
  private healthCheckInterval?: NodeJS.Timeout;
  private lastHealthCheck?: SystemHealthStatus;

  constructor(
    errorHandlingService: ErrorHandlingService,
    checkpointService: CheckpointService,
    offlineOperationService: OfflineOperationService,
    cacheService: SecureCacheService
  ) {
    this.errorHandlingService = errorHandlingService;
    this.checkpointService = checkpointService;
    this.offlineOperationService = offlineOperationService;
    this.cacheService = cacheService;

    this.initializeErrorRecovery();
  }

  /**
   * Initialize error recovery system
   */
  private initializeErrorRecovery(): void {
    // Set up error monitoring
    this.errorHandlingService.onError((error) => {
      this.handleSystemError(error);
    });

    // Set up network monitoring
    this.offlineOperationService.onOffline(() => {
      this.handleNetworkDisconnection();
    });

    this.offlineOperationService.onOnline(() => {
      this.handleNetworkReconnection();
    });

    // Start periodic health checks
    this.startHealthMonitoring();

    // Check for recovery on startup
    this.performStartupRecovery();
  }

  /**
   * Perform startup recovery check
   * Requirement 15.3: Crash recovery with checkpoint resumption
   */
  private async performStartupRecovery(): Promise<void> {
    try {
      console.info('Checking for recovery opportunities...');

      // Check for checkpoint recovery
      const recoveryInfo = await this.checkpointService.checkForRecovery();
      
      if (recoveryInfo.canRecover) {
        console.info('Recovery checkpoint found, attempting to resume...');
        
        // Validate recovery data integrity
        if (!recoveryInfo.dataIntegrityCheck.passed) {
          console.warn('Data integrity issues detected:', recoveryInfo.dataIntegrityCheck.issues);
        }

        // Resume from checkpoint
        await this.checkpointService.resumeFromCheckpoint(recoveryInfo);
        
        console.info(`Successfully resumed from checkpoint at stage: ${recoveryInfo.resumeFromStage}`);
      }

      // Check offline operation queue
      const offlineStatus = await this.offlineOperationService.getOfflineDataStatus();
      if (offlineStatus.operationsQueued > 0) {
        console.info(`Found ${offlineStatus.operationsQueued} queued operations`);
        
        if (this.offlineOperationService.isSystemOnline()) {
          // Process queued operations
          const syncResult = await this.offlineOperationService.processQueuedOperations();
          console.info(`Processed queued operations: ${syncResult.processed} successful, ${syncResult.failed} failed`);
        }
      }

    } catch (error) {
      console.error('Startup recovery failed:', error);
      
      this.errorHandlingService.handleProcessingFailure(
        'ErrorRecoveryCoordinator',
        error as Error,
        { operation: 'startupRecovery' }
      );
    }
  }

  /**
   * Handle system errors and coordinate recovery
   */
  private async handleSystemError(error: ErrorInfo): Promise<void> {
    try {
      // Log error to checkpoint if processing is active
      await this.checkpointService.addError(error.id);

      // Determine if immediate action is needed
      if (error.severity === ErrorSeverity.CRITICAL) {
        await this.handleCriticalError(error);
      } else if (error.category === ErrorCategory.API_FAILURE) {
        await this.handleAPIError(error);
      } else if (error.category === ErrorCategory.NETWORK_FAILURE) {
        await this.handleNetworkError(error);
      }

    } catch (recoveryError) {
      console.error('Error recovery handling failed:', recoveryError);
    }
  }

  /**
   * Handle critical system errors
   */
  private async handleCriticalError(error: ErrorInfo): Promise<void> {
    console.error('Critical error detected:', error.message);

    // Create emergency checkpoint if processing is active
    const progress = this.checkpointService.getProcessingProgress();
    if (progress) {
      try {
        await this.checkpointService.updateCheckpoint(progress.stage);
        console.info('Emergency checkpoint created');
      } catch (checkpointError) {
        console.error('Failed to create emergency checkpoint:', checkpointError);
      }
    }

    // Switch to offline mode if network-related
    if (error.category === ErrorCategory.NETWORK_FAILURE || 
        error.category === ErrorCategory.API_FAILURE) {
      await this.offlineOperationService.handleConnectivityChange(false);
    }
  }

  /**
   * Handle API-related errors
   */
  private async handleAPIError(error: ErrorInfo): Promise<void> {
    console.warn('API error detected:', error.message);

    // Check if we should switch to offline mode
    const recentAPIErrors = this.errorHandlingService.getErrorsByCategory(ErrorCategory.API_FAILURE);
    const recentErrors = recentAPIErrors.filter(e => 
      Date.now() - e.timestamp.getTime() < 5 * 60 * 1000 // Last 5 minutes
    );

    if (recentErrors.length >= 3) {
      console.warn('Multiple API errors detected, switching to offline mode');
      await this.offlineOperationService.handleConnectivityChange(false);
    }
  }

  /**
   * Handle network-related errors
   */
  private async handleNetworkError(error: ErrorInfo): Promise<void> {
    console.warn('Network error detected:', error.message);
    
    // Ensure offline mode is activated
    if (this.offlineOperationService.isSystemOnline()) {
      await this.offlineOperationService.handleConnectivityChange(false);
    }
  }

  /**
   * Handle network disconnection
   */
  private async handleNetworkDisconnection(): Promise<void> {
    console.info('Handling network disconnection...');

    // Create checkpoint if processing is active
    const progress = this.checkpointService.getProcessingProgress();
    if (progress) {
      try {
        await this.checkpointService.updateCheckpoint(progress.stage);
        console.info('Checkpoint created due to network disconnection');
      } catch (error) {
        console.error('Failed to create disconnection checkpoint:', error);
      }
    }
  }

  /**
   * Handle network reconnection
   */
  private async handleNetworkReconnection(): Promise<void> {
    console.info('Handling network reconnection...');

    try {
      // Process any queued operations
      const syncResult = await this.offlineOperationService.processQueuedOperations();
      
      if (syncResult.processed > 0) {
        console.info(`Synced ${syncResult.processed} operations after reconnection`);
      }

      if (syncResult.conflicts.length > 0) {
        console.warn(`${syncResult.conflicts.length} sync conflicts detected`);
        // In a real implementation, would notify user about conflicts
      }

    } catch (error) {
      console.error('Reconnection sync failed:', error);
    }
  }

  /**
   * Get current system health status
   */
  async getSystemHealthStatus(): Promise<SystemHealthStatus> {
    try {
      const errorStats = this.errorHandlingService.getErrorStatistics();
      const offlineStatus = await this.offlineOperationService.getOfflineDataStatus();
      const processingProgress = this.checkpointService.getProcessingProgress();
      const isOnline = this.offlineOperationService.isSystemOnline();

      // Determine component health
      const components = {
        api: isOnline ? 'online' as const : 'offline' as const,
        cache: offlineStatus.notesAvailable > 0 ? 'available' as const : 'limited' as const,
        processing: processingProgress ? 'normal' as const : 'suspended' as const,
        network: isOnline ? 'connected' as const : 'disconnected' as const
      };

      // Determine overall health
      let overall: 'healthy' | 'degraded' | 'critical' = 'healthy';
      
      if (errorStats.errorsBySeverity.critical > 0) {
        overall = 'critical';
      } else if (errorStats.errorsBySeverity.error > 0 || !isOnline) {
        overall = 'degraded';
      }

      const healthStatus: SystemHealthStatus = {
        overall,
        components,
        errors: {
          critical: errorStats.errorsBySeverity.critical || 0,
          warnings: errorStats.errorsBySeverity.warning || 0,
          recent: errorStats.recentErrors
        },
        recovery: {
          checkpointAvailable: processingProgress !== null,
          offlineDataAvailable: offlineStatus.notesAvailable > 0,
          queuedOperations: offlineStatus.operationsQueued
        }
      };

      this.lastHealthCheck = healthStatus;
      return healthStatus;

    } catch (error) {
      console.error('Health check failed:', error);
      
      return {
        overall: 'critical',
        components: {
          api: 'offline',
          cache: 'unavailable',
          processing: 'suspended',
          network: 'disconnected'
        },
        errors: {
          critical: 1,
          warnings: 0,
          recent: 1
        },
        recovery: {
          checkpointAvailable: false,
          offlineDataAvailable: false,
          queuedOperations: 0
        }
      };
    }
  }

  /**
   * Get recovery strategy recommendations
   * Requirement 15.5: User-friendly error messages with recovery suggestions
   */
  async getRecoveryStrategy(): Promise<RecoveryStrategy> {
    const healthStatus = await this.getSystemHealthStatus();
    const strategy: RecoveryStrategy = {
      immediate: [],
      shortTerm: [],
      longTerm: [],
      userActions: [],
      systemActions: []
    };

    // Immediate actions based on current status
    if (healthStatus.overall === 'critical') {
      strategy.immediate.push('System is in critical state - restart recommended');
      strategy.userActions.push('Restart the application');
      strategy.systemActions.push('Create emergency backup of current state');
    }

    if (healthStatus.components.network === 'disconnected') {
      strategy.immediate.push('Network connectivity lost - working offline');
      strategy.userActions.push('Check your internet connection');
      strategy.systemActions.push('Queue operations for later sync');
    }

    if (healthStatus.components.api === 'offline') {
      strategy.immediate.push('Apple Notes API unavailable - using cached data');
      strategy.userActions.push('Check Apple Notes app permissions');
      strategy.systemActions.push('Retry API connection with exponential backoff');
    }

    // Short-term actions
    if (healthStatus.recovery.queuedOperations > 0) {
      strategy.shortTerm.push(`${healthStatus.recovery.queuedOperations} operations queued for sync`);
      strategy.systemActions.push('Process queued operations when connectivity restored');
    }

    if (healthStatus.errors.warnings > 5) {
      strategy.shortTerm.push('Multiple warnings detected - system performance may be affected');
      strategy.systemActions.push('Clear old error logs and optimize performance');
    }

    // Long-term actions
    if (healthStatus.errors.recent > 10) {
      strategy.longTerm.push('High error rate detected - investigate root causes');
      strategy.systemActions.push('Analyze error patterns and improve error handling');
    }

    if (!healthStatus.recovery.offlineDataAvailable) {
      strategy.longTerm.push('No offline data available - improve caching strategy');
      strategy.systemActions.push('Enhance data caching for better offline support');
    }

    return strategy;
  }

  /**
   * Force system recovery attempt
   */
  async forceRecovery(): Promise<{
    success: boolean;
    actions: string[];
    errors: string[];
  }> {
    const actions: string[] = [];
    const errors: string[] = [];

    try {
      // Clear old errors
      this.errorHandlingService.clearOldErrors(1); // Clear errors older than 1 hour
      actions.push('Cleared old error logs');

      // Clear old cached data
      await this.offlineOperationService.clearOldCachedData(24); // Clear data older than 24 hours
      actions.push('Cleared old cached data');

      // Clear old checkpoints
      await this.checkpointService.clearOldCheckpoints(24);
      actions.push('Cleared old checkpoints');

      // Force sync if online
      if (this.offlineOperationService.isSystemOnline()) {
        try {
          const syncSuccess = await this.offlineOperationService.forcSync();
          if (syncSuccess) {
            actions.push('Successfully synced queued operations');
          } else {
            errors.push('Sync failed - some operations may be lost');
          }
        } catch (syncError) {
          errors.push(`Sync error: ${syncError}`);
        }
      }

      return {
        success: errors.length === 0,
        actions,
        errors
      };

    } catch (error) {
      errors.push(`Recovery failed: ${error}`);
      return {
        success: false,
        actions,
        errors
      };
    }
  }

  /**
   * Start periodic health monitoring
   */
  private startHealthMonitoring(): void {
    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.getSystemHealthStatus();
      } catch (error) {
        console.error('Health monitoring failed:', error);
      }
    }, 60000); // Check every minute
  }

  /**
   * Stop health monitoring
   */
  private stopHealthMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }
  }

  /**
   * Shutdown error recovery coordinator
   */
  shutdown(): void {
    this.stopHealthMonitoring();
    this.offlineOperationService.shutdown();
  }
}