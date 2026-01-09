import { Note } from '../models/Note';
import { UtilityScore, ScoringFactor } from '../models/UtilityScore';
import { LLMService } from '../services/LLMService';
import { LLMRequest, LLMRequestType } from '../models/LLMModels';
import { ScoringAlgorithms, TFIDFResult, BehavioralResult, SemanticResult, RuleBasedResult } from './scoring/ScoringAlgorithms';
import { WorkerPool } from '../services/worker/WorkerPool';

/**
 * Configuration for utility scoring algorithms
 */
export interface UtilityScorerConfig {
  tfIdfWeight: number;
  behavioralWeight: number;
  semanticWeight: number;
  ruleBasedWeight: number;
  llmWeight: number;
  userPreferences: UserPreferences;
}

/**
 * User preferences for scoring adjustments
 */
export interface UserPreferences {
  contentTypeWeights: Map<string, number>;
  recencyImportance: number;
  accessFrequencyImportance: number;
  contentLengthPreference: number;
  checklistCompletionImportance: number;
}

/**
 * Utility Scorer Agent - Assigns utility scores to notes using multiple algorithms
 */
export class UtilityScorerAgent {
  private config: UtilityScorerConfig;
  private llmService: LLMService;
  private workerPool?: WorkerPool;

  // Local state for fallback mode
  private documentFrequencies: Map<string, number> = new Map();
  private totalDocuments: number = 0;

  constructor(llmService: LLMService, workerPool?: WorkerPool, config?: Partial<UtilityScorerConfig>) {
    this.llmService = llmService;
    this.workerPool = workerPool;
    this.config = {
      tfIdfWeight: 0.25,
      behavioralWeight: 0.25,
      semanticWeight: 0.25,
      ruleBasedWeight: 0.15,
      llmWeight: 0.10,
      userPreferences: {
        contentTypeWeights: new Map([
          ['meeting_notes', 1.2],
          ['idea', 1.1],
          ['task_list', 1.0],
          ['reference', 0.9],
          ['journal', 0.8],
          ['scratch_pad', 0.3],
          ['shopping_list', 0.2]
        ]),
        recencyImportance: 0.7,
        accessFrequencyImportance: 0.8,
        contentLengthPreference: 0.6,
        checklistCompletionImportance: 0.5
      },
      ...config
    };
  }

  /**
   * Initialize the utility scorer agent
   */
  async initialize(): Promise<void> {
    return Promise.resolve();
  }

  /**
   * Score a single note's utility
   */
  async scoreNote(note: Note): Promise<UtilityScore> {
    try {
      let tfIdfResult: TFIDFResult;
      let behavioralResult: BehavioralResult;
      let semanticResult: SemanticResult;
      let ruleBasedResult: RuleBasedResult;

      // Use Worker Pool if available
      if (this.workerPool) {
        try {
          const result = await this.workerPool.execute('utility-scoring', {
            note,
            preferences: this.config.userPreferences
          });

          tfIdfResult = result.tfIdf;
          behavioralResult = result.behavioral;
          semanticResult = result.semantic;
          ruleBasedResult = result.ruleBased;

        } catch (workerError) {
          console.warn('Worker scoring failed, falling back to local:', workerError);
          // Fallback to local
          tfIdfResult = ScoringAlgorithms.calculateTFIDFScore(note, this.documentFrequencies, this.totalDocuments);
          behavioralResult = ScoringAlgorithms.calculateBehavioralScore(note, this.config.userPreferences);
          semanticResult = ScoringAlgorithms.calculateSemanticScore(note);
          ruleBasedResult = ScoringAlgorithms.calculateRuleBasedScore(note, this.config.userPreferences);
        }
      } else {
        // Run locally using ScoringAlgorithms
        tfIdfResult = ScoringAlgorithms.calculateTFIDFScore(note, this.documentFrequencies, this.totalDocuments);
        behavioralResult = ScoringAlgorithms.calculateBehavioralScore(note, this.config.userPreferences);
        semanticResult = ScoringAlgorithms.calculateSemanticScore(note);
        ruleBasedResult = ScoringAlgorithms.calculateRuleBasedScore(note, this.config.userPreferences);
      }

      // Parallel: Get LLM assessment (main thread)
      const llmAssessment = await this.getLLMAssessment(note);

      // Combine scores using weighted hybrid model
      const hybridScore = this.calculateHybridScore(
        tfIdfResult,
        behavioralResult,
        semanticResult,
        ruleBasedResult,
        llmAssessment
      );

      // Generate explanation
      const explanation = this.generateExplanation(
        note,
        tfIdfResult,
        behavioralResult,
        semanticResult,
        ruleBasedResult,
        llmAssessment,
        hybridScore
      );

      // Create scoring factors
      const factors = this.createScoringFactors(
        tfIdfResult,
        behavioralResult,
        semanticResult,
        ruleBasedResult,
        llmAssessment
      );

      // Calculate confidence based on agreement between algorithms
      const confidence = this.calculateConfidence([
        tfIdfResult.score,
        behavioralResult.score,
        semanticResult.score,
        ruleBasedResult.score,
        llmAssessment.score
      ]);

      return {
        noteId: note.id,
        overallScore: Math.round(hybridScore),
        contentScore: Math.round(tfIdfResult.score),
        behavioralScore: Math.round(behavioralResult.score),
        semanticScore: Math.round(semanticResult.score),
        ruleBasedScore: Math.round(ruleBasedResult.score),
        explanation,
        confidence,
        factors,
        timestamp: new Date()
      };

    } catch (error) {
      console.error(`Error scoring note ${note.id}:`, error);
      // Return fallback score
      return {
        noteId: note.id,
        overallScore: 50,
        contentScore: 50,
        behavioralScore: 50,
        semanticScore: 50,
        ruleBasedScore: 50,
        explanation: 'Score calculated using fallback method due to processing error',
        confidence: 0.3,
        factors: [{ name: 'Fallback Scoring', weight: 1.0, value: 50, description: 'Default score applied due to processing error' }],
        timestamp: new Date()
      };
    }
  }

