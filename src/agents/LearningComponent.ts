import { UserFeedback } from '../models';
import { Recommendation } from '../models/Recommendation';
import { Note } from '../models/Note';
import { UtilityScore } from '../models/UtilityScore';
import { LLMRequest, LLMRequestType } from '../models/LLMModels';
import { LLMService } from '../services/LLMService';
import { DeviceSynchronizationService } from '../services/DeviceSynchronizationService';
import { SecurityService } from '../services/SecurityService';

/**
 * Learning Component for adaptive recommendation improvement
 * Implements privacy-preserving learning from user feedback
 */
export class LearningComponent {
  private feedbackHistory: UserFeedback[] = [];
  private userPreferences: Map<string, any> = new Map();
  private learningEnabled: boolean = true;
  private algorithmWeights: Map<string, number> = new Map();
  private confidenceThresholds: Map<string, number> = new Map();
  private llmService?: LLMService;
  private syncService?: DeviceSynchronizationService;
  private securityService?: SecurityService;

  constructor(
    llmService?: LLMService,
    syncService?: DeviceSynchronizationService,
    securityService?: SecurityService
  ) {
    this.feedbackHistory = [];
    this.userPreferences = new Map();
    this.algorithmWeights = new Map();
    this.confidenceThresholds = new Map();
    this.llmService = llmService;
    this.syncService = syncService;
    this.securityService = securityService;
    
    // Initialize default algorithm weights
    this.initializeDefaultWeights();
  }

  /**
   * Initialize the learning component
   */
  async initialize(): Promise<void> {
    // Initialize any required services or configurations
    return Promise.resolve();
  }

  /**
   * Records user feedback with context for learning purposes
   * Implements Requirements 7.1: Feedback recording with context
   */
  recordFeedback(
    recommendationId: string, 
    action: 'approved' | 'rejected', 
    context?: {
      recommendation?: Recommendation;
      note?: Note;
      utilityScore?: UtilityScore;
      userReason?: string;
      sessionId?: string;
    }
  ): UserFeedback {
    if (!recommendationId || !action) {
      throw new Error('Recommendation ID and action are required for feedback recording');
    }

    if (action !== 'approved' && action !== 'rejected') {
      throw new Error('Action must be either "approved" or "rejected"');
    }

    const feedback: UserFeedback = {
      recommendationId,
      action,
      timestamp: new Date(),
      context: context ? JSON.stringify(context) : undefined
    };

    // Store feedback in history
    this.feedbackHistory.push(feedback);

    // Update learning patterns if enabled
    if (this.learningEnabled && context) {
      this.updateLearningPatterns(feedback, context);
    }

    return feedback;
  }

  /**
   * Retrieves all recorded feedback
   */
  getFeedbackHistory(): UserFeedback[] {
    return [...this.feedbackHistory];
  }

  /**
   * Retrieves feedback for a specific recommendation
   */
  getFeedbackForRecommendation(recommendationId: string): UserFeedback | undefined {
    return this.feedbackHistory.find(f => f.recommendationId === recommendationId);
  }

  /**
   * Clears all feedback history (for privacy/reset purposes)
   */
  clearFeedbackHistory(): void {
    this.feedbackHistory = [];
    this.userPreferences.clear();
  }

  /**
   * Gets the total count of feedback entries
   */
  getFeedbackCount(): number {
    return this.feedbackHistory.length;
  }

  /**
   * Gets feedback statistics
   */
  getFeedbackStats(): {
    total: number;
    approved: number;
    rejected: number;
    approvalRate: number;
  } {
    const total = this.feedbackHistory.length;
    const approved = this.feedbackHistory.filter(f => f.action === 'approved').length;
    const rejected = this.feedbackHistory.filter(f => f.action === 'rejected').length;
    const approvalRate = total > 0 ? approved / total : 0;

    return { total, approved, rejected, approvalRate };
  }

  /**
   * Enables or disables learning from feedback
   */
  setLearningEnabled(enabled: boolean): void {
    this.learningEnabled = enabled;
  }

