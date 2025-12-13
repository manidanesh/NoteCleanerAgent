import { Note } from '../models/Note';
import { Recommendation, RecommendationAction } from '../models/Recommendation';
import { UtilityScore, ScoringFactor } from '../models/UtilityScore';

/**
 * Detailed explanation with content factors and confidence levels
 */
export interface DetailedExplanation {
  summary: string;
  reasoning: string;
  contentFactors: ContentFactor[];
  confidenceLevel: ConfidenceLevel;
  uncertaintyIndicators: UncertaintyIndicator[];
  saferAlternatives?: string[];
}

/**
 * Content factor contributing to a recommendation
 */
export interface ContentFactor {
  name: string;
  value: number | string;
  weight: number;
  description: string;
  impact: 'positive' | 'negative' | 'neutral';
}

/**
 * Confidence level assessment
 */
export interface ConfidenceLevel {
  score: number; // 0-1
  label: 'Low' | 'Medium' | 'High';
  description: string;
  riskLevel: 'low' | 'medium' | 'high';
}

/**
 * Uncertainty indicator for recommendations
 */
export interface UncertaintyIndicator {
  type: 'data_quality' | 'algorithm_confidence' | 'user_pattern' | 'content_ambiguity';
  severity: 'low' | 'medium' | 'high';
  description: string;
  recommendation: string;
}

/**
 * Override option for user control
 */
export interface OverrideOption {
  id: string;
  label: string;
  description: string;
  action: RecommendationAction | 'keep_unchanged';
  requiresConfirmation: boolean;
  safetyLevel: 'safe' | 'moderate' | 'risky';
}

/**
 * Service for providing transparency and control features
 * Implements Requirements 21.1, 21.2, 21.3, 21.4, 21.5
 */
export class TransparencyService {
  
  /**
   * Generate clear, non-technical explanation for any recommendation
   * Implements Requirement 21.1: Clear, non-technical explanation generation
   */
  generateClearExplanation(
    recommendation: Recommendation,
    note: Note,
    utilityScore?: UtilityScore
  ): DetailedExplanation {
    const contentFactors = this.extractContentFactors(note, utilityScore);
    const confidenceLevel = this.assessConfidenceLevel(recommendation, contentFactors);
    const uncertaintyIndicators = this.identifyUncertaintyIndicators(
      recommendation,
      note,
      contentFactors
    );
    
    return {
      summary: this.generateNonTechnicalSummary(recommendation, note),
      reasoning: this.generateDetailedReasoning(recommendation, note, contentFactors),
      contentFactors,
      confidenceLevel,
      uncertaintyIndicators,
      saferAlternatives: this.generateSaferAlternatives(recommendation, uncertaintyIndicators)
    };
  }

  /**
   * Extract and format content factors for display
   * Implements Requirement 21.2: Detailed reasoning display with content factors
   */
  private extractContentFactors(note: Note, utilityScore?: UtilityScore): ContentFactor[] {
    const factors: ContentFactor[] = [];

    // Note age factor
    const daysSinceModified = Math.floor(
      (Date.now() - note.modifiedDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    factors.push({
      name: 'Note Age',
      value: `${daysSinceModified} days since last modified`,
      weight: this.calculateAgeWeight(daysSinceModified),
      description: daysSinceModified > 365 
        ? 'Very old note, likely outdated'
        : daysSinceModified > 90
        ? 'Older note, may be less relevant'
        : 'Recently modified, likely still relevant',
      impact: daysSinceModified > 180 ? 'negative' : daysSinceModified < 30 ? 'positive' : 'neutral'
    });

    // Content length factor
    const wordCount = note.metadata.wordCount || this.estimateWordCount(note.content);
    factors.push({
      name: 'Content Length',
      value: `${wordCount} words`,
      weight: this.calculateLengthWeight(wordCount),
      description: wordCount < 10
        ? 'Very short content, may be incomplete'
        : wordCount < 50
        ? 'Brief content, may lack detail'
        : wordCount > 1000
        ? 'Lengthy content, likely comprehensive'
        : 'Moderate length, good detail level',
      impact: wordCount < 20 ? 'negative' : wordCount > 100 ? 'positive' : 'neutral'
    });

    // Access frequency factor
    const accessCount = note.metadata.accessCount || 0;
    factors.push({
      name: 'Usage Frequency',
      value: `Accessed ${accessCount} times`,
      weight: this.calculateAccessWeight(accessCount),
      description: accessCount === 0
        ? 'Never accessed, may be forgotten'
        : accessCount < 3
        ? 'Rarely accessed, low engagement'
        : accessCount > 10
        ? 'Frequently accessed, high value'
        : 'Occasionally accessed, moderate value',
      impact: accessCount === 0 ? 'negative' : accessCount > 5 ? 'positive' : 'neutral'
    });

    // Content type factor
    const hasAttachments = note.attachments.length > 0;
    const hasChecklists = note.checklists.length > 0;
    const hasImages = note.metadata.hasImages;
    
    if (hasAttachments || hasChecklists || hasImages) {
      factors.push({
        name: 'Rich Content',
        value: this.describeRichContent(note),
        weight: 0.8,
        description: 'Contains attachments, images, or structured content',
        impact: 'positive'
      });
    }

    // Title quality factor
    const titleQuality = this.assessTitleQuality(note.title, note.content);
    factors.push({
      name: 'Title Quality',
      value: titleQuality.label,
      weight: titleQuality.weight,
      description: titleQuality.description,
      impact: titleQuality.impact
    });

    // Add utility score factors if available
    if (utilityScore) {
      utilityScore.factors.forEach(factor => {
        factors.push({
          name: factor.name,
          value: factor.value,
          weight: factor.weight,
          description: factor.description,
          impact: factor.value > 0.6 ? 'positive' : factor.value < 0.4 ? 'negative' : 'neutral'
        });
      });
    }

    return factors.sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight));
  }

