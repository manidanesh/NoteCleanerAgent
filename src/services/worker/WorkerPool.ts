import { Worker } from 'worker_threads';
import path from 'path';
import { EventEmitter } from 'events';
import { Task, TaskResult, WorkerPoolConfig, WorkerMessageType, WorkerStats } from './types';

interface WorkerInfo {
    id: number;
    worker: Worker;
    busy: boolean;
    lastActive: number;
    currentTaskId?: string;
}

interface QueuedTask {
    task: Task;
    resolve: (result: any) => void;
    reject: (error: any) => void;
    queuedAt: number;
}

export class WorkerPool extends EventEmitter {
    private workers: Map<number, WorkerInfo> = new Map();
    private taskQueue: QueuedTask[] = [];
    private pendingTasks: Map<string, QueuedTask> = new Map();
    private config: WorkerPoolConfig;
    private nextWorkerId = 1;
    private isShuttingDown = false;

    constructor(config: Partial<WorkerPoolConfig> = {}) {
        super();
        this.config = {
            minWorkers: 2,
            maxWorkers: 4, // Default to generic quad-core assumption
            idleTimeout: 30000,
            taskTimeout: 60000,
            ...config
        };
    }

    /**
     * Initialize the pool with minimum workers
     */
    async initialize(): Promise<void> {
        console.log(`[WorkerPool] Initializing with ${this.config.minWorkers} min workers`);
        const promises = [];
        for (let i = 0; i < this.config.minWorkers; i++) {
            promises.push(this.createWorker());
        }
        await Promise.all(promises);
    }

    /**
     * Execute a task on a worker
     */
    async execute<T = any, R = any>(type: string, payload: T): Promise<R> {
        if (this.isShuttingDown) {
            throw new Error('Worker pool is shutting down');
        }

        const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const task: Task<T> = { id: taskId, type, payload };

        return new Promise<R>((resolve, reject) => {
            const queuedTask: QueuedTask = {
                task,
                resolve,
                reject,
                queuedAt: Date.now()
            };

            this.enqueueTask(queuedTask);
        });
    }

    /**
     * Add task to queue and try to process
     */
    private enqueueTask(queuedTask: QueuedTask): void {
        this.taskQueue.push(queuedTask);
        this.processQueue();
    }

    /**
     * Process the task queue
     */
    private processQueue(): void {
        if (this.taskQueue.length === 0) return;

        // Find available worker
        let workerInfo = this.findAvailableWorker();

        // If no worker available and we can create more, do so
        if (!workerInfo && this.workers.size < this.config.maxWorkers) {
            // Async create worker, it will trigger queue processing when ready
            this.createWorker().catch(err => console.error('[WorkerPool] Failed to create dynamic worker:', err));
            return;
        }

        if (workerInfo) {
            const queuedTask = this.taskQueue.shift();
            if (queuedTask) {
                this.runTaskOnWorker(workerInfo, queuedTask);
            }
        }
    }

    /**
     * Run a specific task on a specific worker
     */
    private runTaskOnWorker(workerInfo: WorkerInfo, queuedTask: QueuedTask): void {
        workerInfo.busy = true;
        workerInfo.lastActive = Date.now();
        workerInfo.currentTaskId = queuedTask.task.id;

        this.pendingTasks.set(queuedTask.task.id, queuedTask);

        workerInfo.worker.postMessage({
            type: WorkerMessageType.TASK,
            payload: queuedTask.task
        });

        // Set timeout check
        setTimeout(() => {
            if (this.pendingTasks.has(queuedTask.task.id)) {
                const pending = this.pendingTasks.get(queuedTask.task.id);
                if (pending) {
                    pending.reject(new Error(`Task ${queuedTask.task.id} timed out after ${this.config.taskTimeout}ms`));
                    this.pendingTasks.delete(queuedTask.task.id);
                    // Worker might be stuck, consider terminating?
                    // For now, just mark free (though it might still be running)
                    // Ideally we should terminate and replace stuck workers
                    this.terminateWorker(workerInfo.id);
                }
            }
        }, this.config.taskTimeout);
    }

    /**
     * Find an idle worker
     */
    private findAvailableWorker(): WorkerInfo | undefined {
        for (const info of this.workers.values()) {
            if (!info.busy) return info;
        }
        return undefined;
    }

