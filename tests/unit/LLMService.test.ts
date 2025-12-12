import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { LLMServiceImpl, LLMProvider, PrivacyLevel } from '../../src/services/LLMService';
import { LLMServiceFactory } from '../../src/services/LLMServiceFactory';
import { LLMRequestType } from '../../src/models/LLMModels';

describe('LLMService', () => {
  let llmService: LLMServiceImpl;

  beforeEach(() => {
    llmService = LLMServiceFactory.createForTesting() as LLMServiceImpl;
  });

  afterEach(async () => {
    await llmService.shutdown();
  });

  describe('Service Initialization', () => {
    it('should initialize with default privacy-first configuration', () => {
      expect(llmService).toBeDefined();
      expect(llmService.getCurrentProvider()).toBeDefined();
    });

    it('should be available after initialization', async () => {
      const isAvailable = await llmService.isAvailable();
      expect(isAvailable).toBe(true);
    });
  });

  describe('Request Processing', () => {
    it('should process content analysis request', async () => {
      const request = {
        agentId: 'test-agent',
        requestType: LLMRequestType.CONTENT_ANALYSIS,
        context: 'Test context',
        noteContent: 'This is a test note with some content for analysis.',
        systemPrompt: 'Analyze the content',
        userPrompt: 'What is this note about?',
        maxTokens: 100,
        temperature: 0.7
      };

      const response = await llmService.processRequest(request);

      expect(response).toBeDefined();
      expect(response.requestId).toBeDefined();
      expect(response.response).toBeDefined();
      expect(response.confidence).toBeGreaterThan(0);
      expect(response.confidence).toBeLessThanOrEqual(1);
      expect(response.tokensUsed).toBeGreaterThan(0);
      expect(response.processingTime).toBeGreaterThan(0);
      expect(response.model).toBeDefined();
    });

    it('should process title generation request', async () => {
      const request = {
        agentId: 'test-agent',
        requestType: LLMRequestType.TITLE_GENERATION,
        context: '',
        noteContent: 'Meeting with the team about project planning and next steps.',
        systemPrompt: 'Generate a title',
        userPrompt: 'Create a descriptive title for this note',
        maxTokens: 50,
        temperature: 0.5
      };

      const response = await llmService.processRequest(request);

      expect(response).toBeDefined();
      expect(response.response).toBeDefined();
      expect(response.response.length).toBeGreaterThan(0);
    });

    it('should process classification request', async () => {
      const request = {
        agentId: 'test-agent',
        requestType: LLMRequestType.CLASSIFICATION,
        context: '',
        noteContent: 'Buy milk, bread, eggs, and vegetables from the store.',
        systemPrompt: 'Classify content type',
        userPrompt: 'What type of note is this?',
        maxTokens: 20,
        temperature: 0.3
      };

      const response = await llmService.processRequest(request);

      expect(response).toBeDefined();
      expect(response.response).toBeDefined();
    });
  });

  describe('Resource Management', () => {
    it('should track resource usage', () => {
      const usage = llmService.getResourceUsage();

      expect(usage).toBeDefined();
      expect(usage.totalRequests).toBeGreaterThanOrEqual(0);
      expect(usage.onDeviceRequests).toBeGreaterThanOrEqual(0);
      expect(usage.cloudRequests).toBeGreaterThanOrEqual(0);
      expect(usage.failedRequests).toBeGreaterThanOrEqual(0);
      expect(usage.averageResponseTime).toBeGreaterThanOrEqual(0);
    });

    it('should update resource usage after processing requests', async () => {
      const initialUsage = llmService.getResourceUsage();
      
      const request = {
        agentId: 'test-agent',
        requestType: LLMRequestType.EXPLANATION,
        context: '',
        noteContent: 'Test content',
        systemPrompt: 'Explain',
        userPrompt: 'Explain this content',
        maxTokens: 50,
        temperature: 0.7
      };

      await llmService.processRequest(request);
      
      const updatedUsage = llmService.getResourceUsage();
      expect(updatedUsage.totalRequests).toBeGreaterThan(initialUsage.totalRequests);
    });
  });

  describe('Provider Management', () => {
    it('should have a current provider', () => {
      const currentProvider = llmService.getCurrentProvider();
      expect(currentProvider).toBeDefined();
      expect(Object.values(LLMProvider)).toContain(currentProvider);
    });

    it('should allow setting provider preferences', () => {
      const newPreference = {
        preferOnDevice: false,
        allowCloudWithConsent: true,
        fallbackToRules: true,
        privacyLevel: PrivacyLevel.CLOUD_WITH_CONSENT
      };

      expect(() => {
        llmService.setProviderPreference(newPreference);
      }).not.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid requests gracefully', async () => {
      const invalidRequest = {
        agentId: '',
        requestType: 'invalid_type' as LLMRequestType,
        context: '',
        noteContent: '',
        systemPrompt: '',
        userPrompt: '',
        maxTokens: -1,
        temperature: 2.0
      };

      // Should either process with fallback or throw meaningful error
      try {
        const response = await llmService.processRequest(invalidRequest);
        expect(response).toBeDefined();
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBeDefined();
      }
    });
  });

  describe('Service Factory', () => {
    it('should create privacy-first service', () => {
      const service = LLMServiceFactory.createPrivacyFirst();
      expect(service).toBeDefined();
    });

    it('should create balanced service', () => {
      const service = LLMServiceFactory.createBalanced();
      expect(service).toBeDefined();
    });

    it('should create cloud-enabled service', () => {
      const service = LLMServiceFactory.createCloudEnabled();
      expect(service).toBeDefined();
    });

    it('should create custom service', () => {
      const customPreference = {
        preferOnDevice: true,
        allowCloudWithConsent: false,
        fallbackToRules: true,
        privacyLevel: PrivacyLevel.STRICT_ON_DEVICE
      };
      
      const service = LLMServiceFactory.createCustom(customPreference);
      expect(service).toBeDefined();
    });
  });
});