  /**
   * Checks if learning is enabled
   */
  isLearningEnabled(): boolean {
    return this.learningEnabled;
  }

  /**
   * Private method to update learning patterns based on feedback
   */
  private updateLearningPatterns(
    feedback: UserFeedback, 
    context: {
      recommendation?: Recommendation;
      note?: Note;
      utilityScore?: UtilityScore;
      userReason?: string;
      sessionId?: string;
    }
  ): void {
    // Extract patterns from feedback context
    if (context.recommendation) {
      const recType = context.recommendation.action;
      const confidence = context.recommendation.confidence;
      
      // Track preference patterns by recommendation type
      const typeKey = `recommendation_type_${recType}`;
      const currentPreference = this.userPreferences.get(typeKey) || { approved: 0, rejected: 0 };
      
      if (feedback.action === 'approved') {
        currentPreference.approved++;
      } else {
        currentPreference.rejected++;
      }
      
      this.userPreferences.set(typeKey, currentPreference);

      // Track confidence threshold preferences
      const confidenceKey = 'confidence_threshold';
      const confidencePrefs = this.userPreferences.get(confidenceKey) || [];
      confidencePrefs.push({
        confidence,
        action: feedback.action,
        timestamp: feedback.timestamp
      });
      this.userPreferences.set(confidenceKey, confidencePrefs);
    }

    if (context.utilityScore) {
      // Track utility score preferences
      const scoreKey = 'utility_score_preferences';
      const scorePrefs = this.userPreferences.get(scoreKey) || [];
      scorePrefs.push({
        overallScore: context.utilityScore.overallScore,
        action: feedback.action,
        timestamp: feedback.timestamp
      });
      this.userPreferences.set(scoreKey, scorePrefs);
    }
  }

  /**
   * Gets learned user preferences
   */
  getUserPreferences(): Map<string, any> {
    return new Map(this.userPreferences);
  }

  /**
   * Initialize default algorithm weights
   */
  private initializeDefaultWeights(): void {
    // Default weights for utility scoring algorithms
    this.algorithmWeights.set('content_analysis', 0.3);
    this.algorithmWeights.set('behavioral_patterns', 0.25);
    this.algorithmWeights.set('semantic_analysis', 0.25);
    this.algorithmWeights.set('rule_based', 0.2);

    // Default confidence thresholds for recommendations
    this.confidenceThresholds.set('delete', 0.8);
    this.confidenceThresholds.set('archive', 0.7);
    this.confidenceThresholds.set('merge', 0.75);
    this.confidenceThresholds.set('rename', 0.6);
    this.confidenceThresholds.set('organize', 0.65);
  }

  /**
   * Analyzes user feedback patterns using LLM
   * Implements Requirements 7.2: Pattern recognition in user preferences
   */
  async analyzeUserPatterns(): Promise<{
    patterns: string[];
    recommendations: string[];
    confidence: number;
  }> {
    if (!this.llmService || this.feedbackHistory.length < 5) {
      return {
        patterns: [],
        recommendations: [],
        confidence: 0
      };
    }

    try {
      // Prepare feedback data for LLM analysis (privacy-preserving)
      const anonymizedFeedback = this.anonymizeFeedbackForAnalysis();
      
      const prompt = `Analyze user feedback patterns and identify preferences:
        
        Feedback Data: ${JSON.stringify(anonymizedFeedback)}
        
        Identify:
        1. User preference patterns
        2. Recommendation accuracy issues
        3. Suggested algorithm adjustments
        
        Provide analysis in JSON format with patterns, recommendations, and confidence score.`;

      const request: LLMRequest = {
        agentId: 'learning-component',
        requestType: LLMRequestType.CONTENT_ANALYSIS,
        context: 'user-feedback-analysis',
        noteContent: '',
        systemPrompt: 'You are an AI assistant analyzing user feedback patterns.',
        userPrompt: prompt,
        maxTokens: 500,
        temperature: 0.3
      };

      const response = await this.llmService.processRequest(request);
      return JSON.parse(response.response);
    } catch (error) {
      console.error('Error analyzing user patterns:', error);
      return {
        patterns: [],
        recommendations: [],
        confidence: 0
      };
    }
  }