  /**
   * Assess confidence level with detailed breakdown
   * Implements Requirement 21.2: Confidence levels display
   */
  private assessConfidenceLevel(
    recommendation: Recommendation,
    contentFactors: ContentFactor[]
  ): ConfidenceLevel {
    const confidence = recommendation.confidence;
    
    // Calculate risk level based on action type and confidence
    const riskLevel = this.calculateRiskLevel(recommendation.action, confidence);
    
    let label: 'Low' | 'Medium' | 'High';
    let description: string;
    
    if (confidence >= 0.8) {
      label = 'High';
      description = 'Strong evidence supports this recommendation. Multiple factors align consistently.';
    } else if (confidence >= 0.6) {
      label = 'Medium';
      description = 'Good evidence supports this recommendation, but some uncertainty remains.';
    } else {
      label = 'Low';
      description = 'Limited evidence for this recommendation. Consider reviewing manually.';
    }

    // Adjust description based on content factors
    const negativeFactors = contentFactors.filter(f => f.impact === 'negative').length;
    const positiveFactors = contentFactors.filter(f => f.impact === 'positive').length;
    
    if (negativeFactors > positiveFactors && confidence > 0.7) {
      description += ' However, some conflicting signals suggest caution.';
    }

    return {
      score: confidence,
      label,
      description,
      riskLevel
    };
  }

