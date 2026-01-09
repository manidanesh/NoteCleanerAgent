/**
 * LangGraph Node Implementations
 * 
 * Node wrappers for existing agents that conform to LangGraph's
 * state update pattern. Each node processes the state and returns
 * partial updates to be merged.
 */

import { Note } from '../models/Note';
import { RecommendationAction } from '../models/Recommendation';
import { ContentExtractorAgent } from '../agents/ContentExtractorAgent';
import { UtilityScorerAgent } from '../agents/UtilityScorerAgent';
import { DuplicateDetectorAgent } from '../agents/DuplicateDetectorAgent';
import { OrganizationAgent } from '../agents/OrganizationAgent';
import { JunkNoteDetectorAgent } from '../agents/JunkNoteDetectorAgent';
import { LLMService } from '../services/LLMService';
import { ContentType, ErrorSeverity } from '../core/AgentDriverInterface';
import {
    AgentProcessingState,
    NodeResult,
    addCheckpoint,
    addError,
    markAgentInvoked
} from './state';

/**
 * Initialize LLM context from extracted content
 */
function initializeLLMContext(state: AgentProcessingState): NodeResult['llmContext'] {
    return {
        topics: [],
        entities: {
            people: [],
            dates: [],
            locations: [],
            other: []
        },
        contentType: ContentType.OTHER,
        importanceIndicators: [],
        cachedResponses: new Map()
    };
}

/**
 * Content Extraction Node
 * Extracts content from the note and initializes LLM context
 */
export function createExtractContentNode(
    contentExtractor: ContentExtractorAgent
): (state: AgentProcessingState) => Promise<NodeResult> {
    return async (state: AgentProcessingState): Promise<NodeResult> => {
        try {
            console.log('[LangGraph] Executing content extraction node');

            const content = await contentExtractor.extractContent(state.note);
            const llmContext = initializeLLMContext(state);

            return {
                extractedContent: content,
                llmContext,
                metadata: addCheckpoint(
                    markAgentInvoked(state.metadata, 'content-extractor'),
                    'extract',
                    { extractedContent: content }
                )
            };
        } catch (error) {
            console.error('[LangGraph] Content extraction failed:', error);

            return {
                metadata: addError(state.metadata, {
                    agentId: 'content-extractor',
                    message: `Extraction failed: ${error}`,
                    severity: ErrorSeverity.ERROR,
                    recoverable: true,
                    timestamp: new Date()
                })
            };
        }
    };
}

/**
 * Utility Scoring Node
 * Scores the note's utility based on extracted content
 */
export function createScoreUtilityNode(
    utilityScorer: UtilityScorerAgent
): (state: AgentProcessingState) => Promise<NodeResult> {
    return async (state: AgentProcessingState): Promise<NodeResult> => {
        if (!state.extractedContent) {
            return {
                metadata: addError(state.metadata, {
                    agentId: 'utility-scorer',
                    message: 'Cannot score without extracted content',
                    severity: ErrorSeverity.WARNING,
                    recoverable: true,
                    timestamp: new Date()
                })
            };
        }

        try {
            console.log('[LangGraph] Executing utility scoring node');

            const score = await utilityScorer.scoreNote(state.note);

            return {
                utilityScore: score,
                isHighValueNote: score.overallScore > 70,
                metadata: addCheckpoint(
                    markAgentInvoked(state.metadata, 'utility-scorer'),
                    'scoreUtility',
                    { utilityScore: score }
                )
            };
        } catch (error) {
            console.error('[LangGraph] Utility scoring failed:', error);

            return {
                metadata: addError(state.metadata, {
                    agentId: 'utility-scorer',
                    message: `Scoring failed: ${error}`,
                    severity: ErrorSeverity.ERROR,
                    recoverable: true,
                    timestamp: new Date()
                })
            };
        }
    };
}

/**
 * Junk Detection Node
 * Analyzes if the note is junk/temporary content
 */
export function createDetectJunkNode(
    junkDetector: JunkNoteDetectorAgent
): (state: AgentProcessingState) => Promise<NodeResult> {
    return async (state: AgentProcessingState): Promise<NodeResult> => {
        try {
            console.log('[LangGraph] Executing junk detection node');

            const result = await junkDetector.analyzeNote(state.note);

            return {
                junkDetectionResult: result,
                isJunkNote: result.isJunk,
                shouldSkipDuplicateDetection: result.isJunk, // Skip duplicates for junk
                metadata: addCheckpoint(
                    markAgentInvoked(state.metadata, 'junk-detector'),
                    'detectJunk',
                    { junkDetectionResult: result }
                )
            };
        } catch (error) {
            console.error('[LangGraph] Junk detection failed:', error);

            return {
                metadata: addError(state.metadata, {
                    agentId: 'junk-detector',
                    message: `Junk detection failed: ${error}`,
                    severity: ErrorSeverity.ERROR,
                    recoverable: true,
                    timestamp: new Date()
                })
            };
        }
    };
}