  /**
   * Adapts algorithm weights based on learned patterns
   * Implements Requirements 7.3: Algorithm modification based on patterns
   */
  async adaptAlgorithms(): Promise<void> {
    if (this.feedbackHistory.length < 10) {
      return; // Need sufficient feedback for adaptation
    }

    try {
      const patterns = await this.analyzeUserPatterns();
      
      if (patterns.confidence > 0.7) {
        // Adjust algorithm weights based on patterns
        this.adjustAlgorithmWeights(patterns);
        
        // Update confidence thresholds
        this.adjustConfidenceThresholds();
        
        // Sync changes to other devices if available
        if (this.syncService) {
          await this.syncPreferencesToDevices();
        }
      }
    } catch (error) {
      console.error('Error adapting algorithms:', error);
    }
  }

  /**
   * Adjusts algorithm weights based on user feedback patterns
   */
  private adjustAlgorithmWeights(patterns: { patterns: string[]; recommendations: string[] }): void {
    const stats = this.getFeedbackStats();
    
    // If approval rate is low, adjust weights
    if (stats.approvalRate < 0.6) {
      // Reduce weights for algorithms that generate rejected recommendations
      const rejectedFeedback = this.feedbackHistory.filter(f => f.action === 'rejected');
      
      rejectedFeedback.forEach(feedback => {
        if (feedback.context) {
          try {
            const context = JSON.parse(feedback.context);
            if (context.recommendation?.action === 'delete') {
              // Increase threshold for delete recommendations
              const currentWeight = this.algorithmWeights.get('rule_based') || 0.2;
              this.algorithmWeights.set('rule_based', Math.max(0.1, currentWeight - 0.05));
            }
          } catch (error) {
            // Ignore parsing errors
          }
        }
      });
    }

    // If approval rate is high, we can be more aggressive
    if (stats.approvalRate > 0.8) {
      const currentContentWeight = this.algorithmWeights.get('content_analysis') || 0.3;
      this.algorithmWeights.set('content_analysis', Math.min(0.4, currentContentWeight + 0.02));
    }
  }

  /**
   * Adjusts confidence thresholds based on feedback
   */
  private adjustConfidenceThresholds(): void {
    const stats = this.getFeedbackStats();
    
    // Analyze feedback by recommendation type
    const typeStats = new Map<string, { approved: number; rejected: number }>();
    
    this.feedbackHistory.forEach(feedback => {
      if (feedback.context) {
        try {
          const context = JSON.parse(feedback.context);
          const action = context.recommendation?.action;
          
          if (action) {
            const current = typeStats.get(action) || { approved: 0, rejected: 0 };
            if (feedback.action === 'approved') {
              current.approved++;
            } else {
              current.rejected++;
            }
            typeStats.set(action, current);
          }
        } catch (error) {
          // Ignore parsing errors
        }
      }
    });

    // Adjust thresholds based on type-specific approval rates
    typeStats.forEach((stats, action) => {
      const total = stats.approved + stats.rejected;
      if (total >= 3) { // Need minimum feedback
        const approvalRate = stats.approved / total;
        const currentThreshold = this.confidenceThresholds.get(action) || 0.7;
        
        if (approvalRate < 0.5) {
          // Increase threshold for poorly performing actions
          this.confidenceThresholds.set(action, Math.min(0.9, currentThreshold + 0.05));
        } else if (approvalRate > 0.8) {
          // Decrease threshold for well-performing actions
          this.confidenceThresholds.set(action, Math.max(0.5, currentThreshold - 0.02));
        }
      }
    });
  }

