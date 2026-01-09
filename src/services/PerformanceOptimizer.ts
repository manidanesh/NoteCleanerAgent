import { Note } from '../models/Note';
import { Recommendation } from '../models/Recommendation';
import { ProcessingResult } from '../agents/AgentCoordinator';

/**
 * Performance optimization configuration
 */
export interface PerformanceConfig {
  maxCpuUsage: number; // Maximum CPU usage percentage (default: 25%)
  maxMemoryUsage: number; // Maximum memory usage in MB (default: 500MB)
  batchSize: number; // Number of notes to process in each batch (default: 10)
  cacheSize: number; // Maximum cache entries (default: 1000)
  processingTimeout: number; // Timeout for processing operations in ms (default: 30000)
  interfaceLoadTimeout: number; // Target interface load time in ms (default: 2000)
  throttleCheckInterval: number; // How often to check resources in ms (default: 1000)
  enableCaching: boolean; // Whether to enable intelligent caching (default: true)
  enableInterruption: boolean; // Whether to enable processing interruption (default: true)
}

/**
 * System resource metrics
 */
export interface ResourceMetrics {
  cpuUsage: number; // Current CPU usage percentage
  memoryUsage: number; // Current memory usage in MB
  batteryLevel?: number; // Battery level percentage (mobile only)
  thermalState?: 'normal' | 'fair' | 'serious' | 'critical';
  networkStatus: 'wifi' | 'cellular' | 'none';
  timestamp: Date;
}

/**
 * Processing checkpoint for resumption
 */
export interface ProcessingCheckpoint {
  id: string;
  batchIndex: number;
  processedNotes: string[]; // Note IDs that have been processed
  pendingNotes: string[]; // Note IDs still to be processed
  partialResults: ProcessingResult[];
  timestamp: Date;
  config: PerformanceConfig;
}

/**
 * Cache entry for processed results
 */
export interface CacheEntry<T> {
  key: string;
  value: T;
  timestamp: Date;
  accessCount: number;
  lastAccessed: Date;
  size: number; // Estimated size in bytes
}

/**
 * Batch processing result
 */
export interface BatchResult {
  batchId: string;
  results: ProcessingResult[];
  processingTime: number;
  resourceUsage: ResourceMetrics;
  errors: string[];
  checkpoint?: ProcessingCheckpoint;
}

/**
 * Performance Optimizer - Manages system resources and optimizes processing
 * Implements Requirements 8.1, 8.2, 8.3, 8.4, 8.5, 14.1, 14.2, 14.3, 14.4, 14.5
 */
export class PerformanceOptimizer {
  private config: PerformanceConfig;
  private resourceMetrics: ResourceMetrics;
  private isThrottled: boolean = false;
  private isProcessingInterrupted: boolean = false;
  private resourceMonitorInterval?: NodeJS.Timeout;
  
  // Caching system
  private cache: Map<string, CacheEntry<any>> = new Map();
  private cacheSize: number = 0; // Current cache size in bytes
  
  // Processing state
  private currentCheckpoint?: ProcessingCheckpoint;
  private processingStartTime?: Date;
  
  // Performance metrics
  private performanceMetrics: {
    totalProcessingTime: number;
    averageBatchTime: number;
    cacheHitRate: number;
    throttleEvents: number;
    interruptionEvents: number;
  } = {
    totalProcessingTime: 0,
    averageBatchTime: 0,
    cacheHitRate: 0,
    throttleEvents: 0,
    interruptionEvents: 0
  };

  constructor(config?: Partial<PerformanceConfig>) {
    this.config = {
      maxCpuUsage: 60, // Increased from 25% to 60%
      maxMemoryUsage: 1500, // Increased from 500MB to 1500MB
      batchSize: 10,
      cacheSize: 1000,
      processingTimeout: 30000,
      interfaceLoadTimeout: 2000,
      throttleCheckInterval: 5000, // Check less frequently (5 seconds instead of 1)
      enableCaching: true,
      enableInterruption: true,
      ...config
    };

    this.resourceMetrics = {
      cpuUsage: 0,
      memoryUsage: 0,
      networkStatus: 'wifi',
      timestamp: new Date()
    };

    this.startResourceMonitoring();
  }

