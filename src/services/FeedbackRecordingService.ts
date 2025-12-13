import { Recommendation, RecommendationAction } from '../models/Recommendation';
import { Note } from '../models/Note';
import { OverrideOption } from './TransparencyService';

/**
 * User feedback record for learning
 */
export interface UserFeedback {
  id: string;
  recommendationId: string;
  noteId: string;
  originalAction: RecommendationAction;
  userChoice: 'approved' | 'rejected' | 'overridden';
  overrideOption?: OverrideOption;
  timestamp: Date;
  context: FeedbackContext;
  reasoning?: string;
}

/**
 * Context information for feedback
 */
export interface FeedbackContext {
  deviceType: 'ios' | 'macos';
  sessionId: string;
  confidenceLevel: number;
  uncertaintyIndicators: string[];
  contentFactors: string[];
  userInteractionTime: number; // seconds spent reviewing
  previousSimilarDecisions: number;
}

/**
 * Feedback analysis result
 */
export interface FeedbackAnalysis {
  totalFeedback: number;
  approvalRate: number;
  rejectionRate: number;
  overrideRate: number;
  commonOverrides: { option: string; count: number }[];
  patterns: FeedbackPattern[];
  recommendations: string[];
}

/**
 * Identified feedback pattern
 */
export interface FeedbackPattern {
  type: 'content_preference' | 'action_preference' | 'confidence_threshold' | 'timing_preference';
  description: string;
  confidence: number;
  examples: string[];
  suggestedAdjustment: string;
}

/**
 * Service for recording and analyzing user feedback on recommendations
 * Implements Requirement 21.3: Easy override options with feedback recording for learning
 */
export class FeedbackRecordingService {
  private feedbackHistory: Map<string, UserFeedback> = new Map();
  private sessionId: string;
  private deviceType: 'ios' | 'macos';

  constructor(deviceType: 'ios' | 'macos' = 'ios') {
    this.deviceType = deviceType;
    this.sessionId = this.generateSessionId();
  }

  /**
   * Record user feedback when they approve a recommendation
   * Implements Requirement 21.3: Feedback recording for learning
   */
  recordApproval(
    recommendation: Recommendation,
    note: Note,
    interactionTimeSeconds: number,
    context?: Partial<FeedbackContext>
  ): UserFeedback {
    const feedback: UserFeedback = {
      id: this.generateFeedbackId(),
      recommendationId: recommendation.id,
      noteId: note.id,
      originalAction: recommendation.action,
      userChoice: 'approved',
      timestamp: new Date(),
      context: {
        deviceType: this.deviceType,
        sessionId: this.sessionId,
        confidenceLevel: recommendation.confidence,
        uncertaintyIndicators: [],
        contentFactors: this.extractContentFactors(note),
        userInteractionTime: interactionTimeSeconds,
        previousSimilarDecisions: this.countSimilarDecisions(recommendation.action),
        ...context
      }
    };

    this.feedbackHistory.set(feedback.id, feedback);
    this.notifyLearningSystem(feedback);
    
    return feedback;
  }

  /**
   * Record user feedback when they reject a recommendation
   * Implements Requirement 21.3: Feedback recording for learning
   */
  recordRejection(
    recommendation: Recommendation,
    note: Note,
    interactionTimeSeconds: number,
    reasoning?: string,
    context?: Partial<FeedbackContext>
  ): UserFeedback {
    const feedback: UserFeedback = {
      id: this.generateFeedbackId(),
      recommendationId: recommendation.id,
      noteId: note.id,
      originalAction: recommendation.action,
      userChoice: 'rejected',
      timestamp: new Date(),
      reasoning,
      context: {
        deviceType: this.deviceType,
        sessionId: this.sessionId,
        confidenceLevel: recommendation.confidence,
        uncertaintyIndicators: [],
        contentFactors: this.extractContentFactors(note),
        userInteractionTime: interactionTimeSeconds,
        previousSimilarDecisions: this.countSimilarDecisions(recommendation.action),
        ...context
      }
    };

    this.feedbackHistory.set(feedback.id, feedback);
    this.notifyLearningSystem(feedback);
    
    return feedback;
  }

