import { Note, Attachment, ChecklistItem, AttachmentType, NoteMetadata } from '../models/Note';
import { LLMRequest, LLMRequestType, ContentAnalysis, Entity, EntityType, ContentType } from '../models';
import { LLMService } from '../services/LLMService';
import { LLMServiceImpl } from '../services/LLMService';
import { ErrorHandlingService, ErrorCategory } from '../services/ErrorHandlingService';

/**
 * Extracted content result from processing a note
 */
export interface ExtractedContent {
  normalizedText: string;
  ocrText?: string;
  imageMetadata: ImageMetadata[];
  attachmentContent: AttachmentContent[];
  checklists: ProcessedChecklist[];
  semanticAnalysis: ContentAnalysis;
  processingErrors: ProcessingError[];
}

/**
 * Image metadata extracted from note images
 */
export interface ImageMetadata {
  id: string;
  description: string;
  extractedText?: string;
  objects: string[];
  confidence: number;
}

/**
 * Content extracted from attachments
 */
export interface AttachmentContent {
  attachmentId: string;
  extractedText?: string;
  metadata: Record<string, any>;
  processingSuccess: boolean;
  error?: string;
}

/**
 * Processed checklist with preserved structure
 */
export interface ProcessedChecklist {
  id: string;
  items: ChecklistItem[];
  completionRate: number;
  structure: ChecklistStructure;
}

/**
 * Checklist structure information
 */
export interface ChecklistStructure {
  isNested: boolean;
  hasCategories: boolean;
  totalItems: number;
  completedItems: number;
}

/**
 * Processing error information
 */
export interface ProcessingError {
  component: string;
  error: string;
  severity: 'warning' | 'error';
  recoverable: boolean;
}

/**
 * Content Extractor Agent responsible for extracting and interpreting note content
 * including text, handwriting, images, and attachments
 */
export class ContentExtractorAgent {
  private llmService: LLMService;
  private errorHandlingService: ErrorHandlingService;
  private ocrEnabled: boolean = true;
  private imageAnalysisEnabled: boolean = true;

  constructor(llmService?: LLMService, errorHandlingService?: ErrorHandlingService) {
    this.llmService = llmService || new LLMServiceImpl({
      preferOnDevice: true,
      allowCloudWithConsent: false,
      fallbackToRules: true,
      privacyLevel: 'strict_on_device' as any
    });
    this.errorHandlingService = errorHandlingService || new ErrorHandlingService();
  }

