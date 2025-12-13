import { Note } from '../models/Note';
import { Recommendation, RecommendationAction, ImpactLevel, RecommendationStatus } from '../models/Recommendation';
import { JunkNoteDetectorAgent, JunkDetectionResult, JunkConfidence, JunkNoteCategory } from '../agents/JunkNoteDetectorAgent';
import { LLMService } from './LLMService';

/**
 * Junk detection configuration
 */
export interface JunkDetectionConfig {
  enableAutoDetection: boolean;
  confidenceThreshold: JunkConfidence;
  requireManualReviewForUncertain: boolean;
  batchSize: number;
  maxProcessingTime: number; // milliseconds
}

/**
 * Junk detection summary for bulk operations
 */
export interface JunkDetectionSummary {
  totalNotesAnalyzed: number;
  junkNotesFound: number;
  categoryCounts: Map<JunkNoteCategory, number>;
  confidenceDistribution: Map<JunkConfidence, number>;
  estimatedStorageSavings: number; // bytes
  processingTime: number; // milliseconds
}

/**
 * Service for managing junk note detection operations
 */
export class JunkNoteDetectionService {
  private junkDetector: JunkNoteDetectorAgent;
  private config: JunkDetectionConfig;

  constructor(llmService: LLMService, config?: Partial<JunkDetectionConfig>) {
    this.junkDetector = new JunkNoteDetectorAgent(llmService);
    this.config = {
      enableAutoDetection: true,
      confidenceThreshold: JunkConfidence.MEDIUM,
      requireManualReviewForUncertain: true,
      batchSize: 20,
      maxProcessingTime: 30000, // 30 seconds
      ...config
    };
  }

  /**
   * Analyze a single note for junk detection
   */
  async analyzeNote(note: Note): Promise<JunkDetectionResult> {
    if (!this.config.enableAutoDetection) {
      return this.createDisabledResult(note);
    }

    return await this.junkDetector.analyzeNote(note);
  }

  /**
   * Analyze multiple notes and generate recommendations
   */
  async analyzeNotesWithRecommendations(notes: Note[]): Promise<{
    results: JunkDetectionResult[];
    recommendations: Recommendation[];
    summary: JunkDetectionSummary;
  }> {
    const startTime = Date.now();
    
    // Analyze notes for junk detection
    const results = await this.junkDetector.analyzeNotes(notes);
    
    // Generate recommendations based on results
    const recommendations = this.generateRecommendations(results, notes);
    
    // Create summary
    const summary = this.createSummary(results, notes, Date.now() - startTime);
    
    return {
      results,
      recommendations,
      summary
    };
  }

  /**
   * Generate recommendations based on junk detection results
   */
  private generateRecommendations(results: JunkDetectionResult[], notes: Note[]): Recommendation[] {
    const recommendations: Recommendation[] = [];
    const noteMap = new Map(notes.map(note => [note.id, note]));

    for (const result of results) {
      const note = noteMap.get(result.noteId);
      if (!note) continue;

      // Only create recommendations for notes classified as junk with sufficient confidence
      if (result.isJunk && this.meetsConfidenceThreshold(result.confidence)) {
        const recommendation = this.createJunkRecommendation(result, note);
        recommendations.push(recommendation);
      } else if (result.requiresManualReview && this.config.requireManualReviewForUncertain) {
        const reviewRecommendation = this.createReviewRecommendation(result, note);
        recommendations.push(reviewRecommendation);
      }
    }

    return recommendations;
  }

  /**
   * Create a recommendation for a junk note
   */
  private createJunkRecommendation(result: JunkDetectionResult, note: Note): Recommendation {
    // Determine action based on category and confidence
    let action: RecommendationAction;
    let impact: ImpactLevel;

    if (result.confidence === JunkConfidence.HIGH) {
      action = result.category === JunkNoteCategory.EMPTY_NOTE ? 
        RecommendationAction.DELETE : RecommendationAction.ARCHIVE;
      impact = ImpactLevel.MEDIUM;
    } else {
      action = RecommendationAction.REVIEW;
      impact = ImpactLevel.LOW;
    }

    const categoryDescription = this.getCategoryDescription(result.category);
    
    return {
      id: `junk_${note.id}_${Date.now()}`,
      noteId: note.id,
      action,
      confidence: result.confidenceScore / 100,
      reasoning: `Junk Detection: ${result.reasoning} ${categoryDescription ? `Classified as: ${categoryDescription}.` : ''}`,
      impact,
      reversible: true,
      timestamp: new Date(),
      status: RecommendationStatus.PENDING
    };
  }

