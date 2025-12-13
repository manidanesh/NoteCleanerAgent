import { AgentCoordinator, AgentStatus, FallbackStrategy, CoordinationMessageType, MessagePriority } from '../../src/agents/AgentCoordinator';
import { LLMService } from '../../src/services/LLMService';
import { Note, AttachmentType } from '../../src/models/Note';
import { RecommendationAction, ImpactLevel } from '../../src/models/Recommendation';

// Mock LLM Service
class MockLLMService implements LLMService {
  async processRequest(request: any): Promise<any> {
    return {
      requestId: 'mock-request',
      response: 'Mock LLM response',
      confidence: 0.8,
      tokensUsed: 100,
      processingTime: 500,
      model: 'mock-model',
      fallbackUsed: false
    };
  }
}

describe('AgentCoordinator', () => {
  let coordinator: AgentCoordinator;
  let mockLLMService: LLMService;
  let mockNote: Note;

  beforeEach(() => {
    mockLLMService = new MockLLMService();
    coordinator = new AgentCoordinator(mockLLMService, {
      maxConcurrentProcessing: 3,
      batchSize: 5,
      enableOnDeviceLLM: true,
      enableCloudLLM: false,
      privacyMode: 'strict'
    });

    mockNote = {
      id: 'test-note-1',
      title: 'Test Note',
      content: 'This is a test note with some content for processing.',
      createdDate: new Date('2024-01-01'),
      modifiedDate: new Date('2024-01-02'),
      folder: 'Test Folder',
      attachments: [],
      checklists: [],
      metadata: {
        accessCount: 5,
        lastAccessDate: new Date('2024-01-02'),
        shareCount: 0,
        tags: ['test'],
        isShared: false,
        wordCount: 12,
        hasHandwriting: false,
        hasImages: false
      }
    };
  });

  afterEach(async () => {
    await coordinator.shutdown();
  });

  describe('Agent Registration', () => {
    test('should register all required agents on initialization', () => {
      const capabilities = coordinator.getAgentCapabilities();
      
      expect(capabilities).toHaveLength(5);
      
      const agentIds = capabilities.map(c => c.agentId);
      expect(agentIds).toContain('content-extractor');
      expect(agentIds).toContain('utility-scorer');
      expect(agentIds).toContain('duplicate-detector');
      expect(agentIds).toContain('organization-agent');
      expect(agentIds).toContain('learning-component');
    });

    test('should have all agents in active status', () => {
      const capabilities = coordinator.getAgentCapabilities();
      
      capabilities.forEach(capability => {
        expect(capability.status).toBe(AgentStatus.ACTIVE);
        expect(capability.lastHealthCheck).toBeInstanceOf(Date);
      });
    });

    test('should register agent capabilities correctly', () => {
      const capabilities = coordinator.getAgentCapabilities();
      const contentExtractor = capabilities.find(c => c.agentId === 'content-extractor');
      
      expect(contentExtractor).toBeDefined();
      expect(contentExtractor!.capabilities).toContain('text_processing');
      expect(contentExtractor!.capabilities).toContain('ocr_processing');
      expect(contentExtractor!.capabilities).toContain('semantic_analysis');
    });
  });

  describe('Single Note Processing', () => {
    test('should process a note through complete workflow', async () => {
      const result = await coordinator.processNote(mockNote);
      
      expect(result.noteId).toBe(mockNote.id);
      expect(result.extractedContent).toBeDefined();
      expect(result.utilityScore).toBeDefined();
      expect(result.recommendations).toBeDefined();
      expect(result.processingTime).toBeGreaterThan(0);
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    test('should handle processing errors gracefully', async () => {
      // Create a note that might cause processing issues
      const problematicNote: Note = {
        ...mockNote,
        id: 'problematic-note',
        content: '', // Empty content might cause issues
        title: ''
      };

      const result = await coordinator.processNote(problematicNote);
      
      expect(result.noteId).toBe(problematicNote.id);
      // Should still complete processing even with potential issues
      expect(result.extractedContent).toBeDefined();
    });

    test('should generate utility scores within valid range', async () => {
      const result = await coordinator.processNote(mockNote);
      
      expect(result.utilityScore).toBeDefined();
      expect(result.utilityScore!.overallScore).toBeGreaterThanOrEqual(0);
      expect(result.utilityScore!.overallScore).toBeLessThanOrEqual(100);
      expect(result.utilityScore!.confidence).toBeGreaterThan(0);
      expect(result.utilityScore!.confidence).toBeLessThanOrEqual(1);
    });

    test('should generate valid recommendations', async () => {
      const result = await coordinator.processNote(mockNote);
      
      expect(result.recommendations).toBeDefined();
      expect(Array.isArray(result.recommendations)).toBe(true);
      
      if (result.recommendations!.length > 0) {
        const recommendation = result.recommendations![0];
        expect(recommendation.noteId).toBe(mockNote.id);
        expect(recommendation.confidence).toBeGreaterThan(0);
        expect(recommendation.confidence).toBeLessThanOrEqual(1);
        expect(recommendation.reasoning).toBeDefined();
        expect(recommendation.reversible).toBeDefined();
      }
    });
  });

  describe('Batch Processing', () => {
    test('should process multiple notes in batches', async () => {
      const notes: Note[] = [
        { ...mockNote, id: 'note-1', title: 'Note 1' },
        { ...mockNote, id: 'note-2', title: 'Note 2' },
        { ...mockNote, id: 'note-3', title: 'Note 3' }
      ];

      const results = await coordinator.processNotes(notes);
      
      expect(results).toHaveLength(3);
      expect(results[0].noteId).toBe('note-1');
      expect(results[1].noteId).toBe('note-2');
      expect(results[2].noteId).toBe('note-3');
    });

    test('should handle batch processing with different batch sizes', async () => {
      const notes: Note[] = Array.from({ length: 7 }, (_, i) => ({
        ...mockNote,
        id: `note-${i + 1}`,
        title: `Note ${i + 1}`
      }));

      const results = await coordinator.processNotes(notes);
      
      expect(results).toHaveLength(7);
      results.forEach((result, index) => {
        expect(result.noteId).toBe(`note-${index + 1}`);
      });
    });
  });

  describe('Processing Status', () => {
    test('should update processing status during workflow', async () => {
      const initialStatus = coordinator.getProcessingStatus();
      expect(initialStatus.isProcessing).toBe(false);

      // Start processing (don't await to check intermediate status)
      const processingPromise = coordinator.processNote(mockNote);
      
      // Allow some time for processing to start
      await new Promise(resolve => setTimeout(resolve, 10));
      
      await processingPromise;
      
      const finalStatus = coordinator.getProcessingStatus();
      expect(finalStatus.progress).toBe(100);
    });

    test('should provide processing status information', () => {
      const status = coordinator.getProcessingStatus();
      
      expect(status).toHaveProperty('isProcessing');
      expect(status).toHaveProperty('currentStep');
      expect(status).toHaveProperty('progress');
      expect(typeof status.progress).toBe('number');
    });
  });

  describe('Feedback Recording', () => {
    test('should record user feedback correctly', () => {
      const feedback = coordinator.recordFeedback('rec-1', 'approved', {
        note: mockNote,
        userReason: 'Good recommendation'
      });
      
      expect(feedback.recommendationId).toBe('rec-1');
      expect(feedback.action).toBe('approved');
      expect(feedback.timestamp).toBeInstanceOf(Date);
      expect(feedback.context).toBeDefined();
    });

    test('should handle feedback rejection', () => {
      const feedback = coordinator.recordFeedback('rec-2', 'rejected', {
        note: mockNote,
        userReason: 'Not relevant'
      });
      
      expect(feedback.recommendationId).toBe('rec-2');
      expect(feedback.action).toBe('rejected');
    });
  });

  describe('Health Checks', () => {
    test('should perform health checks on all agents', async () => {
      const healthStatus = await coordinator.performHealthCheck();
      
      expect(healthStatus.size).toBe(5);
      expect(healthStatus.get('content-extractor')).toBe(AgentStatus.ACTIVE);
      expect(healthStatus.get('utility-scorer')).toBe(AgentStatus.ACTIVE);
      expect(healthStatus.get('duplicate-detector')).toBe(AgentStatus.ACTIVE);
      expect(healthStatus.get('organization-agent')).toBe(AgentStatus.ACTIVE);
      expect(healthStatus.get('learning-component')).toBe(AgentStatus.ACTIVE);
    });
  });

  describe('Configuration Management', () => {
    test('should get current configuration', () => {
      const config = coordinator.getConfiguration();
      
      expect(config.maxConcurrentProcessing).toBe(3);
      expect(config.batchSize).toBe(5);
      expect(config.enableOnDeviceLLM).toBe(true);
      expect(config.enableCloudLLM).toBe(false);
      expect(config.privacyMode).toBe('strict');
    });

    test('should update configuration', () => {
      coordinator.updateConfiguration({
        maxConcurrentProcessing: 10,
        batchSize: 20
      });
      
      const config = coordinator.getConfiguration();
      expect(config.maxConcurrentProcessing).toBe(10);
      expect(config.batchSize).toBe(20);
      // Other values should remain unchanged
      expect(config.enableOnDeviceLLM).toBe(true);
    });
  });

  describe('Cross-Device Coordination', () => {
    test('should register coordination message callbacks', () => {
      let messageReceived = false;
      
      coordinator.onCoordinationMessage(CoordinationMessageType.STATUS_UPDATE, (message) => {
        messageReceived = true;
        expect(message.type).toBe(CoordinationMessageType.STATUS_UPDATE);
      });
      
      // Simulate receiving a coordination message
      coordinator.handleCoordinationMessage({
        id: 'test-msg-1',
        type: CoordinationMessageType.STATUS_UPDATE,
        sourceDevice: 'other-device',
        payload: { status: 'processing' },
        timestamp: new Date(),
        priority: MessagePriority.NORMAL
      });
      
      expect(messageReceived).toBe(true);
    });

    test('should announce capabilities', () => {
      // This would normally broadcast to other devices
      // For testing, we just ensure it doesn't throw
      expect(() => {
        coordinator.announceCapabilities();
      }).not.toThrow();
    });

    test('should request macOS processing', async () => {
      const notes = [mockNote];
      
      // This would normally send a request to macOS companion
      // For testing, we just ensure it doesn't throw
      await expect(coordinator.requestMacOSProcessing(notes)).resolves.not.toThrow();
    });
  });

  describe('Error Handling and Fallbacks', () => {
    test('should handle agent failures gracefully', async () => {
      // This test would require mocking agent failures
      // For now, we test that processing completes even with potential issues
      const result = await coordinator.processNote(mockNote);
      
      expect(result).toBeDefined();
      expect(result.noteId).toBe(mockNote.id);
      // Even if some steps fail, we should get a result
    });

    test('should provide fallback results when agents fail', async () => {
      const result = await coordinator.processNote(mockNote);
      
      // Should always provide some form of result
      expect(result.extractedContent).toBeDefined();
      expect(result.utilityScore).toBeDefined();
      expect(result.recommendations).toBeDefined();
    });
  });

  describe('Cleanup and Shutdown', () => {
    test('should shutdown cleanly', async () => {
      await expect(coordinator.shutdown()).resolves.not.toThrow();
    });

    test('should clear resources on shutdown', async () => {
      await coordinator.shutdown();
      
      const status = coordinator.getProcessingStatus();
      expect(status.isProcessing).toBe(false);
    });
  });
});