/**
 * Duplicate Detection Node
 * Finds duplicate or similar notes
 */
export function createDetectDuplicatesNode(
    duplicateDetector: DuplicateDetectorAgent
): (state: AgentProcessingState) => Promise<NodeResult> {
    return async (state: AgentProcessingState): Promise<NodeResult> => {
        // Skip if flagged to skip
        if (state.shouldSkipDuplicateDetection) {
            console.log('[LangGraph] Skipping duplicate detection (flagged to skip)');
            return {};
        }

        if (!state.extractedContent) {
            return {
                metadata: addError(state.metadata, {
                    agentId: 'duplicate-detector',
                    message: 'Cannot detect duplicates without extracted content',
                    severity: ErrorSeverity.WARNING,
                    recoverable: true,
                    timestamp: new Date()
                })
            };
        }

        try {
            console.log('[LangGraph] Executing duplicate detection node');

            // Note: This is a simplified version - actual implementation would need
            // access to all notes for comparison
            const duplicates: any[] = [];

            return {
                duplicateGroups: duplicates,
                metadata: addCheckpoint(
                    markAgentInvoked(state.metadata, 'duplicate-detector'),
                    'detectDuplicates',
                    { duplicateGroups: duplicates }
                )
            };
        } catch (error) {
            console.error('[LangGraph] Duplicate detection failed:', error);

            return {
                metadata: addError(state.metadata, {
                    agentId: 'duplicate-detector',
                    message: `Duplicate detection failed: ${error}`,
                    severity: ErrorSeverity.ERROR,
                    recoverable: true,
                    timestamp: new Date()
                })
            };
        }
    };
}

/**
 * Organization Node
 * Generates recommendations for organizing the note
 */
export function createOrganizeNode(
    organizationAgent: OrganizationAgent
): (state: AgentProcessingState) => Promise<NodeResult> {
    return async (state: AgentProcessingState): Promise<NodeResult> => {
        try {
            console.log('[LangGraph] Executing organization node');

            // Generate recommendations based on available data
            let recommendations;

            if (state.utilityScore) {
                recommendations = await organizationAgent.generateRecommendations(
                    state.note,
                    state.utilityScore
                );
            } else {
                // Fallback recommendations
                recommendations = [{
                    id: `review_${state.note.id}`,
                    noteId: state.note.id,
                    action: RecommendationAction.REVIEW,
                    confidence: 0.5,
                    reasoning: 'Manual review recommended - insufficient data for automated recommendation',
                    impact: 'medium' as any,
                    reversible: true,
                    timestamp: new Date(),
                    status: 'pending' as any
                }];
            }

            return {
                recommendations,
                metadata: addCheckpoint(
                    markAgentInvoked(state.metadata, 'organization-agent'),
                    'organize',
                    { recommendations }
                )
            };
        } catch (error) {
            console.error('[LangGraph] Organization failed:', error);

            return {
                metadata: addError(state.metadata, {
                    agentId: 'organization-agent',
                    message: `Organization failed: ${error}`,
                    severity: ErrorSeverity.ERROR,
                    recoverable: true,
                    timestamp: new Date()
                })
            };
        }
    };
}

/**
 * Generate Recommendations Node (for quick junk strategy)
 * Simplified recommendation generation based on junk detection
 */
export function createGenerateRecommendationsNode(): (state: AgentProcessingState) => Promise<NodeResult> {
    return async (state: AgentProcessingState): Promise<NodeResult> => {
        try {
            console.log('[LangGraph] Generating recommendations from junk detection');

            const recommendations = [];

            if (state.junkDetectionResult?.isJunk) {
                recommendations.push({
                    id: `junk_${state.note.id}`,
                    noteId: state.note.id,
                    action: RecommendationAction.DELETE,
                    confidence: state.junkDetectionResult.confidenceScore / 100,
                    reasoning: state.junkDetectionResult.reasoning,
                    impact: 'low' as any,
                    reversible: true,
                    timestamp: new Date(),
                    status: 'pending' as any
                });
            }

            return {
                recommendations,
                metadata: markAgentInvoked(state.metadata, 'recommendation-generator')
            };
        } catch (error) {
            console.error('[LangGraph] Recommendation generation failed:', error);

            return {
                metadata: addError(state.metadata, {
                    agentId: 'recommendation-generator',
                    message: `Recommendation generation failed: ${error}`,
                    severity: ErrorSeverity.ERROR,
                    recoverable: true,
                    timestamp: new Date()
                })
            };
        }
    };
}
