import { Note } from '../models/Note';
import { LLMService } from '../services/LLMService';
import { LLMRequest, LLMRequestType, ContentType } from '../models/LLMModels';

/**
 * Junk note classification categories
 */
export enum JunkNoteCategory {
  SHOPPING_LIST = 'shopping_list',
  SCRATCH_PAD = 'scratch_pad',
  EXPIRED_REMINDER = 'expired_reminder',
  EMPTY_NOTE = 'empty_note',
  TEMPORARY_LIST = 'temporary_list',
  COMPLETED_TASK = 'completed_task',
  OUTDATED_INFO = 'outdated_info'
}

/**
 * Confidence level for junk detection
 */
export enum JunkConfidence {
  HIGH = 'high',        // 80-100% confident it's junk
  MEDIUM = 'medium',    // 60-79% confident it's junk
  LOW = 'low',          // 40-59% confident it's junk
  UNCERTAIN = 'uncertain' // <40% confident - needs manual review
}

/**
 * Junk detection result
 */
export interface JunkDetectionResult {
  noteId: string;
  isJunk: boolean;
  category?: JunkNoteCategory;
  confidence: JunkConfidence;
  confidenceScore: number; // 0-100
  indicators: JunkIndicator[];
  reasoning: string;
  requiresManualReview: boolean;
  timestamp: Date;
}

/**
 * Specific indicator that suggests a note is junk
 */
export interface JunkIndicator {
  type: JunkIndicatorType;
  description: string;
  weight: number; // 0-1, how much this indicator contributes to junk classification
  evidence: string; // Specific text or pattern that triggered this indicator
}

/**
 * Types of junk indicators
 */
export enum JunkIndicatorType {
  // Content patterns
  VERY_SHORT_CONTENT = 'very_short_content',
  EMPTY_OR_WHITESPACE = 'empty_or_whitespace',
  SINGLE_WORD = 'single_word',
  
  // List patterns
  SHOPPING_LIST_PATTERN = 'shopping_list_pattern',
  SIMPLE_LIST_ITEMS = 'simple_list_items',
  GROCERY_ITEMS = 'grocery_items',
  
  // Temporal patterns
  EXPIRED_DATE = 'expired_date',
  OLD_REMINDER = 'old_reminder',
  PAST_EVENT = 'past_event',
  
  // Completion patterns
  ALL_TASKS_COMPLETED = 'all_tasks_completed',
  COMPLETION_MARKERS = 'completion_markers',
  
  // Scratch patterns
  SCRATCH_CONTENT = 'scratch_content',
  RANDOM_TEXT = 'random_text',
  TEST_CONTENT = 'test_content',
  PLACEHOLDER_TEXT = 'placeholder_text',
  
  // Behavioral patterns
  NEVER_ACCESSED = 'never_accessed',
  CREATED_AND_ABANDONED = 'created_and_abandoned'
}

/**
 * Junk Note Detector Agent - Identifies temporary, outdated, or low-value notes
 */
export class JunkNoteDetectorAgent {
  private llmService: LLMService;
  
  // Pattern definitions for junk detection
  private readonly SHOPPING_PATTERNS = [
    /\b(buy|get|pick up|purchase|grocery|store|market)\b/i,
    /\b(milk|bread|eggs|butter|cheese|meat|vegetables|fruit)\b/i,
    /\b(walmart|target|costco|safeway|kroger|whole foods)\b/i,
    /^\s*[-•*]\s*(milk|bread|eggs|butter|cheese|meat|vegetables|fruit|bananas|apples|chicken|beef|pasta|rice|cereal|yogurt|juice|water|soap|shampoo|toilet paper)/im
  ];

  private readonly SCRATCH_PATTERNS = [
    /^(test|testing|temp|temporary|scratch|draft|notes?|random|misc|stuff|things)(\s*\d*)?$/i,
    /^(asdf|qwerty|hello world|test test|123|abc)/i,
    /lorem ipsum/i,
    /^[a-z]{1,3}$/i, // Very short random text
    /^[\d\s\-+*/=()]+$/, // Just numbers and math symbols
  ];