    /**
   * Create a new worker thread
   */
    private async createWorker(): Promise<WorkerInfo> {
        const id = this.nextWorkerId++;

        // Determine worker file path and execution arguments based on environment
        const isTs = __filename.endsWith('.ts');
        const workerFile = isTs ? 'taskWorker.ts' : 'taskWorker.js';
        const workerPath = path.join(__dirname, workerFile);

        const workerOptions: any = {
            workerData: { workerId: id }
        };

        // If running in TypeScript (ts-node), we need to register the loader for the worker
        if (isTs) {
            workerOptions.execArgv = ['-r', 'ts-node/register'];
        }

        return new Promise((resolve, reject) => {
            try {
                const worker = new Worker(workerPath, workerOptions);

                const info: WorkerInfo = {
                    id,
                    worker,
                    busy: false,
                    lastActive: Date.now()
                };

                // Wrapper to handle initialization errors
                const initErrorHandler = (err: Error) => {
                    this.handleWorkerError(info, err);
                    reject(err);
                };

                const initExitHandler = (code: number) => {
                    this.handleWorkerExit(info, code);
                    if (code !== 0) {
                        reject(new Error(`Worker exited with code ${code} during initialization`));
                    }
                };

                worker.on('message', (message: any) => {
                    // Remove init listeners on success to avoid double-handling
                    worker.removeListener('error', initErrorHandler);
                    worker.removeListener('exit', initExitHandler);

                    // Re-bind standard listeners
                    worker.on('error', (err) => this.handleWorkerError(info, err));
                    worker.on('exit', (code) => this.handleWorkerExit(info, code));

                    this.handleWorkerMessage(info, message, resolve);
                });

                worker.on('error', initErrorHandler);
                worker.on('exit', initExitHandler);

                this.workers.set(id, info);
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Handle messages from workers
     */
    private handleWorkerMessage(info: WorkerInfo, message: any, initResolve?: (info: WorkerInfo) => void): void {
        if (message.type === WorkerMessageType.READY) {
            if (initResolve) initResolve(info);
            this.processQueue();
        } else if (message.type === WorkerMessageType.RESULT) {
            const result = message.payload as TaskResult;
            const pendingTask = this.pendingTasks.get(result.taskId);

            if (pendingTask) {
                if (result.success) {
                    pendingTask.resolve(result.result);
                } else {
                    pendingTask.reject(new Error(result.error));
                }
                this.pendingTasks.delete(result.taskId);
            }

            info.busy = false;
            info.lastActive = Date.now();
            info.currentTaskId = undefined;

            // Look for next task
            this.processQueue();
        }
    }

    private handleWorkerError(info: WorkerInfo, error: Error): void {
        console.error(`[WorkerPool] Worker ${info.id} error:`, error);
        // Any pending task on this worker fails
        if (info.currentTaskId) {
            const pending = this.pendingTasks.get(info.currentTaskId);
            if (pending) {
                pending.reject(new Error(`Worker failed: ${error.message}`));
                this.pendingTasks.delete(info.currentTaskId);
            }
        }
        this.terminateWorker(info.id);
    }

    private handleWorkerExit(info: WorkerInfo, code: number): void {
        if (code !== 0) {
            console.warn(`[WorkerPool] Worker ${info.id} exited with code ${code}`);
        }
        this.workers.delete(info.id);
        // Replace if needed (unless shutting down)
        if (!this.isShuttingDown && this.workers.size < this.config.minWorkers) {
            this.createWorker().catch(e => console.error('Failed to replace worker', e));
        }
    }

    private terminateWorker(id: number): void {
        const info = this.workers.get(id);
        if (info) {
            info.worker.terminate();
            this.workers.delete(id);
        }
    }

    async shutdown(): Promise<void> {
        this.isShuttingDown = true;
        const promises = [];
        for (const info of this.workers.values()) {
            promises.push(info.worker.terminate());
        }
        await Promise.all(promises);
        this.workers.clear();
    }

    getStats(): WorkerStats {
        let idleWorkers = 0;
        for (const w of this.workers.values()) if (!w.busy) idleWorkers++;

        return {
            activeWorkers: this.workers.size,
            idleWorkers,
            pendingTasks: this.taskQueue.length,
            // Metrics tracking (completed/failed) omitted for brevity, logic exists in pendingTasks resolution
            completedTasks: 0,
            failedTasks: 0,
            uptime: process.uptime()
        };
    }
}
