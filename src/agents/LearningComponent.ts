import { UserFeedback } from '../models';
import { Recommendation } from '../models/Recommendation';
import { Note } from '../models/Note';
import { UtilityScore } from '../models/UtilityScore';

/**
 * Learning Component for adaptive recommendation improvement
 * Implements privacy-preserving learning from user feedback
 */
export class LearningComponent {
  private feedbackHistory: UserFeedback[] = [];
  private userPreferences: Map<string, any> = new Map();
  private learningEnabled: boolean = true;

  constructor() {
    this.feedbackHistory = [];
    this.userPreferences = new Map();
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
}