  /**
   * Anonymizes feedback data for LLM analysis (privacy-preserving)
   * Implements Requirements 7.5: Privacy-preserving learning
   */
  private anonymizeFeedbackForAnalysis(): any[] {
    return this.feedbackHistory.map(feedback => {
      let anonymizedContext = {};
      
      if (feedback.context) {
        try {
          const context = JSON.parse(feedback.context);
          
          // Remove personally identifiable information
          anonymizedContext = {
            recommendationType: context.recommendation?.action,
            confidence: context.recommendation?.confidence,
            utilityScore: context.utilityScore?.overallScore,
            noteLength: context.note?.content?.length || 0,
            hasAttachments: (context.note?.attachments?.length || 0) > 0,
            // Remove actual content, titles, etc.
          };
        } catch (error) {
          // Ignore parsing errors
        }
      }
      
      return {
        action: feedback.action,
        timestamp: feedback.timestamp,
        context: anonymizedContext
      };
    });
  }

  /**
   * Synchronizes preferences to other devices
   * Implements Requirements 7.4: Preference synchronization between devices
   */
  async syncPreferencesToDevices(): Promise<void> {
    if (!this.syncService || !this.securityService) {
      return;
    }

    try {
      // Prepare learning preferences data
      const learningData = {
        algorithmWeights: Object.fromEntries(this.algorithmWeights),
        confidenceThresholds: Object.fromEntries(this.confidenceThresholds),
        learningEnabled: this.learningEnabled,
        lastUpdated: new Date().toISOString()
      };

      // Encrypt the learning data
      const encryptedData = await this.securityService.encryptData(
        JSON.stringify(learningData)
      );

      // Sync through the device synchronization service
      await this.syncService.syncPreferences({
        learningPreferences: {
          adaptToFeedback: this.learningEnabled,
          shareAcrossDevices: true,
          retentionDays: 30
        }
      });

      // Store encrypted detailed preferences separately if needed
      await this.securityService.storeSecureData('learning_algorithm_weights', encryptedData);
    } catch (error) {
      console.error('Error syncing preferences:', error);
    }
  }

  /**
   * Loads preferences from synchronized devices
   */
  async loadSyncedPreferences(): Promise<void> {
    if (!this.syncService || !this.securityService) {
      return;
    }

    try {
      // Load encrypted detailed preferences
      const encryptedData = await this.securityService.retrieveSecureData<string>('learning_algorithm_weights');
      
      if (encryptedData) {
        const decryptedData = await this.securityService.decryptData(encryptedData);
        const preferences = JSON.parse(decryptedData as string);
        
        // Update local preferences
        this.algorithmWeights = new Map(Object.entries(preferences.algorithmWeights));
        this.confidenceThresholds = new Map(Object.entries(preferences.confidenceThresholds));
        this.learningEnabled = preferences.learningEnabled;
      }
    } catch (error) {
      console.error('Error loading synced preferences:', error);
    }
  }

  /**
   * Gets current algorithm weights
   */
  getAlgorithmWeights(): Map<string, number> {
    return new Map(this.algorithmWeights);
  }

  /**
   * Gets current confidence thresholds
   */
  getConfidenceThresholds(): Map<string, number> {
    return new Map(this.confidenceThresholds);
  }

  /**
   * Applies learned preferences to utility scoring
   * Implements Requirements 7.4: Apply updated criteria to future analysis
   */
  applyLearnedWeights(
    contentScore: number,
    behavioralScore: number,
    semanticScore: number,
    ruleBasedScore: number
  ): number {
    const contentWeight = this.algorithmWeights.get('content_analysis') || 0.3;
    const behavioralWeight = this.algorithmWeights.get('behavioral_patterns') || 0.25;
    const semanticWeight = this.algorithmWeights.get('semantic_analysis') || 0.25;
    const ruleWeight = this.algorithmWeights.get('rule_based') || 0.2;

    return (
      contentScore * contentWeight +
      behavioralScore * behavioralWeight +
      semanticScore * semanticWeight +
      ruleBasedScore * ruleWeight
    );
  }

  /**
   * Checks if a recommendation meets the learned confidence threshold
   */
  meetsConfidenceThreshold(action: string, confidence: number): boolean {
    const threshold = this.confidenceThresholds.get(action) || 0.7;
    return confidence >= threshold;
  }
}