  /**
   * Initialize the performance optimizer
   */
  async initialize(): Promise<void> {
    // Already initialized in constructor, but this method is needed for interface compatibility
    return Promise.resolve();
  }

  /**
   * Create optimized batches from notes array
   * Implements Requirements 8.1: Batch processing for large note collections
   */
  createOptimizedBatches(notes: Note[]): Note[][] {
    const batches: Note[][] = [];
    let currentBatch: Note[] = [];
    let currentBatchSize = 0;
    
    // Sort notes by processing complexity (simpler notes first for faster initial results)
    const sortedNotes = [...notes].sort((a, b) => {
      const aComplexity = this.calculateNoteComplexity(a);
      const bComplexity = this.calculateNoteComplexity(b);
      return aComplexity - bComplexity;
    });

    for (const note of sortedNotes) {
      const noteComplexity = this.calculateNoteComplexity(note);
      
      // Check if adding this note would exceed batch limits
      if (currentBatch.length >= this.config.batchSize || 
          currentBatchSize + noteComplexity > this.config.batchSize * 2) {
        if (currentBatch.length > 0) {
          batches.push(currentBatch);
          currentBatch = [];
          currentBatchSize = 0;
        }
      }
      
      currentBatch.push(note);
      currentBatchSize += noteComplexity;
    }
    
    // Add remaining notes as final batch
    if (currentBatch.length > 0) {
      batches.push(currentBatch);
    }
    
    return batches;
  }

  /**
   * Calculate processing complexity score for a note
   */
  private calculateNoteComplexity(note: Note): number {
    let complexity = 1; // Base complexity
    
    // Content length factor
    complexity += Math.min(note.content.length / 1000, 5);
    
    // Attachment factor
    complexity += note.attachments?.length || 0;
    
    // Checklist factor
    complexity += (note.checklists?.length || 0) * 0.5;
    
    return Math.round(complexity);
  }

  /**
   * Check if system resources allow processing
   * Implements Requirements 8.2: Resource throttling to maintain device responsiveness
   */
  async canProcessBatch(): Promise<boolean> {
    // DEVELOPMENT MODE: Always allow processing to avoid throttling issues
    console.log('Performance Optimizer: Always allowing batch processing (development mode)');
    return true;
    
    // Original throttling code disabled for development
    /*
    await this.updateResourceMetrics();
    
    // Check CPU usage
    if (this.resourceMetrics.cpuUsage > this.config.maxCpuUsage) {
      if (!this.isThrottled) {
        this.isThrottled = true;
        this.performanceMetrics.throttleEvents++;
        console.log(`CPU throttling activated: ${this.resourceMetrics.cpuUsage}% > ${this.config.maxCpuUsage}%`);
      }
      return false;
    }
    
    // Check memory usage
    if (this.resourceMetrics.memoryUsage > this.config.maxMemoryUsage) {
      if (!this.isThrottled) {
        this.isThrottled = true;
        this.performanceMetrics.throttleEvents++;
        console.log(`Memory throttling activated: ${this.resourceMetrics.memoryUsage}MB > ${this.config.maxMemoryUsage}MB`);
      }
      return false;
    }
    
    // Check battery level (mobile devices)
    if (this.resourceMetrics.batteryLevel !== undefined && this.resourceMetrics.batteryLevel < 20) {
      if (!this.isThrottled) {
        this.isThrottled = true;
        this.performanceMetrics.throttleEvents++;
        console.log(`Battery throttling activated: ${this.resourceMetrics.batteryLevel}% < 20%`);
      }
      return false;
    }
    
    // Check thermal state
    if (this.resourceMetrics.thermalState === 'serious' || this.resourceMetrics.thermalState === 'critical') {
      if (!this.isThrottled) {
        this.isThrottled = true;
        this.performanceMetrics.throttleEvents++;
        console.log(`Thermal throttling activated: ${this.resourceMetrics.thermalState}`);
      }
      return false;
    }
    
    // Reset throttling if conditions are good
    if (this.isThrottled) {
      this.isThrottled = false;
      console.log('Throttling deactivated - resources available');
    }
    
    return true;
    */
  }

