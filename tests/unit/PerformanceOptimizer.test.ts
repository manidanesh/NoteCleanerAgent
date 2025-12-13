import { PerformanceOptimizer, PerformanceConfig } from '../../src/services/PerformanceOptimizer';
import { Note } from '../../src/models/Note';
import { Recommendation } from '../../src/models/Recommendation';

describe('PerformanceOptimizer', () => {
  let performanceOptimizer: PerformanceOptimizer;
  let mockConfig: Partial<PerformanceConfig>;

  beforeEach(() => {
    mockConfig = {
      maxCpuUsage: 25,
      maxMemoryUsage: 500,
      batchSize: 5,
      cacheSize: 100,
      enableCaching: true,
      enableInterruption: true,
      throttleCheckInterval: 100
    };
    
    performanceOptimizer = new PerformanceOptimizer(mockConfig);
  });

  afterEach(() => {
    performanceOptimizer.shutdown();
  });

  describe('Batch Creation', () => {
    it('should create optimized batches based on note complexity', () => {
      const notes: Note[] = [
        {
          id: '1',
          title: 'Simple Note',
          content: 'Short content',
          createdDate: new Date(),
          modifiedDate: new Date(),
          folder: 'Notes',
          attachments: [],
          checklists: []
        },
        {
          id: '2',
          title: 'Complex Note',
          content: 'Very long content '.repeat(100),
          createdDate: new Date(),
          modifiedDate: new Date(),
          folder: 'Notes',
          attachments: [{ id: '1', name: 'file.pdf', type: 'pdf', size: 1000 }],
          checklists: [{ id: '1', items: [], completed: false }]
        }
      ];

      const batches = performanceOptimizer.createOptimizedBatches(notes);
      
      expect(batches).toBeDefined();
      expect(batches.length).toBeGreaterThan(0);
      expect(batches.flat()).toHaveLength(notes.length);
    });

    it('should respect batch size limits', () => {
      const notes: Note[] = Array.from({ length: 20 }, (_, i) => ({
        id: `${i}`,
        title: `Note ${i}`,
        content: 'Content',
        createdDate: new Date(),
        modifiedDate: new Date(),
        folder: 'Notes',
        attachments: [],
        checklists: []
      }));

      const batches = performanceOptimizer.createOptimizedBatches(notes);
      
      batches.forEach(batch => {
        expect(batch.length).toBeLessThanOrEqual(mockConfig.batchSize!);
      });
    });
  });

  describe('Resource Management', () => {
    it('should check if system can process batch', async () => {
      const canProcess = await performanceOptimizer.canProcessBatch();
      expect(typeof canProcess).toBe('boolean');
    });

    it('should throttle when resources are constrained', async () => {
      // Update config to very low thresholds to trigger throttling
      performanceOptimizer.updateConfiguration({
        maxCpuUsage: 1,
        maxMemoryUsage: 1
      });

      const canProcess = await performanceOptimizer.canProcessBatch();
      expect(canProcess).toBe(false);
    });
  });

  describe('Caching System', () => {
    it('should cache and retrieve results', () => {
      const testData = { test: 'data', value: 123 };
      const cacheKey = 'test_key';

      // Cache should be empty initially
      expect(performanceOptimizer.getCachedResult(cacheKey)).toBeNull();

      // Set cached result
      performanceOptimizer.setCachedResult(cacheKey, testData);

      // Should retrieve cached result
      const cachedResult = performanceOptimizer.getCachedResult(cacheKey);
      expect(cachedResult).toEqual(testData);
    });

    it('should handle cache eviction when full', () => {
      // Fill cache beyond capacity
      for (let i = 0; i < mockConfig.cacheSize! + 10; i++) {
        performanceOptimizer.setCachedResult(`key_${i}`, { data: i });
      }

      // Some early entries should be evicted
      expect(performanceOptimizer.getCachedResult('key_0')).toBeNull();
      
      // Recent entries should still be cached
      const recentKey = `key_${mockConfig.cacheSize! + 5}`;
      expect(performanceOptimizer.getCachedResult(recentKey)).toBeDefined();
    });

    it('should perform memory cleanup', () => {
      // Add some cached data
      for (let i = 0; i < 10; i++) {
        performanceOptimizer.setCachedResult(`key_${i}`, { data: i });
      }

      // Perform cleanup
      performanceOptimizer.performMemoryCleanup();

      // Should not throw and should complete successfully
      expect(true).toBe(true);
    });
  });

  describe('Processing Interruption', () => {
    it('should handle processing interruption', () => {
      expect(performanceOptimizer.shouldInterruptProcessing()).toBe(false);

      performanceOptimizer.interruptProcessing();
      expect(performanceOptimizer.shouldInterruptProcessing()).toBe(true);

      performanceOptimizer.resetInterruption();
      expect(performanceOptimizer.shouldInterruptProcessing()).toBe(false);
    });

    it('should create and resume from checkpoints', () => {
      const processedNotes = ['note1', 'note2'];
      const pendingNotes = ['note3', 'note4'];
      const partialResults: any[] = [];

      const checkpoint = performanceOptimizer.createCheckpoint(
        1,
        processedNotes,
        pendingNotes,
        partialResults
      );

      expect(checkpoint).toBeDefined();
      expect(checkpoint.processedNotes).toEqual(processedNotes);
      expect(checkpoint.pendingNotes).toEqual(pendingNotes);

      const resumedCheckpoint = performanceOptimizer.resumeFromCheckpoint(checkpoint.id);
      expect(resumedCheckpoint).toBeDefined();
      expect(resumedCheckpoint!.processedNotes).toEqual(processedNotes);
    });
  });

  describe('Recommendation Optimization', () => {
    it('should optimize recommendation loading', async () => {
      const recommendations: Recommendation[] = [
        {
          id: '1',
          noteId: 'note1',
          action: 'delete',
          confidence: 0.9,
          reasoning: 'High confidence deletion',
          impact: 'high',
          reversible: true,
          timestamp: new Date(),
          status: 'pending'
        },
        {
          id: '2',
          noteId: 'note2',
          action: 'archive',
          confidence: 0.5,
          reasoning: 'Medium confidence archive',
          impact: 'medium',
          reversible: true,
          timestamp: new Date(),
          status: 'pending'
        },
        {
          id: '3',
          noteId: 'note3',
          action: 'keep',
          confidence: 0.3,
          reasoning: 'Low confidence keep',
          impact: 'low',
          reversible: true,
          timestamp: new Date(),
          status: 'pending'
        }
      ];

      const optimized = await performanceOptimizer.optimizeRecommendationLoading(recommendations);
      
      expect(optimized).toBeDefined();
      expect(optimized.length).toBeGreaterThan(0);
      expect(optimized.length).toBeLessThanOrEqual(recommendations.length);
      
      // High impact recommendations should be prioritized
      expect(optimized[0].impact).toBe('high');
    });

    it('should cache remaining recommendations', async () => {
      const recommendations: Recommendation[] = Array.from({ length: 20 }, (_, i) => ({
        id: `${i}`,
        noteId: `note${i}`,
        action: 'review',
        confidence: Math.random(),
        reasoning: `Recommendation ${i}`,
        impact: i < 5 ? 'high' : 'low',
        reversible: true,
        timestamp: new Date(),
        status: 'pending'
      }));

      await performanceOptimizer.optimizeRecommendationLoading(recommendations);
      
      const remaining = performanceOptimizer.getRemainingRecommendations();
      expect(remaining).toBeDefined();
    });
  });

  describe('Performance Metrics', () => {
    it('should track performance metrics', () => {
      const metrics = performanceOptimizer.getPerformanceMetrics();
      
      expect(metrics).toBeDefined();
      expect(typeof metrics.cacheHitRate).toBe('number');
      expect(typeof metrics.throttleEvents).toBe('number');
      expect(typeof metrics.interruptionEvents).toBe('number');
    });

    it('should track resource metrics', () => {
      const metrics = performanceOptimizer.getCurrentResourceMetrics();
      
      expect(metrics).toBeDefined();
      expect(typeof metrics.cpuUsage).toBe('number');
      expect(typeof metrics.memoryUsage).toBe('number');
      expect(metrics.timestamp).toBeInstanceOf(Date);
    });

    it('should update configuration', () => {
      const newConfig = {
        maxCpuUsage: 50,
        batchSize: 20
      };

      performanceOptimizer.updateConfiguration(newConfig);
      
      const currentConfig = performanceOptimizer.getConfiguration();
      expect(currentConfig.maxCpuUsage).toBe(50);
      expect(currentConfig.batchSize).toBe(20);
    });
  });

  describe('Cache Management', () => {
    it('should clear all caches', () => {
      // Add some cached data
      performanceOptimizer.setCachedResult('test1', { data: 1 });
      performanceOptimizer.setCachedResult('test2', { data: 2 });

      // Verify data is cached
      expect(performanceOptimizer.getCachedResult('test1')).toBeDefined();

      // Clear cache
      performanceOptimizer.clearCache();

      // Verify cache is empty
      expect(performanceOptimizer.getCachedResult('test1')).toBeNull();
      expect(performanceOptimizer.getCachedResult('test2')).toBeNull();
    });

    it('should reset metrics', () => {
      // Trigger some events to change metrics
      performanceOptimizer.interruptProcessing();
      
      const metricsBefore = performanceOptimizer.getPerformanceMetrics();
      expect(metricsBefore.interruptionEvents).toBeGreaterThan(0);

      performanceOptimizer.resetMetrics();
      
      const metricsAfter = performanceOptimizer.getPerformanceMetrics();
      expect(metricsAfter.interruptionEvents).toBe(0);
    });
  });
});