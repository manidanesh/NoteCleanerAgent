/**
 * LangGraph Workflow Graphs
 * 
 * Defines the three main processing workflows:
 * 1. Quick Junk Detection - Fast junk identification
 * 2. Comprehensive Analysis - Full analysis with parallel execution
 * 3. Balanced Processing - Standard workflow with conditional routing
 */

import { StateGraph, END, START } from "@langchain/langgraph";
import { MemorySaver } from "@langchain/langgraph";
import { ContentExtractorAgent } from '../agents/ContentExtractorAgent';
import { UtilityScorerAgent } from '../agents/UtilityScorerAgent';
import { DuplicateDetectorAgent } from '../agents/DuplicateDetectorAgent';
import { OrganizationAgent } from '../agents/OrganizationAgent';
import { JunkNoteDetectorAgent } from '../agents/JunkNoteDetectorAgent';
import { LLMService } from '../services/LLMService';
import { AgentProcessingState } from './state';
import {
    createExtractContentNode,
    createScoreUtilityNode,
    createDetectJunkNode,
    createDetectDuplicatesNode,
    createOrganizeNode,
    createGenerateRecommendationsNode
} from './nodes';

/**
 * Quick Junk Detection Workflow
 * Fast path for obvious junk notes
 * 
 * Flow: extract → detectJunk → [if junk] → generateRecommendations → END
 */
export function createQuickJunkWorkflow(
    contentExtractor: ContentExtractorAgent,
    junkDetector: JunkNoteDetectorAgent
) {
    // Create a simple workflow that processes sequentially
    return {
        async invoke(initialState: AgentProcessingState, options?: any): Promise<AgentProcessingState> {
            console.log('[QuickJunk] Starting workflow');
            let state = { ...initialState };

            // Step 1: Extract content
            const extractNode = createExtractContentNode(contentExtractor);
            const extractResult = await extractNode(state);
            state = { ...state, ...extractResult };

            // Step 2: Detect junk
            const junkNode = createDetectJunkNode(junkDetector);
            const junkResult = await junkNode(state);
            state = { ...state, ...junkResult };

            // Step 3: Generate recommendations if junk
            if (state.junkDetectionResult?.isJunk) {
                const recommendationNode = createGenerateRecommendationsNode();
                const recommendationResult = await recommendationNode(state);
                state = { ...state, ...recommendationResult };
            }

            console.log('[QuickJunk] Workflow complete');
            return state;
        }
    };
}

/**
 * Comprehensive Analysis Workflow
 * Full analysis with parallel execution for high-value notes
 * 
 * Flow: extract → [parallel: scoreUtility, detectDuplicates] → organize → END
 */
export function createComprehensiveWorkflow(
    contentExtractor: ContentExtractorAgent,
    utilityScorer: UtilityScorerAgent,
    duplicateDetector: DuplicateDetectorAgent,
    organizationAgent: OrganizationAgent
) {
    return {
        async invoke(initialState: AgentProcessingState, options?: any): Promise<AgentProcessingState> {
            console.log('[Comprehensive] Starting workflow');
            let state = { ...initialState };

            // Step 1: Extract content
            const extractNode = createExtractContentNode(contentExtractor);
            const extractResult = await extractNode(state);
            state = { ...state, ...extractResult };

            // Step 2: Parallel processing
            const utilityNode = createScoreUtilityNode(utilityScorer);
            const duplicateNode = createDetectDuplicatesNode(duplicateDetector);

            const [utilityResult, duplicateResult] = await Promise.allSettled([
                utilityNode(state),
                duplicateNode(state)
            ]);

            if (utilityResult.status === 'fulfilled') {
                state = { ...state, ...utilityResult.value };
            }
            if (duplicateResult.status === 'fulfilled') {
                state = { ...state, ...duplicateResult.value };
            }

            // Step 3: Organization
            const organizeNode = createOrganizeNode(organizationAgent);
            const organizeResult = await organizeNode(state);
            state = { ...state, ...organizeResult };

            console.log('[Comprehensive] Workflow complete');
            return state;
        }
    };
}

/**
 * Balanced Processing Workflow
 * Standard workflow with conditional routing
 * 
 * Flow: extract → [parallel: scoreUtility, detectJunk] → 
 *       [if not junk] → detectDuplicates → organize → END
 */
export function createBalancedWorkflow(
    contentExtractor: ContentExtractorAgent,
    utilityScorer: UtilityScorerAgent,
    junkDetector: JunkNoteDetectorAgent,
    duplicateDetector: DuplicateDetectorAgent,
    organizationAgent: OrganizationAgent
) {
    return {
        async invoke(initialState: AgentProcessingState, options?: any): Promise<AgentProcessingState> {
            console.log('[Balanced] Starting workflow');
            let state = { ...initialState };

            // Step 1: Extract content
            const extractNode = createExtractContentNode(contentExtractor);
            const extractResult = await extractNode(state);
            state = { ...state, ...extractResult };

            // Step 2: Parallel processing
            const utilityNode = createScoreUtilityNode(utilityScorer);
            const junkNode = createDetectJunkNode(junkDetector);

            const [utilityResult, junkResult] = await Promise.allSettled([
                utilityNode(state),
                junkNode(state)
            ]);

            if (utilityResult.status === 'fulfilled') {
                state = { ...state, ...utilityResult.value };
            }
            if (junkResult.status === 'fulfilled') {
                state = { ...state, ...junkResult.value };
            }

            // Step 3: Conditional duplicate detection
            if (!state.junkDetectionResult?.isJunk) {
                const duplicateNode = createDetectDuplicatesNode(duplicateDetector);
                const duplicateResult = await duplicateNode(state);
                state = { ...state, ...duplicateResult };
            }

            // Step 4: Organization
            const organizeNode = createOrganizeNode(organizationAgent);
            const organizeResult = await organizeNode(state);
            state = { ...state, ...organizeResult };

            console.log('[Balanced] Workflow complete');
            return state;
        }
    };
}

/**
 * Compile a workflow with checkpointing support
 */
export function compileWorkflow(workflow: any) {
    return workflow; // For now, return as-is since we're using simple implementations
}

/**
 * Create all workflows with the provided agents
 */
export function createAllWorkflows(
    contentExtractor: ContentExtractorAgent,
    utilityScorer: UtilityScorerAgent,
    junkDetector: JunkNoteDetectorAgent,
    duplicateDetector: DuplicateDetectorAgent,
    organizationAgent: OrganizationAgent
) {
    return {
        quickJunk: compileWorkflow(
            createQuickJunkWorkflow(contentExtractor, junkDetector)
        ),
        comprehensive: compileWorkflow(
            createComprehensiveWorkflow(
                contentExtractor,
                utilityScorer,
                duplicateDetector,
                organizationAgent
            )
        ),
        balanced: compileWorkflow(
            createBalancedWorkflow(
                contentExtractor,
                utilityScorer,
                junkDetector,
                duplicateDetector,
                organizationAgent
            )
        )
    };
}