  /**
   * Identify uncertainty indicators for safer defaults
   * Implements Requirement 21.5: Uncertainty indicators with safer action defaults
   */
  private identifyUncertaintyIndicators(
    recommendation: Recommendation,
    note: Note,
    contentFactors: ContentFactor[]
  ): UncertaintyIndicator[] {
    const indicators: UncertaintyIndicator[] = [];

    // Low confidence indicator
    if (recommendation.confidence < 0.7) {
      indicators.push({
        type: 'algorithm_confidence',
        severity: recommendation.confidence < 0.5 ? 'high' : 'medium',
        description: `AI confidence is ${Math.round(recommendation.confidence * 100)}%, below the recommended threshold`,
        recommendation: 'Consider manual review before taking action'
      });
    }

    // Conflicting signals indicator
    const negativeFactors = contentFactors.filter(f => f.impact === 'negative');
    const positiveFactors = contentFactors.filter(f => f.impact === 'positive');
    
    if (negativeFactors.length > 0 && positiveFactors.length > 0) {
      indicators.push({
        type: 'content_ambiguity',
        severity: 'medium',
        description: 'Mixed signals detected - some factors support the action while others oppose it',
        recommendation: 'Review individual factors carefully before deciding'
      });
    }

    // High-risk action with moderate confidence
    if (this.isHighRiskAction(recommendation.action) && recommendation.confidence < 0.9) {
      indicators.push({
        type: 'algorithm_confidence',
        severity: 'high',
        description: `${recommendation.action} is irreversible but confidence is only ${Math.round(recommendation.confidence * 100)}%`,
        recommendation: 'Consider a safer alternative like archiving instead'
      });
    }

    // Data quality issues
    if (note.metadata.wordCount < 10 && recommendation.action === RecommendationAction.DELETE) {
      indicators.push({
        type: 'data_quality',
        severity: 'medium',
        description: 'Very short content makes it difficult to assess true value',
        recommendation: 'Review content manually to ensure nothing important is missed'
      });
    }

    // Recent activity despite low utility
    const daysSinceModified = Math.floor(
      (Date.now() - note.modifiedDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    
    if (daysSinceModified < 7 && recommendation.action === RecommendationAction.DELETE) {
      indicators.push({
        type: 'user_pattern',
        severity: 'medium',
        description: 'Note was recently modified but marked for deletion',
        recommendation: 'Recent activity suggests potential ongoing value'
      });
    }

    return indicators;
  }

  /**
   * Generate override options for user control
   * Implements Requirement 21.3: Easy override options with feedback recording
   */
  generateOverrideOptions(
    recommendation: Recommendation,
    uncertaintyIndicators: UncertaintyIndicator[]
  ): OverrideOption[] {
    const options: OverrideOption[] = [];

    // Always provide "keep unchanged" option
    options.push({
      id: 'keep_unchanged',
      label: 'Keep as is',
      description: 'Leave this note unchanged and dismiss the recommendation',
      action: 'keep_unchanged',
      requiresConfirmation: false,
      safetyLevel: 'safe'
    });

    // Provide safer alternatives based on original recommendation
    switch (recommendation.action) {
      case RecommendationAction.DELETE:
        options.push({
          id: 'archive_instead',
          label: 'Archive instead',
          description: 'Move to archive folder instead of deleting (safer option)',
          action: RecommendationAction.ARCHIVE,
          requiresConfirmation: false,
          safetyLevel: 'safe'
        });
        
        options.push({
          id: 'review_later',
          label: 'Mark for review',
          description: 'Flag for manual review later instead of immediate action',
          action: RecommendationAction.REVIEW,
          requiresConfirmation: false,
          safetyLevel: 'safe'
        });
        break;

      case RecommendationAction.ARCHIVE:
        options.push({
          id: 'delete_instead',
          label: 'Delete permanently',
          description: 'Delete the note completely (more aggressive option)',
          action: RecommendationAction.DELETE,
          requiresConfirmation: true,
          safetyLevel: 'risky'
        });
        break;

      case RecommendationAction.MERGE_DUPLICATES:
        options.push({
          id: 'review_duplicates',
          label: 'Review duplicates manually',
          description: 'Show duplicate candidates for manual review and selection',
          action: RecommendationAction.REVIEW,
          requiresConfirmation: false,
          safetyLevel: 'safe'
        });
        break;

      case RecommendationAction.RENAME:
        options.push({
          id: 'suggest_different_title',
          label: 'Suggest different title',
          description: 'Generate alternative title suggestions',
          action: RecommendationAction.RENAME,
          requiresConfirmation: false,
          safetyLevel: 'safe'
        });
        break;
    }

    // Add uncertainty-based options
    if (uncertaintyIndicators.some(i => i.severity === 'high')) {
      options.push({
        id: 'defer_decision',
        label: 'Defer decision',
        description: 'Skip this recommendation due to high uncertainty',
        action: 'keep_unchanged',
        requiresConfirmation: false,
        safetyLevel: 'safe'
      });
    }

    return options;
  }

  /**
   * Generate safer alternatives when uncertainty is high
   * Implements Requirement 21.5: Safer action defaults
   */
  private generateSaferAlternatives(
    recommendation: Recommendation,
    uncertaintyIndicators: UncertaintyIndicator[]
  ): string[] | undefined {
    if (uncertaintyIndicators.length === 0) return undefined;

    const alternatives: string[] = [];
    const highUncertainty = uncertaintyIndicators.some(i => i.severity === 'high');

    if (highUncertainty) {
      switch (recommendation.action) {
        case RecommendationAction.DELETE:
          alternatives.push('Archive instead of deleting');
          alternatives.push('Mark for manual review');
          break;
        case RecommendationAction.MERGE_DUPLICATES:
          alternatives.push('Review duplicates manually first');
          alternatives.push('Keep separate for now');
          break;
        case RecommendationAction.ARCHIVE:
          alternatives.push('Keep in current location');
          break;
      }
    }

    return alternatives.length > 0 ? alternatives : undefined;
  }

  // Private helper methods

  private generateNonTechnicalSummary(recommendation: Recommendation, note: Note): string {
    const action = this.getActionDescription(recommendation.action);
    const confidence = Math.round(recommendation.confidence * 100);
    
    return `I suggest ${action} "${note.title}" with ${confidence}% confidence. ${this.getActionBenefit(recommendation.action)}`;
  }

  private generateDetailedReasoning(
    recommendation: Recommendation,
    note: Note,
    contentFactors: ContentFactor[]
  ): string {
    const topFactors = contentFactors.slice(0, 3);
    const factorDescriptions = topFactors.map(f => 
      `${f.name}: ${f.description}`
    ).join('. ');
    
    return `${recommendation.reasoning} Key factors: ${factorDescriptions}.`;
  }

  private getActionDescription(action: RecommendationAction): string {
    switch (action) {
      case RecommendationAction.DELETE:
        return 'permanently removing';
      case RecommendationAction.ARCHIVE:
        return 'archiving';
      case RecommendationAction.RENAME:
        return 'renaming';
      case RecommendationAction.MERGE_DUPLICATES:
        return 'merging with similar notes';
      case RecommendationAction.REVIEW:
        return 'marking for review';
      default:
        return 'keeping';
    }
  }

  private getActionBenefit(action: RecommendationAction): string {
    switch (action) {
      case RecommendationAction.DELETE:
        return 'This will free up space and reduce clutter.';
      case RecommendationAction.ARCHIVE:
        return 'This will keep it accessible while decluttering your active notes.';
      case RecommendationAction.RENAME:
        return 'This will make the note easier to find and understand.';
      case RecommendationAction.MERGE_DUPLICATES:
        return 'This will eliminate redundancy while preserving all information.';
      case RecommendationAction.REVIEW:
        return 'This will flag it for your personal attention.';
      default:
        return 'This will maintain the current organization.';
    }
  }

  private calculateRiskLevel(action: RecommendationAction, confidence: number): 'low' | 'medium' | 'high' {
    if (action === RecommendationAction.DELETE) {
      return confidence > 0.9 ? 'medium' : 'high';
    }
    if (action === RecommendationAction.MERGE_DUPLICATES) {
      return confidence > 0.8 ? 'low' : 'medium';
    }
    return 'low';
  }

  private isHighRiskAction(action: RecommendationAction): boolean {
    return action === RecommendationAction.DELETE || action === RecommendationAction.MERGE_DUPLICATES;
  }

  private calculateAgeWeight(days: number): number {
    if (days > 365) return -0.8;
    if (days > 180) return -0.4;
    if (days < 30) return 0.6;
    return 0.0;
  }

  private calculateLengthWeight(wordCount: number): number {
    if (wordCount < 10) return -0.6;
    if (wordCount < 50) return -0.2;
    if (wordCount > 500) return 0.4;
    return 0.0;
  }

  private calculateAccessWeight(accessCount: number): number {
    if (accessCount === 0) return -0.7;
    if (accessCount < 3) return -0.3;
    if (accessCount > 10) return 0.8;
    return 0.2;
  }

  private estimateWordCount(content: string): number {
    return content.trim().split(/\s+/).length;
  }

  private describeRichContent(note: Note): string {
    const parts: string[] = [];
    if (note.attachments.length > 0) parts.push(`${note.attachments.length} attachments`);
    if (note.checklists.length > 0) parts.push(`${note.checklists.length} checklists`);
    if (note.metadata.hasImages) parts.push('images');
    return parts.join(', ');
  }

  private assessTitleQuality(title: string, content: string): {
    label: string;
    weight: number;
    description: string;
    impact: 'positive' | 'negative' | 'neutral';
  } {
    const isGeneric = /^(note|untitled|new note|\d{4}-\d{2}-\d{2})/i.test(title);
    const isVeryShort = title.length < 10;
    const contentWords = content.toLowerCase().split(/\s+/).slice(0, 20);
    const titleWords = title.toLowerCase().split(/\s+/);
    const hasContentOverlap = titleWords.some(word => 
      word.length > 3 && contentWords.includes(word)
    );

    if (isGeneric) {
      return {
        label: 'Generic title',
        weight: -0.5,
        description: 'Title is generic and not descriptive',
        impact: 'negative'
      };
    }

    if (isVeryShort && !hasContentOverlap) {
      return {
        label: 'Unclear title',
        weight: -0.3,
        description: 'Title is too short and doesn\'t reflect content',
        impact: 'negative'
      };
    }

    if (hasContentOverlap && title.length > 15) {
      return {
        label: 'Descriptive title',
        weight: 0.4,
        description: 'Title clearly describes the content',
        impact: 'positive'
      };
    }

    return {
      label: 'Adequate title',
      weight: 0.0,
      description: 'Title is acceptable but could be improved',
      impact: 'neutral'
    };
  }
}