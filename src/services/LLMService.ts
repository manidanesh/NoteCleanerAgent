import { LLMRequest, LLMResponse, LLMRequestType, ContentAnalysis } from '../models/LLMModels';
import { LLMResourceManager } from './LLMResourceManager';
import { LLMResourceManagerOverride } from './LLMResourceManagerOverride';
import { LLMRateLimiter } from './LLMRateLimiter';

/**
 * LLM Service interface for multi-provider LLM integration
 */
export interface LLMService {
  /**
   * Process an LLM request with automatic provider selection
   */
  processRequest(request: LLMRequest): Promise<LLMResponse>;

  /**
   * Check if the service is available and ready
   */
  isAvailable(): Promise<boolean>;

  /**
   * Get the current provider being used
   */
  getCurrentProvider(): LLMProvider;

  /**
   * Set provider preference (on-device, cloud with consent, etc.)
   */
  setProviderPreference(preference: LLMProviderPreference): void;

  /**
   * Get resource usage statistics
   */
  getResourceUsage(): LLMResourceUsage;

  /**
   * Shutdown and cleanup resources
   */
  shutdown(): Promise<void>;
}

/**
 * LLM Provider types
 */
export enum LLMProvider {
  CORE_ML = 'core_ml',
  OLLAMA = 'ollama',
  GGML = 'ggml',
  CLOUD_OPENAI = 'cloud_openai',
  CLOUD_ANTHROPIC = 'cloud_anthropic',
  FALLBACK_RULES = 'fallback_rules'
}

/**
 * Provider preference configuration
 */
export interface LLMProviderPreference {
  preferOnDevice: boolean;
  allowCloudWithConsent: boolean;
  fallbackToRules: boolean;
  maxCloudRequests?: number;
  privacyLevel: PrivacyLevel;
}

/**
 * Privacy levels for LLM processing
 */
export enum PrivacyLevel {
  STRICT_ON_DEVICE = 'strict_on_device',
  ON_DEVICE_PREFERRED = 'on_device_preferred',
  CLOUD_WITH_CONSENT = 'cloud_with_consent',
  CLOUD_ALLOWED = 'cloud_allowed'
}

/**
 * Resource usage tracking
 */
export interface LLMResourceUsage {
  totalRequests: number;
  onDeviceRequests: number;
  cloudRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  memoryUsage: number;
  cpuUsage: number;
}

/**
 * LLM Provider interface that all implementations must follow
 */
export interface ILLMProvider {
  name: string;
  isAvailable(): Promise<boolean>;
  processRequest(request: LLMRequest): Promise<LLMResponse>;
  getCapabilities(): LLMCapabilities;
  getResourceUsage(): ProviderResourceUsage;
  shutdown(): Promise<void>;
}

/**
 * Provider capabilities
 */
export interface LLMCapabilities {
  maxTokens: number;
  supportedRequestTypes: LLMRequestType[];
  supportsStreaming: boolean;
  requiresNetwork: boolean;
  privacyCompliant: boolean;
}

/**
 * Provider-specific resource usage
 */
export interface ProviderResourceUsage {
  memoryUsage: number;
  cpuUsage: number;
  requestCount: number;
  averageLatency: number;
}

/**
 * Request queue item for managing LLM requests
 */
export interface QueuedRequest {
  id: string;
  request: LLMRequest;
  priority: RequestPriority;
  timestamp: number;
  resolve: (response: LLMResponse) => void;
  reject: (error: Error) => void;
}

/**
 * Request priority levels
 */
export enum RequestPriority {
  LOW = 0,
  NORMAL = 1,
  HIGH = 2,
  CRITICAL = 3
}

/**
 * Main LLM Service implementation with provider management and request queuing
 */
export class LLMServiceImpl implements LLMService {
  private providers: Map<LLMProvider, ILLMProvider> = new Map();
  private currentProvider: LLMProvider = LLMProvider.CORE_ML;
  private providerPreference: LLMProviderPreference;
  private requestQueue: QueuedRequest[] = [];
  private isProcessingQueue = false;
  private resourceUsage: LLMResourceUsage;
  private maxConcurrentRequests = 2; // Reduced from 3 to 2
  private activeRequests = 0;
  private resourceManager: LLMResourceManager | LLMResourceManagerOverride;
  private rateLimiter: LLMRateLimiter;