  /**
   * Record user feedback when they choose an override option
   * Implements Requirement 21.3: Override options with feedback recording
   */
  recordOverride(
    recommendation: Recommendation,
    note: Note,
    overrideOption: OverrideOption,
    interactionTimeSeconds: number,
    reasoning?: string,
    context?: Partial<FeedbackContext>
  ): UserFeedback {
    const feedback: UserFeedback = {
      id: this.generateFeedbackId(),
      recommendationId: recommendation.id,
      noteId: note.id,
      originalAction: recommendation.action,
      userChoice: 'overridden',
      overrideOption,
      timestamp: new Date(),
      reasoning,
      context: {
        deviceType: this.deviceType,
        sessionId: this.sessionId,
        confidenceLevel: recommendation.confidence,
        uncertaintyIndicators: [],
        contentFactors: this.extractContentFactors(note),
        userInteractionTime: interactionTimeSeconds,
        previousSimilarDecisions: this.countSimilarDecisions(recommendation.action),
        ...context
      }
    };

    this.feedbackHistory.set(feedback.id, feedback);
    this.notifyLearningSystem(feedback);
    
    return feedback;
  }

  /**
   * Analyze feedback patterns for learning insights
   * Implements Requirement 21.3: Learning from feedback patterns
   */
  analyzeFeedbackPatterns(timeframeHours: number = 168): FeedbackAnalysis {
    const cutoffTime = new Date(Date.now() - timeframeHours * 60 * 60 * 1000);
    const recentFeedback = Array.from(this.feedbackHistory.values())
      .filter(f => f.timestamp >= cutoffTime);

    if (recentFeedback.length === 0) {
      return this.createEmptyAnalysis();
    }

    const totalFeedback = recentFeedback.length;
    const approvals = recentFeedback.filter(f => f.userChoice === 'approved').length;
    const rejections = recentFeedback.filter(f => f.userChoice === 'rejected').length;
    const overrides = recentFeedback.filter(f => f.userChoice === 'overridden').length;

    const commonOverrides = this.analyzeCommonOverrides(recentFeedback);
    const patterns = this.identifyPatterns(recentFeedback);
    const recommendations = this.generateRecommendations(patterns);

    return {
      totalFeedback,
      approvalRate: approvals / totalFeedback,
      rejectionRate: rejections / totalFeedback,
      overrideRate: overrides / totalFeedback,
      commonOverrides,
      patterns,
      recommendations
    };
  }

