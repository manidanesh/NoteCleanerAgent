import { parentPort, workerData, isMainThread } from 'worker_threads';
import { WorkerMessageType, Task, TaskResult } from './types';
import { ScoringAlgorithms, TFIDFResult } from '../../agents/scoring/ScoringAlgorithms';
import { Note } from '../../models/Note';
import { UserPreferences } from '../../agents/UtilityScorerAgent';

// State for scoring
let documentFrequencies: Map<string, number> = new Map();
let totalDocuments: number = 0;

// Registry of task handlers
// In a real app, these might be dynamically imported or registered
const taskHandlers: Record<string, (payload: any) => Promise<any>> = {
    'echo': async (payload) => payload,

    // Initialize vocabulary for TF-IDF
    'scoring-init-vocab': async (payload: { notes: Note[] }) => {
        const { notes } = payload;
        totalDocuments = notes.length;
        documentFrequencies.clear();

        for (const note of notes) {
            const text = `${note.title} ${note.content}`.toLowerCase();
            const words = new Set(ScoringAlgorithms.tokenize(text));

            for (const word of words) {
                documentFrequencies.set(word, (documentFrequencies.get(word) || 0) + 1);
            }
        }
        return { success: true, totalDocuments };
    },

    // Calculate non-LLM scores
    'utility-scoring': async (payload: { note: Note, preferences: UserPreferences }) => {
        const { note, preferences } = payload;

        // Convert string dates back to Date objects if needed (JSON serialization converts to string)
        // Note: The Note interface usually has Date objects, but over JSON they become strings.
        // We create a proxy or copy with Date objects logic handled by the Alg class or here.
        const noteWithDates = {
            ...note,
            createdDate: new Date(note.createdDate),
            modifiedDate: new Date(note.modifiedDate),
            metadata: {
                ...note.metadata,
                lastAccessDate: note.metadata.lastAccessDate ? new Date(note.metadata.lastAccessDate) : undefined
            }
        } as Note;

        const tfIdf = ScoringAlgorithms.calculateTFIDFScore(noteWithDates, documentFrequencies, totalDocuments);
        const behavioral = ScoringAlgorithms.calculateBehavioralScore(noteWithDates, preferences);
        const semantic = ScoringAlgorithms.calculateSemanticScore(noteWithDates);
        const ruleBased = ScoringAlgorithms.calculateRuleBasedScore(noteWithDates, preferences);

        // Filter out Maps from result if they are not serializable or needed
        // keywordScores is a Map, handled by structured clone?
        // Node worker messages support Maps.

        return {
            tfIdf,
            behavioral,
            semantic,
            ruleBased
        };
    },

    'heavy-computation': async (payload) => {
        // Simulate heavy work
        const start = Date.now();
        while (Date.now() - start < (payload.duration || 1000)) {
            // Burn CPU
            Math.random();
        }
        return { completed: true, duration: Date.now() - start };
    }
};

/**
 * Main worker execution loop
 */
async function runWorker() {
    if (isMainThread || !parentPort) {
        throw new Error('This file must be run as a worker thread');
    }

    const workerId = workerData.workerId;
    console.log(`[Worker ${workerId}] Started`);

    // Signal readiness
    parentPort.postMessage({
        type: WorkerMessageType.READY,
        payload: { workerId }
    });

    // Handle messages from main thread
    parentPort.on('message', async (message: { type: WorkerMessageType, payload: any }) => {
        if (message.type === WorkerMessageType.SHUTDOWN) {
            process.exit(0);
        }

        if (message.type === WorkerMessageType.TASK) {
            const task = message.payload as Task;

            try {
                const handler = taskHandlers[task.type];
                if (!handler) {
                    throw new Error(`Unknown task type: ${task.type}`);
                }

                const result = await handler(task.payload);

                const response: TaskResult = {
                    taskId: task.id,
                    result,
                    success: true,
                    workerId
                };

                parentPort?.postMessage({
                    type: WorkerMessageType.RESULT,
                    payload: response
                });

            } catch (error) {
                console.error(`[Worker ${workerId}] Task failed:`, error);

                const response: TaskResult = {
                    taskId: task.id,
                    error: error instanceof Error ? error.message : String(error),
                    success: false,
                    workerId
                };

                parentPort?.postMessage({
                    type: WorkerMessageType.RESULT,
                    payload: response
                });
            }
        }
    });
}

// Start the worker
runWorker().catch(err => {
    console.error('Worker failed to start:', err);
    process.exit(1);
});
