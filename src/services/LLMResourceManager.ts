import { LLMRequest, LLMResponse } from '../models/LLMModels';
import { LLMProvider, RequestPriority, QueuedRequest } from './LLMService';

/**
 * Resource manager for LLM operations
 * Handles memory management, CPU throttling, and request optimization
 */
export class LLMResourceManager {
  private memoryThreshold = 1500; // MB - Increased for better performance
  private cpuThreshold = 60; // Percentage - More reasonable limit
  private batteryThreshold = 10; // Percentage - Only throttle at very low battery
  private thermalThreshold = 85; // Celsius - Higher thermal limit
  private isThrottled = false;
  private resourceMonitorInterval?: NodeJS.Timeout;

  constructor() {
    this.startResourceMonitoring();
  }

  /**
   * Check if system resources allow LLM processing
   */
  async canProcessRequest(request: LLMRequest): Promise<boolean> {
    // DEVELOPMENT MODE: Always allow processing to avoid throttling issues
    console.log('LLM Resource Manager: Always allowing processing (development mode)');
    return true;
    
    // Original resource checking code disabled for development
    /*
    const resources = await this.getCurrentResourceUsage();
    
    // Check memory availability
    if (resources.memoryUsage > this.memoryThreshold) {
      console.warn('Memory usage too high for LLM processing');
      return false;
    }
    
    // Check CPU usage
    if (resources.cpuUsage > this.cpuThreshold) {
      console.warn('CPU usage too high for LLM processing');
      return false;
    }
    
    // Check battery level (mobile devices)
    if (resources.batteryLevel !== undefined && resources.batteryLevel < this.batteryThreshold) {
      console.warn('Battery level too low for intensive LLM processing');
      return false;
    }
    
    // Check thermal state
    if (resources.thermalState !== undefined && resources.thermalState > this.thermalThreshold) {
      console.warn('Device too hot for LLM processing');
      return false;
    }
    
    return true;
    */
  }

  /**
   * Optimize request for current resource constraints
   */
  optimizeRequest(request: LLMRequest): LLMRequest {
    const optimized = { ...request };
    
    if (this.isThrottled) {
      // Reduce token limits when throttled
      optimized.maxTokens = Math.min(optimized.maxTokens, 256);
      
      // Increase temperature slightly for faster generation
      optimized.temperature = Math.min(optimized.temperature + 0.1, 1.0);
      
      // Truncate content if too long
      if (optimized.noteContent.length > 1000) {
        optimized.noteContent = optimized.noteContent.substring(0, 1000) + '...';
      }
    }
    
    return optimized;
  }

  /**
   * Determine if request should be batched with others
   */
  shouldBatchRequest(request: LLMRequest, queuedRequests: QueuedRequest[]): boolean {
    // Don't batch high priority requests
    if (this.getRequestPriority(request) >= RequestPriority.HIGH) {
      return false;
    }
    
    // Look for similar requests that can be batched
    const similarRequests = queuedRequests.filter(queued => 
      queued.request.requestType === request.requestType &&
      queued.request.agentId === request.agentId
    );
    
    return similarRequests.length >= 2;
  }

  /**
   * Create batched request from multiple similar requests
   */
  createBatchedRequest(requests: LLMRequest[]): LLMRequest {
    if (requests.length === 0) {
      throw new Error('Cannot create batched request from empty array');
    }
    
    const firstRequest = requests[0];
    const batchedContent = requests.map((req, index) => 
      `[Note ${index + 1}]: ${req.noteContent}`
    ).join('\n\n');
    
    return {
      ...firstRequest,
      noteContent: batchedContent,
      userPrompt: `${firstRequest.userPrompt}\n\nProcess each note separately and provide results in the same order.`,
      maxTokens: Math.min(firstRequest.maxTokens * requests.length, 2048)
    };
  }

  /**
   * Parse batched response back to individual responses
   */
  parseBatchedResponse(response: LLMResponse, originalRequests: LLMRequest[]): LLMResponse[] {
    const responses: LLMResponse[] = [];
    const responseText = response.response;
    
    // Simple parsing - in real implementation would be more sophisticated
    const sections = responseText.split(/\[Note \d+\]:|Note \d+:/);
    
    for (let i = 0; i < originalRequests.length; i++) {
      const sectionText = sections[i + 1] || responseText; // Fallback to full response
      
      responses.push({
        requestId: `${response.requestId}_${i}`,
        response: sectionText.trim(),
        confidence: response.confidence * 0.9, // Slightly lower confidence for batched
        tokensUsed: Math.floor(response.tokensUsed / originalRequests.length),
        processingTime: response.processingTime,
        model: response.model,
        fallbackUsed: response.fallbackUsed
      });
    }
    
    return responses;
  }

