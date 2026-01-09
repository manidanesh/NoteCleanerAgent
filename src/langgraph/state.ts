/**
 * LangGraph State Definitions
 * 
 * Defines the shared state structure used across all LangGraph workflows
 * for agent orchestration in the Notes AI Organizer.
 */

import { Note } from '../models/Note';
import { Recommendation } from '../models/Recommendation';
import { UtilityScore } from '../models/UtilityScore';
import { DuplicateGroup } from '../models/DuplicateGroup';
import { ExtractedContent } from '../agents/ContentExtractorAgent';
import { JunkDetectionResult } from '../agents/JunkNoteDetectorAgent';
import { ProcessingStrategy, ProcessingError, LLMContext } from '../core/AgentDriverInterface';

/**
 * Main state for all LangGraph workflows
 * This state is passed between nodes and updated as processing progresses
 */
export interface AgentProcessingState {
    // Input
    note: Note;
    strategy: ProcessingStrategy;

    // Agent outputs
    extractedContent?: ExtractedContent;
    utilityScore?: UtilityScore;
    duplicateGroups?: DuplicateGroup[];
    junkDetectionResult?: JunkDetectionResult;
    recommendations?: Recommendation[];

    // LLM context (shared between agents to avoid redundant processing)
    llmContext?: LLMContext;

    // Processing metadata
    metadata: ProcessingMetadata;

    // Control flow flags
    shouldSkipDuplicateDetection?: boolean;
    shouldSkipJunkDetection?: boolean;
    isJunkNote?: boolean;
    isHighValueNote?: boolean;
}

/**
 * Processing metadata tracked throughout workflow execution
 */
export interface ProcessingMetadata {
    /** When processing started */
    startTime: Date;

    /** List of agents that have been invoked */
    invokedAgents: string[];

    /** Errors encountered during processing */
    errors: ProcessingError[];

    /** Checkpoints for resumable processing */
    checkpoints: StateCheckpoint[];

    /** Resource usage tracking */
    resourceUsage: {
        cpuUsage: number;
        memoryUsageMb: number;
        llmCallCount: number;
    };
}

/**
 * Checkpoint for resumable processing
 * Allows workflow to resume from last successful state after failure
 */
export interface StateCheckpoint {
    /** Node ID where checkpoint was created */
    nodeId: string;

    /** When checkpoint was created */
    timestamp: Date;

    /** Partial state at checkpoint */
    state: Partial<AgentProcessingState>;
}

/**
 * Result from a node execution
 * Nodes return partial state updates that get merged into the main state
 */
export type NodeResult = Partial<AgentProcessingState>;

/**
 * Node execution function signature
 * All nodes must implement this interface
 */
export type NodeFunction = (state: AgentProcessingState) => Promise<NodeResult>;

/**
 * Conditional edge function signature
 * Used for routing decisions in the workflow
 */
export type ConditionalEdgeFunction = (state: AgentProcessingState) => string;

/**
 * Helper to create initial state for a note
 */
export function createInitialState(
    note: Note,
    strategy: ProcessingStrategy
): AgentProcessingState {
    return {
        note,
        strategy,
        metadata: {
            startTime: new Date(),
            invokedAgents: [],
            errors: [],
            checkpoints: [],
            resourceUsage: {
                cpuUsage: 0,
                memoryUsageMb: 0,
                llmCallCount: 0
            }
        }
    };
}

/**
 * Helper to add checkpoint to metadata
 */
export function addCheckpoint(
    metadata: ProcessingMetadata,
    nodeId: string,
    partialState: Partial<AgentProcessingState>
): ProcessingMetadata {
    return {
        ...metadata,
        checkpoints: [
            ...metadata.checkpoints,
            {
                nodeId,
                timestamp: new Date(),
                state: partialState
            }
        ]
    };
}

/**
 * Helper to add error to metadata
 */
export function addError(
    metadata: ProcessingMetadata,
    error: ProcessingError
): ProcessingMetadata {
    return {
        ...metadata,
        errors: [...metadata.errors, error]
    };
}

/**
 * Helper to mark agent as invoked in metadata
 */
export function markAgentInvoked(
    metadata: ProcessingMetadata,
    agentId: string
): ProcessingMetadata {
    return {
        ...metadata,
        invokedAgents: [...metadata.invokedAgents, agentId]
    };
}
