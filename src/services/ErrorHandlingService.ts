import { ProcessingError } from '../agents/ContentExtractorAgent';

/**
 * Error severity levels for classification
 */
export enum ErrorSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical'
}

/**
 * Error categories for better handling
 */
export enum ErrorCategory {
  OCR_FAILURE = 'ocr_failure',
  API_FAILURE = 'api_failure',
  NETWORK_FAILURE = 'network_failure',
  PROCESSING_FAILURE = 'processing_failure',
  PERMISSION_FAILURE = 'permission_failure',
  RESOURCE_FAILURE = 'resource_failure',
  UNKNOWN = 'unknown'
}

/**
 * Recovery action types
 */
export enum RecoveryAction {
  RETRY = 'retry',
  FALLBACK = 'fallback',
  SKIP = 'skip',
  CACHE_FALLBACK = 'cache_fallback',
  USER_INTERVENTION = 'user_intervention',
  RESTART_REQUIRED = 'restart_required'
}

/**
 * Error information with recovery suggestions
 */
export interface ErrorInfo {
  id: string;
  timestamp: Date;
  category: ErrorCategory;
  severity: ErrorSeverity;
  message: string;
  technicalDetails?: string;
  userFriendlyMessage: string;
  recoveryActions: RecoveryAction[];
  recoverySuggestions: string[];
  context?: Record<string, any>;
  retryable: boolean;
  maxRetries?: number;
  currentRetries?: number;
}

/**
 * Retry configuration for different error types
 */
export interface RetryConfig {
  maxAttempts: number;
  initialDelayMs: number;
  backoffMultiplier: number;
  maxDelayMs: number;
  retryableErrors: ErrorCategory[];
}

/**
 * Error handling and recovery service
 */
export class ErrorHandlingService {
  private errors: Map<string, ErrorInfo> = new Map();
  private retryConfig: RetryConfig;
  private errorCallbacks: ((error: ErrorInfo) => void)[] = [];

  constructor(retryConfig?: Partial<RetryConfig>) {
    this.retryConfig = {
      maxAttempts: 3,
      initialDelayMs: 1000,
      backoffMultiplier: 2,
      maxDelayMs: 30000,
      retryableErrors: [
        ErrorCategory.API_FAILURE,
        ErrorCategory.NETWORK_FAILURE,
        ErrorCategory.OCR_FAILURE
      ],
      ...retryConfig
    };
  }

  /**
   * Handle OCR processing failure with text-only fallback
   * Requirement 15.1: Graceful OCR failure handling
   */
  handleOCRFailure(error: Error, noteId: string, fallbackText?: string): ErrorInfo {
    const errorInfo: ErrorInfo = {
      id: this.generateErrorId(),
      timestamp: new Date(),
      category: ErrorCategory.OCR_FAILURE,
      severity: ErrorSeverity.WARNING,
      message: `OCR processing failed for note ${noteId}`,
      technicalDetails: error.message,
      userFriendlyMessage: 'Handwriting recognition failed, but text content is still available.',
      recoveryActions: [RecoveryAction.FALLBACK, RecoveryAction.RETRY],
      recoverySuggestions: [
        'The system will continue with available text content',
        'You can try processing this note again later',
        'Check if the handwriting is clear and legible'
      ],
      context: { noteId, fallbackText },
      retryable: true,
      maxRetries: 2,
      currentRetries: 0
    };

    this.logError(errorInfo);
    return errorInfo;
  }