  /**
   * Extract and process all content from a note
   */
  async extractContent(note: Note): Promise<ExtractedContent> {
    const errors: ProcessingError[] = [];
    
    try {
      // 1. Text processing and normalization
      const normalizedText = this.normalizeText(note.content);

      // 2. OCR processing for handwriting (if metadata indicates handwriting exists)
      let ocrText: string | undefined;
      if (note.metadata.hasHandwriting && this.ocrEnabled) {
        try {
          ocrText = await this.processHandwriting(note);
        } catch (error) {
          // Requirement 15.1: Graceful OCR failure handling with text-only fallback
          const errorInfo = this.errorHandlingService.handleOCRFailure(
            error as Error,
            note.id,
            normalizedText
          );
          
          errors.push({
            component: 'OCR',
            error: errorInfo.message,
            severity: 'warning',
            recoverable: true
          });
          
          // Continue with text-only content (fallback)
          console.warn(`OCR failed for note ${note.id}, continuing with text-only content`);
        }
      }

      // 3. Image analysis and metadata extraction
      let imageMetadata: ImageMetadata[] = [];
      if (note.metadata.hasImages && this.imageAnalysisEnabled) {
        try {
          imageMetadata = await this.analyzeImages(note);
        } catch (error) {
          errors.push({
            component: 'ImageAnalysis',
            error: `Image analysis failed: ${error}`,
            severity: 'warning',
            recoverable: true
          });
        }
      }

      // 4. Attachment processing
      let attachmentContent: AttachmentContent[] = [];
      if (note.attachments.length > 0) {
        try {
          attachmentContent = await this.processAttachments(note.attachments);
        } catch (error) {
          errors.push({
            component: 'AttachmentProcessing',
            error: `Attachment processing failed: ${error}`,
            severity: 'warning',
            recoverable: true
          });
        }
      }

      // 5. Checklist parsing with structure preservation
      let checklists: ProcessedChecklist[] = [];
      if (note.checklists.length > 0) {
        try {
          checklists = this.parseChecklists(note.checklists);
        } catch (error) {
          errors.push({
            component: 'ChecklistParser',
            error: `Checklist parsing failed: ${error}`,
            severity: 'error',
            recoverable: false
          });
        }
      }

      // 6. LLM-powered semantic content understanding
      let semanticAnalysis: ContentAnalysis;
      try {
        const combinedContent = this.combineAllContent(normalizedText, ocrText, imageMetadata, attachmentContent);
        semanticAnalysis = await this.performSemanticAnalysis(note, combinedContent);
      } catch (error) {
        errors.push({
          component: 'SemanticAnalysis',
          error: `Semantic analysis failed: ${error}`,
          severity: 'warning',
          recoverable: true
        });
        
        // Provide fallback semantic analysis
        semanticAnalysis = this.createFallbackAnalysis(normalizedText);
      }

      return {
        normalizedText,
        ocrText,
        imageMetadata,
        attachmentContent,
        checklists,
        semanticAnalysis,
        processingErrors: errors
      };

    } catch (error) {
      // Critical failure - return minimal result with error
      errors.push({
        component: 'ContentExtractor',
        error: `Critical extraction failure: ${error}`,
        severity: 'error',
        recoverable: false
      });

      return {
        normalizedText: note.content,
        imageMetadata: [],
        attachmentContent: [],
        checklists: [],
        semanticAnalysis: this.createFallbackAnalysis(note.content),
        processingErrors: errors
      };
    }
  }

  /**
   * Normalize and clean text content
   */
  private normalizeText(content: string): string {
    if (!content) return '';

    return content
      // Normalize whitespace
      .replace(/\s+/g, ' ')
      // Remove excessive line breaks
      .replace(/\n{3,}/g, '\n\n')
      // Trim leading/trailing whitespace
      .trim()
      // Normalize quotes
      .replace(/[""]/g, '"')
      .replace(/['']/g, "'")
      // Remove zero-width characters
      .replace(/[\u200B-\u200D\uFEFF]/g, '');
  }

  /**
   * Process handwritten content using OCR
   */
  private async processHandwriting(note: Note): Promise<string> {
    // In a real implementation, this would integrate with:
    // - Apple's Vision framework for iOS/macOS
    // - Tesseract OCR as fallback
    // - Cloud OCR services with user consent
    
    // For now, simulate OCR processing
    await new Promise(resolve => setTimeout(resolve, 100)); // Simulate processing time
    
    // Mock OCR result - in real implementation this would be actual OCR
    if (note.metadata.hasHandwriting) {
      return `[OCR: Handwritten content from note ${note.id}]`;
    }
    
    return '';
  }

  /**
   * Analyze images and extract metadata
   */
  private async analyzeImages(note: Note): Promise<ImageMetadata[]> {
    const imageMetadata: ImageMetadata[] = [];
    
    // In a real implementation, this would:
    // - Use Apple's Vision framework for object detection
    // - Extract text from images using OCR
    // - Analyze image content using Core ML models
    // - Generate descriptions using LLM
    
    // Mock image analysis for notes that have images
    if (note.metadata.hasImages) {
      // Simulate processing multiple images
      const imageCount = Math.min(3, Math.floor(Math.random() * 3) + 1);
      
      for (let i = 0; i < imageCount; i++) {
        imageMetadata.push({
          id: `img_${note.id}_${i}`,
          description: `Image ${i + 1} in note: contains visual content`,
          extractedText: `[Text extracted from image ${i + 1}]`,
          objects: ['document', 'text', 'diagram'],
          confidence: 0.85
        });
      }
    }
    
    return imageMetadata;
  }

