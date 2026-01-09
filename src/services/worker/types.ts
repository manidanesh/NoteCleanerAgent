/**
 * Types for Worker Thread communication and task management
 */

export interface Task<T = any> {
    id: string;
    type: string;
    payload: T;
}

export interface TaskResult<R = any> {
    taskId: string;
    result?: R;
    error?: string;
    success: boolean;
    workerId: number;
}

export enum WorkerMessageType {
    TASK = 'task',
    RESULT = 'result',
    ERROR = 'error',
    READY = 'ready',
    SHUTDOWN = 'shutdown'
}

export interface WorkerMessage {
    type: WorkerMessageType;
    payload: any;
}

export interface WorkerPoolConfig {
    minWorkers: number;
    maxWorkers: number;
    idleTimeout: number; // ms to wait before terminating idle worker
    taskTimeout: number; // ms to wait before failing a task
}

export interface WorkerStats {
    activeWorkers: number;
    idleWorkers: number;
    pendingTasks: number;
    completedTasks: number;
    failedTasks: number;
    uptime: number;
}