  /**
   * Create a review recommendation for uncertain cases
   */
  private createReviewRecommendation(result: JunkDetectionResult, note: Note): Recommendation {
    return {
      id: `junk_review_${note.id}_${Date.now()}`,
      noteId: note.id,
      action: RecommendationAction.REVIEW,
      confidence: result.confidenceScore / 100,
      reasoning: `Manual Review Needed: ${result.reasoning} Please review to determine if this note should be kept or removed.`,
      impact: ImpactLevel.LOW,
      reversible: true,
      timestamp: new Date(),
      status: RecommendationStatus.PENDING
    };
  }  /**

   * Create summary of junk detection analysis
   */
  private createSummary(results: JunkDetectionResult[], notes: Note[], processingTime: number): JunkDetectionSummary {
    const junkResults = results.filter(r => r.isJunk);
    const categoryCounts = new Map<JunkNoteCategory, number>();
    const confidenceDistribution = new Map<JunkConfidence, number>();
    
    // Count categories and confidence levels
    for (const result of results) {
      if (result.category) {
        categoryCounts.set(result.category, (categoryCounts.get(result.category) || 0) + 1);
      }
      confidenceDistribution.set(result.confidence, (confidenceDistribution.get(result.confidence) || 0) + 1);
    }
    
    // Estimate storage savings (rough calculation)
    const junkNoteIds = new Set(junkResults.map(r => r.noteId));
    const junkNotes = notes.filter(note => junkNoteIds.has(note.id));
    const estimatedStorageSavings = junkNotes.reduce((total, note) => {
      // Rough estimate: content length + metadata + attachments
      const contentSize = note.content.length * 2; // UTF-16 encoding
      const attachmentSize = note.attachments.reduce((sum, att) => sum + att.size, 0);
      return total + contentSize + attachmentSize + 1000; // 1KB for metadata
    }, 0);
    
    return {
      totalNotesAnalyzed: results.length,
      junkNotesFound: junkResults.length,
      categoryCounts,
      confidenceDistribution,
      estimatedStorageSavings,
      processingTime
    };
  }

  /**
   * Check if result meets confidence threshold
   */
  private meetsConfidenceThreshold(confidence: JunkConfidence): boolean {
    const thresholdOrder = [JunkConfidence.UNCERTAIN, JunkConfidence.LOW, JunkConfidence.MEDIUM, JunkConfidence.HIGH];
    const resultIndex = thresholdOrder.indexOf(confidence);
    const thresholdIndex = thresholdOrder.indexOf(this.config.confidenceThreshold);
    
    return resultIndex >= thresholdIndex;
  }

  /**
   * Get human-readable description for junk category
   */
  private getCategoryDescription(category?: JunkNoteCategory): string | null {
    if (!category) return null;
    
    const descriptions = {
      [JunkNoteCategory.SHOPPING_LIST]: 'shopping or grocery list',
      [JunkNoteCategory.SCRATCH_PAD]: 'scratch pad or test content',
      [JunkNoteCategory.EXPIRED_REMINDER]: 'expired reminder or outdated information',
      [JunkNoteCategory.EMPTY_NOTE]: 'empty or minimal content note',
      [JunkNoteCategory.TEMPORARY_LIST]: 'temporary list',
      [JunkNoteCategory.COMPLETED_TASK]: 'completed task or checklist',
      [JunkNoteCategory.OUTDATED_INFO]: 'outdated or abandoned content'
    };
    
    return descriptions[category] || null;
  }

  /**
   * Create a disabled result when auto-detection is off
   */
  private createDisabledResult(note: Note): JunkDetectionResult {
    return {
      noteId: note.id,
      isJunk: false,
      confidence: JunkConfidence.UNCERTAIN,
      confidenceScore: 0,
      indicators: [],
      reasoning: 'Junk detection is disabled',
      requiresManualReview: false,
      timestamp: new Date()
    };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<JunkDetectionConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   */
  getConfig(): JunkDetectionConfig {
    return { ...this.config };
  }

  /**
   * Get statistics about junk detection performance
   */
  getStatistics(results: JunkDetectionResult[]): {
    totalAnalyzed: number;
    junkFound: number;
    highConfidenceJunk: number;
    manualReviewNeeded: number;
    categoryBreakdown: { [key: string]: number };
  } {
    const junkResults = results.filter(r => r.isJunk);
    const highConfidenceJunk = junkResults.filter(r => r.confidence === JunkConfidence.HIGH).length;
    const manualReviewNeeded = results.filter(r => r.requiresManualReview).length;
    
    const categoryBreakdown: { [key: string]: number } = {};
    for (const result of results) {
      if (result.category) {
        categoryBreakdown[result.category] = (categoryBreakdown[result.category] || 0) + 1;
      }
    }
    
    return {
      totalAnalyzed: results.length,
      junkFound: junkResults.length,
      highConfidenceJunk,
      manualReviewNeeded,
      categoryBreakdown
    };
  }
}