  /**
   * Process various attachment types and extract content
   */
  private async processAttachments(attachments: Attachment[]): Promise<AttachmentContent[]> {
    const results: AttachmentContent[] = [];
    
    for (const attachment of attachments) {
      try {
        const content = await this.processAttachment(attachment);
        results.push(content);
      } catch (error) {
        results.push({
          attachmentId: attachment.id,
          processingSuccess: false,
          error: `Failed to process attachment: ${error}`,
          metadata: {}
        });
      }
    }
    
    return results;
  }

  /**
   * Process a single attachment based on its type
   */
  private async processAttachment(attachment: Attachment): Promise<AttachmentContent> {
    const result: AttachmentContent = {
      attachmentId: attachment.id,
      processingSuccess: false,
      metadata: {
        filename: attachment.filename,
        size: attachment.size,
        mimeType: attachment.mimeType
      }
    };

    try {
      switch (attachment.type) {
        case AttachmentType.PDF:
          result.extractedText = await this.extractPDFText(attachment);
          break;
          
        case AttachmentType.DOCUMENT:
          result.extractedText = await this.extractDocumentText(attachment);
          break;
          
        case AttachmentType.IMAGE:
          result.extractedText = await this.extractImageText(attachment);
          break;
          
        case AttachmentType.AUDIO:
          result.extractedText = await this.transcribeAudio(attachment);
          break;
          
        case AttachmentType.VIDEO:
          result.extractedText = await this.extractVideoText(attachment);
          break;
          
        default:
          result.extractedText = attachment.content || '';
      }
      
      result.processingSuccess = true;
      
    } catch (error) {
      result.error = `Processing failed: ${error}`;
    }
    
    return result;
  }

  /**
   * Extract text from PDF attachments
   */
  private async extractPDFText(attachment: Attachment): Promise<string> {
    // In real implementation: use PDF parsing libraries
    return attachment.content || `[PDF content from ${attachment.filename}]`;
  }

  /**
   * Extract text from document attachments
   */
  private async extractDocumentText(attachment: Attachment): Promise<string> {
    // In real implementation: use document parsing libraries for Word, etc.
    return attachment.content || `[Document content from ${attachment.filename}]`;
  }

  /**
   * Extract text from image attachments using OCR
   */
  private async extractImageText(attachment: Attachment): Promise<string> {
    // In real implementation: use OCR on image attachments
    return `[Text extracted from image ${attachment.filename}]`;
  }

  /**
   * Transcribe audio attachments to text
   */
  private async transcribeAudio(attachment: Attachment): Promise<string> {
    // In real implementation: use speech-to-text services
    return `[Audio transcription from ${attachment.filename}]`;
  }

  /**
   * Extract text from video attachments
   */
  private async extractVideoText(attachment: Attachment): Promise<string> {
    // In real implementation: extract audio and transcribe, or OCR video frames
    return `[Video content analysis from ${attachment.filename}]`;
  }

  /**
   * Parse checklists and preserve their structure
   */
  private parseChecklists(checklists: ChecklistItem[]): ProcessedChecklist[] {
    if (!checklists || checklists.length === 0) {
      return [];
    }

    // Group checklists by analyzing structure patterns
    const processedChecklists: ProcessedChecklist[] = [];
    
    // For simplicity, treat all items as one checklist
    // In real implementation, this would analyze indentation, categories, etc.
    const sortedItems = [...checklists].sort((a, b) => a.order - b.order);
    const completedItems = sortedItems.filter(item => item.completed).length;
    
    const structure: ChecklistStructure = {
      isNested: this.detectNestedStructure(sortedItems),
      hasCategories: this.detectCategories(sortedItems),
      totalItems: sortedItems.length,
      completedItems
    };

    processedChecklists.push({
      id: `checklist_${Date.now()}`,
      items: sortedItems,
      completionRate: completedItems / sortedItems.length,
      structure
    });

    return processedChecklists;
  }

  /**
   * Detect if checklist has nested structure
   */
  private detectNestedStructure(items: ChecklistItem[]): boolean {
    // Simple heuristic: look for indentation patterns in text
    return items.some(item => 
      item.text.startsWith('  ') || 
      item.text.startsWith('\t') ||
      item.text.includes('  -') ||
      item.text.includes('    ')
    );
  }