  /**
   * Get feedback history for a specific recommendation type
   */
  getFeedbackForAction(action: RecommendationAction, limit: number = 50): UserFeedback[] {
    return Array.from(this.feedbackHistory.values())
      .filter(f => f.originalAction === action)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Get recent feedback for analysis
   */
  getRecentFeedback(hours: number = 24): UserFeedback[] {
    const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
    return Array.from(this.feedbackHistory.values())
      .filter(f => f.timestamp >= cutoffTime)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Clear old feedback to manage memory
   */
  cleanupOldFeedback(retentionDays: number = 30): number {
    const cutoffTime = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    let removedCount = 0;

    for (const [id, feedback] of this.feedbackHistory.entries()) {
      if (feedback.timestamp < cutoffTime) {
        this.feedbackHistory.delete(id);
        removedCount++;
      }
    }

    return removedCount;
  }

  // Private helper methods

  private extractContentFactors(note: Note): string[] {
    const factors: string[] = [];
    
    if (note.metadata.wordCount < 50) factors.push('short_content');
    if (note.metadata.wordCount > 500) factors.push('long_content');
    if (note.attachments.length > 0) factors.push('has_attachments');
    if (note.checklists.length > 0) factors.push('has_checklists');
    if (note.metadata.hasImages) factors.push('has_images');
    if (note.metadata.accessCount === 0) factors.push('never_accessed');
    if (note.metadata.accessCount > 10) factors.push('frequently_accessed');
    
    const daysSinceModified = Math.floor(
      (Date.now() - note.modifiedDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    
    if (daysSinceModified > 365) factors.push('very_old');
    else if (daysSinceModified > 90) factors.push('old');
    else if (daysSinceModified < 7) factors.push('recent');

    return factors;
  }

  private countSimilarDecisions(action: RecommendationAction): number {
    return Array.from(this.feedbackHistory.values())
      .filter(f => f.originalAction === action)
      .length;
  }

  private analyzeCommonOverrides(feedback: UserFeedback[]): { option: string; count: number }[] {
    const overrideCounts = new Map<string, number>();
    
    feedback
      .filter(f => f.userChoice === 'overridden' && f.overrideOption)
      .forEach(f => {
        const optionId = f.overrideOption!.id;
        overrideCounts.set(optionId, (overrideCounts.get(optionId) || 0) + 1);
      });

    return Array.from(overrideCounts.entries())
      .map(([option, count]) => ({ option, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }

  private identifyPatterns(feedback: UserFeedback[]): FeedbackPattern[] {
    const patterns: FeedbackPattern[] = [];

    // Analyze confidence threshold patterns
    const lowConfidenceRejections = feedback.filter(f => 
      f.userChoice === 'rejected' && f.context.confidenceLevel < 0.7
    ).length;
    
    const highConfidenceRejections = feedback.filter(f => 
      f.userChoice === 'rejected' && f.context.confidenceLevel >= 0.8
    ).length;

    if (lowConfidenceRejections > highConfidenceRejections * 2) {
      patterns.push({
        type: 'confidence_threshold',
        description: 'User tends to reject recommendations with low confidence',
        confidence: 0.8,
        examples: ['Rejected 70% confidence deletion', 'Rejected 60% confidence merge'],
        suggestedAdjustment: 'Increase minimum confidence threshold to 0.75'
      });
    }

    // Analyze content preferences
    const shortContentRejections = feedback.filter(f => 
      f.userChoice === 'rejected' && f.context.contentFactors.includes('short_content')
    ).length;

    if (shortContentRejections > feedback.length * 0.3) {
      patterns.push({
        type: 'content_preference',
        description: 'User prefers to keep short notes',
        confidence: 0.7,
        examples: ['Kept brief meeting notes', 'Kept short reminders'],
        suggestedAdjustment: 'Reduce deletion recommendations for notes under 50 words'
      });
    }

    // Analyze action preferences
    const deleteOverrides = feedback.filter(f => 
      f.originalAction === RecommendationAction.DELETE && 
      f.overrideOption?.action === RecommendationAction.ARCHIVE
    ).length;

    if (deleteOverrides > 3) {
      patterns.push({
        type: 'action_preference',
        description: 'User prefers archiving over deletion',
        confidence: 0.9,
        examples: ['Chose archive instead of delete 5 times'],
        suggestedAdjustment: 'Default to archive recommendations instead of delete'
      });
    }

    return patterns;
  }

  private generateRecommendations(patterns: FeedbackPattern[]): string[] {
    return patterns
      .filter(p => p.confidence > 0.6)
      .map(p => p.suggestedAdjustment);
  }

  private createEmptyAnalysis(): FeedbackAnalysis {
    return {
      totalFeedback: 0,
      approvalRate: 0,
      rejectionRate: 0,
      overrideRate: 0,
      commonOverrides: [],
      patterns: [],
      recommendations: []
    };
  }

  private notifyLearningSystem(feedback: UserFeedback): void {
    // In a real implementation, this would notify the learning component
    console.log(`Feedback recorded: ${feedback.userChoice} for ${feedback.originalAction}`);
  }

  private generateFeedbackId(): string {
    return `feedback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}