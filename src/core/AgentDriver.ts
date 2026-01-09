/**
 * Agent Driver - Intelligent orchestration system for specialized AI agents
 * 
 * Implements the Agent Driver approach with:
 * - Intelligent routing and conditional agent invocation
 * - Parallel processing of independent agents
 * - LLM context sharing and optimization
 * - Resource-aware throttling and adaptation
 * - Learning-based processing strategy selection
 * 
 * This enhances the existing AgentCoordinator with intelligent decision-making
 * while maintaining backward compatibility.
 */

import { Note } from '../models/Note';
import { Recommendation, RecommendationAction } from '../models/Recommendation';
import { UtilityScore } from '../models/UtilityScore';
import { DuplicateGroup } from '../models/DuplicateGroup';
import { ExtractedContent } from '../agents/ContentExtractorAgent';
import { JunkDetectionResult } from '../agents/JunkNoteDetectorAgent';
import { LLMService } from '../services/LLMService';
import { PerformanceOptimizer } from '../services/PerformanceOptimizer';
import { LLMOptimizationService } from '../services/LLMOptimizationService';

import {
    IAgent,
    IAgentDriver,
    AgentDriverResult,
    ProcessingContext,
    ProcessingStrategy,
    ProcessingStrategyConfig,
    ProcessingOptions,
    ProcessingPriority,
    ProcessingStatistics,
    LLMContext,
    ContentType,
    ProcessingError,
    ErrorSeverity,
    UserFeedback,
    AgentStatus,
    ResourceRequirements
} from './AgentDriverInterface';

/**
 * Agent Driver implementation
 * Implements Requirements 25.1, 25.2, 25.3, 25.4, 25.5 with intelligent routing
 */
export class AgentDriver implements IAgentDriver {
    private agents: Map<string, IAgent> = new Map();
    private llmService: LLMService;
    private performanceOptimizer: PerformanceOptimizer;
    private llmOptimizationService: LLMOptimizationService;

    // Learning data for strategy adaptation
    private feedbackHistory: UserFeedback[] = [];
    private strategyPerformance: Map<string, StrategyPerformanceMetrics> = new Map();

    // Processing statistics
    private globalStatistics: GlobalStatistics = {
        totalNotesProcessed: 0,
        totalProcessingTimeMs: 0,
        totalLLMCalls: 0,
        totalLLMCallsCached: 0,
        averageProcessingTimeMs: 0,
        strategyUsageCounts: new Map()
    };

    constructor(
        llmService: LLMService,
        performanceOptimizer: PerformanceOptimizer,
        llmOptimizationService: LLMOptimizationService
    ) {
        this.llmService = llmService;
        this.performanceOptimizer = performanceOptimizer;
        this.llmOptimizationService = llmOptimizationService;
    }

    /**
     * Register an agent with the driver
     * Implements Requirement 25.1: Agent capability registration
     */
    registerAgent(agent: IAgent): void {
        this.agents.set(agent.agentId, agent);
        console.log(`[AgentDriver] Registered agent: ${agent.name} (${agent.agentId})`);
    }

    /**
     * Get all registered agents
     */
    getRegisteredAgents(): IAgent[] {
        return Array.from(this.agents.values());
    }

