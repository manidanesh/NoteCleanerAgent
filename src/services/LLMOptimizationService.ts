import { LLMRequest, LLMResponse, LLMRequestType } from '../models/LLMModels';
import { Note } from '../models/Note';
import { LLMService } from './LLMService';

/**
 * Optimized LLM request that combines multiple analysis types
 */
export interface OptimizedLLMRequest {
  noteId: string;
  content: string;
  title: string;
  requestedAnalyses: AnalysisType[];
  priority: RequestPriority;
}

/**
 * Types of analysis that can be performed
 */
export enum AnalysisType {
  CONTENT_EXTRACTION = 'content_extraction',
  UTILITY_SCORING = 'utility_scoring', 
  TITLE_ANALYSIS = 'title_analysis',
  FOLDER_SUGGESTION = 'folder_suggestion',
  SEMANTIC_ANALYSIS = 'semantic_analysis'
}

/**
 * Request priority levels
 */
export enum RequestPriority {
  LOW = 0,
  NORMAL = 1,
  HIGH = 2,
  CRITICAL = 3
}

/**
 * Comprehensive analysis result
 */
export interface ComprehensiveAnalysis {
  noteId: string;
  contentAnalysis?: {
    topics: string[];
    entities: any[];
    contentType: string;
    actionItems: string[];
    summary: string;
  };
  utilityAssessment?: {
    score: number;
    reasoning: string;
    confidence: number;
  };
  titleAnalysis?: {
    isGeneric: boolean;
    suggestedTitle?: string;
    reasoning?: string;
  };
  folderSuggestion?: {
    suggestedFolder: string;
    reasoning: string;
    confidence: number;
  };
  processingTime: number;
  tokensUsed: number;
}

/**
 * LLM Optimization Service - Reduces LLM calls and improves performance
 */
export class LLMOptimizationService {
  private llmService: LLMService;
  private requestCache: Map<string, ComprehensiveAnalysis> = new Map();
  private batchQueue: OptimizedLLMRequest[] = [];
  private isProcessingBatch = false;
  private batchTimeout?: NodeJS.Timeout;
  private readonly BATCH_SIZE = 3;
  private readonly BATCH_DELAY = 500; // ms

  constructor(llmService: LLMService) {
    this.llmService = llmService;
  }

  /**
   * Request comprehensive analysis for a note
   */
  async requestAnalysis(
    note: Note, 
    analyses: AnalysisType[], 
    priority: RequestPriority = RequestPriority.NORMAL
  ): Promise<ComprehensiveAnalysis> {
    const cacheKey = this.generateCacheKey(note.id, analyses);
    
    // Check cache first
    const cached = this.requestCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Create optimized request
    const request: OptimizedLLMRequest = {
      noteId: note.id,
      content: note.content.substring(0, 2000), // Reasonable limit
      title: note.title,
      requestedAnalyses: analyses,
      priority
    };

    // For high priority requests, process immediately
    if (priority >= RequestPriority.HIGH) {
      return await this.processImmediately(request);
    }

    // Otherwise, add to batch queue
    return await this.addToBatch(request);
  }

  /**
   * Process a single request immediately (for high priority)
   */
  private async processImmediately(request: OptimizedLLMRequest): Promise<ComprehensiveAnalysis> {
    const startTime = Date.now();
    
    try {
      const llmRequest = this.createOptimizedLLMRequest(request);
      const response = await this.llmService.processRequest(llmRequest);
      
      const analysis = this.parseComprehensiveResponse(
        request.noteId,
        response,
        request.requestedAnalyses,
        Date.now() - startTime
      );

      // Cache the result
      const cacheKey = this.generateCacheKey(request.noteId, request.requestedAnalyses);
      this.requestCache.set(cacheKey, analysis);

      return analysis;
    } catch (error) {
      console.error('Immediate LLM processing failed:', error);
      return this.createFallbackAnalysis(request, Date.now() - startTime);
    }
  }