  /**
   * Detect if checklist has categories
   */
  private detectCategories(items: ChecklistItem[]): boolean {
    // Simple heuristic: look for category-like patterns
    return items.some(item => 
      item.text.includes(':') ||
      item.text.toUpperCase() === item.text ||
      /^[A-Z][a-z]+ [A-Z][a-z]+/.test(item.text)
    );
  }

  /**
   * Combine all extracted content for semantic analysis
   */
  private combineAllContent(
    normalizedText: string,
    ocrText?: string,
    imageMetadata?: ImageMetadata[],
    attachmentContent?: AttachmentContent[]
  ): string {
    let combined = normalizedText;
    
    if (ocrText) {
      combined += `\n\nHandwritten content: ${ocrText}`;
    }
    
    if (imageMetadata && imageMetadata.length > 0) {
      const imageTexts = imageMetadata
        .map(img => `${img.description}${img.extractedText ? ': ' + img.extractedText : ''}`)
        .join('\n');
      combined += `\n\nImage content: ${imageTexts}`;
    }
    
    if (attachmentContent && attachmentContent.length > 0) {
      const attachmentTexts = attachmentContent
        .filter(att => att.processingSuccess && att.extractedText)
        .map(att => att.extractedText)
        .join('\n');
      if (attachmentTexts) {
        combined += `\n\nAttachment content: ${attachmentTexts}`;
      }
    }
    
    return combined;
  }

  /**
   * Perform semantic analysis using LLM
   */
  private async performSemanticAnalysis(note: Note, combinedContent: string): Promise<ContentAnalysis> {
    const request: LLMRequest = {
      agentId: 'content-extractor',
      requestType: LLMRequestType.CONTENT_ANALYSIS,
      context: `Analyzing note: ${note.title}`,
      noteContent: combinedContent,
      systemPrompt: `You are a content analysis expert. Analyze the provided note content and extract structured information.`,
      userPrompt: `Analyze this note and identify:
1. Primary topics and themes (max 5)
2. Key entities (people, dates, locations, organizations, tasks, concepts)
3. Note type (meeting_notes, idea, task_list, reference, journal, scratch_pad, shopping_list, other)
4. Actionable items or tasks mentioned
5. Importance indicators (urgency words, deadlines, priorities)
6. Brief summary (2-3 sentences)

Note content: "${combinedContent.substring(0, 1000)}..."

Respond in a structured format.`,
      maxTokens: 500,
      temperature: 0.3
    };

    try {
      const response = await this.llmService.processRequest(request);
      return this.parseLLMAnalysis(response.response);
    } catch (error) {
      throw new Error(`LLM semantic analysis failed: ${error}`);
    }
  }

  /**
   * Parse LLM response into structured ContentAnalysis
   */
  private parseLLMAnalysis(llmResponse: string): ContentAnalysis {
    // In a real implementation, this would parse structured LLM output
    // For now, create a reasonable analysis from the response
    
    const topics = this.extractTopics(llmResponse);
    const entities = this.extractEntities(llmResponse);
    const contentType = this.determineContentType(llmResponse);
    const actionItems = this.extractActionItems(llmResponse);
    const importanceIndicators = this.extractImportanceIndicators(llmResponse);
    const summary = this.extractSummary(llmResponse);

    return {
      topics,
      entities,
      contentType,
      actionItems,
      importanceIndicators,
      summary
    };
  }

  /**
   * Extract topics from LLM response
   */
  private extractTopics(response: string): string[] {
    // Simple extraction - in real implementation would be more sophisticated
    const topicMatches = response.match(/topics?[:\-\s]+(.*?)(?:\n|$)/i);
    if (topicMatches) {
      return topicMatches[1]
        .split(/[,;]/)
        .map(topic => topic.trim())
        .filter(topic => topic.length > 0)
        .slice(0, 5);
    }
    return ['general'];
  }