    /**
     * Process a single note with intelligent agent coordination
     * Implements Requirements 25.2, 25.4: Agent communication and workflow sequencing
     */
    async processNote(note: Note, options?: ProcessingOptions): Promise<AgentDriverResult> {
        const startTime = Date.now();

        // Determine strategy first
        const strategyConfig = options?.forceStrategy || await this.determineStrategy(note, {} as ProcessingContext);

        // Initialize processing context
        const context: ProcessingContext = {
            sessionId: this.generateSessionId(),
            note,
            metadata: {
                startTime: new Date(),
                elapsedTimeMs: 0,
                invokedAgents: [],
                strategy: strategyConfig.name,
                interrupted: false,
                resourceUsage: {
                    cpuUsage: 0,
                    memoryUsageMb: 0,
                    llmCallCount: 0
                }
            },
            errors: []
        };

        try {
            // Execute processing strategy
            await this.executeStrategy(context, strategyConfig, options);

            // Generate final recommendations
            const recommendations = this.generateFinalRecommendations(context);

            // Calculate statistics
            const statistics = this.calculateStatistics(context);

            // Update global statistics
            this.updateGlobalStatistics(context, statistics);

            const processingTimeMs = Date.now() - startTime;

            return {
                context,
                success: context.errors.filter(e => e.severity === ErrorSeverity.CRITICAL).length === 0,
                processingTimeMs,
                recommendations,
                statistics
            };

        } catch (error) {
            // Handle critical failure
            context.errors.push({
                agentId: 'agent-driver',
                message: `Critical processing failure: ${error}`,
                severity: ErrorSeverity.CRITICAL,
                recoverable: false,
                timestamp: new Date()
            });

            const processingTimeMs = Date.now() - startTime;

            return {
                context,
                success: false,
                processingTimeMs,
                recommendations: [],
                statistics: this.calculateStatistics(context)
            };
        }
    }

    /**
     * Process multiple notes in batch with optimization
     * Implements Requirement 8.1, 8.2, 8.3: Batch processing and performance optimization
     */
    async processNotes(notes: Note[], options?: ProcessingOptions): Promise<AgentDriverResult[]> {
        const results: AgentDriverResult[] = [];

        // Check system resources
        if (!(await this.performanceOptimizer.canProcessBatch())) {
            throw new Error('Insufficient system resources for batch processing');
        }

        // Create optimized batches
        const batches = this.performanceOptimizer.createOptimizedBatches(notes);

        for (const batch of batches) {
            // Check for interruption
            if (this.performanceOptimizer.shouldInterruptProcessing()) {
                console.log('[AgentDriver] Processing interrupted by performance optimizer');
                break;
            }

            // Wait for resources if needed
            while (!(await this.performanceOptimizer.canProcessBatch())) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            // Process batch with parallelization where possible
            const batchResults = await this.processBatchIntelligently(batch, options);
            results.push(...batchResults);

            // Periodic memory cleanup
            if (results.length % 50 === 0) {
                this.performanceOptimizer.performMemoryCleanup();
            }
        }

        return results;
    }

    /**
     * Determine processing strategy for a note
     * This is the core intelligence of the Agent Driver
     */
    async determineStrategy(note: Note, context: ProcessingContext): Promise<ProcessingStrategyConfig> {
        // Quick analysis to determine note characteristics
        const noteCharacteristics = this.analyzeNoteCharacteristics(note);

        // Check if this is obviously junk (short-circuit processing)
        if (noteCharacteristics.isObviousJunk) {
            return {
                name: 'quick_junk',
                agentsToInvoke: ['content-extractor', 'junk-detector'],
                enableParallelProcessing: false,
                skipDuplicateDetection: true,
                skipJunkDetection: false,
                useEnhancedOrganization: false,
                confidenceThreshold: 0.7,
                reasoning: 'Note appears to be obvious junk - using quick detection strategy'
            };
        }

        // Check if this is high-value content (invest more resources)
        if (noteCharacteristics.isHighValue) {
            return {
                name: 'comprehensive',
                agentsToInvoke: ['content-extractor', 'utility-scorer', 'duplicate-detector', 'organization-agent'],
                enableParallelProcessing: true,
                skipDuplicateDetection: false,
                skipJunkDetection: true,
                useEnhancedOrganization: true,
                confidenceThreshold: 0.8,
                reasoning: 'High-value note detected - using comprehensive analysis strategy'
            };
        }

        // Check learning history for user preferences
        const learnedStrategy = await this.getLearnedStrategy(note);
        if (learnedStrategy) {
            return learnedStrategy;
        }

        // Default balanced strategy
        return {
            name: 'balanced',
            agentsToInvoke: ['content-extractor', 'utility-scorer', 'junk-detector', 'organization-agent'],
            enableParallelProcessing: true,
            skipDuplicateDetection: false,
            skipJunkDetection: false,
            useEnhancedOrganization: false,
            confidenceThreshold: 0.75,
            reasoning: 'Standard note - using balanced processing strategy'
        };
    }

