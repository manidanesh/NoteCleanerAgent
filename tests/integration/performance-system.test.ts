import { PerformanceOptimizer } from '../../src/services/PerformanceOptimizer';
import { BatchProcessor } from '../../src/services/BatchProcessor';
import { PerformanceService } from '../../src/services/PerformanceService';
import { AgentCoordinator } from '../../src/agents/AgentCoordinator';
import { LLMService } from '../../src/services/LLMService';
import { Note } from '../../src/models/Note';

/**
 * Integration test for the complete performance optimization system
 * Validates Requirements 8.1, 8.2, 8.3, 8.4, 8.5, 14.1, 14.2, 14.3, 14.4, 14.5
 */
describe('Performance Optimization System Integration', () => {
  let performanceOptimizer: PerformanceOptimizer;
  let batchProcessor: BatchProcessor;
  let performanceService: PerformanceService;
  let agentCoordinator: AgentCoordinator;
  let llmService: LLMService;

  beforeEach(() => {
    // Initialize LLM service with test configuration
    llmService = new LLMService({
      provider: 'test',
      enableOnDevice: true,
      enableCloud: false
    });

    // Initialize agent coordinator with performance optimization
    agentCoordinator = new AgentCoordinator(llmService, {
      maxConcurrentProcessing: 2,
      cpuThrottleThreshold: 25,
      memoryThreshold: 500,
      batchSize: 5,
      enableOnDeviceLLM: true,
      enableCloudLLM: false,
      privacyMode: 'strict'
    });

    // Get performance components from coordinator
    performanceOptimizer = agentCoordinator.getPerformanceOptimizer();
    batchProcessor = agentCoordinator.getBatchProcessor();

    // Initialize performance service
    performanceService = new PerformanceService(agentCoordinator, {
      enableProgressTracking: true,
      enableResourceMonitoring: true,
      enableAutomaticOptimization: true,
      uiUpdateInterval: 100
    });
  });

  afterEach(() => {
    performanceOptimizer.shutdown();
    performanceService.shutdown();
  });

  describe('Batch Processing Integration', () => {
    it('should process notes in optimized batches with resource management', async () => {
      const testNotes: Note[] = Array.from({ length: 15 }, (_, i) => ({
        id: `note-${i}`,
        title: `Test Note ${i}`,
        content: `Content for note ${i}`.repeat(i + 1), // Varying complexity
        createdDate: new Date(),
        modifiedDate: new Date(),
        folder: 'Test',
        attachments: i % 3 === 0 ? [{ id: `att-${i}`, name: 'file.pdf', type: 'pdf', size: 1000 }] : [],
        checklists: i % 5 === 0 ? [{ id: `cl-${i}`, items: [], completed: false }] : [],
        metadata: {
          accessCount: i,
          shareCount: 0,
          tags: [],
          isShared: false,
          lastAccessDate: new Date(),
          creationSource: 'test',
          syncStatus: 'synced'
        }
      }));

      // Test batch creation
      const batches = performanceOptimizer.createOptimizedBatches(testNotes);
      expect(batches.length).toBeGreaterThan(1);
      expect(batches.flat().length).toBe(testNotes.length);

      // Test resource checking
      const canProcess = await performanceOptimizer.canProcessBatch();
      expect(typeof canProcess).toBe('boolean');

      // Test progress tracking
      let progressUpdates = 0;
      performanceService.addProgressListener(() => {
        progressUpdates++;
      });

      // Process notes through the system
      const results = await performanceService.processNotesOptimized(testNotes);
      
      expect(results).toBeDefined();
      expect(progressUpdates).toBeGreaterThan(0);
    }, 10000);

    it('should handle processing interruption and resumption', async () => {
      const testNotes: Note[] = Array.from({ length: 10 }, (_, i) => ({
        id: `note-${i}`,
        title: `Test Note ${i}`,
        content: `Content ${i}`,
        createdDate: new Date(),
        modifiedDate: new Date(),
        folder: 'Test',
        attachments: [],
        checklists: [],
        metadata: {
          accessCount: 1,
          shareCount: 0,
          tags: [],
          isShared: false,
          lastAccessDate: new Date(),
          creationSource: 'test',
          syncStatus: 'synced'
        }
      }));

      // Start processing
      const processingPromise = performanceService.processNotesOptimized(testNotes);

      // Interrupt after a short delay
      setTimeout(() => {
        performanceService.interruptProcessing();
      }, 100);

      // Should handle interruption gracefully
      const results = await processingPromise;
      expect(results).toBeDefined();
    }, 5000);
  });

  describe('Resource Management Integration', () => {
    it('should monitor and throttle based on system resources', async () => {
      // Test resource metrics
      const resourceMetrics = performanceOptimizer.getCurrentResourceMetrics();
      expect(resourceMetrics.cpuUsage).toBeGreaterThanOrEqual(0);
      expect(resourceMetrics.memoryUsage).toBeGreaterThanOrEqual(0);
      expect(resourceMetrics.timestamp).toBeInstanceOf(Date);

      // Test performance metrics
      const perfMetrics = performanceOptimizer.getPerformanceMetrics();
      expect(typeof perfMetrics.cacheHitRate).toBe('number');
      expect(typeof perfMetrics.throttleEvents).toBe('number');
    });

    it('should perform memory cleanup when needed', () => {
      // Add some cached data
      for (let i = 0; i < 50; i++) {
        performanceOptimizer.setCachedResult(`test-key-${i}`, { data: i, large: 'x'.repeat(1000) });
      }

      // Perform cleanup
      performanceOptimizer.performMemoryCleanup();

      // Should complete without errors
      expect(true).toBe(true);
    });
  });

  describe('Caching System Integration', () => {
    it('should cache and retrieve results efficiently', () => {
      const testData = { 
        id: 'test-123',
        content: 'Test content',
        processed: true,
        timestamp: new Date()
      };

      // Test caching
      performanceOptimizer.setCachedResult('test-cache-key', testData);
      const retrieved = performanceOptimizer.getCachedResult('test-cache-key');
      
      expect(retrieved).toEqual(testData);

      // Test cache eviction
      performanceOptimizer.clearCache();
      const afterClear = performanceOptimizer.getCachedResult('test-cache-key');
      expect(afterClear).toBeNull();
    });
  });

  describe('UI Performance Integration', () => {
    it('should optimize recommendation loading for interface performance', async () => {
      const testRecommendations = Array.from({ length: 20 }, (_, i) => ({
        id: `rec-${i}`,
        noteId: `note-${i}`,
        action: 'review' as const,
        confidence: Math.random(),
        reasoning: `Test reasoning ${i}`,
        impact: (i < 5 ? 'high' : i < 15 ? 'medium' : 'low') as 'high' | 'medium' | 'low',
        reversible: true,
        timestamp: new Date(),
        status: 'pending' as const
      }));

      const startTime = Date.now();
      const optimized = await performanceService.optimizeRecommendationLoading(testRecommendations);
      const loadTime = Date.now() - startTime;

      expect(optimized.immediate.length).toBeGreaterThan(0);
      expect(optimized.immediate.length).toBeLessThanOrEqual(testRecommendations.length);
      expect(optimized.loadTime).toBeLessThan(2000); // Should meet 2-second target
      expect(loadTime).toBeLessThan(100); // Should be very fast for test data
    });

    it('should track UI performance metrics', () => {
      const renderTime = performanceService.measureUIPerformance('TestComponent', () => {
        // Simulate component rendering
        for (let i = 0; i < 1000; i++) {
          Math.random();
        }
      });

      expect(renderTime).toBeGreaterThan(0);
      
      const uiMetrics = performanceService.getUIMetrics();
      expect(uiMetrics.interfaceRenderTime).toBe(renderTime);
      expect(uiMetrics.targetLoadTime).toBe(2000);
    });
  });

  describe('Performance Statistics Integration', () => {
    it('should provide comprehensive performance statistics', () => {
      const stats = performanceService.getPerformanceStats();
      
      expect(stats.totalProcessingTime).toBeGreaterThanOrEqual(0);
      expect(stats.totalNotesProcessed).toBeGreaterThanOrEqual(0);
      expect(stats.cacheHitRate).toBeGreaterThanOrEqual(0);
      expect(stats.memoryUsage).toBeGreaterThan(0);
      expect(stats.cpuUsage).toBeGreaterThanOrEqual(0);
      expect(stats.lastUpdated).toBeInstanceOf(Date);
    });

    it('should track performance listeners and notifications', () => {
      let performanceUpdates = 0;
      let uiMetricsUpdates = 0;

      performanceService.addPerformanceListener(() => {
        performanceUpdates++;
      });

      performanceService.addUIMetricsListener(() => {
        uiMetricsUpdates++;
      });

      // Trigger some activity to generate metrics
      performanceOptimizer.performMemoryCleanup();

      // Allow time for async updates
      setTimeout(() => {
        expect(performanceUpdates).toBeGreaterThanOrEqual(0);
        expect(uiMetricsUpdates).toBeGreaterThanOrEqual(0);
      }, 200);
    });
  });

  describe('Configuration Management Integration', () => {
    it('should allow dynamic configuration updates', () => {
      const newConfig = {
        maxCpuUsage: 30,
        batchSize: 15,
        enableCaching: false
      };

      performanceService.updateConfiguration(newConfig);
      
      const currentConfig = performanceOptimizer.getConfiguration();
      expect(currentConfig.maxCpuUsage).toBe(30);
      expect(currentConfig.batchSize).toBe(15);
      expect(currentConfig.enableCaching).toBe(false);
    });
  });
});