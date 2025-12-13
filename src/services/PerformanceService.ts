import { Note } from '../models/Note';
import { Recommendation } from '../models/Recommendation';
import { AgentCoordinator, ProcessingResult } from '../agents/AgentCoordinator';
import { PerformanceOptimizer, PerformanceConfig } from './PerformanceOptimizer';
import { BatchProcessor, BatchProcessingEvent } from './BatchProcessor';

/**
 * Performance service configuration
 */
export interface PerformanceServiceConfig extends PerformanceConfig {
  enableProgressTracking: boolean;
  enableResourceMonitoring: boolean;
  enableAutomaticOptimization: boolean;
  uiUpdateInterval: number; // milliseconds
}

/**
 * Performance statistics
 */
export interface PerformanceStats {
  totalProcessingTime: number;
  averageNoteProcessingTime: number;
  totalNotesProcessed: number;
  cacheHitRate: number;
  throttleEvents: number;
  interruptionEvents: number;
  memoryUsage: number;
  cpuUsage: number;
  lastUpdated: Date;
}

/**
 * UI performance metrics for interface optimization
 */
export interface UIPerformanceMetrics {
  recommendationLoadTime: number;
  interfaceRenderTime: number;
  scrollPerformance: number;
  memoryFootprint: number;
  targetLoadTime: number; // 2 seconds as per requirements
}

/**
 * Performance Service - Central service for managing performance optimization
 * Implements Requirements 8.1, 8.2, 8.3, 8.4, 8.5, 14.1, 14.2, 14.3, 14.4, 14.5
 */
export class PerformanceService {
  private config: PerformanceServiceConfig;
  private agentCoordinator: AgentCoordinator;
  private performanceOptimizer: PerformanceOptimizer;
  private batchProcessor: BatchProcessor;
  
  // Event listeners
  private progressListeners: ((progress: any) => void)[] = [];
  private performanceListeners: ((stats: PerformanceStats) => void)[] = [];
  private uiMetricsListeners: ((metrics: UIPerformanceMetrics) => void)[] = [];
  
  // Monitoring intervals
  private resourceMonitorInterval?: NodeJS.Timeout;
  private uiMetricsInterval?: NodeJS.Timeout;
  
  // Performance tracking
  private processingStartTime?: Date;
  private totalNotesProcessed: number = 0;
  private totalProcessingTime: number = 0;
  private uiMetrics: UIPerformanceMetrics;

  constructor(
    agentCoordinator: AgentCoordinator,
    config?: Partial<PerformanceServiceConfig>
  ) {
    this.agentCoordinator = agentCoordinator;
    this.performanceOptimizer = agentCoordinator.getPerformanceOptimizer();
    this.batchProcessor = agentCoordinator.getBatchProcessor();
    
    this.config = {
      maxCpuUsage: 25,
      maxMemoryUsage: 500,
      batchSize: 10,
      cacheSize: 1000,
      processingTimeout: 30000,
      interfaceLoadTimeout: 2000,
      throttleCheckInterval: 1000,
      enableCaching: true,
      enableInterruption: true,
      enableProgressTracking: true,
      enableResourceMonitoring: true,
      enableAutomaticOptimization: true,
      uiUpdateInterval: 500,
      ...config
    };

    this.uiMetrics = {
      recommendationLoadTime: 0,
      interfaceRenderTime: 0,
      scrollPerformance: 100,
      memoryFootprint: 0,
      targetLoadTime: this.config.interfaceLoadTimeout
    };

    this.initialize();
  }

  /**
   * Initialize performance service
   */
  private initialize(): void {
    // Listen to batch processing events
    this.batchProcessor.addEventListener(this.handleBatchEvent.bind(this));
    
    // Start monitoring if enabled
    if (this.config.enableResourceMonitoring) {
      this.startResourceMonitoring();
    }
    
    if (this.config.enableProgressTracking) {
      this.startUIMetricsTracking();
    }
  }

  /**
   * Process notes with performance optimization
   * Implements Requirements 8.1: Batch processing for large note collections
   */
  async processNotesOptimized(notes: Note[], resumeFromCheckpoint?: string): Promise<ProcessingResult[]> {
    this.processingStartTime = new Date();
    
    try {
      // Pre-processing optimization
      await this.optimizeForProcessing();
      
      // Process with batch processor
      const results = await this.agentCoordinator.processNotes(notes, resumeFromCheckpoint);
      
      // Update statistics
      this.updateProcessingStats(results);
      
      return results;
      
    } catch (error) {
      console.error('Optimized processing failed:', error);
      throw error;
    } finally {
      // Post-processing cleanup
      await this.cleanupAfterProcessing();
    }
  }