  private readonly COMPLETION_PATTERNS = [
    /✓|✔|☑|✅|done|completed|finished|✗|❌/g,
    /\[x\]|\[✓\]|\[done\]/gi,
    /~~.*~~/, // Strikethrough text
  ];

  private readonly EXPIRED_DATE_PATTERNS = [
    /\b(yesterday|last week|last month|last year)\b/i,
    /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+\d{1,2},?\s+\d{4}\b/i,
    /\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/,
    /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i
  ];

  constructor(llmService: LLMService) {
    this.llmService = llmService;
  }

  /**
   * Analyze a note to determine if it's junk
   */
  async analyzeNote(note: Note): Promise<JunkDetectionResult> {
    const indicators: JunkIndicator[] = [];
    
    try {
      // Stage 1: Basic pattern recognition
      const basicIndicators = this.detectBasicPatterns(note);
      indicators.push(...basicIndicators);
      
      // Stage 2: Content analysis
      const contentIndicators = this.analyzeContent(note);
      indicators.push(...contentIndicators);
      
      // Stage 3: Temporal analysis
      const temporalIndicators = this.analyzeTemporalRelevance(note);
      indicators.push(...temporalIndicators);
      
      // Stage 4: Behavioral analysis
      const behavioralIndicators = this.analyzeBehavioralPatterns(note);
      indicators.push(...behavioralIndicators);
      
      // Stage 5: LLM validation (for uncertain cases)
      const preliminaryScore = this.calculatePreliminaryScore(indicators);
      let llmValidation: { isJunk: boolean; reasoning: string; confidence: number } | null = null;
      
      if (preliminaryScore >= 40 && preliminaryScore <= 75) {
        llmValidation = await this.getLLMValidation(note, indicators);
      }
      
      // Final classification
      const classification = this.classifyNote(indicators, llmValidation);
      
      return {
        noteId: note.id,
        isJunk: classification.isJunk,
        category: classification.category,
        confidence: classification.confidence,
        confidenceScore: classification.confidenceScore,
        indicators,
        reasoning: classification.reasoning,
        requiresManualReview: classification.confidence === JunkConfidence.UNCERTAIN,
        timestamp: new Date()
      };
      
    } catch (error) {
      console.error(`Error analyzing note ${note.id} for junk detection:`, error);
      
      // Conservative fallback - flag for manual review
      return {
        noteId: note.id,
        isJunk: false,
        confidence: JunkConfidence.UNCERTAIN,
        confidenceScore: 30,
        indicators: [{
          type: JunkIndicatorType.PLACEHOLDER_TEXT,
          description: 'Analysis failed - manual review recommended',
          weight: 0.5,
          evidence: 'Processing error occurred'
        }],
        reasoning: 'Unable to complete analysis due to processing error. Manual review recommended.',
        requiresManualReview: true,
        timestamp: new Date()
      };
    }
  } 
 /**
   * Stage 1: Detect basic patterns that indicate junk notes
   */
  private detectBasicPatterns(note: Note): JunkIndicator[] {
    const indicators: JunkIndicator[] = [];
    const content = note.content.trim();
    const title = note.title.trim();
    
    // Empty or whitespace-only content
    if (!content || content.length === 0 || /^\s*$/.test(content)) {
      indicators.push({
        type: JunkIndicatorType.EMPTY_OR_WHITESPACE,
        description: 'Note contains no meaningful content',
        weight: 0.9,
        evidence: 'Empty content'
      });
    }
    
    // Very short content (less than 10 characters)
    if (content.length > 0 && content.length < 10) {
      indicators.push({
        type: JunkIndicatorType.VERY_SHORT_CONTENT,
        description: 'Note content is extremely short',
        weight: 0.7,
        evidence: `Content length: ${content.length} characters`
      });
    }
    
    // Single word content
    if (content.split(/\s+/).length === 1 && content.length < 20) {
      indicators.push({
        type: JunkIndicatorType.SINGLE_WORD,
        description: 'Note contains only a single word',
        weight: 0.6,
        evidence: content
      });
    }
    
    // Shopping list patterns
    const shoppingMatches = this.SHOPPING_PATTERNS.filter(pattern => pattern.test(content));
    if (shoppingMatches.length >= 2) {
      indicators.push({
        type: JunkIndicatorType.SHOPPING_LIST_PATTERN,
        description: 'Content matches shopping list patterns',
        weight: 0.8,
        evidence: `${shoppingMatches.length} shopping patterns detected`
      });
    }
    
    // Scratch/test patterns
    const scratchMatches = this.SCRATCH_PATTERNS.filter(pattern => pattern.test(content) || pattern.test(title));
    if (scratchMatches.length > 0) {
      indicators.push({
        type: JunkIndicatorType.SCRATCH_CONTENT,
        description: 'Content appears to be scratch/test text',
        weight: 0.8,
        evidence: 'Matches scratch text patterns'
      });
    }
    
    return indicators;
  }