  /**
   * Add request to batch queue
   */
  private async addToBatch(request: OptimizedLLMRequest): Promise<ComprehensiveAnalysis> {
    return new Promise((resolve, reject) => {
      // Add resolve/reject to request for later callback
      (request as any).resolve = resolve;
      (request as any).reject = reject;
      
      this.batchQueue.push(request);
      
      // Start batch processing if queue is full or set timeout
      if (this.batchQueue.length >= this.BATCH_SIZE) {
        this.processBatch();
      } else if (!this.batchTimeout) {
        this.batchTimeout = setTimeout(() => {
          this.processBatch();
        }, this.BATCH_DELAY);
      }
    });
  }

  /**
   * Process queued requests in batch
   */
  private async processBatch(): Promise<void> {
    if (this.isProcessingBatch || this.batchQueue.length === 0) {
      return;
    }

    this.isProcessingBatch = true;
    
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = undefined;
    }

    const batch = this.batchQueue.splice(0, this.BATCH_SIZE);
    const startTime = Date.now();

    try {
      // Create single batched LLM request
      const batchedRequest = this.createBatchedLLMRequest(batch);
      const response = await this.llmService.processRequest(batchedRequest);
      
      // Parse and distribute results
      const results = this.parseBatchedResponse(batch, response, Date.now() - startTime);
      
      // Resolve all promises and cache results
      batch.forEach((request, index) => {
        const analysis = results[index];
        const cacheKey = this.generateCacheKey(request.noteId, request.requestedAnalyses);
        this.requestCache.set(cacheKey, analysis);
        
        (request as any).resolve(analysis);
      });

    } catch (error) {
      console.error('Batch LLM processing failed:', error);
      
      // Resolve with fallback analyses
      batch.forEach(request => {
        const fallback = this.createFallbackAnalysis(request, Date.now() - startTime);
        (request as any).resolve(fallback);
      });
    } finally {
      this.isProcessingBatch = false;
      
      // Process next batch if queue has items
      if (this.batchQueue.length > 0) {
        setTimeout(() => this.processBatch(), 100);
      }
    }
  }

  /**
   * Create optimized LLM request for single note
   */
  private createOptimizedLLMRequest(request: OptimizedLLMRequest): LLMRequest {
    const prompt = this.buildComprehensivePrompt(request);
    
    return {
      agentId: 'llm-optimization-service',
      requestType: LLMRequestType.CONTENT_ANALYSIS,
      context: 'Comprehensive note analysis',
      noteContent: request.content,
      systemPrompt: 'You are an AI assistant that performs comprehensive note analysis efficiently.',
      userPrompt: prompt,
      maxTokens: 400, // Reduced from multiple 150-500 token requests
      temperature: 0.3
    };
  }

  /**
   * Create batched LLM request for multiple notes
   */
  private createBatchedLLMRequest(batch: OptimizedLLMRequest[]): LLMRequest {
    const batchPrompt = batch.map((request, index) => {
      const prompt = this.buildComprehensivePrompt(request);
      return `[NOTE ${index + 1}]
Title: "${request.title}"
Content: "${request.content.substring(0, 800)}"

${prompt}`;
    }).join('\n\n---\n\n');

    return {
      agentId: 'llm-optimization-service',
      requestType: LLMRequestType.CONTENT_ANALYSIS,
      context: 'Batch note analysis',
      noteContent: '',
      systemPrompt: 'You are an AI assistant that performs comprehensive note analysis efficiently. Process each note separately and provide results in the same order.',
      userPrompt: `${batchPrompt}

Respond with results for each note in order, clearly separated.`,
      maxTokens: Math.min(2048, batch.length * 400), // Scale with batch size
      temperature: 0.3
    };
  }

  /**
   * Build comprehensive prompt based on requested analyses
   */
  private buildComprehensivePrompt(request: OptimizedLLMRequest): string {
    const analyses = request.requestedAnalyses;
    const parts: string[] = [];

    if (analyses.includes(AnalysisType.CONTENT_EXTRACTION)) {
      parts.push(`1. CONTENT ANALYSIS:
- Primary topics (max 3)
- Content type (meeting_notes, idea, task_list, reference, journal, scratch_pad, shopping_list, other)
- Key action items
- Brief summary (1 sentence)`);
    }

    if (analyses.includes(AnalysisType.UTILITY_SCORING)) {
      parts.push(`2. UTILITY SCORE:
- Rate utility 0-100 based on completeness, relevance, uniqueness, actionability
- Brief reasoning`);
    }

    if (analyses.includes(AnalysisType.TITLE_ANALYSIS)) {
      parts.push(`3. TITLE ANALYSIS:
- Is title generic/unclear? (yes/no)
- Suggest better title if needed (3-8 words)
- Brief reasoning`);
    }

    if (analyses.includes(AnalysisType.FOLDER_SUGGESTION)) {
      parts.push(`4. FOLDER SUGGESTION:
- Best folder category (Work, Personal, Ideas, Reference, Tasks, etc.)
- Brief reasoning`);
    }

    const prompt = parts.join('\n\n');
    return `${prompt}

Respond concisely in structured format.`;
  }

  /**
   * Parse comprehensive response for single note
   */
  private parseComprehensiveResponse(
    noteId: string,
    response: LLMResponse,
    requestedAnalyses: AnalysisType[],
    processingTime: number
  ): ComprehensiveAnalysis {
    const text = response.response;
    const analysis: ComprehensiveAnalysis = {
      noteId,
      processingTime,
      tokensUsed: response.tokensUsed
    };

    try {
      if (requestedAnalyses.includes(AnalysisType.CONTENT_EXTRACTION)) {
        analysis.contentAnalysis = this.parseContentAnalysis(text);
      }

      if (requestedAnalyses.includes(AnalysisType.UTILITY_SCORING)) {
        analysis.utilityAssessment = this.parseUtilityAssessment(text);
      }

      if (requestedAnalyses.includes(AnalysisType.TITLE_ANALYSIS)) {
        analysis.titleAnalysis = this.parseTitleAnalysis(text);
      }

      if (requestedAnalyses.includes(AnalysisType.FOLDER_SUGGESTION)) {
        analysis.folderSuggestion = this.parseFolderSuggestion(text);
      }
    } catch (error) {
      console.warn('Failed to parse LLM response, using fallbacks:', error);
    }

    return analysis;
  }

  /**
   * Parse batched response for multiple notes
   */
  private parseBatchedResponse(
    batch: OptimizedLLMRequest[],
    response: LLMResponse,
    processingTime: number
  ): ComprehensiveAnalysis[] {
    const text = response.response;
    const results: ComprehensiveAnalysis[] = [];
    
    // Split response by note sections
    const sections = text.split(/\[NOTE \d+\]|\-\-\-/).filter(s => s.trim());
    
    batch.forEach((request, index) => {
      const sectionText = sections[index + 1] || sections[0] || text; // +1 to skip first empty section
      
      try {
        const analysis = this.parseComprehensiveResponse(
          request.noteId,
          { ...response, response: sectionText },
          request.requestedAnalyses,
          processingTime / batch.length
        );
        results.push(analysis);
      } catch (error) {
        results.push(this.createFallbackAnalysis(request, processingTime / batch.length));
      }
    });

    return results;
  }

  /**
   * Parse content analysis from LLM response
   */
  private parseContentAnalysis(text: string): any {
    const topicsMatch = text.match(/topics?[:\-\s]+(.*?)(?:\n|$)/i);
    const typeMatch = text.match(/type[:\-\s]+(.*?)(?:\n|$)/i);
    const summaryMatch = text.match(/summary[:\-\s]+(.*?)(?:\n|$)/i);
    
    return {
      topics: topicsMatch ? topicsMatch[1].split(',').map(t => t.trim()).slice(0, 3) : ['general'],
      entities: [],
      contentType: typeMatch ? typeMatch[1].trim() : 'other',
      actionItems: [],
      summary: summaryMatch ? summaryMatch[1].trim() : 'Content analyzed'
    };
  }

  /**
   * Parse utility assessment from LLM response
   */
  private parseUtilityAssessment(text: string): any {
    const scoreMatch = text.match(/(?:utility|score)[:\-\s]*(\d+)/i);
    const reasoningMatch = text.match(/reasoning[:\-\s]+(.*?)(?:\n|$)/i);
    
    return {
      score: scoreMatch ? Math.min(100, Math.max(0, parseInt(scoreMatch[1]))) : 50,
      reasoning: reasoningMatch ? reasoningMatch[1].trim() : 'Utility assessed',
      confidence: 0.7
    };
  }

  /**
   * Parse title analysis from LLM response
   */
  private parseTitleAnalysis(text: string): any {
    const genericMatch = text.match(/generic[:\-\s]+(yes|no)/i);
    const titleMatch = text.match(/(?:suggest|title)[:\-\s]+(.*?)(?:\n|$)/i);
    const reasoningMatch = text.match(/reasoning[:\-\s]+(.*?)(?:\n|$)/i);
    
    return {
      isGeneric: genericMatch ? genericMatch[1].toLowerCase() === 'yes' : false,
      suggestedTitle: titleMatch ? titleMatch[1].trim().replace(/['"]/g, '') : undefined,
      reasoning: reasoningMatch ? reasoningMatch[1].trim() : undefined
    };
  }

  /**
   * Parse folder suggestion from LLM response
   */
  private parseFolderSuggestion(text: string): any {
    const folderMatch = text.match(/folder[:\-\s]+(.*?)(?:\n|$)/i);
    const reasoningMatch = text.match(/reasoning[:\-\s]+(.*?)(?:\n|$)/i);
    
    return {
      suggestedFolder: folderMatch ? folderMatch[1].trim() : 'General',
      reasoning: reasoningMatch ? reasoningMatch[1].trim() : 'Content-based suggestion',
      confidence: 0.7
    };
  }

  /**
   * Create fallback analysis when LLM fails
   */
  private createFallbackAnalysis(request: OptimizedLLMRequest, processingTime: number): ComprehensiveAnalysis {
    const analysis: ComprehensiveAnalysis = {
      noteId: request.noteId,
      processingTime,
      tokensUsed: 0
    };

    if (request.requestedAnalyses.includes(AnalysisType.CONTENT_EXTRACTION)) {
      analysis.contentAnalysis = {
        topics: ['general'],
        entities: [],
        contentType: 'other',
        actionItems: [],
        summary: 'Fallback analysis'
      };
    }

    if (request.requestedAnalyses.includes(AnalysisType.UTILITY_SCORING)) {
      analysis.utilityAssessment = {
        score: 50,
        reasoning: 'Fallback scoring',
        confidence: 0.3
      };
    }

    if (request.requestedAnalyses.includes(AnalysisType.TITLE_ANALYSIS)) {
      analysis.titleAnalysis = {
        isGeneric: false,
        suggestedTitle: undefined,
        reasoning: undefined
      };
    }

    if (request.requestedAnalyses.includes(AnalysisType.FOLDER_SUGGESTION)) {
      analysis.folderSuggestion = {
        suggestedFolder: 'General',
        reasoning: 'Fallback suggestion',
        confidence: 0.3
      };
    }

    return analysis;
  }

  /**
   * Generate cache key for request
   */
  private generateCacheKey(noteId: string, analyses: AnalysisType[]): string {
    return `${noteId}_${analyses.sort().join('_')}`;
  }

  /**
   * Clear cache (for memory management)
   */
  clearCache(): void {
    this.requestCache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; hitRate: number } {
    return {
      size: this.requestCache.size,
      hitRate: 0.8 // Would track actual hit rate in real implementation
    };
  }
}