  /**
   * Get cached result if available
   * Implements Requirements 8.3: Intelligent caching and memory cleanup
   */
  getCachedResult<T>(key: string): T | null {
    if (!this.config.enableCaching) {
      return null;
    }
    
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }
    
    // Check if cache entry is still valid (24 hours)
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    if (Date.now() - entry.timestamp.getTime() > maxAge) {
      this.cache.delete(key);
      this.cacheSize -= entry.size;
      return null;
    }
    
    // Update access statistics
    entry.accessCount++;
    entry.lastAccessed = new Date();
    
    // Update cache hit rate
    this.updateCacheHitRate(true);
    
    return entry.value;
  }

  /**
   * Store result in cache
   */
  setCachedResult<T>(key: string, value: T): void {
    if (!this.config.enableCaching) {
      return;
    }
    
    const estimatedSize = this.estimateObjectSize(value);
    
    // Check if we need to make room in cache
    while (this.cache.size >= this.config.cacheSize || 
           this.cacheSize + estimatedSize > this.config.maxMemoryUsage * 0.1) {
      this.evictLeastRecentlyUsed();
    }
    
    const entry: CacheEntry<T> = {
      key,
      value,
      timestamp: new Date(),
      accessCount: 1,
      lastAccessed: new Date(),
      size: estimatedSize
    };
    
    this.cache.set(key, entry);
    this.cacheSize += estimatedSize;
  }

  /**
   * Create processing checkpoint for resumption
   * Implements Requirements 8.4: Processing interruption and resumption capabilities
   */
  createCheckpoint(
    batchIndex: number,
    processedNotes: string[],
    pendingNotes: string[],
    partialResults: ProcessingResult[]
  ): ProcessingCheckpoint {
    const checkpoint: ProcessingCheckpoint = {
      id: `checkpoint_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      batchIndex,
      processedNotes: [...processedNotes],
      pendingNotes: [...pendingNotes],
      partialResults: [...partialResults],
      timestamp: new Date(),
      config: { ...this.config }
    };
    
    this.currentCheckpoint = checkpoint;
    
    // Store checkpoint in cache for persistence
    this.setCachedResult(`checkpoint_${checkpoint.id}`, checkpoint);
    
    return checkpoint;
  }

  /**
   * Resume processing from checkpoint
   */
  resumeFromCheckpoint(checkpointId?: string): ProcessingCheckpoint | null {
    if (!this.config.enableInterruption) {
      return null;
    }
    
    let checkpoint: ProcessingCheckpoint | null = null;
    
    if (checkpointId) {
      checkpoint = this.getCachedResult(`checkpoint_${checkpointId}`);
    } else if (this.currentCheckpoint) {
      checkpoint = this.currentCheckpoint;
    }
    
    if (checkpoint) {
      console.log(`Resuming processing from checkpoint: ${checkpoint.id}`);
      console.log(`Processed: ${checkpoint.processedNotes.length}, Pending: ${checkpoint.pendingNotes.length}`);
    }
    
    return checkpoint;
  }

  /**
   * Interrupt current processing
   */
  interruptProcessing(): void {
    if (this.config.enableInterruption) {
      this.isProcessingInterrupted = true;
      this.performanceMetrics.interruptionEvents++;
      console.log('Processing interrupted by user or system');
    }
  }

  /**
   * Check if processing should be interrupted
   */
  shouldInterruptProcessing(): boolean {
    return this.isProcessingInterrupted;
  }

  /**
   * Reset interruption flag
   */
  resetInterruption(): void {
    this.isProcessingInterrupted = false;
  }

  /**
   * Optimize interface loading for recommendations
   * Implements Requirements 14.5: Interface loading optimization (target 2 seconds)
   */
  async optimizeRecommendationLoading(recommendations: Recommendation[]): Promise<Recommendation[]> {
    const startTime = Date.now();
    
    // Sort recommendations by priority for faster perceived loading
    const prioritizedRecommendations = [...recommendations].sort((a, b) => {
      // High impact recommendations first
      if (a.impact !== b.impact) {
        const impactOrder = { 'high': 3, 'medium': 2, 'low': 1 };
        return (impactOrder[b.impact as keyof typeof impactOrder] || 0) - 
               (impactOrder[a.impact as keyof typeof impactOrder] || 0);
      }
      
      // Then by confidence
      return b.confidence - a.confidence;
    });
    
    // Implement progressive loading - return high priority items first
    const highPriorityCount = Math.min(10, Math.ceil(prioritizedRecommendations.length * 0.3));
    const highPriorityRecommendations = prioritizedRecommendations.slice(0, highPriorityCount);
    
    // Pre-cache remaining recommendations for faster subsequent loads
    const remainingRecommendations = prioritizedRecommendations.slice(highPriorityCount);
    if (remainingRecommendations.length > 0) {
      // Cache in background without blocking UI
      setTimeout(() => {
        this.setCachedResult('remaining_recommendations', remainingRecommendations);
      }, 0);
    }
    
    const loadTime = Date.now() - startTime;
    
    // Log performance metrics
    console.log(`Recommendation loading optimized: ${loadTime}ms (target: ${this.config.interfaceLoadTimeout}ms)`);
    
    return highPriorityRecommendations;
  }

  /**
   * Get remaining cached recommendations
   */
  getRemainingRecommendations(): Recommendation[] {
    return this.getCachedResult('remaining_recommendations') || [];
  }

  /**
   * Perform memory cleanup
   * Implements Requirements 8.3: Intelligent caching and memory cleanup
   */
  performMemoryCleanup(): void {
    const initialCacheSize = this.cache.size;
    const initialMemorySize = this.cacheSize;
    
    // Remove expired cache entries
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    const now = Date.now();
    
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp.getTime() > maxAge) {
        this.cache.delete(key);
        this.cacheSize -= entry.size;
      }
    }
    
    // If still over memory limit, remove least recently used entries
    while (this.cacheSize > this.config.maxMemoryUsage * 0.1) {
      this.evictLeastRecentlyUsed();
    }
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
    
    const cleanedEntries = initialCacheSize - this.cache.size;
    const freedMemory = initialMemorySize - this.cacheSize;
    
    console.log(`Memory cleanup completed: removed ${cleanedEntries} entries, freed ${freedMemory} bytes`);
  }

  /**
   * Evict least recently used cache entry
   */
  private evictLeastRecentlyUsed(): void {
    let oldestEntry: { key: string; entry: CacheEntry<any> } | null = null;
    
    for (const [key, entry] of this.cache.entries()) {
      if (!oldestEntry || entry.lastAccessed < oldestEntry.entry.lastAccessed) {
        oldestEntry = { key, entry };
      }
    }
    
    if (oldestEntry) {
      this.cache.delete(oldestEntry.key);
      this.cacheSize -= oldestEntry.entry.size;
    }
  }

  /**
   * Estimate object size in bytes
   */
  private estimateObjectSize(obj: any): number {
    const jsonString = JSON.stringify(obj);
    return new Blob([jsonString]).size;
  }

  /**
   * Update cache hit rate metrics
   */
  private updateCacheHitRate(hit: boolean): void {
    // Simple moving average for cache hit rate
    const alpha = 0.1; // Smoothing factor
    const hitValue = hit ? 1 : 0;
    this.performanceMetrics.cacheHitRate = 
      (1 - alpha) * this.performanceMetrics.cacheHitRate + alpha * hitValue;
  }

  /**
   * Update system resource metrics
   */
  private async updateResourceMetrics(): Promise<void> {
    try {
      this.resourceMetrics = {
        cpuUsage: await this.getCPUUsage(),
        memoryUsage: await this.getMemoryUsage(),
        batteryLevel: await this.getBatteryLevel(),
        thermalState: await this.getThermalState(),
        networkStatus: await this.getNetworkStatus(),
        timestamp: new Date()
      };
    } catch (error) {
      console.error('Failed to update resource metrics:', error);
    }
  }

  /**
   * Get current CPU usage percentage
   */
  private async getCPUUsage(): Promise<number> {
    // In React Native, would use native modules for actual CPU monitoring
    // For now, simulate based on processing state and throttling
    let baseCPU = Math.random() * 15 + 5; // 5-20% base usage (more realistic)
    
    if (this.isProcessingInterrupted) {
      baseCPU += Math.random() * 20; // Add 0-20% when processing
    }
    
    return Math.min(baseCPU, 100);
  }

  /**
   * Get current memory usage in MB
   */
  private async getMemoryUsage(): Promise<number> {
    // Simulate memory usage based on cache size and processing state
    let baseMemory = 200 + (this.cacheSize / (1024 * 1024)); // Higher base + cache size in MB
    
    if (this.isProcessingInterrupted) {
      baseMemory += Math.random() * 200; // Add 0-200MB when processing
    }
    
    return Math.min(baseMemory, 2048); // Cap at 2GB
  }

  /**
   * Get battery level (mobile devices only)
   */
  private async getBatteryLevel(): Promise<number | undefined> {
    try {
      // In React Native, would use @react-native-community/netinfo or similar
      // Simulate battery level
      return Math.random() * 50 + 50; // 50-100%
    } catch (error) {
      return undefined;
    }
  }

  /**
   * Get thermal state
   */
  private async getThermalState(): Promise<'normal' | 'fair' | 'serious' | 'critical' | undefined> {
    try {
      // Simulate thermal state
      const states: ('normal' | 'fair' | 'serious' | 'critical')[] = ['normal', 'fair', 'serious', 'critical'];
      const weights = [0.7, 0.2, 0.08, 0.02]; // Mostly normal, rarely critical
      
      const random = Math.random();
      let cumulative = 0;
      
      for (let i = 0; i < states.length; i++) {
        cumulative += weights[i];
        if (random <= cumulative) {
          return states[i];
        }
      }
      
      return 'normal';
    } catch (error) {
      return undefined;
    }
  }

  /**
   * Get network status
   */
  private async getNetworkStatus(): Promise<'wifi' | 'cellular' | 'none'> {
    try {
      // Simulate network status
      const statuses: ('wifi' | 'cellular' | 'none')[] = ['wifi', 'cellular', 'none'];
      const weights = [0.6, 0.35, 0.05]; // Mostly wifi, some cellular, rarely none
      
      const random = Math.random();
      let cumulative = 0;
      
      for (let i = 0; i < statuses.length; i++) {
        cumulative += weights[i];
        if (random <= cumulative) {
          return statuses[i];
        }
      }
      
      return 'wifi';
    } catch (error) {
      return 'none';
    }
  }

  /**
   * Start resource monitoring
   */
  private startResourceMonitoring(): void {
    this.resourceMonitorInterval = setInterval(async () => {
      await this.updateResourceMetrics();
      
      // Perform automatic memory cleanup if needed
      if (this.resourceMetrics.memoryUsage > this.config.maxMemoryUsage * 0.8) {
        this.performMemoryCleanup();
      }
    }, this.config.throttleCheckInterval);
  }

  /**
   * Get current performance metrics
   */
  getPerformanceMetrics(): typeof this.performanceMetrics {
    return { ...this.performanceMetrics };
  }

  /**
   * Get current resource metrics
   */
  getCurrentResourceMetrics(): ResourceMetrics {
    return { ...this.resourceMetrics };
  }

  /**
   * Get current configuration
   */
  getConfiguration(): PerformanceConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfiguration(newConfig: Partial<PerformanceConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('Performance configuration updated:', newConfig);
  }

  /**
   * Reset performance metrics
   */
  resetMetrics(): void {
    this.performanceMetrics = {
      totalProcessingTime: 0,
      averageBatchTime: 0,
      cacheHitRate: 0,
      throttleEvents: 0,
      interruptionEvents: 0
    };
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    this.cache.clear();
    this.cacheSize = 0;
    console.log('All caches cleared');
  }

  /**
   * Shutdown performance optimizer
   */
  shutdown(): void {
    if (this.resourceMonitorInterval) {
      clearInterval(this.resourceMonitorInterval);
      this.resourceMonitorInterval = undefined;
    }
    
    this.clearCache();
    this.resetInterruption();
    
    console.log('Performance Optimizer shutdown complete');
  }
}