  /**
   * Handle API failures with exponential backoff retry
   * Requirement 15.2: API retry logic with exponential backoff
   */
  async handleAPIFailure<T>(
    operation: () => Promise<T>,
    context: string,
    errorCategory: ErrorCategory = ErrorCategory.API_FAILURE
  ): Promise<T> {
    let lastError: Error;
    let attempt = 0;

    while (attempt < this.retryConfig.maxAttempts) {
      try {
        const result = await operation();
        
        // If we had previous failures but now succeeded, log recovery
        if (attempt > 0) {
          this.logRecovery(context, attempt);
        }
        
        return result;
      } catch (error) {
        lastError = error as Error;
        attempt++;

        if (attempt >= this.retryConfig.maxAttempts) {
          break;
        }

        // Calculate exponential backoff delay
        const delay = Math.min(
          this.retryConfig.initialDelayMs * Math.pow(this.retryConfig.backoffMultiplier, attempt - 1),
          this.retryConfig.maxDelayMs
        );

        const errorInfo: ErrorInfo = {
          id: this.generateErrorId(),
          timestamp: new Date(),
          category: errorCategory,
          severity: attempt === this.retryConfig.maxAttempts - 1 ? ErrorSeverity.ERROR : ErrorSeverity.WARNING,
          message: `API operation failed (attempt ${attempt}/${this.retryConfig.maxAttempts})`,
          technicalDetails: lastError.message,
          userFriendlyMessage: `Connection issue detected. Retrying in ${Math.round(delay / 1000)} seconds...`,
          recoveryActions: [RecoveryAction.RETRY],
          recoverySuggestions: [
            'The system is automatically retrying the operation',
            'Check your internet connection',
            'Ensure Apple Notes app has proper permissions'
          ],
          context: { operation: context, attempt, delay },
          retryable: true,
          maxRetries: this.retryConfig.maxAttempts,
          currentRetries: attempt
        };

        this.logError(errorInfo);

        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    // All retries failed, create final error
    const finalError: ErrorInfo = {
      id: this.generateErrorId(),
      timestamp: new Date(),
      category: errorCategory,
      severity: ErrorSeverity.ERROR,
      message: `API operation failed after ${this.retryConfig.maxAttempts} attempts`,
      technicalDetails: lastError!.message,
      userFriendlyMessage: 'Unable to connect to Apple Notes. Please check your connection and try again.',
      recoveryActions: [RecoveryAction.CACHE_FALLBACK, RecoveryAction.USER_INTERVENTION],
      recoverySuggestions: [
        'Check your internet connection',
        'Restart the Apple Notes app',
        'Check system permissions for Notes access',
        'Try again in a few minutes'
      ],
      context: { operation: context, totalAttempts: attempt },
      retryable: false
    };

    this.logError(finalError);
    throw new Error(finalError.userFriendlyMessage);
  }

  /**
   * Handle network connectivity issues
   * Requirement 15.4: Offline operation with locally cached data
   */
  handleNetworkFailure(operation: string, cacheAvailable: boolean = false): ErrorInfo {
    const errorInfo: ErrorInfo = {
      id: this.generateErrorId(),
      timestamp: new Date(),
      category: ErrorCategory.NETWORK_FAILURE,
      severity: cacheAvailable ? ErrorSeverity.WARNING : ErrorSeverity.ERROR,
      message: `Network connectivity lost during ${operation}`,
      userFriendlyMessage: cacheAvailable 
        ? 'Working offline with cached data. Some features may be limited.'
        : 'No internet connection. Please check your network and try again.',
      recoveryActions: cacheAvailable 
        ? [RecoveryAction.CACHE_FALLBACK] 
        : [RecoveryAction.RETRY, RecoveryAction.USER_INTERVENTION],
      recoverySuggestions: cacheAvailable
        ? [
            'The app is working with locally cached data',
            'Changes will sync when connection is restored',
            'Some features may be temporarily unavailable'
          ]
        : [
            'Check your Wi-Fi or cellular connection',
            'Try moving to an area with better signal',
            'Restart your network connection'
          ],
      context: { operation, cacheAvailable },
      retryable: true,
      maxRetries: 5
    };

    this.logError(errorInfo);
    return errorInfo;
  }

  /**
   * Handle processing failures with appropriate fallbacks
   */
  handleProcessingFailure(
    component: string, 
    error: Error, 
    context?: Record<string, any>,
    fallbackAvailable: boolean = false
  ): ErrorInfo {
    const errorInfo: ErrorInfo = {
      id: this.generateErrorId(),
      timestamp: new Date(),
      category: ErrorCategory.PROCESSING_FAILURE,
      severity: fallbackAvailable ? ErrorSeverity.WARNING : ErrorSeverity.ERROR,
      message: `Processing failed in ${component}`,
      technicalDetails: error.message,
      userFriendlyMessage: fallbackAvailable
        ? `${component} encountered an issue but will continue with reduced functionality.`
        : `${component} failed to process your request. Please try again.`,
      recoveryActions: fallbackAvailable 
        ? [RecoveryAction.FALLBACK] 
        : [RecoveryAction.RETRY, RecoveryAction.USER_INTERVENTION],
      recoverySuggestions: fallbackAvailable
        ? [
            'The system is using a simplified processing method',
            'Some advanced features may be temporarily unavailable',
            'Results may be less detailed than usual'
          ]
        : [
            'Try the operation again',
            'Restart the application if the problem persists',
            'Check if you have sufficient device storage and memory'
          ],
      context: { component, ...context },
      retryable: !fallbackAvailable
    };

    this.logError(errorInfo);
    return errorInfo;
  }

  /**
   * Handle permission-related errors
   */
  handlePermissionFailure(permissionType: string, canRecover: boolean = true): ErrorInfo {
    const errorInfo: ErrorInfo = {
      id: this.generateErrorId(),
      timestamp: new Date(),
      category: ErrorCategory.PERMISSION_FAILURE,
      severity: ErrorSeverity.ERROR,
      message: `Permission denied for ${permissionType}`,
      userFriendlyMessage: `Access to ${permissionType} is required for this feature to work.`,
      recoveryActions: canRecover 
        ? [RecoveryAction.USER_INTERVENTION] 
        : [RecoveryAction.RESTART_REQUIRED],
      recoverySuggestions: canRecover
        ? [
            `Grant permission for ${permissionType} in Settings`,
            'Restart the app after changing permissions',
            'Check system privacy settings'
          ]
        : [
            'This feature requires system permissions that cannot be granted',
            'Some functionality will be unavailable',
            'Consider using alternative methods'
          ],
      context: { permissionType, canRecover },
      retryable: canRecover
    };

    this.logError(errorInfo);
    return errorInfo;
  }

  /**
   * Handle resource exhaustion (memory, CPU, storage)
   */
  handleResourceFailure(resourceType: string, currentUsage?: number, limit?: number): ErrorInfo {
    const errorInfo: ErrorInfo = {
      id: this.generateErrorId(),
      timestamp: new Date(),
      category: ErrorCategory.RESOURCE_FAILURE,
      severity: ErrorSeverity.WARNING,
      message: `${resourceType} resources exhausted`,
      userFriendlyMessage: `System resources are running low. Processing may be slower.`,
      recoveryActions: [RecoveryAction.FALLBACK, RecoveryAction.RETRY],
      recoverySuggestions: [
        'Close other apps to free up resources',
        'Wait for current operations to complete',
        'Try processing fewer items at once',
        'Restart the app if performance is severely affected'
      ],
      context: { resourceType, currentUsage, limit },
      retryable: true,
      maxRetries: 2
    };

    this.logError(errorInfo);
    return errorInfo;
  }

  /**
   * Create user-friendly error message with recovery suggestions
   * Requirement 15.5: User-friendly error messages with recovery suggestions
   */
  createUserFriendlyMessage(error: ErrorInfo): string {
    let message = error.userFriendlyMessage;
    
    if (error.recoverySuggestions.length > 0) {
      message += '\n\nSuggested actions:';
      error.recoverySuggestions.forEach((suggestion, index) => {
        message += `\n${index + 1}. ${suggestion}`;
      });
    }

    return message;
  }

  /**
   * Check if an error is retryable
   */
  isRetryable(error: ErrorInfo): boolean {
    return error.retryable && 
           (error.currentRetries || 0) < (error.maxRetries || this.retryConfig.maxAttempts);
  }

  /**
   * Get all errors of a specific category
   */
  getErrorsByCategory(category: ErrorCategory): ErrorInfo[] {
    return Array.from(this.errors.values()).filter(error => error.category === category);
  }

  /**
   * Get recent errors (last hour)
   */
  getRecentErrors(hoursBack: number = 1): ErrorInfo[] {
    const cutoff = new Date(Date.now() - hoursBack * 60 * 60 * 1000);
    return Array.from(this.errors.values()).filter(error => error.timestamp > cutoff);
  }

  /**
   * Clear old errors to prevent memory buildup
   */
  clearOldErrors(hoursBack: number = 24): void {
    const cutoff = new Date(Date.now() - hoursBack * 60 * 60 * 1000);
    for (const [id, error] of this.errors.entries()) {
      if (error.timestamp < cutoff) {
        this.errors.delete(id);
      }
    }
  }

  /**
   * Register callback for error notifications
   */
  onError(callback: (error: ErrorInfo) => void): void {
    this.errorCallbacks.push(callback);
  }

  /**
   * Get error statistics
   */
  getErrorStatistics(): {
    totalErrors: number;
    errorsByCategory: Record<ErrorCategory, number>;
    errorsBySeverity: Record<ErrorSeverity, number>;
    recentErrors: number;
  } {
    const errors = Array.from(this.errors.values());
    const recentCutoff = new Date(Date.now() - 60 * 60 * 1000); // Last hour

    const errorsByCategory = {} as Record<ErrorCategory, number>;
    const errorsBySeverity = {} as Record<ErrorSeverity, number>;

    // Initialize counters
    Object.values(ErrorCategory).forEach(category => {
      errorsByCategory[category] = 0;
    });
    Object.values(ErrorSeverity).forEach(severity => {
      errorsBySeverity[severity] = 0;
    });

    // Count errors
    errors.forEach(error => {
      errorsByCategory[error.category]++;
      errorsBySeverity[error.severity]++;
    });

    return {
      totalErrors: errors.length,
      errorsByCategory,
      errorsBySeverity,
      recentErrors: errors.filter(error => error.timestamp > recentCutoff).length
    };
  }

  private logError(error: ErrorInfo): void {
    this.errors.set(error.id, error);
    
    // Log to console based on severity
    const logMessage = `[${error.severity.toUpperCase()}] ${error.message}`;
    switch (error.severity) {
      case ErrorSeverity.CRITICAL:
      case ErrorSeverity.ERROR:
        console.error(logMessage, error.technicalDetails);
        break;
      case ErrorSeverity.WARNING:
        console.warn(logMessage, error.technicalDetails);
        break;
      default:
        console.info(logMessage);
    }

    // Notify callbacks
    this.errorCallbacks.forEach(callback => {
      try {
        callback(error);
      } catch (callbackError) {
        console.error('Error callback failed:', callbackError);
      }
    });

    // Auto-cleanup old errors periodically
    if (this.errors.size > 1000) {
      this.clearOldErrors(24);
    }
  }

  private logRecovery(context: string, attempts: number): void {
    console.info(`Operation recovered after ${attempts} attempts: ${context}`);
  }

  private generateErrorId(): string {
    return `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Global error handling service instance
 */
export const errorHandlingService = new ErrorHandlingService();