  /**
   * Initialize vocabulary for TF-IDF from a corpus of notes
   */
  async initializeVocabulary(notes: Note[]): Promise<void> {
    if (this.workerPool) {
      try {
        await this.workerPool.execute('scoring-init-vocab', { notes });
        this.totalDocuments = notes.length; // Local copy of count
      } catch (e) {
        console.warn('Worker vocab init failed, falling back local', e);
        this.initializeVocabularyLocal(notes);
      }
    } else {
      this.initializeVocabularyLocal(notes);
    }
  }

  private initializeVocabularyLocal(notes: Note[]): void {
    this.totalDocuments = notes.length;
    this.documentFrequencies.clear();

    for (const note of notes) {
      const text = `${note.title} ${note.content}`.toLowerCase();
      const words = new Set(ScoringAlgorithms.tokenize(text));

      for (const word of words) {
        this.documentFrequencies.set(word, (this.documentFrequencies.get(word) || 0) + 1);
      }
    }
  }

  /**
   * Get LLM assessment of content quality (optimized)
   */
  private async getLLMAssessment(note: Note): Promise<{ score: number; reasoning: string }> {
    try {
      // Use optimized LLM service if available
      if ((this.llmService as any).optimizationService) {
        const analysis = await (this.llmService as any).optimizationService.requestAnalysis(
          note,
          ['utility_scoring'],
          'normal'
        );

        if (analysis.utilityAssessment) {
          return {
            score: analysis.utilityAssessment.score,
            reasoning: analysis.utilityAssessment.reasoning
          };
        }
      }

      // Fallback to direct LLM request with reduced token usage
      const request: LLMRequest = {
        agentId: 'utility-scorer',
        requestType: LLMRequestType.CONTENT_ANALYSIS,
        context: 'Utility scoring for note organization',
        noteContent: note.content.substring(0, 800),
        systemPrompt: `Rate note utility 0-100 based on completeness, relevance, uniqueness, actionability.`,
        userPrompt: `Rate utility (0-100): "${note.title}" - "${note.content.substring(0, 300)}..."
                    
                    Format: SCORE: [number] REASON: [brief explanation]`,
        maxTokens: 100,
        temperature: 0.3
      };

      const response = await this.llmService.processRequest(request);

      const scoreMatch = response.response.match(/SCORE:\s*(\d+)/i);
      const reasoningMatch = response.response.match(/REASON:\s*(.+)/i);

      const score = scoreMatch ? Math.min(100, Math.max(0, parseInt(scoreMatch[1]))) : 50;
      const reasoning = reasoningMatch ? reasoningMatch[1].trim() : 'LLM assessment completed';

      return { score, reasoning };

    } catch (error) {
      console.warn('LLM assessment failed, using fallback:', error);
      return {
        score: 50,
        reasoning: 'Fallback assessment - LLM unavailable'
      };
    }
  }