    /**
     * Update processing strategy based on user feedback
     * Implements Requirement 7: Learning from user feedback
     */
    async updateStrategyFromFeedback(feedback: UserFeedback[]): Promise<void> {
        this.feedbackHistory.push(...feedback);

        // Analyze feedback patterns
        const patterns = this.analyzeFeedbackPatterns(feedback);

        // Update strategy performance metrics
        for (const fb of feedback) {
            // Find the strategy used for this recommendation
            const strategyName = this.findStrategyForRecommendation(fb.recommendationId);
            if (strategyName) {
                const metrics = this.strategyPerformance.get(strategyName) || {
                    totalUses: 0,
                    acceptedCount: 0,
                    rejectedCount: 0,
                    averageConfidence: 0,
                    successRate: 0
                };

                metrics.totalUses++;
                if (fb.accepted) {
                    metrics.acceptedCount++;
                } else {
                    metrics.rejectedCount++;
                }
                metrics.successRate = metrics.acceptedCount / metrics.totalUses;

                this.strategyPerformance.set(strategyName, metrics);
            }
        }

        console.log('[AgentDriver] Updated strategy performance from feedback:', {
            feedbackCount: feedback.length,
            patterns: patterns.length,
            strategiesUpdated: this.strategyPerformance.size
        });
    }

    /**
     * Execute processing strategy
     * Implements Requirements 25.2, 25.4: Agent coordination and workflow execution
     */
    private async executeStrategy(context: ProcessingContext, strategy: ProcessingStrategyConfig, options?: ProcessingOptions): Promise<void> {
        console.log(`[AgentDriver] Executing strategy: ${strategy.name}`, {
            agentsToInvoke: strategy.agentsToInvoke,
            parallelProcessing: strategy.enableParallelProcessing
        });

        // Stage 1: Always extract content first (required for all other agents)
        await this.invokeAgent('content-extractor', context);

        // Stage 2: Parallel or sequential processing based on strategy
        if (strategy.enableParallelProcessing) {
            await this.executeParallelProcessing(context, strategy);
        } else {
            await this.executeSequentialProcessing(context, strategy);
        }

        // Stage 3: Generate recommendations if we have utility score
        if (context.utilityScore && strategy.agentsToInvoke.includes('organization-agent')) {
            await this.invokeAgent('organization-agent', context);
        }
    }

    /**
     * Execute agents in parallel for independent operations
     */
    private async executeParallelProcessing(
        context: ProcessingContext,
        strategy: ProcessingStrategyConfig
    ): Promise<void> {
        const parallelTasks: Promise<void>[] = [];

        // Utility scoring and junk detection can run in parallel
        if (strategy.agentsToInvoke.includes('utility-scorer')) {
            parallelTasks.push(this.invokeAgent('utility-scorer', context));
        }

        if (!strategy.skipJunkDetection && strategy.agentsToInvoke.includes('junk-detector')) {
            parallelTasks.push(this.invokeAgent('junk-detector', context));
        }

        // Wait for parallel tasks to complete
        await Promise.allSettled(parallelTasks);

        // Duplicate detection runs after we have utility score (if needed)
        if (!strategy.skipDuplicateDetection && strategy.agentsToInvoke.includes('duplicate-detector')) {
            await this.invokeAgent('duplicate-detector', context);
        }
    }

    /**
     * Execute agents sequentially
     */
    private async executeSequentialProcessing(
        context: ProcessingContext,
        strategy: ProcessingStrategyConfig
    ): Promise<void> {
        for (const agentId of strategy.agentsToInvoke) {
            // Skip content-extractor as it's already executed
            if (agentId === 'content-extractor') continue;

            // Skip based on strategy flags
            if (agentId === 'duplicate-detector' && strategy.skipDuplicateDetection) continue;
            if (agentId === 'junk-detector' && strategy.skipJunkDetection) continue;

            await this.invokeAgent(agentId, context);
        }
    }

