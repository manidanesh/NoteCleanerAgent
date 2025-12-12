import { LLMRequest, LLMResponse, LLMRequestType, ContentAnalysis } from '../models/LLMModels';
import { LLMResourceManager } from './LLMResourceManager';

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
  private maxConcurrentRequests = 3;
  private activeRequests = 0;
  private resourceManager: LLMResourceManager;

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

    this.resourceManager = new LLMResourceManager();
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

      // Core ML provider (iOS/macOS)
      const coreMLProvider = await this.createCoreMLProvider();
      if (coreMLProvider) {
        this.providers.set(LLMProvider.CORE_ML, coreMLProvider);
        this.currentProvider = LLMProvider.CORE_ML;
      }

      // Ollama provider (macOS)
      const ollamaProvider = await this.createOllamaProvider();
      if (ollamaProvider) {
        this.providers.set(LLMProvider.OLLAMA, ollamaProvider);
        if (this.currentProvider === LLMProvider.FALLBACK_RULES) {
          this.currentProvider = LLMProvider.OLLAMA;
        }
      }

      // GGML provider (fallback)
      const ggmlProvider = await this.createGGMLProvider();
      if (ggmlProvider) {
        this.providers.set(LLMProvider.GGML, ggmlProvider);
        if (this.currentProvider === LLMProvider.FALLBACK_RULES) {
          this.currentProvider = LLMProvider.GGML;
        }
      }

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
    // Check if resources allow processing
    if (!(await this.resourceManager.canProcessRequest(request))) {
      throw new Error('Insufficient system resources for LLM processing');
    }

    // Optimize request based on current resource constraints
    const optimizedRequest = this.resourceManager.optimizeRequest(request);

    return new Promise((resolve, reject) => {
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
      if (provider && await provider.isAvailable()) {
        const capabilities = provider.getCapabilities();
        if (capabilities.supportedRequestTypes.includes(request.requestType)) {
          return provider;
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
        return {
          requestId: `fallback_${Date.now()}`,
          response: 'Processed with rule-based fallback',
          confidence: 0.6,
          tokensUsed: 10,
          processingTime: 50,
          model: 'Rule-Based-Fallback',
          fallbackUsed: true
        };
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

    // Shutdown resource manager
    this.resourceManager.shutdown();

    // Shutdown all providers
    for (const provider of this.providers.values()) {
      await provider.shutdown();
    }
    
    this.providers.clear();
  }
}