  /**
   * Get current system resource usage
   */
  private async getCurrentResourceUsage(): Promise<SystemResources> {
    try {
      // In React Native, we'd use native modules to get actual system info
      // For now, we'll simulate resource monitoring
      return {
        memoryUsage: this.getMemoryUsage(),
        cpuUsage: this.getCPUUsage(),
        batteryLevel: await this.getBatteryLevel(),
        thermalState: await this.getThermalState(),
        networkStatus: await this.getNetworkStatus()
      };
    } catch (error) {
      console.error('Failed to get resource usage:', error);
      // Return safe defaults
      return {
        memoryUsage: 100,
        cpuUsage: 10,
        batteryLevel: 50,
        thermalState: 30,
        networkStatus: 'wifi'
      };
    }
  }

  private getMemoryUsage(): number {
    // Simulate memory usage monitoring
    // In real implementation, would use native modules
    return Math.random() * 300 + 100; // 100-400 MB (realistic range)
  }

  private getCPUUsage(): number {
    // Simulate CPU usage monitoring
    return Math.random() * 20 + 5; // 5-25% (realistic range)
  }

  private async getBatteryLevel(): Promise<number | undefined> {
    try {
      // In React Native, would use @react-native-community/netinfo or similar
      return Math.random() * 50 + 50; // 50-100% (higher for testing)
    } catch (error) {
      return undefined;
    }
  }

  private async getThermalState(): Promise<number | undefined> {
    try {
      // Would use native thermal monitoring
      return Math.random() * 60 + 20; // 20-80°C
    } catch (error) {
      return undefined;
    }
  }

  private async getNetworkStatus(): Promise<string> {
    try {
      // Would use @react-native-community/netinfo
      const statuses = ['wifi', 'cellular', 'none'];
      return statuses[Math.floor(Math.random() * statuses.length)];
    } catch (error) {
      return 'unknown';
    }
  }

  private getRequestPriority(request: LLMRequest): RequestPriority {
    // Determine priority based on request type and context
    switch (request.requestType) {
      case 'content_analysis':
        return RequestPriority.HIGH;
      case 'explanation':
        return RequestPriority.NORMAL;
      case 'title_generation':
        return RequestPriority.NORMAL;
      default:
        return RequestPriority.LOW;
    }
  }

  private startResourceMonitoring(): void {
    // DEVELOPMENT MODE: Disable resource monitoring to prevent throttling messages
    console.log('LLM Resource Manager: Resource monitoring disabled (development mode)');
    return;
    
    // Original monitoring code disabled for development
    /*
    this.resourceMonitorInterval = setInterval(async () => {
      const resources = await this.getCurrentResourceUsage();
      
      // Update throttling state based on resources
      const shouldThrottle = 
        resources.memoryUsage > this.memoryThreshold * 0.8 ||
        resources.cpuUsage > this.cpuThreshold * 0.8 ||
        (resources.batteryLevel !== undefined && resources.batteryLevel < this.batteryThreshold * 1.5) ||
        (resources.thermalState !== undefined && resources.thermalState > this.thermalThreshold * 0.8);
      
      if (shouldThrottle !== this.isThrottled) {
        this.isThrottled = shouldThrottle;
        console.log(`LLM processing ${shouldThrottle ? 'throttled' : 'unthrottled'} due to resource constraints`);
      }
    }, 5000); // Check every 5 seconds
    */
  }

  /**
   * Clean up resources and stop monitoring
   */
  shutdown(): void {
    if (this.resourceMonitorInterval) {
      clearInterval(this.resourceMonitorInterval);
      this.resourceMonitorInterval = undefined;
    }
  }

  /**
   * Get current throttling state
   */
  isCurrentlyThrottled(): boolean {
    return this.isThrottled;
  }

  /**
   * Update resource thresholds
   */
  updateThresholds(thresholds: Partial<ResourceThresholds>): void {
    if (thresholds.memory !== undefined) {
      this.memoryThreshold = thresholds.memory;
    }
    if (thresholds.cpu !== undefined) {
      this.cpuThreshold = thresholds.cpu;
    }
    if (thresholds.battery !== undefined) {
      this.batteryThreshold = thresholds.battery;
    }
    if (thresholds.thermal !== undefined) {
      this.thermalThreshold = thresholds.thermal;
    }
  }
}

/**
 * System resource information
 */
interface SystemResources {
  memoryUsage: number; // MB
  cpuUsage: number; // Percentage
  batteryLevel?: number; // Percentage
  thermalState?: number; // Celsius
  networkStatus: string;
}

/**
 * Resource threshold configuration
 */
interface ResourceThresholds {
  memory: number; // MB
  cpu: number; // Percentage
  battery: number; // Percentage
  thermal: number; // Celsius
}

export type { SystemResources, ResourceThresholds };