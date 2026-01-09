/**
 * LLM Rate Limiter - Implements rate limiting, retry logic, and request optimization
 * Addresses "LLM processing throttled due to resource constraints" issues
 */

export interface RateLimitConfig {
  maxRequestsPerMinute: number;
  maxTokensPerRequest: number;
  requestDelayMs: number;
  maxRetries: number;
  backoffMultiplier: number;
  maxContentLength: number;
}

export interface RequestMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  throttledRequests: number;
  averageResponseTime: number;
  lastRequestTime: number;
}

/**
 * Rate limiter with exponential backoff and request optimization
 */
export class LLMRateLimiter {
  private config: RateLimitConfig;
  private requestTimes: number[] = [];
  private metrics: RequestMetrics;
  private isThrottled = false;

  constructor(config?: Partial<RateLimitConfig>) {
    this.config = {
      maxRequestsPerMinute: 30, // Conservative rate limit
      maxTokensPerRequest: 1000, // Reduced token limit
      requestDelayMs: 2000, // 2 second delay between requests
      maxRetries: 3,
      backoffMultiplier: 2,
      maxContentLength: 2000, // Limit content length
      ...config
    };

    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      throttledRequests: 0,
      averageResponseTime: 0,
      lastRequestTime: 0
    };
  }

  /**
   * Check if we can make a request now
   */
  canMakeRequest(): boolean {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    // Clean old request times
    this.requestTimes = this.requestTimes.filter(time => time > oneMinuteAgo);

    // Check rate limit
    if (this.requestTimes.length >= this.config.maxRequestsPerMinute) {
      this.isThrottled = true;
      return false;
    }

    // Check minimum delay between requests
    if (this.metrics.lastRequestTime > 0) {
      const timeSinceLastRequest = now - this.metrics.lastRequestTime;
      if (timeSinceLastRequest < this.config.requestDelayMs) {
        return false;
      }
    }

    this.isThrottled = false;
    return true;
  }

  /**
   * Wait until we can make a request
   */
  async waitForAvailability(): Promise<void> {
    while (!this.canMakeRequest()) {
      const waitTime = this.calculateWaitTime();
      console.log(`Rate limited - waiting ${waitTime}ms before next request`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }

  /**
   * Calculate how long to wait before next request
   */
  private calculateWaitTime(): number {
    const now = Date.now();
    
    if (this.requestTimes.length >= this.config.maxRequestsPerMinute) {
      // Wait until oldest request is more than 1 minute old
      const oldestRequest = Math.min(...this.requestTimes);
      return Math.max(1000, (oldestRequest + 60000) - now);
    }

    // Wait for minimum delay
    const timeSinceLastRequest = now - this.metrics.lastRequestTime;
    return Math.max(0, this.config.requestDelayMs - timeSinceLastRequest);
  }

  /**
   * Record a request attempt
   */
  recordRequest(): void {
    const now = Date.now();
    this.requestTimes.push(now);
    this.metrics.totalRequests++;
    this.metrics.lastRequestTime = now;
  }

  /**
   * Record a successful request
   */
  recordSuccess(responseTime: number): void {
    this.metrics.successfulRequests++;
    this.updateAverageResponseTime(responseTime);
  }

  /**
   * Record a failed request
   */
  recordFailure(): void {
    this.metrics.failedRequests++;
  }

  /**
   * Record a throttled request
   */
  recordThrottle(): void {
    this.metrics.throttledRequests++;
  }

  /**
   * Update average response time
   */
  private updateAverageResponseTime(responseTime: number): void {
    const totalSuccessful = this.metrics.successfulRequests;
    if (totalSuccessful === 1) {
      this.metrics.averageResponseTime = responseTime;
    } else {
      this.metrics.averageResponseTime = 
        (this.metrics.averageResponseTime * (totalSuccessful - 1) + responseTime) / totalSuccessful;
    }
  }

  /**
   * Optimize request content to reduce token usage
   */
  optimizeRequestContent(content: string, maxLength?: number): string {
    const limit = maxLength || this.config.maxContentLength;
    
    if (content.length <= limit) {
      return content;
    }

    // Truncate content intelligently
    const truncated = content.substring(0, limit - 100); // Leave room for "..."
    const lastSentence = truncated.lastIndexOf('.');
    const lastNewline = truncated.lastIndexOf('\n');
    
    // Cut at sentence or paragraph boundary if possible
    const cutPoint = Math.max(lastSentence, lastNewline);
    if (cutPoint > limit * 0.7) { // Only if we don't lose too much content
      return truncated.substring(0, cutPoint + 1) + '\n\n[Content truncated for processing efficiency]';
    }
    
    return truncated + '...\n\n[Content truncated for processing efficiency]';
  }

  /**
   * Execute function with exponential backoff retry
   */
  async executeWithRetry<T>(
    fn: () => Promise<T>,
    context: string = 'LLM request'
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
      try {
        // Wait for rate limit availability
        await this.waitForAvailability();
        
        // Record the request
        this.recordRequest();
        
        const startTime = Date.now();
        const result = await fn();
        const responseTime = Date.now() - startTime;
        
        this.recordSuccess(responseTime);
        console.log(`${context} succeeded on attempt ${attempt + 1} (${responseTime}ms)`);
        
        return result;
        
      } catch (error) {
        lastError = error as Error;
        this.recordFailure();
        
        console.warn(`${context} failed on attempt ${attempt + 1}:`, error);
        
        // Don't retry on the last attempt
        if (attempt === this.config.maxRetries - 1) {
          break;
        }
        
        // Calculate exponential backoff delay
        const baseDelay = 1000; // 1 second base delay
        const backoffDelay = baseDelay * Math.pow(this.config.backoffMultiplier, attempt);
        const jitter = Math.random() * 1000; // Add jitter to prevent thundering herd
        const totalDelay = backoffDelay + jitter;
        
        console.log(`Retrying ${context} in ${Math.round(totalDelay)}ms...`);
        await new Promise(resolve => setTimeout(resolve, totalDelay));
      }
    }

    throw new Error(`${context} failed after ${this.config.maxRetries} attempts. Last error: ${lastError?.message}`);
  }

  /**
   * Process items in batches with rate limiting
   */
  async processBatch<T, R>(
    items: T[],
    processor: (item: T) => Promise<R>,
    batchSize: number = 5
  ): Promise<R[]> {
    const results: R[] = [];
    
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(items.length / batchSize)} (${batch.length} items)`);
      
      // Process batch items with delays
      for (const item of batch) {
        const result = await this.executeWithRetry(
          () => processor(item),
          `Batch item ${i + 1}`
        );
        results.push(result);
        
        // Add delay between items in batch
        if (batch.indexOf(item) < batch.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500)); // 500ms between items
        }
      }
      
      // Add longer delay between batches
      if (i + batchSize < items.length) {
        console.log('Waiting between batches...');
        await new Promise(resolve => setTimeout(resolve, 2000)); // 2s between batches
      }
    }
    
    return results;
  }

  /**
   * Get current metrics
   */
  getMetrics(): RequestMetrics {
    return { ...this.metrics };
  }

  /**
   * Get current throttling status
   */
  isCurrentlyThrottled(): boolean {
    return this.isThrottled;
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      throttledRequests: 0,
      averageResponseTime: 0,
      lastRequestTime: 0
    };
    this.requestTimes = [];
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<RateLimitConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('Rate limiter configuration updated:', newConfig);
  }
}