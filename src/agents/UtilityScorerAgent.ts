import { Note } from '../models/Note';
import { UtilityScore, ScoringFactor, ScoringAlgorithm } from '../models/UtilityScore';
import { LLMService } from '../services/LLMService';
import { LLMRequest, LLMRequestType, ContentAnalysis } from '../models/LLMModels';

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
 * TF-IDF analysis result
 */
interface TFIDFResult {
  score: number;
  keywordScores: Map<string, number>;
  importantTerms: string[];
}

/**
 * Behavioral analysis result
 */
interface BehavioralResult {
  score: number;
  accessFrequency: number;
  recencyScore: number;
  sharingScore: number;
}

/**
 * Semantic analysis result
 */
interface SemanticResult {
  score: number;
  contentQuality: number;
  relevanceScore: number;
  uniquenessScore: number;
}

/**
 * Rule-based classification result
 */
interface RuleBasedResult {
  score: number;
  ageScore: number;
  lengthScore: number;
  checklistScore: number;
  completenessScore: number;
}

/**
 * Utility Scorer Agent - Assigns utility scores to notes using multiple algorithms
 */
export class UtilityScorerAgent {
  private config: UtilityScorerConfig;
  private llmService: LLMService;
  private vocabularyCache: Map<string, number> = new Map();
  private documentFrequencies: Map<string, number> = new Map();
  private totalDocuments: number = 0;

  constructor(llmService: LLMService, config?: Partial<UtilityScorerConfig>) {
    this.llmService = llmService;
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
   * Score a single note's utility
   */
  async scoreNote(note: Note): Promise<UtilityScore> {
    const startTime = Date.now();
    
    try {
      // Run all scoring algorithms in parallel for efficiency
      const [tfIdfResult, behavioralResult, semanticResult, ruleBasedResult, llmAssessment] = 
        await Promise.all([
          this.calculateTFIDFScore(note),
          this.calculateBehavioralScore(note),
          this.calculateSemanticScore(note),
          this.calculateRuleBasedScore(note),
          this.getLLMAssessment(note)
        ]);

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
        overallScore: 50, // Neutral score
        contentScore: 50,
        behavioralScore: 50,
        semanticScore: 50,
        ruleBasedScore: 50,
        explanation: 'Score calculated using fallback method due to processing error',
        confidence: 0.3,
        factors: [{
          name: 'Fallback Scoring',
          weight: 1.0,
          value: 50,
          description: 'Default score applied due to processing error'
        }],
        timestamp: new Date()
      };
    }
  }