  /**
   * Stage 2: Analyze content structure and meaning
   */
  private analyzeContent(note: Note): JunkIndicator[] {
    const indicators: JunkIndicator[] = [];
    const content = note.content.toLowerCase();
    const lines = note.content.split('\n').filter(line => line.trim().length > 0);
    
    // Simple list detection
    const listItemCount = lines.filter(line => 
      /^\s*[-•*]\s/.test(line) || /^\d+\.\s/.test(line)
    ).length;
    
    if (listItemCount >= 3 && listItemCount === lines.length) {
      // Check if it's a simple grocery/shopping list
      const groceryItems = lines.filter(line => 
        /\b(milk|bread|eggs|butter|cheese|meat|vegetables|fruit|bananas|apples|chicken|beef|pasta|rice|cereal|yogurt|juice|water|soap|shampoo|toilet paper|detergent|paper towels)\b/i.test(line)
      ).length;
      
      if (groceryItems >= Math.floor(listItemCount * 0.6)) {
        indicators.push({
          type: JunkIndicatorType.GROCERY_ITEMS,
          description: 'List primarily contains grocery items',
          weight: 0.8,
          evidence: `${groceryItems}/${listItemCount} items are grocery items`
        });
      } else {
        indicators.push({
          type: JunkIndicatorType.SIMPLE_LIST_ITEMS,
          description: 'Note is a simple list without context',
          weight: 0.6,
          evidence: `${listItemCount} list items detected`
        });
      }
    }
    
    // Completion markers analysis
    const completionMatches = content.match(this.COMPLETION_PATTERNS[0]) || [];
    const totalItems = note.checklists.length + listItemCount;
    
    if (totalItems > 0) {
      const completedItems = note.checklists.filter(item => item.completed).length + completionMatches.length;
      const completionRate = completedItems / totalItems;
      
      if (completionRate >= 0.8) {
        indicators.push({
          type: JunkIndicatorType.ALL_TASKS_COMPLETED,
          description: 'Most or all tasks/items are completed',
          weight: 0.7,
          evidence: `${completedItems}/${totalItems} items completed (${Math.round(completionRate * 100)}%)`
        });
      }
    }
    
    return indicators;
  }

