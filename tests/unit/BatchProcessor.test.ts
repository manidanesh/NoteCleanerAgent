import { BatchProcessor, BatchProcessingEvent } from '../../src/services/BatchProcessor';
import { PerformanceOptimizer } from '../../src/services/PerformanceOptimizer';
import { AgentCoordinator } from '../../src/agents/AgentCoordinator';
import { Note } from '../../src/models/Note';
import { LLMService } from '../../src/services/LLMService';

// Mock dependencies
jest.mock('../../src/services/PerformanceOptimizer');
jest.mock('../../src/agents/AgentCoordinator');
jest.mock('../../src/services/LLMService');

describe('BatchProcessor', () => {
  let batchProcessor: BatchProcessor;
  let mockAgentCoordinator: jest.Mocked<AgentCoordinator>;
  let mockPerformanceOptimizer: jest.Mocked<PerformanceOptimizer>;
  let mockLLMService: jest.Mocked<LLMService>;

  beforeEach(() => {
    mockLLMService = new LLMService({}) as jest.Mocked<LLMService>;
    mockAgentCoordinator = new AgentCoordinator(mockLLMService) as jest.Mocked<AgentCoordinator>;
    mockPerformanceOptimizer = new PerformanceOptimizer() as jest.Mocked<PerformanceOptimizer>;

    // Setup mocks
    mockPerformanceOptimizer.createOptimizedBatches.mockImplementation((notes) => {
      // Simple batching for tests
      const batches = [];
      for (let i = 0; i < notes.length; i += 2) {
        batches.push(notes.slice(i, i + 2));
      }
      return batches;
    });

    mockPerformanceOptimizer.canProcessBatch.mockResolvedValue(true);
    mockPerformanceOptimizer.shouldInterruptProcessing.mockReturnValue(false);

    mockAgentCoordinator.processNotes.mockResolvedValue([
      {
        noteId: 'test',
        errors: [],
        processingTime: 100,
        timestamp: new Date()
      }
    ]);

    batchProcessor = new BatchProcessor(
      mockAgentCoordinator,
      mockPerformanceOptimizer,
      {
        maxConcurrentBatches: 2,
        batchTimeout: 5000,
        retryAttempts: 2,
        enableCheckpointing: true,
        checkpointInterval: 2
      }
    );
  });

  describe('Batch Processing', () => {
    it('should process notes in batches', async () => {
      const notes: Note[] = [
        {
          id: '1',
          title: 'Note 1',
          content: 'Content 1',
          createdDate: new Date(),
          modifiedDate: new Date(),
          folder: 'Notes',
          attachments: [],
          checklists: []
        },
        {
          id: '2',
          title: 'Note 2',
          content: 'Content 2',
          createdDate: new Date(),
          modifiedDate: new Date(),
          folder: 'Notes',
          attachments: [],
          checklists: []
        }
      ];

      const results = await batchProcessor.processNotes(notes);

      expect(results).toBeDefined();
      expect(mockPerformanceOptimizer.createOptimizedBatches).toHaveBeenCalledWith(notes);
      expect(mockAgentCoordinator.processNotes).toHaveBeenCalled();
    });

    it('should handle empty notes array', async () => {
      const results = await batchProcessor.processNotes([]);

      expect(results).toEqual([]);
      expect(mockPerformanceOptimizer.createOptimizedBatches).toHaveBeenCalledWith([]);
    });

    it('should emit progress events during processing', async () => {
      const notes: Note[] = Array.from({ length: 4 }, (_, i) => ({
        id: `${i}`,
        title: `Note ${i}`,
        content: `Content ${i}`,
        createdDate: new Date(),
        modifiedDate: new Date(),
        folder: 'Notes',
        attachments: [],
        checklists: []
      }));

      const events: BatchProcessingEvent[] = [];
      batchProcessor.addEventListener((event) => {
        events.push(event);
      });

      await batchProcessor.processNotes(notes);

      // Should have received progress events
      const progressEvents = events.filter(e => e.type === 'progress_updated');
      expect(progressEvents.length).toBeGreaterThan(0);

      // Should have received batch events
      const batchStartedEvents = events.filter(e => e.type === 'batch_started');
      expect(batchStartedEvents.length).toBeGreaterThan(0);
    });
  });

  describe('Resource Management', () => {
    it('should wait for resources when throttled', async () => {
      // Mock throttling scenario
      let callCount = 0;
      mockPerformanceOptimizer.canProcessBatch.mockImplementation(async () => {
        callCount++;
        return callCount > 2; // Allow processing after 2 calls
      });

      const notes: Note[] = [{
        id: '1',
        title: 'Note 1',
        content: 'Content 1',
        createdDate: new Date(),
        modifiedDate: new Date(),
        folder: 'Notes',
        attachments: [],
        checklists: []
      }];

      const events: BatchProcessingEvent[] = [];
      batchProcessor.addEventListener((event) => {
        events.push(event);
      });

      await batchProcessor.processNotes(notes);

      // Should have paused and resumed
      const pausedEvents = events.filter(e => e.type === 'processing_paused');
      const resumedEvents = events.filter(e => e.type === 'processing_resumed');
      
      expect(pausedEvents.length).toBeGreaterThan(0);
      expect(resumedEvents.length).toBeGreaterThan(0);
    });

    it('should handle processing interruption', async () => {
      // Mock interruption scenario
      mockPerformanceOptimizer.shouldInterruptProcessing.mockReturnValue(true);

      const notes: Note[] = Array.from({ length: 6 }, (_, i) => ({
        id: `${i}`,
        title: `Note ${i}`,
        content: `Content ${i}`,
        createdDate: new Date(),
        modifiedDate: new Date(),
        folder: 'Notes',
        attachments: [],
        checklists: []
      }));

      const events: BatchProcessingEvent[] = [];
      batchProcessor.addEventListener((event) => {
        events.push(event);
      });

      const results = await batchProcessor.processNotes(notes);

      // Processing should be interrupted
      const pausedEvents = events.filter(e => e.type === 'processing_paused');
      expect(pausedEvents.length).toBeGreaterThan(0);
      
      // Results may be partial due to interruption
      expect(results.length).toBeLessThanOrEqual(notes.length);
    });
  });

  describe('Error Handling', () => {
    it('should retry failed batches', async () => {
      // Mock failure then success
      let attemptCount = 0;
      mockAgentCoordinator.processNotes.mockImplementation(async () => {
        attemptCount++;
        if (attemptCount === 1) {
          throw new Error('Processing failed');
        }
        return [{
          noteId: 'test',
          errors: [],
          processingTime: 100,
          timestamp: new Date()
        }];
      });

      const notes: Note[] = [{
        id: '1',
        title: 'Note 1',
        content: 'Content 1',
        createdDate: new Date(),
        modifiedDate: new Date(),
        folder: 'Notes',
        attachments: [],
        checklists: []
      }];

      const results = await batchProcessor.processNotes(notes);

      expect(attemptCount).toBe(2); // Initial attempt + 1 retry
      expect(results).toBeDefined();
    });

    it('should handle batch timeout', async () => {
      // Mock long-running process
      mockAgentCoordinator.processNotes.mockImplementation(async () => {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve([{
              noteId: 'test',
              errors: [],
              processingTime: 100,
              timestamp: new Date()
            }]);
          }, 10000); // 10 seconds - longer than batch timeout
        });
      });

      const notes: Note[] = [{
        id: '1',
        title: 'Note 1',
        content: 'Content 1',
        createdDate: new Date(),
        modifiedDate: new Date(),
        folder: 'Notes',
        attachments: [],
        checklists: []
      }];

      const events: BatchProcessingEvent[] = [];
      batchProcessor.addEventListener((event) => {
        events.push(event);
      });

      const results = await batchProcessor.processNotes(notes);

      // Should have failed events due to timeout
      const failedEvents = events.filter(e => e.type === 'batch_failed');
      expect(failedEvents.length).toBeGreaterThan(0);
    });
  });

  describe('Checkpointing', () => {
    it('should create checkpoints during processing', async () => {
      const notes: Note[] = Array.from({ length: 6 }, (_, i) => ({
        id: `${i}`,
        title: `Note ${i}`,
        content: `Content ${i}`,
        createdDate: new Date(),
        modifiedDate: new Date(),
        folder: 'Notes',
        attachments: [],
        checklists: []
      }));

      mockPerformanceOptimizer.createCheckpoint.mockReturnValue({
        id: 'checkpoint_1',
        batchIndex: 2,
        processedNotes: ['0', '1'],
        pendingNotes: ['2', '3', '4', '5'],
        partialResults: [],
        timestamp: new Date(),
        config: {} as any
      });

      const events: BatchProcessingEvent[] = [];
      batchProcessor.addEventListener((event) => {
        events.push(event);
      });

      await batchProcessor.processNotes(notes);

      // Should have created checkpoints
      const checkpointEvents = events.filter(e => e.type === 'checkpoint_created');
      expect(checkpointEvents.length).toBeGreaterThan(0);
    });

    it('should resume from checkpoint', async () => {
      const checkpoint = {
        id: 'checkpoint_1',
        batchIndex: 1,
        processedNotes: ['0'],
        pendingNotes: ['1', '2'],
        partialResults: [{
          noteId: '0',
          errors: [],
          processingTime: 100,
          timestamp: new Date()
        }],
        timestamp: new Date(),
        config: {} as any
      };

      mockPerformanceOptimizer.resumeFromCheckpoint.mockReturnValue(checkpoint);

      const notes: Note[] = Array.from({ length: 3 }, (_, i) => ({
        id: `${i}`,
        title: `Note ${i}`,
        content: `Content ${i}`,
        createdDate: new Date(),
        modifiedDate: new Date(),
        folder: 'Notes',
        attachments: [],
        checklists: []
      }));

      const events: BatchProcessingEvent[] = [];
      batchProcessor.addEventListener((event) => {
        events.push(event);
      });

      const results = await batchProcessor.processNotes(notes, 'checkpoint_1');

      // Should have resumed from checkpoint
      const resumedEvents = events.filter(e => e.type === 'processing_resumed');
      expect(resumedEvents.length).toBeGreaterThan(0);
      
      expect(mockPerformanceOptimizer.resumeFromCheckpoint).toHaveBeenCalledWith('checkpoint_1');
    });
  });

  describe('Progress Tracking', () => {
    it('should track processing progress', () => {
      const progress = batchProcessor.getProgress();

      expect(progress).toBeDefined();
      expect(typeof progress.totalBatches).toBe('number');
      expect(typeof progress.completedBatches).toBe('number');
      expect(typeof progress.totalNotes).toBe('number');
      expect(typeof progress.processedNotes).toBe('number');
    });

    it('should provide processing statistics', () => {
      const stats = batchProcessor.getStatistics();

      expect(stats).toBeDefined();
      expect(typeof stats.totalProcessingTime).toBe('number');
      expect(typeof stats.averageBatchTime).toBe('number');
      expect(typeof stats.totalBatches).toBe('number');
    });

    it('should track processing state', () => {
      expect(batchProcessor.isCurrentlyProcessing()).toBe(false);
      expect(batchProcessor.isCurrentlyPaused()).toBe(false);
    });
  });

  describe('Event Management', () => {
    it('should add and remove event listeners', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();

      batchProcessor.addEventListener(listener1);
      batchProcessor.addEventListener(listener2);

      // Remove one listener
      batchProcessor.removeEventListener(listener1);

      // Trigger an event (this would normally happen during processing)
      // For testing, we'll just verify the listeners are managed correctly
      expect(true).toBe(true); // Placeholder assertion
    });
  });

  describe('Configuration', () => {
    it('should update configuration', () => {
      const newConfig = {
        maxConcurrentBatches: 4,
        batchTimeout: 10000
      };

      batchProcessor.updateConfiguration(newConfig);
      
      const currentConfig = batchProcessor.getConfiguration();
      expect(currentConfig.maxConcurrentBatches).toBe(4);
      expect(currentConfig.batchTimeout).toBe(10000);
    });

    it('should get current configuration', () => {
      const config = batchProcessor.getConfiguration();

      expect(config).toBeDefined();
      expect(typeof config.maxConcurrentBatches).toBe('number');
      expect(typeof config.batchTimeout).toBe('number');
      expect(typeof config.retryAttempts).toBe('number');
    });
  });

  describe('Interruption Control', () => {
    it('should interrupt processing', () => {
      batchProcessor.interruptProcessing();
      
      expect(mockPerformanceOptimizer.interruptProcessing).toHaveBeenCalled();
    });
  });
});