  /**
   * Calculate TF-IDF score with keyword importance weighting
   */
  private async calculateTFIDFScore(note: Note): Promise<TFIDFResult> {
    const text = `${note.title} ${note.content}`.toLowerCase();
    const words = this.tokenize(text);
    
    if (words.length === 0) {
      return {
        score: 20, // Low score for empty content
        keywordScores: new Map(),
        importantTerms: []
      };
    }
    
    const wordCounts = this.countWords(words);
    
    // Calculate TF-IDF scores for each term
    const keywordScores = new Map<string, number>();
    let totalScore = 0;
    
    // Use default values if vocabulary not initialized
    const totalDocs = this.totalDocuments || 1000; // Default corpus size
    
    for (const [word, count] of wordCounts) {
      const tf = count / words.length;
      const df = this.documentFrequencies.get(word) || Math.max(1, totalDocs * 0.1); // Default frequency
      const idf = Math.log(totalDocs / df);
      const tfidf = tf * idf;
      
      // Apply keyword importance weighting
      const importance = this.getKeywordImportance(word);
      const weightedScore = tfidf * importance;
      
      keywordScores.set(word, weightedScore);
      totalScore += weightedScore;
    }
    
    // Normalize score to 0-100 range with better scaling
    const normalizedScore = Math.min(100, Math.max(0, totalScore * 20));
    
    // Get top important terms
    const importantTerms = Array.from(keywordScores.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word]) => word);
    
    return {
      score: normalizedScore,
      keywordScores,
      importantTerms
    };
  }

  /**
   * Calculate behavioral score based on access patterns
   */
  private calculateBehavioralScore(note: Note): BehavioralResult {
    const now = new Date();
    const daysSinceCreated = (now.getTime() - note.createdDate.getTime()) / (1000 * 60 * 60 * 24);
    const daysSinceModified = (now.getTime() - note.modifiedDate.getTime()) / (1000 * 60 * 60 * 24);
    const daysSinceAccessed = note.metadata.lastAccessDate 
      ? (now.getTime() - note.metadata.lastAccessDate.getTime()) / (1000 * 60 * 60 * 24)
      : daysSinceCreated;

    // Access frequency score (0-100)
    const accessFrequency = Math.min(100, (note.metadata.accessCount / Math.max(1, daysSinceCreated)) * 10);
    
    // Recency score - more recent = higher score
    const recencyScore = Math.max(0, 100 - (daysSinceModified * 2));
    
    // Sharing score
    const sharingScore = note.metadata.isShared ? 
      Math.min(100, note.metadata.shareCount * 20) : 0;
    
    // Combine behavioral factors
    const behavioralScore = (
      accessFrequency * this.config.userPreferences.accessFrequencyImportance +
      recencyScore * this.config.userPreferences.recencyImportance +
      sharingScore * 0.3
    ) / (this.config.userPreferences.accessFrequencyImportance + 
         this.config.userPreferences.recencyImportance + 0.3);
    
    return {
      score: Math.min(100, behavioralScore),
      accessFrequency,
      recencyScore,
      sharingScore
    };
  }

  /**
   * Calculate semantic score using content analysis
   */
  private async calculateSemanticScore(note: Note): Promise<SemanticResult> {
    // Content quality based on structure and completeness
    const contentQuality = this.assessContentQuality(note);
    
    // Relevance based on content type and user preferences
    const relevanceScore = this.assessRelevance(note);
    
    // Uniqueness - penalize very short or generic content
    const uniquenessScore = this.assessUniqueness(note);
    
    // Combine semantic factors
    const semanticScore = (contentQuality + relevanceScore + uniquenessScore) / 3;
    
    return {
      score: semanticScore,
      contentQuality,
      relevanceScore,
      uniquenessScore
    };
  }

  /**
   * Calculate rule-based classification score
   */
  private calculateRuleBasedScore(note: Note): RuleBasedResult {
    const now = new Date();
    const daysSinceCreated = (now.getTime() - note.createdDate.getTime()) / (1000 * 60 * 60 * 24);
    const daysSinceModified = (now.getTime() - note.modifiedDate.getTime()) / (1000 * 60 * 60 * 24);

    // Age-based scoring - newer notes generally more valuable
    // Clamp daysSinceModified to prevent future dates from causing issues
    const clampedDaysSinceModified = Math.max(0, daysSinceModified);
    const ageScore = Math.max(0, 100 - (clampedDaysSinceModified * 1.5));
    
    // Content length scoring
    const wordCount = note.metadata.wordCount;
    const lengthScore = this.scoreLengthPreference(wordCount);
    
    // Checklist completion scoring
    const checklistScore = this.scoreChecklistCompletion(note.checklists);
    
    // Completeness scoring based on title and content quality
    const completenessScore = this.scoreCompleteness(note);
    
    // Combine rule-based factors
    const ruleBasedScore = (ageScore + lengthScore + checklistScore + completenessScore) / 4;
    
    return {
      score: ruleBasedScore,
      ageScore,
      lengthScore,
      checklistScore,
      completenessScore
    };
  }

  /**
   * Get LLM assessment of content quality
   */
  private async getLLMAssessment(note: Note): Promise<{ score: number; reasoning: string }> {
    try {
      const request: LLMRequest = {
        agentId: 'utility-scorer',
        requestType: LLMRequestType.CONTENT_ANALYSIS,
        context: 'Utility scoring for note organization',
        noteContent: note.content.substring(0, 1000), // Limit content for LLM
        systemPrompt: `You are an AI assistant helping to assess the utility and value of notes. 
                      Rate the utility of note content on a scale of 0-100 based on:
                      - Information completeness and clarity
                      - Current relevance and future value  
                      - Uniqueness vs redundancy
                      - Actionability of content`,
        userPrompt: `Rate this note's utility (0-100) and provide brief reasoning:
                    Title: "${note.title}"
                    Content: "${note.content.substring(0, 500)}..."
                    
                    Respond with: SCORE: [number] REASONING: [brief explanation]`,
        maxTokens: 150,
        temperature: 0.3
      };

      const response = await this.llmService.processRequest(request);
      
      // Parse LLM response
      const scoreMatch = response.response.match(/SCORE:\s*(\d+)/i);
      const reasoningMatch = response.response.match(/REASONING:\s*(.+)/i);
      
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
    
    if (behavioral.accessFrequency > 50) {
      factors.push('frequently accessed');
    }
    
    if (behavioral.recencyScore > 70) {
      factors.push('recently modified');
    }
    
    if (semantic.contentQuality > 70) {
      factors.push('well-structured content');
    }
    
    if (tfIdf.score > 60) {
      factors.push('contains important keywords');
    }
    
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

  // Helper methods for scoring calculations

  private tokenize(text: string): string[] {
    return text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2);
  }

  private countWords(words: string[]): Map<string, number> {
    const counts = new Map<string, number>();
    for (const word of words) {
      counts.set(word, (counts.get(word) || 0) + 1);
    }
    return counts;
  }

  private getKeywordImportance(word: string): number {
    // Simple keyword importance based on common patterns
    const importantPatterns = [
      /^(meeting|project|task|todo|important|urgent|deadline)/,
      /^(idea|concept|strategy|plan|goal)/,
      /^(contact|phone|email|address)/,
      /^(date|time|schedule|appointment)/
    ];
    
    for (const pattern of importantPatterns) {
      if (pattern.test(word)) {
        return 1.5;
      }
    }
    
    return 1.0;
  }

  private assessContentQuality(note: Note): number {
    let score = 50; // Base score
    
    // Title quality
    if (note.title && note.title.length > 5 && !note.title.match(/^(note|untitled|new)/i)) {
      score += 15;
    }
    
    // Content structure
    if (note.content.includes('\n')) score += 10; // Has paragraphs
    if (note.checklists.length > 0) score += 10; // Has checklists
    if (note.attachments.length > 0) score += 10; // Has attachments
    
    // Content depth
    if (note.metadata.wordCount > 50) score += 10;
    if (note.metadata.wordCount > 200) score += 5;
    
    return Math.min(100, score);
  }

  private assessRelevance(note: Note): number {
    // This would typically use content analysis to determine note type
    // For now, use simple heuristics
    let score = 60; // Base relevance
    
    // Check for time-sensitive content
    const hasDateReferences = /\b(today|tomorrow|yesterday|next week|deadline)\b/i.test(note.content);
    if (hasDateReferences) score += 20;
    
    // Check for action items
    const hasActionItems = /\b(todo|task|action|follow up|remember)\b/i.test(note.content);
    if (hasActionItems) score += 15;
    
    return Math.min(100, score);
  }

  private assessUniqueness(note: Note): number {
    let score = 70; // Base uniqueness
    
    // Penalize very short content
    if (note.metadata.wordCount < 10) score -= 30;
    else if (note.metadata.wordCount < 25) score -= 15;
    
    // Penalize generic titles
    if (note.title.match(/^(note|untitled|new|test)/i)) score -= 20;
    
    return Math.max(0, score);
  }

  private scoreLengthPreference(wordCount: number): number {
    const preference = this.config.userPreferences.contentLengthPreference;
    
    // Optimal range is 25-200 words
    if (wordCount >= 25 && wordCount <= 200) {
      return 100 * preference + (1 - preference) * 70;
    } else if (wordCount < 25) {
      return Math.max(20, (wordCount / 25) * 70);
    } else {
      // Diminishing returns for very long notes
      return Math.max(50, 100 - ((wordCount - 200) / 50));
    }
  }

  private scoreChecklistCompletion(checklists: any[]): number {
    if (checklists.length === 0) return 70; // Neutral score for no checklists
    
    const totalItems = checklists.length;
    const completedItems = checklists.filter(item => item.completed).length;
    const completionRate = completedItems / totalItems;
    
    // Partially completed checklists are more valuable than empty or fully completed
    if (completionRate === 0) return 80; // New checklist
    if (completionRate === 1) return 60; // Fully completed (less urgent)
    return 90; // Partially completed (active work)
  }

  private scoreCompleteness(note: Note): number {
    let score = 50;
    
    // Has meaningful title
    if (note.title && note.title.length > 5) score += 20;
    
    // Has substantial content
    if (note.metadata.wordCount > 20) score += 20;
    
    // Has structure (paragraphs, lists, etc.)
    if (note.content.includes('\n') || note.checklists.length > 0) score += 10;
    
    return Math.min(100, score);
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

  /**
   * Initialize vocabulary for TF-IDF from a corpus of notes
   */
  initializeVocabulary(notes: Note[]): void {
    this.totalDocuments = notes.length;
    this.documentFrequencies.clear();
    
    for (const note of notes) {
      const text = `${note.title} ${note.content}`.toLowerCase();
      const words = new Set(this.tokenize(text));
      
      for (const word of words) {
        this.documentFrequencies.set(word, (this.documentFrequencies.get(word) || 0) + 1);
      }
    }
  }
}