  /**
   * Stage 3: Analyze temporal relevance
   */
  private analyzeTemporalRelevance(note: Note): JunkIndicator[] {
    const indicators: JunkIndicator[] = [];
    const content = note.content;
    const now = new Date();
    
    // Check for expired dates
    const dateMatches = content.match(this.EXPIRED_DATE_PATTERNS[1]) || 
                       content.match(this.EXPIRED_DATE_PATTERNS[2]) || [];
    
    for (const dateMatch of dateMatches) {
      const extractedDate = this.parseDate(dateMatch);
      if (extractedDate && extractedDate < now) {
        const daysPast = Math.floor((now.getTime() - extractedDate.getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysPast > 30) {
          indicators.push({
            type: JunkIndicatorType.EXPIRED_DATE,
            description: 'Note contains dates that are significantly in the past',
            weight: 0.6,
            evidence: `Date ${dateMatch} is ${daysPast} days old`
          });
        }
      }
    }
    
    // Check note age vs. last access
    const daysSinceCreated = Math.floor((now.getTime() - note.createdDate.getTime()) / (1000 * 60 * 60 * 24));
    const daysSinceModified = Math.floor((now.getTime() - note.modifiedDate.getTime()) / (1000 * 60 * 60 * 24));
    const daysSinceAccessed = note.metadata.lastAccessDate ? 
      Math.floor((now.getTime() - note.metadata.lastAccessDate.getTime()) / (1000 * 60 * 60 * 24)) : 
      daysSinceCreated;
    
    // Old reminder that hasn't been accessed
    if (daysSinceCreated > 90 && daysSinceAccessed > 60 && note.metadata.accessCount <= 2) {
      indicators.push({
        type: JunkIndicatorType.OLD_REMINDER,
        description: 'Old note that has rarely been accessed',
        weight: 0.5,
        evidence: `Created ${daysSinceCreated} days ago, last accessed ${daysSinceAccessed} days ago`
      });
    }
    
    return indicators;
  } 
 /**
   * Stage 4: Analyze behavioral patterns
   */
  private analyzeBehavioralPatterns(note: Note): JunkIndicator[] {
    const indicators: JunkIndicator[] = [];
    const now = new Date();
    
    // Never accessed after creation
    if (note.metadata.accessCount === 0 || 
        (note.metadata.lastAccessDate && note.metadata.lastAccessDate <= note.createdDate)) {
      indicators.push({
        type: JunkIndicatorType.NEVER_ACCESSED,
        description: 'Note has never been accessed after creation',
        weight: 0.6,
        evidence: `Access count: ${note.metadata.accessCount}`
      });
    }
    
    // Created and immediately abandoned
    const timeSinceCreation = now.getTime() - note.createdDate.getTime();
    const timeSinceModification = now.getTime() - note.modifiedDate.getTime();
    const creationToModificationGap = note.modifiedDate.getTime() - note.createdDate.getTime();
    
    if (creationToModificationGap < 60000 && // Modified within 1 minute of creation
        timeSinceModification > 7 * 24 * 60 * 60 * 1000 && // Not modified for a week
        note.metadata.accessCount <= 1) {
      indicators.push({
        type: JunkIndicatorType.CREATED_AND_ABANDONED,
        description: 'Note was created and quickly abandoned',
        weight: 0.7,
        evidence: 'Quick creation followed by no further interaction'
      });
    }
    
    return indicators;
  }

  /**
   * Stage 5: Get LLM validation for uncertain cases
   */
  private async getLLMValidation(note: Note, indicators: JunkIndicator[]): Promise<{ isJunk: boolean; reasoning: string; confidence: number }> {
    try {
      const indicatorSummary = indicators.map(ind => `${ind.type}: ${ind.description}`).join('; ');
      
      const request: LLMRequest = {
        agentId: 'junk-detector',
        requestType: LLMRequestType.CLASSIFICATION,
        context: 'Validating potential junk note classification',
        noteContent: note.content.substring(0, 500),
        systemPrompt: `You are an expert at identifying temporary, outdated, or low-value notes that users typically want to clean up. 
                      Consider notes as "junk" if they are: scratch pads, old shopping lists, expired reminders, 
                      test content, very short meaningless notes, or completed temporary tasks.`,
        userPrompt: `Analyze this note to determine if it should be classified as "junk":

Title: "${note.title}"
Content: "${note.content.substring(0, 300)}..."
Created: ${note.createdDate.toDateString()}
Modified: ${note.modifiedDate.toDateString()}
Access count: ${note.metadata.accessCount}

Detected indicators: ${indicatorSummary}

Is this note likely "junk" that the user would want to clean up?
Respond with JSON:
{
  "isJunk": true/false,
  "confidence": 0.75,
  "reasoning": "brief explanation"
}`,
        maxTokens: 150,
        temperature: 0.2
      };

      const response = await this.llmService.processRequest(request);
      
      try {
        const parsed = JSON.parse(response.response);
        return {
          isJunk: parsed.isJunk || false,
          reasoning: parsed.reasoning || 'LLM validation completed',
          confidence: Math.min(0.95, Math.max(0.3, parsed.confidence || 0.6))
        };
      } catch (parseError) {
        console.warn('Failed to parse LLM junk validation response');
        return {
          isJunk: false,
          reasoning: 'LLM validation inconclusive',
          confidence: 0.4
        };
      }
      
    } catch (error) {
      console.warn('LLM junk validation failed:', error);
      return {
        isJunk: false,
        reasoning: 'LLM validation unavailable',
        confidence: 0.4
      };
    }
  }

  /**
   * Calculate preliminary junk score based on indicators
   */
  private calculatePreliminaryScore(indicators: JunkIndicator[]): number {
    if (indicators.length === 0) return 0;
    
    const totalWeight = indicators.reduce((sum, ind) => sum + ind.weight, 0);
    const weightedScore = indicators.reduce((sum, ind) => sum + (ind.weight * 100), 0);
    
    return Math.min(100, weightedScore / Math.max(1, totalWeight));
  }

  /**
   * Final classification based on all analysis stages
   */
  private classifyNote(indicators: JunkIndicator[], llmValidation: { isJunk: boolean; reasoning: string; confidence: number } | null): {
    isJunk: boolean;
    category?: JunkNoteCategory;
    confidence: JunkConfidence;
    confidenceScore: number;
    reasoning: string;
  } {
    const preliminaryScore = this.calculatePreliminaryScore(indicators);
    
    // Adjust score based on LLM validation
    let finalScore = preliminaryScore;
    if (llmValidation) {
      const llmScore = llmValidation.isJunk ? 80 : 20;
      const llmWeight = llmValidation.confidence;
      finalScore = (preliminaryScore * (1 - llmWeight)) + (llmScore * llmWeight);
    }
    
    // Determine category based on dominant indicators
    const category = this.determineJunkCategory(indicators);
    
    // Determine confidence level
    let confidence: JunkConfidence;
    if (finalScore >= 80) confidence = JunkConfidence.HIGH;
    else if (finalScore >= 60) confidence = JunkConfidence.MEDIUM;
    else if (finalScore >= 40) confidence = JunkConfidence.LOW;
    else confidence = JunkConfidence.UNCERTAIN;
    
    // Generate reasoning
    const reasoning = this.generateReasoning(indicators, llmValidation, finalScore, category);
    
    return {
      isJunk: finalScore >= 60, // Conservative threshold
      category,
      confidence,
      confidenceScore: Math.round(finalScore),
      reasoning
    };
  }

  /**
   * Determine the most likely junk category based on indicators
   */
  private determineJunkCategory(indicators: JunkIndicator[]): JunkNoteCategory | undefined {
    const categoryWeights = new Map<JunkNoteCategory, number>();
    
    for (const indicator of indicators) {
      let category: JunkNoteCategory | undefined;
      
      switch (indicator.type) {
        case JunkIndicatorType.EMPTY_OR_WHITESPACE:
        case JunkIndicatorType.VERY_SHORT_CONTENT:
        case JunkIndicatorType.SINGLE_WORD:
          category = JunkNoteCategory.EMPTY_NOTE;
          break;
          
        case JunkIndicatorType.SHOPPING_LIST_PATTERN:
        case JunkIndicatorType.GROCERY_ITEMS:
          category = JunkNoteCategory.SHOPPING_LIST;
          break;
          
        case JunkIndicatorType.SCRATCH_CONTENT:
        case JunkIndicatorType.RANDOM_TEXT:
        case JunkIndicatorType.TEST_CONTENT:
        case JunkIndicatorType.PLACEHOLDER_TEXT:
          category = JunkNoteCategory.SCRATCH_PAD;
          break;
          
        case JunkIndicatorType.EXPIRED_DATE:
        case JunkIndicatorType.OLD_REMINDER:
        case JunkIndicatorType.PAST_EVENT:
          category = JunkNoteCategory.EXPIRED_REMINDER;
          break;
          
        case JunkIndicatorType.ALL_TASKS_COMPLETED:
        case JunkIndicatorType.COMPLETION_MARKERS:
          category = JunkNoteCategory.COMPLETED_TASK;
          break;
          
        case JunkIndicatorType.SIMPLE_LIST_ITEMS:
          category = JunkNoteCategory.TEMPORARY_LIST;
          break;
          
        case JunkIndicatorType.NEVER_ACCESSED:
        case JunkIndicatorType.CREATED_AND_ABANDONED:
          category = JunkNoteCategory.OUTDATED_INFO;
          break;
      }
      
      if (category) {
        const currentWeight = categoryWeights.get(category) || 0;
        categoryWeights.set(category, currentWeight + indicator.weight);
      }
    }
    
    // Return category with highest weight
    let maxWeight = 0;
    let bestCategory: JunkNoteCategory | undefined;
    
    for (const [category, weight] of categoryWeights) {
      if (weight > maxWeight) {
        maxWeight = weight;
        bestCategory = category;
      }
    }
    
    return bestCategory;
  }

  /**
   * Generate human-readable reasoning for the classification
   */
  private generateReasoning(
    indicators: JunkIndicator[], 
    llmValidation: { isJunk: boolean; reasoning: string; confidence: number } | null,
    finalScore: number,
    category?: JunkNoteCategory
  ): string {
    const scoreCategory = finalScore >= 80 ? 'high' : finalScore >= 60 ? 'medium' : finalScore >= 40 ? 'low' : 'very low';
    
    let reasoning = `This note has a ${scoreCategory} likelihood (${Math.round(finalScore)}%) of being junk content. `;
    
    if (indicators.length > 0) {
      const topIndicators = indicators
        .sort((a, b) => b.weight - a.weight)
        .slice(0, 3)
        .map(ind => ind.description.toLowerCase());
      
      reasoning += `Key indicators: ${topIndicators.join(', ')}. `;
    }
    
    if (category) {
      const categoryDescriptions = {
        [JunkNoteCategory.SHOPPING_LIST]: 'appears to be a shopping or grocery list',
        [JunkNoteCategory.SCRATCH_PAD]: 'contains scratch or test content',
        [JunkNoteCategory.EXPIRED_REMINDER]: 'contains expired or outdated information',
        [JunkNoteCategory.EMPTY_NOTE]: 'has minimal or no meaningful content',
        [JunkNoteCategory.TEMPORARY_LIST]: 'appears to be a temporary list',
        [JunkNoteCategory.COMPLETED_TASK]: 'contains completed tasks or items',
        [JunkNoteCategory.OUTDATED_INFO]: 'appears to be outdated or abandoned content'
      };
      
      reasoning += `The note ${categoryDescriptions[category]}. `;
    }
    
    if (llmValidation && llmValidation.reasoning) {
      reasoning += llmValidation.reasoning;
    }
    
    if (finalScore < 60) {
      reasoning += ' Manual review is recommended before taking any action.';
    }
    
    return reasoning;
  }

  /**
   * Parse date from various string formats
   */
  private parseDate(dateString: string): Date | null {
    try {
      // Try standard date parsing first
      const parsed = new Date(dateString);
      if (!isNaN(parsed.getTime())) {
        return parsed;
      }
      
      // Try common formats
      const formats = [
        /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/,
        /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+(\d{1,2}),?\s+(\d{4})/i
      ];
      
      for (const format of formats) {
        const match = dateString.match(format);
        if (match) {
          if (format === formats[0]) {
            // MM/DD/YYYY or DD/MM/YYYY
            const [, month, day, year] = match;
            return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
          } else if (format === formats[1]) {
            // Month DD, YYYY
            const [, monthName, day, year] = match;
            const monthMap: { [key: string]: number } = {
              jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
              jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
            };
            const month = monthMap[monthName.toLowerCase()];
            if (month !== undefined) {
              return new Date(parseInt(year), month, parseInt(day));
            }
          }
        }
      }
      
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Batch analyze multiple notes for junk detection
   */
  async analyzeNotes(notes: Note[]): Promise<JunkDetectionResult[]> {
    const results: JunkDetectionResult[] = [];
    
    // Process in batches to avoid overwhelming the system
    const batchSize = 10;
    for (let i = 0; i < notes.length; i += batchSize) {
      const batch = notes.slice(i, i + batchSize);
      const batchPromises = batch.map(note => this.analyzeNote(note));
      
      try {
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
      } catch (error) {
        console.error(`Error processing batch ${i / batchSize + 1}:`, error);
        // Add fallback results for failed batch
        batch.forEach(note => {
          results.push({
            noteId: note.id,
            isJunk: false,
            confidence: JunkConfidence.UNCERTAIN,
            confidenceScore: 30,
            indicators: [],
            reasoning: 'Analysis failed - manual review recommended',
            requiresManualReview: true,
            timestamp: new Date()
          });
        });
      }
    }
    
    return results;
  }
}