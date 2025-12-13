import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ErrorHandlingService, ErrorCategory, ErrorSeverity, RecoveryAction } from '../../src/services/ErrorHandlingService';

describe('ErrorHandlingService', () => {
  let errorHandlingService: ErrorHandlingService;
  let mockCallback: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    errorHandlingService = new ErrorHandlingService();
    mockCallback = vi.fn();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('OCR Failure Handling', () => {
    it('should handle OCR failure with fallback text', () => {
      const error = new Error('OCR processing failed');
      const noteId = 'test-note-123';
      const fallbackText = 'Available text content';

      const errorInfo = errorHandlingService.handleOCRFailure(error, noteId, fallbackText);

      expect(errorInfo.category).toBe(ErrorCategory.OCR_FAILURE);
      expect(errorInfo.severity).toBe(ErrorSeverity.WARNING);
      expect(errorInfo.message).toContain(noteId);
      expect(errorInfo.recoveryActions).toContain(RecoveryAction.FALLBACK);
      expect(errorInfo.recoveryActions).toContain(RecoveryAction.RETRY);
      expect(errorInfo.retryable).toBe(true);
      expect(errorInfo.context?.noteId).toBe(noteId);
      expect(errorInfo.context?.fallbackText).toBe(fallbackText);
    });

    it('should provide appropriate recovery suggestions for OCR failure', () => {
      const error = new Error('OCR processing failed');
      const errorInfo = errorHandlingService.handleOCRFailure(error, 'note-123');

      expect(errorInfo.recoverySuggestions).toContain('The system will continue with available text content');
      expect(errorInfo.recoverySuggestions).toContain('You can try processing this note again later');
      expect(errorInfo.recoverySuggestions).toContain('Check if the handwriting is clear and legible');
    });
  });

  describe('API Failure Handling with Exponential Backoff', () => {
    it('should retry API operations with exponential backoff', async () => {
      let attemptCount = 0;
      const mockOperation = vi.fn().mockImplementation(() => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error('API temporarily unavailable');
        }
        return Promise.resolve('success');
      });

      const result = await errorHandlingService.handleAPIFailure(
        mockOperation,
        'test operation'
      );

      expect(result).toBe('success');
      expect(mockOperation).toHaveBeenCalledTimes(3);
    });

    it('should fail after max retries', async () => {
      const mockOperation = vi.fn().mockRejectedValue(new Error('Persistent API failure'));

      await expect(
        errorHandlingService.handleAPIFailure(mockOperation, 'test operation')
      ).rejects.toThrow('Unable to connect to Apple Notes');

      expect(mockOperation).toHaveBeenCalledTimes(3); // Default max attempts
    });

    it('should use exponential backoff delays', async () => {
      const delays: number[] = [];
      const originalSetTimeout = global.setTimeout;
      
      global.setTimeout = vi.fn().mockImplementation((callback, delay) => {
        delays.push(delay);
        return originalSetTimeout(callback, 0); // Execute immediately for test
      });

      const mockOperation = vi.fn()
        .mockRejectedValueOnce(new Error('Failure 1'))
        .mockRejectedValueOnce(new Error('Failure 2'))
        .mockResolvedValueOnce('success');

      await errorHandlingService.handleAPIFailure(mockOperation, 'test operation');

      expect(delays).toHaveLength(2);
      expect(delays[0]).toBe(1000); // Initial delay
      expect(delays[1]).toBe(2000); // 2x backoff

      global.setTimeout = originalSetTimeout;
    });
  });

  describe('Network Failure Handling', () => {
    it('should handle network failure with cache available', () => {
      const errorInfo = errorHandlingService.handleNetworkFailure('sync operation', true);

      expect(errorInfo.category).toBe(ErrorCategory.NETWORK_FAILURE);
      expect(errorInfo.severity).toBe(ErrorSeverity.WARNING);
      expect(errorInfo.recoveryActions).toContain(RecoveryAction.CACHE_FALLBACK);
      expect(errorInfo.userFriendlyMessage).toContain('Working offline with cached data');
    });

    it('should handle network failure without cache', () => {
      const errorInfo = errorHandlingService.handleNetworkFailure('sync operation', false);

      expect(errorInfo.severity).toBe(ErrorSeverity.ERROR);
      expect(errorInfo.recoveryActions).toContain(RecoveryAction.RETRY);
      expect(errorInfo.recoveryActions).toContain(RecoveryAction.USER_INTERVENTION);
      expect(errorInfo.userFriendlyMessage).toContain('No internet connection');
    });
  });

  describe('Processing Failure Handling', () => {
    it('should handle processing failure with fallback available', () => {
      const error = new Error('Processing component failed');
      const errorInfo = errorHandlingService.handleProcessingFailure(
        'ContentExtractor',
        error,
        { noteId: 'test-123' },
        true
      );

      expect(errorInfo.category).toBe(ErrorCategory.PROCESSING_FAILURE);
      expect(errorInfo.severity).toBe(ErrorSeverity.WARNING);
      expect(errorInfo.recoveryActions).toContain(RecoveryAction.FALLBACK);
      expect(errorInfo.retryable).toBe(false); // With fallback, no retry needed
    });

    it('should handle processing failure without fallback', () => {
      const error = new Error('Critical processing failure');
      const errorInfo = errorHandlingService.handleProcessingFailure(
        'UtilityScorer',
        error,
        undefined,
        false
      );

      expect(errorInfo.severity).toBe(ErrorSeverity.ERROR);
      expect(errorInfo.recoveryActions).toContain(RecoveryAction.RETRY);
      expect(errorInfo.retryable).toBe(true);
    });
  });

  describe('User-Friendly Messages', () => {
    it('should create user-friendly messages with recovery suggestions', () => {
      const error = new Error('Test error');
      const errorInfo = errorHandlingService.handleOCRFailure(error, 'note-123');
      
      const userMessage = errorHandlingService.createUserFriendlyMessage(errorInfo);

      expect(userMessage).toContain(errorInfo.userFriendlyMessage);
      expect(userMessage).toContain('Suggested actions:');
      expect(userMessage).toContain('1. ');
      expect(userMessage).toContain('2. ');
    });
  });

  describe('Error Statistics and Management', () => {
    it('should track error statistics by category and severity', () => {
      const freshService = new ErrorHandlingService();
      
      // Create various errors
      freshService.handleOCRFailure(new Error('OCR error'), 'note-1');
      freshService.handleNetworkFailure('operation', false);
      freshService.handleProcessingFailure('component', new Error('processing error'));

      const stats = freshService.getErrorStatistics();

      expect(stats.totalErrors).toBe(3);
      expect(stats.errorsByCategory[ErrorCategory.OCR_FAILURE]).toBe(1);
      expect(stats.errorsByCategory[ErrorCategory.NETWORK_FAILURE]).toBe(1);
      expect(stats.errorsByCategory[ErrorCategory.PROCESSING_FAILURE]).toBe(1);
      expect(stats.errorsBySeverity[ErrorSeverity.WARNING]).toBeGreaterThan(0);
      expect(stats.errorsBySeverity[ErrorSeverity.ERROR]).toBeGreaterThan(0);
    });

    it('should get errors by category', () => {
      const freshService = new ErrorHandlingService();
      
      freshService.handleOCRFailure(new Error('OCR error 1'), 'note-1');
      freshService.handleOCRFailure(new Error('OCR error 2'), 'note-2');
      freshService.handleNetworkFailure('operation', false);

      const ocrErrors = freshService.getErrorsByCategory(ErrorCategory.OCR_FAILURE);
      const networkErrors = freshService.getErrorsByCategory(ErrorCategory.NETWORK_FAILURE);

      expect(ocrErrors).toHaveLength(2);
      expect(networkErrors).toHaveLength(1);
    });

    it('should clear old errors', async () => {
      const freshService = new ErrorHandlingService();
      
      // Create an error
      freshService.handleOCRFailure(new Error('Old error'), 'note-1');
      
      let stats = freshService.getErrorStatistics();
      expect(stats.totalErrors).toBe(1);

      // Wait a small amount to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));

      // Clear errors (using -1 hours to clear all, including future ones)
      freshService.clearOldErrors(-1);
      
      stats = freshService.getErrorStatistics();
      expect(stats.totalErrors).toBe(0);
    });
  });

  describe('Error Callbacks', () => {
    it('should notify callbacks when errors occur', () => {
      errorHandlingService.onError(mockCallback);

      const error = new Error('Test error');
      errorHandlingService.handleOCRFailure(error, 'note-123');

      expect(mockCallback).toHaveBeenCalledTimes(1);
      expect(mockCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          category: ErrorCategory.OCR_FAILURE,
          severity: ErrorSeverity.WARNING
        })
      );
    });

    it('should handle callback failures gracefully', () => {
      const failingCallback = vi.fn().mockImplementation(() => {
        throw new Error('Callback failed');
      });
      
      errorHandlingService.onError(failingCallback);
      errorHandlingService.onError(mockCallback);

      // Should not throw even if callback fails
      expect(() => {
        errorHandlingService.handleOCRFailure(new Error('Test'), 'note-123');
      }).not.toThrow();

      expect(failingCallback).toHaveBeenCalled();
      expect(mockCallback).toHaveBeenCalled();
    });
  });

  describe('Retry Logic', () => {
    it('should identify retryable errors', () => {
      const retryableError = errorHandlingService.handleOCRFailure(new Error('OCR failed'), 'note-123');
      const nonRetryableError = errorHandlingService.handleProcessingFailure(
        'component',
        new Error('error'),
        undefined,
        true // fallback available
      );

      expect(errorHandlingService.isRetryable(retryableError)).toBe(true);
      expect(errorHandlingService.isRetryable(nonRetryableError)).toBe(false);
    });

    it('should respect max retry limits', () => {
      const errorInfo = errorHandlingService.handleOCRFailure(new Error('OCR failed'), 'note-123');
      
      // Simulate retries
      errorInfo.currentRetries = errorInfo.maxRetries;
      
      expect(errorHandlingService.isRetryable(errorInfo)).toBe(false);
    });
  });
});