    /**
     * Invoke a specific agent with error handling
     * Implements Requirement 25.3: Fallback mechanisms for agent failures
     */
    private async invokeAgent(agentId: string, context: ProcessingContext): Promise<void> {
        const agent = this.agents.get(agentId);
        if (!agent) {
            context.errors.push({
                agentId,
                message: `Agent not found: ${agentId}`,
                severity: ErrorSeverity.ERROR,
                recoverable: true,
                timestamp: new Date()
            });
            return;
        }

        // Check agent health
        if (agent.status !== AgentStatus.ACTIVE) {
            context.errors.push({
                agentId,
                message: `Agent not active: ${agentId} (status: ${agent.status})`,
                severity: ErrorSeverity.WARNING,
                recoverable: true,
                timestamp: new Date()
            });
            return;
        }

        try {
            console.log(`[AgentDriver] Invoking agent: ${agentId}`);
            context.metadata.invokedAgents.push(agentId);

            // Invoke agent based on type
            await this.executeAgentOperation(agentId, context);

        } catch (error) {
            context.errors.push({
                agentId,
                message: `Agent execution failed: ${error}`,
                severity: ErrorSeverity.ERROR,
                recoverable: true,
                fallbackAction: 'skip',
                timestamp: new Date()
            });

            // Attempt fallback
            await this.executeFallback(agentId, context);
        }
    }

    /**
     * Execute agent-specific operation
     * This delegates to the actual agent implementations
     */
    private async executeAgentOperation(agentId: string, context: ProcessingContext): Promise<void> {
        // NOTE: This is a placeholder that will be connected to actual agent implementations
        // In the full implementation, this would call the actual agent methods

        switch (agentId) {
            case 'content-extractor':
                // context.extractedContent = await contentExtractor.extractContent(context.note);
                // Initialize LLM context from extraction
                context.llmContext = this.initializeLLMContext(context);
                break;

            case 'utility-scorer':
                // context.utilityScore = await utilityScorer.scoreNote(context.note, context.extractedContent);
                break;

            case 'duplicate-detector':
                // context.duplicateGroups = await duplicateDetector.detect(context.note, context.extractedContent);
                break;

            case 'junk-detector':
                // context.junkDetectionResult = await junkDetector.analyzeNote(context.note);
                break;

            case 'organization-agent':
                // context.recommendations = await organizationAgent.generateRecommendations(context.note, context.utilityScore);
                break;

            default:
                throw new Error(`Unknown agent: ${agentId}`);
        }
    }

    /**
     * Execute fallback for failed agent
     */
    private async executeFallback(agentId: string, context: ProcessingContext): Promise<void> {
        console.log(`[AgentDriver] Executing fallback for agent: ${agentId}`);

        switch (agentId) {
            case 'utility-scorer':
                // Simple fallback scoring
                context.utilityScore = {
                    noteId: context.note.id,
                    overallScore: 50,
                    contentScore: Math.min(100, context.note.content.length / 10),
                    behavioralScore: 50,
                    semanticScore: 50,
                    ruleBasedScore: 50,
                    explanation: 'Fallback scoring used due to agent failure',
                    confidence: 0.3,
                    factors: [],
                    timestamp: new Date()
                };
                break;

            case 'organization-agent':
                // Simple fallback recommendation
                context.recommendations = [{
                    id: `fallback_${context.note.id}`,
                    noteId: context.note.id,
                    action: RecommendationAction.REVIEW,
                    confidence: 0.3,
                    reasoning: 'Manual review recommended due to processing limitations',
                    impact: 'low' as any,
                    reversible: true,
                    timestamp: new Date(),
                    status: 'pending' as any
                }];
                break;

            default:
                // No fallback available - continue without this agent's results
                break;
        }
    }

    /**
     * Process batch intelligently with grouping and optimization
     */
    private async processBatchIntelligently(
        batch: Note[],
        options?: ProcessingOptions
    ): Promise<AgentDriverResult[]> {
        // Group notes by characteristics for optimized processing
        const groups = this.groupNotesByCharacteristics(batch);

        const results: AgentDriverResult[] = [];

        for (const [groupType, notes] of groups.entries()) {
            console.log(`[AgentDriver] Processing group: ${groupType} (${notes.length} notes)`);

            // Process notes in group with appropriate strategy
            const groupResults = await Promise.all(
                notes.map(note => this.processNote(note, options))
            );

            results.push(...groupResults);
        }

        return results;
    }