  constructor(preference?: LLMProviderPreference) {
    this.providerPreference = preference || {
      preferOnDevice: true,
      allowCloudWithConsent: false,
      fallbackToRules: true,
      privacyLevel: PrivacyLevel.STRICT_ON_DEVICE
    };

    this.resourceUsage = {
      totalRequests: 0,
      onDeviceRequests: 0,
      cloudRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      memoryUsage: 0,
      cpuUsage: 0
    };

    // Use override in development to completely bypass resource constraints
    this.resourceManager = new LLMResourceManagerOverride();
    this.rateLimiter = new LLMRateLimiter({
      maxRequestsPerMinute: 120, // Higher rate limit for development
      requestDelayMs: 100, // Much shorter delay - 100ms instead of 500ms
      maxTokensPerRequest: 1200, // Higher token limit
      maxContentLength: 2500, // Longer content allowed
      maxRetries: 2, // Reduced retries to fail faster
      backoffMultiplier: 1.5 // Reduced backoff
    });
    
    // Initialize providers asynchronously but ensure fallback is available immediately
    const fallbackProvider = this.createFallbackProvider();
    this.providers.set(LLMProvider.FALLBACK_RULES, fallbackProvider);
    this.currentProvider = LLMProvider.FALLBACK_RULES;
    
    // Initialize other providers in background
    this.initializeProviders().catch(error => {
      console.error('Background provider initialization failed:', error);
    });
  }

  private async initializeProviders(): Promise<void> {
    // Initialize providers based on platform and availability
    try {
      // Always ensure we have fallback provider first
      const fallbackProvider = this.createFallbackProvider();
      this.providers.set(LLMProvider.FALLBACK_RULES, fallbackProvider);
      this.currentProvider = LLMProvider.FALLBACK_RULES;

      console.log('🔧 Initializing LLM providers...');

      // Ollama provider (macOS) - try first since it's most capable
      try {
        const ollamaProvider = await this.createOllamaProvider();
        if (ollamaProvider && await ollamaProvider.isAvailable()) {
          this.providers.set(LLMProvider.OLLAMA, ollamaProvider);
          this.currentProvider = LLMProvider.OLLAMA;
          console.log('✅ Ollama provider initialized and available');
        } else {
          console.log('⚠️  Ollama provider not available (server not running or model not found)');
        }
      } catch (error) {
        console.log('⚠️  Ollama provider initialization failed:', (error as Error).message || error);
      }

      // Core ML provider (iOS/macOS)
      try {
        const coreMLProvider = await this.createCoreMLProvider();
        if (coreMLProvider && await coreMLProvider.isAvailable()) {
          this.providers.set(LLMProvider.CORE_ML, coreMLProvider);
          if (this.currentProvider === LLMProvider.FALLBACK_RULES) {
            this.currentProvider = LLMProvider.CORE_ML;
          }
          console.log('✅ Core ML provider initialized and available');
        } else {
          console.log('⚠️  Core ML provider not available');
        }
      } catch (error) {
        console.log('⚠️  Core ML provider initialization failed:', (error as Error).message || error);
      }

      // GGML provider (fallback)
      try {
        const ggmlProvider = await this.createGGMLProvider();
        if (ggmlProvider && await ggmlProvider.isAvailable()) {
          this.providers.set(LLMProvider.GGML, ggmlProvider);
          if (this.currentProvider === LLMProvider.FALLBACK_RULES) {
            this.currentProvider = LLMProvider.GGML;
          }
          console.log('✅ GGML provider initialized and available');
        } else {
          console.log('⚠️  GGML provider not available');
        }
      } catch (error) {
        console.log('⚠️  GGML provider initialization failed:', (error as Error).message || error);
      }

      console.log(`🎯 Using provider: ${this.currentProvider}`);

    } catch (error) {
      console.error('Failed to initialize LLM providers:', error);
      // Ensure we always have fallback
      if (!this.providers.has(LLMProvider.FALLBACK_RULES)) {
        const fallbackProvider = this.createFallbackProvider();
        this.providers.set(LLMProvider.FALLBACK_RULES, fallbackProvider);
        this.currentProvider = LLMProvider.FALLBACK_RULES;
      }
    }
  }