  /**
   * Extract entities from LLM response
   */
  private extractEntities(response: string): Entity[] {
    // Simple extraction - in real implementation would use NER
    const entities: Entity[] = [];
    
    // Look for common entity patterns
    const datePattern = /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g;
    const dates = response.match(datePattern) || [];
    dates.forEach(date => {
      entities.push({
        type: EntityType.DATE,
        value: date,
        confidence: 0.8
      });
    });

    return entities.slice(0, 10); // Limit entities
  }

  /**
   * Determine content type from LLM response
   */
  private determineContentType(response: string): ContentType {
    const lowerResponse = response.toLowerCase();
    
    if (lowerResponse.includes('meeting') || lowerResponse.includes('notes')) {
      return ContentType.MEETING_NOTES;
    } else if (lowerResponse.includes('task') || lowerResponse.includes('todo')) {
      return ContentType.TASK_LIST;
    } else if (lowerResponse.includes('idea') || lowerResponse.includes('brainstorm')) {
      return ContentType.IDEA;
    } else if (lowerResponse.includes('shopping') || lowerResponse.includes('buy')) {
      return ContentType.SHOPPING_LIST;
    } else if (lowerResponse.includes('reference') || lowerResponse.includes('info')) {
      return ContentType.REFERENCE;
    } else if (lowerResponse.includes('journal') || lowerResponse.includes('diary')) {
      return ContentType.JOURNAL;
    } else if (lowerResponse.includes('scratch') || lowerResponse.includes('temp')) {
      return ContentType.SCRATCH_PAD;
    }
    
    return ContentType.OTHER;
  }

  /**
   * Extract action items from LLM response
   */
  private extractActionItems(response: string): string[] {
    // Simple extraction of action-oriented phrases
    const actionWords = ['todo', 'task', 'action', 'need to', 'should', 'must', 'call', 'email', 'buy', 'complete'];
    const sentences = response.split(/[.!?]/);
    
    return sentences
      .filter(sentence => 
        actionWords.some(word => sentence.toLowerCase().includes(word))
      )
      .map(sentence => sentence.trim())
      .filter(sentence => sentence.length > 0)
      .slice(0, 5);
  }

  /**
   * Extract importance indicators from LLM response
   */
  private extractImportanceIndicators(response: string): string[] {
    const importanceWords = ['urgent', 'important', 'critical', 'asap', 'deadline', 'priority', 'emergency'];
    const indicators: string[] = [];
    
    importanceWords.forEach(word => {
      if (response.toLowerCase().includes(word)) {
        indicators.push(word);
      }
    });
    
    return indicators;
  }

  /**
   * Extract summary from LLM response
   */
  private extractSummary(response: string): string {
    // Look for summary section or create from first few sentences
    const summaryMatch = response.match(/summary[:\-\s]+(.*?)(?:\n\n|$)/is);
    if (summaryMatch) {
      return summaryMatch[1].trim();
    }
    
    // Fallback: use first 2 sentences
    const sentences = response.split(/[.!?]/).filter(s => s.trim().length > 0);
    return sentences.slice(0, 2).join('. ').trim() + '.';
  }

  /**
   * Create fallback analysis when LLM fails
   */
  private createFallbackAnalysis(content: string): ContentAnalysis {
    return {
      topics: ['general'],
      entities: [],
      contentType: ContentType.OTHER,
      actionItems: [],
      importanceIndicators: [],
      summary: content.length > 100 ? content.substring(0, 100) + '...' : content
    };
  }

  /**
   * Enable or disable OCR processing
   */
  setOCREnabled(enabled: boolean): void {
    this.ocrEnabled = enabled;
  }

  /**
   * Enable or disable image analysis
   */
  setImageAnalysisEnabled(enabled: boolean): void {
    this.imageAnalysisEnabled = enabled;
  }

  /**
   * Get processing capabilities
   */
  getCapabilities(): {
    ocrEnabled: boolean;
    imageAnalysisEnabled: boolean;
    supportedAttachmentTypes: AttachmentType[];
  } {
    return {
      ocrEnabled: this.ocrEnabled,
      imageAnalysisEnabled: this.imageAnalysisEnabled,
      supportedAttachmentTypes: Object.values(AttachmentType)
    };
  }
}