  /**
   * Optimize recommendations loading for UI
   * Implements Requirements 14.5: Interface loading optimization (target 2 seconds)
   */
  async optimizeRecommendationLoading(recommendations: Recommendation[]): Promise<{
    immediate: Recommendation[];
    deferred: Recommendation[];
    loadTime: number;
  }> {
    const startTime = Date.now();
    
    try {
      // Use performance optimizer for recommendation optimization
      const optimizedRecommendations = await this.performanceOptimizer.optimizeRecommendationLoading(recommendations);
      const deferredRecommendations = this.performanceOptimizer.getRemainingRecommendations();
      
      const loadTime = Date.now() - startTime;
      
      // Update UI metrics
      this.uiMetrics.recommendationLoadTime = loadTime;
      this.notifyUIMetricsListeners();
      
      // Log performance
      if (loadTime > this.config.interfaceLoadTimeout) {
        console.warn(`Recommendation loading exceeded target: ${loadTime}ms > ${this.config.interfaceLoadTimeout}ms`);
      }
      
      return {
        immediate: optimizedRecommendations,
        deferred: deferredRecommendations,
        loadTime
      };
      
    } catch (error) {
      console.error('Recommendation loading optimization failed:', error);
      throw error;
    }
  }

  /**
   * Measure and optimize UI rendering performance
   */
  measureUIPerformance(componentName: string, renderFunction: () => void): number {
    const startTime = performance.now();
    
    try {
      renderFunction();
      const renderTime = performance.now() - startTime;
      
      // Update UI metrics
      this.uiMetrics.interfaceRenderTime = renderTime;
      
      // Log slow renders
      if (renderTime > 16.67) { // 60 FPS threshold
        console.warn(`Slow render detected in ${componentName}: ${renderTime.toFixed(2)}ms`);
      }
      
      return renderTime;
      
    } catch (error) {
      console.error(`UI performance measurement failed for ${componentName}:`, error);
      return performance.now() - startTime;
    }
  }

  /**
   * Interrupt current processing
   * Implements Requirements 8.4: Processing interruption capabilities
   */
  interruptProcessing(): void {
    this.agentCoordinator.interruptProcessing();
  }

  /**
   * Get current processing progress
   */
  getProcessingProgress(): any {
    return this.agentCoordinator.getProcessingProgress();
  }

  /**
   * Perform memory cleanup
   * Implements Requirements 8.3: Intelligent caching and memory cleanup
   */
  async performMemoryCleanup(): Promise<void> {
    try {
      // Cleanup through performance optimizer
      this.performanceOptimizer.performMemoryCleanup();
      
      // Additional cleanup through agent coordinator
      this.agentCoordinator.performMemoryCleanup();
      
      console.log('Memory cleanup completed');
      
    } catch (error) {
      console.error('Memory cleanup failed:', error);
    }
  }

  /**
   * Get comprehensive performance statistics
   */
  getPerformanceStats(): PerformanceStats {
    const perfMetrics = this.performanceOptimizer.getPerformanceMetrics();
    const resourceMetrics = this.performanceOptimizer.getCurrentResourceMetrics();
    
    return {
      totalProcessingTime: this.totalProcessingTime,
      averageNoteProcessingTime: this.totalNotesProcessed > 0 ? 
        this.totalProcessingTime / this.totalNotesProcessed : 0,
      totalNotesProcessed: this.totalNotesProcessed,
      cacheHitRate: perfMetrics.cacheHitRate,
      throttleEvents: perfMetrics.throttleEvents,
      interruptionEvents: perfMetrics.interruptionEvents,
      memoryUsage: resourceMetrics.memoryUsage,
      cpuUsage: resourceMetrics.cpuUsage,
      lastUpdated: new Date()
    };
  }

  /**
   * Get UI performance metrics
   */
  getUIMetrics(): UIPerformanceMetrics {
    return { ...this.uiMetrics };
  }

  /**
   * Update performance configuration
   */
  updateConfiguration(newConfig: Partial<PerformanceServiceConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Update underlying components
    this.performanceOptimizer.updateConfiguration(newConfig);
    
    // Restart monitoring if intervals changed
    if (newConfig.uiUpdateInterval || newConfig.throttleCheckInterval) {
      this.stopMonitoring();
      if (this.config.enableResourceMonitoring) {
        this.startResourceMonitoring();
      }
      if (this.config.enableProgressTracking) {
        this.startUIMetricsTracking();
      }
    }
  }

  /**
   * Add progress listener
   */
  addProgressListener(listener: (progress: any) => void): void {
    this.progressListeners.push(listener);
  }

  /**
   * Remove progress listener
   */
  removeProgressListener(listener: (progress: any) => void): void {
    const index = this.progressListeners.indexOf(listener);
    if (index > -1) {
      this.progressListeners.splice(index, 1);
    }
  }