    /**
     * Analyze note characteristics for strategy selection
     */
    private analyzeNoteCharacteristics(note: Note): NoteCharacteristics {
        const wordCount = note.content.split(/\s+/).length;
        const hasGenericTitle = /^(note|untitled|\d{4}-\d{2}-\d{2})/i.test(note.title);
        const isVeryShort = wordCount < 10;
        const isVeryOld = (Date.now() - note.modifiedDate.getTime()) > (365 * 24 * 60 * 60 * 1000); // 1 year
        const hasAttachments = note.attachments.length > 0;
        const hasChecklists = note.checklists.length > 0;

        return {
            isObviousJunk: (hasGenericTitle && isVeryShort) || (isVeryShort && isVeryOld),
            isHighValue: hasAttachments || hasChecklists || wordCount > 500,
            wordCount,
            hasGenericTitle,
            isVeryShort,
            isVeryOld,
            hasAttachments,
            hasChecklists
        };
    }

    /**
     * Group notes by characteristics for batch optimization
     */
    private groupNotesByCharacteristics(notes: Note[]): Map<string, Note[]> {
        const groups = new Map<string, Note[]>();

        for (const note of notes) {
            const chars = this.analyzeNoteCharacteristics(note);

            let groupKey: string;
            if (chars.isObviousJunk) {
                groupKey = 'junk';
            } else if (chars.isHighValue) {
                groupKey = 'high-value';
            } else {
                groupKey = 'standard';
            }

            if (!groups.has(groupKey)) {
                groups.set(groupKey, []);
            }
            groups.get(groupKey)!.push(note);
        }

        return groups;
    }