  /**
   * Calculate hybrid score combining all algorithms
   */
  private calculateHybridScore(
    tfIdf: TFIDFResult,
    behavioral: BehavioralResult,
    semantic: SemanticResult,
    ruleBased: RuleBasedResult,
    llmAssessment: { score: number; reasoning: string }
  ): number {
    const weightedScore = (
      tfIdf.score * this.config.tfIdfWeight +
      behavioral.score * this.config.behavioralWeight +
      semantic.score * this.config.semanticWeight +
      ruleBased.score * this.config.ruleBasedWeight +
      llmAssessment.score * this.config.llmWeight
    );

    return Math.min(100, Math.max(0, weightedScore));
  }

  /**
   * Generate human-readable explanation for the score
   */
  private generateExplanation(
    note: Note,
    tfIdf: TFIDFResult,
    behavioral: BehavioralResult,
    semantic: SemanticResult,
    ruleBased: RuleBasedResult,
    llmAssessment: { score: number; reasoning: string },
    finalScore: number
  ): string {
    const scoreCategory = finalScore >= 80 ? 'high' : finalScore >= 60 ? 'medium' : 'low';

    let explanation = `This note received a ${scoreCategory} utility score of ${Math.round(finalScore)}/100. `;

    // Add key contributing factors
    const factors = [];

    if (behavioral.accessFrequency > 50) factors.push('frequently accessed');
    if (behavioral.recencyScore > 70) factors.push('recently modified');
    if (semantic.contentQuality > 70) factors.push('well-structured content');
    if (tfIdf.score > 60) factors.push('contains important keywords');

    if (factors.length > 0) {
      explanation += `Key strengths: ${factors.join(', ')}. `;
    }

    // Add LLM reasoning if available
    if (llmAssessment.reasoning && !llmAssessment.reasoning.includes('Fallback')) {
      explanation += llmAssessment.reasoning;
    } else if (llmAssessment.reasoning.includes('Fallback')) {
      explanation += 'AI assessment used fallback method due to service unavailability.';
    }

    return explanation;
  }

  /**
   * Create detailed scoring factors
   */
  private createScoringFactors(
    tfIdf: TFIDFResult,
    behavioral: BehavioralResult,
    semantic: SemanticResult,
    ruleBased: RuleBasedResult,
    llmAssessment: { score: number; reasoning: string }
  ): ScoringFactor[] {
    return [
      {
        name: 'Content Analysis (TF-IDF)',
        weight: this.config.tfIdfWeight,
        value: tfIdf.score,
        description: `Keyword importance and content relevance analysis`
      },
      {
        name: 'Usage Patterns',
        weight: this.config.behavioralWeight,
        value: behavioral.score,
        description: `Access frequency, recency, and sharing behavior`
      },
      {
        name: 'Content Quality',
        weight: this.config.semanticWeight,
        value: semantic.score,
        description: `Structure, completeness, and semantic value`
      },
      {
        name: 'Classification Rules',
        weight: this.config.ruleBasedWeight,
        value: ruleBased.score,
        description: `Age, length, checklist status, and completeness`
      },
      {
        name: 'AI Assessment',
        weight: this.config.llmWeight,
        value: llmAssessment.score,
        description: `LLM evaluation of content utility and relevance`
      }
    ];
  }

  /**
   * Calculate confidence based on algorithm agreement
   */
  private calculateConfidence(scores: number[]): number {
    const mean = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    const variance = scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / scores.length;
    const standardDeviation = Math.sqrt(variance);

    // Higher agreement (lower std dev) = higher confidence
    const confidence = Math.max(0.3, Math.min(1.0, 1 - (standardDeviation / 50)));

    return Math.round(confidence * 100) / 100;
  }

  /**
   * Update user preferences based on feedback
   */
  updateUserPreferences(preferences: Partial<UserPreferences>): void {
    this.config.userPreferences = {
      ...this.config.userPreferences,
      ...preferences
    };
  }

  /**
   * Update algorithm weights based on learning
   */
  updateAlgorithmWeights(weights: Partial<UtilityScorerConfig>): void {
    this.config = {
      ...this.config,
      ...weights
    };
  }
}