  /**
   * Add performance listener
   */
  addPerformanceListener(listener: (stats: PerformanceStats) => void): void {
    this.performanceListeners.push(listener);
  }

  /**
   * Remove performance listener
   */
  removePerformanceListener(listener: (stats: PerformanceStats) => void): void {
    const index = this.performanceListeners.indexOf(listener);
    if (index > -1) {
      this.performanceListeners.splice(index, 1);
    }
  }

  /**
   * Add UI metrics listener
   */
  addUIMetricsListener(listener: (metrics: UIPerformanceMetrics) => void): void {
    this.uiMetricsListeners.push(listener);
  }

  /**
   * Remove UI metrics listener
   */
  removeUIMetricsListener(listener: (metrics: UIPerformanceMetrics) => void): void {
    const index = this.uiMetricsListeners.indexOf(listener);
    if (index > -1) {
      this.uiMetricsListeners.splice(index, 1);
    }
  }

  /**
   * Handle batch processing events
   */
  private handleBatchEvent(event: BatchProcessingEvent): void {
    switch (event.type) {
      case 'progress_updated':
        this.notifyProgressListeners(event.progress);
        break;
      case 'batch_completed':
        // Update processing statistics
        break;
    }
  }

  /**
   * Optimize system for processing
   */
  private async optimizeForProcessing(): Promise<void> {
    if (this.config.enableAutomaticOptimization) {
      // Perform memory cleanup before processing
      await this.performMemoryCleanup();
      
      // Check system resources
      const canProcess = await this.performanceOptimizer.canProcessBatch();
      if (!canProcess) {
        console.warn('System resources may be insufficient for optimal processing');
      }
    }
  }

  /**
   * Cleanup after processing
   */
  private async cleanupAfterProcessing(): Promise<void> {
    if (this.config.enableAutomaticOptimization) {
      // Perform memory cleanup after processing
      setTimeout(() => {
        this.performMemoryCleanup();
      }, 1000); // Delay to avoid interfering with results
    }
  }

  /**
   * Update processing statistics
   */
  private updateProcessingStats(results: ProcessingResult[]): void {
    if (this.processingStartTime) {
      const processingTime = Date.now() - this.processingStartTime.getTime();
      this.totalProcessingTime += processingTime;
      this.totalNotesProcessed += results.length;
    }
    
    // Notify performance listeners
    this.notifyPerformanceListeners();
  }

  /**
   * Start resource monitoring
   */
  private startResourceMonitoring(): void {
    this.resourceMonitorInterval = setInterval(() => {
      this.notifyPerformanceListeners();
    }, this.config.uiUpdateInterval);
  }

  /**
   * Start UI metrics tracking
   */
  private startUIMetricsTracking(): void {
    this.uiMetricsInterval = setInterval(() => {
      // Update memory footprint
      const resourceMetrics = this.performanceOptimizer.getCurrentResourceMetrics();
      this.uiMetrics.memoryFootprint = resourceMetrics.memoryUsage;
      
      this.notifyUIMetricsListeners();
    }, this.config.uiUpdateInterval);
  }

  /**
   * Stop all monitoring
   */
  private stopMonitoring(): void {
    if (this.resourceMonitorInterval) {
      clearInterval(this.resourceMonitorInterval);
      this.resourceMonitorInterval = undefined;
    }
    
    if (this.uiMetricsInterval) {
      clearInterval(this.uiMetricsInterval);
      this.uiMetricsInterval = undefined;
    }
  }

  /**
   * Notify progress listeners
   */
  private notifyProgressListeners(progress: any): void {
    this.progressListeners.forEach(listener => {
      try {
        listener(progress);
      } catch (error) {
        console.error('Error in progress listener:', error);
      }
    });
  }

  /**
   * Notify performance listeners
   */
  private notifyPerformanceListeners(): void {
    const stats = this.getPerformanceStats();
    this.performanceListeners.forEach(listener => {
      try {
        listener(stats);
      } catch (error) {
        console.error('Error in performance listener:', error);
      }
    });
  }

  /**
   * Notify UI metrics listeners
   */
  private notifyUIMetricsListeners(): void {
    this.uiMetricsListeners.forEach(listener => {
      try {
        listener(this.uiMetrics);
      } catch (error) {
        console.error('Error in UI metrics listener:', error);
      }
    });
  }

  /**
   * Shutdown performance service
   */
  shutdown(): void {
    this.stopMonitoring();
    
    // Clear listeners
    this.progressListeners = [];
    this.performanceListeners = [];
    this.uiMetricsListeners = [];
    
    console.log('Performance Service shutdown complete');
  }
}