    /**
     * Initialize LLM context from extracted content
     */
    private initializeLLMContext(context: ProcessingContext): LLMContext {
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
     * Generate final recommendations from processing context
     */
    private generateFinalRecommendations(context: ProcessingContext): Recommendation[] {
        // If we already have recommendations from organization agent, use those
        if (context.recommendations && context.recommendations.length > 0) {
            return context.recommendations;
        }

        // Otherwise, generate basic recommendations based on available data
        const recommendations: Recommendation[] = [];

        // Check junk detection result
        if (context.junkDetectionResult?.isJunk) {
            recommendations.push({
                id: `junk_${context.note.id}`,
                noteId: context.note.id,
                action: RecommendationAction.DELETE,
                confidence: context.junkDetectionResult.confidenceScore / 100, // Convert 0-100 to 0-1
                reasoning: context.junkDetectionResult.reasoning,
                impact: 'low' as any,
                reversible: true,
                timestamp: new Date(),
                status: 'pending' as any
            });
        }

        // Check utility score
        if (context.utilityScore) {
            if (context.utilityScore.overallScore < 30) {
                recommendations.push({
                    id: `low_utility_${context.note.id}`,
                    noteId: context.note.id,
                    action: RecommendationAction.ARCHIVE,
                    confidence: 0.7,
                    reasoning: `Low utility score: ${context.utilityScore.overallScore}/100`,
                    impact: 'medium' as any,
                    reversible: true,
                    timestamp: new Date(),
                    status: 'pending' as any
                });
            } else if (context.utilityScore.overallScore > 70) {
                recommendations.push({
                    id: `high_utility_${context.note.id}`,
                    noteId: context.note.id,
                    action: RecommendationAction.KEEP,
                    confidence: 0.8,
                    reasoning: `High utility score: ${context.utilityScore.overallScore}/100`,
                    impact: 'high' as any,
                    reversible: true,
                    timestamp: new Date(),
                    status: 'pending' as any
                });
            }
        }

        // Default: review
        if (recommendations.length === 0) {
            recommendations.push({
                id: `review_${context.note.id}`,
                noteId: context.note.id,
                action: RecommendationAction.REVIEW,
                confidence: 0.5,
                reasoning: 'Manual review recommended',
                impact: 'medium' as any,
                reversible: true,
                timestamp: new Date(),
                status: 'pending' as any
            });
        }

        return recommendations;
    }

    /**
     * Calculate processing statistics
     */
    private calculateStatistics(context: ProcessingContext): ProcessingStatistics {
        return {
            agentsInvoked: context.metadata.invokedAgents.length,
            agentsSkipped: this.agents.size - context.metadata.invokedAgents.length,
            llmCallsMade: context.metadata.resourceUsage.llmCallCount,
            llmCallsCached: context.llmContext?.cachedResponses.size || 0,
            totalCpuUsage: context.metadata.resourceUsage.cpuUsage,
            totalMemoryUsageMb: context.metadata.resourceUsage.memoryUsageMb,
            errorsEncountered: context.errors.length,
            fallbacksUsed: context.errors.filter(e => e.fallbackAction).length
        };
    }

    /**
     * Update global statistics
     */
    private updateGlobalStatistics(context: ProcessingContext, statistics: ProcessingStatistics): void {
        this.globalStatistics.totalNotesProcessed++;
        this.globalStatistics.totalProcessingTimeMs += context.metadata.elapsedTimeMs;
        this.globalStatistics.totalLLMCalls += statistics.llmCallsMade;
        this.globalStatistics.totalLLMCallsCached += statistics.llmCallsCached;
        this.globalStatistics.averageProcessingTimeMs =
            this.globalStatistics.totalProcessingTimeMs / this.globalStatistics.totalNotesProcessed;

        const strategyName = context.metadata.strategy;
        const currentCount = this.globalStatistics.strategyUsageCounts.get(strategyName) || 0;
        this.globalStatistics.strategyUsageCounts.set(strategyName, currentCount + 1);
    }

    /**
     * Analyze feedback patterns for learning
     */
    private analyzeFeedbackPatterns(feedback: UserFeedback[]): FeedbackPattern[] {
        const patterns: FeedbackPattern[] = [];

        // Analyze acceptance rate by action type
        const actionTypeAcceptance = new Map<RecommendationAction, { accepted: number; total: number }>();

        for (const fb of feedback) {
            // This would need to look up the recommendation to get the action type
            // For now, this is a placeholder
        }

        return patterns;
    }

    /**
     * Get learned strategy based on user preferences
     */
    private async getLearnedStrategy(note: Note): Promise<ProcessingStrategyConfig | null> {
        // Check if we have enough feedback history
        if (this.feedbackHistory.length < 10) {
            return null;
        }

        // Analyze user preferences from feedback
        // This is a placeholder for more sophisticated learning logic

        return null;
    }

    /**
     * Find strategy used for a specific recommendation
     */
    private findStrategyForRecommendation(recommendationId: string): string | null {
        // This would need to track recommendation -> strategy mapping
        // For now, return null
        return null;
    }

    /**
     * Generate unique session ID
     */
    private generateSessionId(): string {
        return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Get global statistics
     */
    getGlobalStatistics(): GlobalStatistics {
        return { ...this.globalStatistics };
    }

    /**
     * Get strategy performance metrics
     */
    getStrategyPerformance(): Map<string, StrategyPerformanceMetrics> {
        return new Map(this.strategyPerformance);
    }
}

/**
 * Note characteristics for strategy selection
 */
interface NoteCharacteristics {
    isObviousJunk: boolean;
    isHighValue: boolean;
    wordCount: number;
    hasGenericTitle: boolean;
    isVeryShort: boolean;
    isVeryOld: boolean;
    hasAttachments: boolean;
    hasChecklists: boolean;
}

/**
 * Strategy performance metrics
 */
interface StrategyPerformanceMetrics {
    totalUses: number;
    acceptedCount: number;
    rejectedCount: number;
    averageConfidence: number;
    successRate: number;
}

/**
 * Global statistics
 */
interface GlobalStatistics {
    totalNotesProcessed: number;
    totalProcessingTimeMs: number;
    totalLLMCalls: number;
    totalLLMCallsCached: number;
    averageProcessingTimeMs: number;
    strategyUsageCounts: Map<string, number>;
}

/**
 * Feedback pattern
 */
interface FeedbackPattern {
    pattern: string;
    confidence: number;
    recommendation: string;
}
