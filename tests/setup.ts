/**
 * Test setup configuration for property-based testing
 */
import fc from 'fast-check';

// Configure fast-check for property-based testing
// Minimum 100 iterations as specified in design document
fc.configureGlobal({
  numRuns: 100,
  verbose: true,
  seed: 42, // For reproducible tests
  endOnFailure: true
});

// Global test utilities
export const testConfig = {
  minIterations: 100,
  maxIterations: 1000,
  timeout: 30000 // 30 seconds
};

// Test utilities for date handling
export const createTestDate = (dateString?: string): Date => {
  return dateString ? new Date(dateString) : new Date('2024-01-01T00:00:00Z');
};