  async processRequest(request: LLMRequest): Promise<LLMResponse> {
    // Add timeout to prevent hanging - increased from 8s to 15s for better reliability
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('LLM request timeout after 15 seconds')), 15000);
    });

    try {
      // Use rate limiter with retry logic and timeout
      const processPromise = this.rateLimiter.executeWithRetry(async () => {
        // Check if resources allow processing
        if (!(await this.resourceManager.canProcessRequest(request))) {
          this.rateLimiter.recordThrottle();
          throw new Error('Insufficient system resources for LLM processing');
        }

        // Optimize request content to reduce token usage
        const optimizedContent = this.rateLimiter.optimizeRequestContent(request.noteContent);
        const optimizedRequest = {
          ...this.resourceManager.optimizeRequest(request),
          noteContent: optimizedContent,
          maxTokens: Math.min(request.maxTokens, 800) // Cap tokens
        };

        return new Promise<LLMResponse>((resolve, reject) => {
          const queuedRequest: QueuedRequest = {
            id: this.generateRequestId(),
            request: optimizedRequest,
            priority: this.determinePriority(optimizedRequest),
            timestamp: Date.now(),
            resolve,
            reject
          };

          this.requestQueue.push(queuedRequest);
          this.requestQueue.sort((a, b) => b.priority - a.priority || a.timestamp - b.timestamp);

          this.processQueue();
        });
      }, `LLM Request ${request.requestType}`);

      return await Promise.race([processPromise, timeoutPromise]);
    } catch (error) {
      console.warn('⚠️  LLM request failed, using fallback response:', error);
      
      // Return a fallback response instead of hanging
      return {
        requestId: `fallback-${Date.now()}`,
        response: this.createFallbackResponse(request),
        confidence: 0.3,
        tokensUsed: 0,
        processingTime: 100,
        model: 'fallback-rules',
        fallbackUsed: true
      };
    }
  }

  private createFallbackResponse(request: LLMRequest): string {
    switch (request.requestType) {
      case LLMRequestType.CONTENT_ANALYSIS:
        return JSON.stringify({
          topics: ['general'],
          entities: { people: [], dates: [], locations: [], other: [] },
          contentType: 'other',
          actionItems: [],
          importanceIndicators: [],
          summary: 'Content analysis unavailable - using fallback'
        });
      case LLMRequestType.TITLE_GENERATION:
        return 'Untitled Note';
      case LLMRequestType.EXPLANATION:
        return 'Explanation unavailable - LLM service not available';
      default:
        return 'Response unavailable - LLM service not available';
    }
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.activeRequests >= this.maxConcurrentRequests) {
      return;
    }

    this.isProcessingQueue = true;

    while (this.requestQueue.length > 0 && this.activeRequests < this.maxConcurrentRequests) {
      const queuedRequest = this.requestQueue.shift();
      if (queuedRequest) {
        this.activeRequests++;
        // Reduced delay between processing queue items from 1s to 100ms
        if (this.activeRequests > 1) {
          await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay for concurrent requests
        }
        this.processQueuedRequest(queuedRequest);
      }
    }

    this.isProcessingQueue = false;
  }

  private async processQueuedRequest(queuedRequest: QueuedRequest): Promise<void> {
    const startTime = Date.now();
    
    try {
      const provider = await this.selectProvider(queuedRequest.request);
      const response = await provider.processRequest(queuedRequest.request);
      
      // Update resource usage
      this.updateResourceUsage(response, Date.now() - startTime, provider.name);
      
      queuedRequest.resolve(response);
    } catch (error) {
      this.resourceUsage.failedRequests++;
      queuedRequest.reject(error as Error);
    } finally {
      this.activeRequests--;
      // Continue processing queue
      if (this.requestQueue.length > 0) {
        setTimeout(() => this.processQueue(), 10);
      }
    }
  }

  private async selectProvider(request: LLMRequest): Promise<ILLMProvider> {
    // Provider selection logic based on preferences and availability
    const preferredProviders = this.getPreferredProviders();
    
    for (const providerType of preferredProviders) {
      const provider = this.providers.get(providerType);
      if (provider) {
        try {
          // Add timeout to isAvailable check to prevent hanging - reduced from 2s to 1s
          const isAvailablePromise = provider.isAvailable();
          const timeoutPromise = new Promise<boolean>((_, reject) => {
            setTimeout(() => reject(new Error('Provider availability check timeout')), 1000);
          });
          
          const isAvailable = await Promise.race([isAvailablePromise, timeoutPromise]);
          
          if (isAvailable) {
            const capabilities = provider.getCapabilities();
            if (capabilities.supportedRequestTypes.includes(request.requestType)) {
              return provider;
            }
          }
        } catch (error) {
          console.warn(`⚠️  Provider ${providerType} availability check failed:`, error);
          continue;
        }
      }
    }

    // Fallback to rule-based provider
    const fallback = this.providers.get(LLMProvider.FALLBACK_RULES);
    if (fallback) {
      return fallback;
    }

    throw new Error('No available LLM provider found');
  }

  private getPreferredProviders(): LLMProvider[] {
    const providers: LLMProvider[] = [];

    if (this.providerPreference.preferOnDevice) {
      providers.push(LLMProvider.CORE_ML, LLMProvider.OLLAMA, LLMProvider.GGML);
    }

    if (this.providerPreference.allowCloudWithConsent) {
      providers.push(LLMProvider.CLOUD_OPENAI, LLMProvider.CLOUD_ANTHROPIC);
    }

    if (this.providerPreference.fallbackToRules) {
      providers.push(LLMProvider.FALLBACK_RULES);
    }

    return providers;
  }

  private determinePriority(request: LLMRequest): RequestPriority {
    // Prioritize based on request type and agent
    switch (request.requestType) {
      case LLMRequestType.CONTENT_ANALYSIS:
        return RequestPriority.HIGH;
      case LLMRequestType.EXPLANATION:
        return RequestPriority.NORMAL;
      case LLMRequestType.TITLE_GENERATION:
        return RequestPriority.NORMAL;
      default:
        return RequestPriority.LOW;
    }
  }

  private updateResourceUsage(response: LLMResponse, processingTime: number, providerName: string): void {
    this.resourceUsage.totalRequests++;
    
    // Check provider name against actual provider names, not enum values
    const onDeviceProviderNames = ['CoreML', 'GGML', 'Ollama', 'Fallback'];
    const cloudProviderNames = ['OpenAI', 'Anthropic', 'Cloud'];
    
    if (onDeviceProviderNames.includes(providerName)) {
      this.resourceUsage.onDeviceRequests++;
    } else if (cloudProviderNames.some(cloudName => providerName.includes(cloudName))) {
      this.resourceUsage.cloudRequests++;
    } else {
      // Default to on-device for unknown providers (safer assumption)
      this.resourceUsage.onDeviceRequests++;
    }

    // Update average response time
    const totalTime = this.resourceUsage.averageResponseTime * (this.resourceUsage.totalRequests - 1) + processingTime;
    this.resourceUsage.averageResponseTime = totalTime / this.resourceUsage.totalRequests;
  }

  private generateRequestId(): string {
    return `llm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Provider factory methods (to be implemented by specific providers)
  private async createCoreMLProvider(): Promise<ILLMProvider | null> {
    try {
      const { CoreMLProvider } = await import('./providers/CoreMLProvider.js');
      return new CoreMLProvider();
    } catch (error) {
      console.warn('Core ML provider not available:', error);
      return null;
    }
  }

  private async createOllamaProvider(): Promise<ILLMProvider | null> {
    try {
      const { OllamaProvider } = await import('./providers/OllamaProvider.js');
      return new OllamaProvider();
    } catch (error) {
      console.warn('Ollama provider not available:', error);
      return null;
    }
  }

  private async createGGMLProvider(): Promise<ILLMProvider | null> {
    try {
      const { GGMLProvider } = await import('./providers/GGMLProvider.js');
      return new GGMLProvider();
    } catch (error) {
      console.warn('GGML provider not available:', error);
      return null;
    }
  }

  private createFallbackProvider(): ILLMProvider {
    // Create inline fallback provider for immediate availability
    return new (class implements ILLMProvider {
      name = 'Fallback';
      
      async isAvailable(): Promise<boolean> {
        return true;
      }
      
      async processRequest(request: LLMRequest): Promise<LLMResponse> {
        // Provide intelligent rule-based responses based on request type
        let response = '';
        
        switch (request.requestType) {
          case LLMRequestType.CONTENT_ANALYSIS:
            response = this.analyzeContent(request.noteContent);
            break;
          case LLMRequestType.TITLE_GENERATION:
            response = this.generateTitle(request.noteContent);
            break;
          case LLMRequestType.CLASSIFICATION:
            response = this.classifyContent(request.noteContent);
            break;
          case LLMRequestType.EXPLANATION:
            response = this.generateExplanation(request.noteContent, request.context);
            break;
          case LLMRequestType.SUMMARIZATION:
            response = this.summarizeContent(request.noteContent);
            break;
          case LLMRequestType.RELATIONSHIP_DETECTION:
            response = this.detectRelationships(request.noteContent);
            break;
          default:
            response = 'Processed with rule-based fallback';
        }
        
        return {
          requestId: `fallback_${Date.now()}`,
          response,
          confidence: 0.6,
          tokensUsed: Math.ceil(response.length / 4), // Rough token estimate
          processingTime: 50 + Math.random() * 100, // Simulate processing time
          model: 'Rule-Based-Fallback',
          fallbackUsed: true
        };
      }
      
      private analyzeContent(content: string): string {
        const words = content.toLowerCase().split(/\s+/);
        const topics = [];
        
        // Simple keyword-based topic detection
        if (words.some(w => ['meeting', 'discussed', 'agenda'].includes(w))) {
          topics.push('meeting');
        }
        if (words.some(w => ['buy', 'shopping', 'store', 'groceries'].includes(w))) {
          topics.push('shopping');
        }
        if (words.some(w => ['idea', 'concept', 'think', 'brainstorm'].includes(w))) {
          topics.push('ideas');
        }
        if (words.some(w => ['task', 'todo', 'complete', 'finish'].includes(w))) {
          topics.push('tasks');
        }
        
        const contentType = topics.length > 0 ? topics[0] : 'general';
        
        return JSON.stringify({
          topics: topics.length > 0 ? topics : ['general'],
          contentType,
          summary: content.substring(0, 100) + (content.length > 100 ? '...' : ''),
          confidence: 0.6
        });
      }
      
      private generateTitle(content: string): string {
        const words = content.split(/\s+/).slice(0, 5);
        const title = words.join(' ');
        return title.length > 3 ? title : 'Note Summary';
      }
      
      private classifyContent(content: string): string {
        const words = content.toLowerCase();
        
        if (words.includes('meeting') || words.includes('discussed')) {
          return 'meeting_notes';
        }
        if (words.includes('buy') || words.includes('shopping')) {
          return 'shopping_list';
        }
        if (words.includes('idea') || words.includes('concept')) {
          return 'idea';
        }
        if (words.includes('task') || words.includes('todo')) {
          return 'task_list';
        }
        
        return 'other';
      }
      
      private generateExplanation(content: string, context: string): string {
        return `This content appears to be ${this.classifyContent(content).replace('_', ' ')} based on keyword analysis. The content contains ${content.split(/\s+/).length} words and discusses topics related to the identified category.`;
      }
      
      private summarizeContent(content: string): string {
        const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
        return sentences.slice(0, 2).join('. ') + (sentences.length > 2 ? '...' : '');
      }
      
      private detectRelationships(content: string): string {
        const words = content.toLowerCase().split(/\s+/);
        const relationships = [];
        
        // Simple relationship detection
        if (words.includes('and') || words.includes('with')) {
          relationships.push('coordination');
        }
        if (words.includes('because') || words.includes('due')) {
          relationships.push('causation');
        }
        if (words.includes('similar') || words.includes('like')) {
          relationships.push('similarity');
        }
        
        return JSON.stringify({
          relationships: relationships.length > 0 ? relationships : ['none_detected'],
          confidence: 0.5
        });
      }
      
      getCapabilities() {
        return {
          maxTokens: 512,
          supportedRequestTypes: Object.values(LLMRequestType),
          supportsStreaming: false,
          requiresNetwork: false,
          privacyCompliant: true
        };
      }
      
      getResourceUsage() {
        return {
          memoryUsage: 10,
          cpuUsage: 5,
          requestCount: 0,
          averageLatency: 50
        };
      }
      
      async shutdown(): Promise<void> {
        // No cleanup needed
      }
    })();
  }

  // Interface implementation
  async isAvailable(): Promise<boolean> {
    return this.providers.size > 0;
  }

  getCurrentProvider(): LLMProvider {
    return this.currentProvider;
  }

  setProviderPreference(preference: LLMProviderPreference): void {
    this.providerPreference = preference;
  }

  getResourceUsage(): LLMResourceUsage {
    return { ...this.resourceUsage };
  }

  async shutdown(): Promise<void> {
    // Clear request queue
    this.requestQueue.forEach(req => {
      req.reject(new Error('Service shutting down'));
    });
    this.requestQueue = [];

    // Shutdown resource manager and rate limiter
    this.resourceManager.shutdown();
    this.rateLimiter.resetMetrics();

    // Shutdown all providers
    for (const provider of this.providers.values()) {
      await provider.shutdown();
    }
    
    this.providers.clear();
  }
}