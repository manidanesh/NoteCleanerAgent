import { LLMRequest, LLMResponse, LLMRequestType, ContentType } from '../../models/LLMModels';
import { ILLMProvider, LLMCapabilities, ProviderResourceUsage } from '../LLMService';

/**
 * Fallback provider using rule-based processing when LLM is unavailable
 * Provides basic functionality without machine learning
 */
export class FallbackProvider implements ILLMProvider {
  name = 'Fallback';
  private resourceUsage: ProviderResourceUsage;

  constructor() {
    this.resourceUsage = {
      memoryUsage: 0,
      cpuUsage: 0,
      requestCount: 0,
      averageLatency: 0
    };
  }

  async isAvailable(): Promise<boolean> {
    // Fallback provider is always available
    return true;
  }

  async processRequest(request: LLMRequest): Promise<LLMResponse> {
    const startTime = Date.now();
    
    try {
      const response = await this.processWithRules(request);
      const processingTime = Date.now() - startTime;
      
      this.updateResourceUsage(processingTime);
      
      return {
        requestId: this.generateResponseId(),
        response: response.text,
        confidence: response.confidence,
        tokensUsed: response.tokensUsed,
        processingTime,
        model: 'Rule-Based-Fallback',
        fallbackUsed: true
      };
    } catch (error) {
      console.error('Fallback processing failed:', error);
      throw new Error(`Fallback processing failed: ${(error as Error).message}`);
    }
  }

  private async processWithRules(request: LLMRequest): Promise<{text: string, confidence: number, tokensUsed: number}> {
    // Simulate minimal processing time
    await new Promise(resolve => setTimeout(resolve, 50));
    
    let response = '';
    let confidence = 0.6; // Lower confidence for rule-based processing
    
    switch (request.requestType) {
      case LLMRequestType.CONTENT_ANALYSIS:
        response = this.analyzeContentWithRules(request.noteContent);
        confidence = 0.65;
        break;
        
      case LLMRequestType.TITLE_GENERATION:
        response = this.generateTitleWithRules(request.noteContent);
        confidence = 0.7;
        break;
        
      case LLMRequestType.CLASSIFICATION:
        response = this.classifyContentWithRules(request.noteContent);
        confidence = 0.75;
        break;
        
      case LLMRequestType.EXPLANATION:
        response = this.generateExplanationWithRules(request);
        confidence = 0.6;
        break;
        
      case LLMRequestType.SUMMARIZATION:
        response = this.summarizeWithRules(request.noteContent);
        confidence = 0.65;
        break;
        
      case LLMRequestType.RELATIONSHIP_DETECTION:
        response = this.detectRelationshipsWithRules(request.noteContent);
        confidence = 0.5;
        break;
        
      default:
        response = 'Content processed using rule-based analysis.';
        confidence = 0.5;
    }
    
    const tokensUsed = Math.floor(response.length / 4); // Rough token estimation
    
    return {
      text: response,
      confidence,
      tokensUsed
    };
  }

  private analyzeContentWithRules(content: string): string {
    const analysis = [];
    
    // Basic content analysis using rules
    const wordCount = content.split(/\s+/).length;
    const hasNumbers = /\d/.test(content);
    const hasEmails = /@\w+\.\w+/.test(content);
    const hasUrls = /https?:\/\//.test(content);
    const hasDates = /\d{1,2}\/\d{1,2}\/\d{2,4}|\d{4}-\d{2}-\d{2}/.test(content);
    const hasActionWords = /\b(todo|task|action|complete|finish|deadline|due)\b/i.test(content);
    
    analysis.push(`Content contains ${wordCount} words.`);
    
    if (hasActionWords) {
      analysis.push('Contains action items or tasks.');
    }
    
    if (hasDates) {
      analysis.push('Contains date references.');
    }
    
    if (hasEmails || hasUrls) {
      analysis.push('Contains contact information or web references.');
    }
    
    if (hasNumbers) {
      analysis.push('Contains numerical data.');
    }
    
    // Determine content value
    let value = 'medium';
    if (wordCount > 100 && (hasActionWords || hasDates)) {
      value = 'high';
    } else if (wordCount < 20 && !hasActionWords) {
      value = 'low';
    }
    
    analysis.push(`Estimated content value: ${value}.`);
    
    return analysis.join(' ');
  }

  private generateTitleWithRules(content: string): string {
    // Extract potential title from content
    const lines = content.split('\n').filter(line => line.trim().length > 0);
    
    if (lines.length === 0) {
      return 'Untitled Note';
    }
    
    // Use first line if it's short and descriptive
    const firstLine = lines[0].trim();
    if (firstLine.length <= 50 && firstLine.length > 5) {
      return firstLine;
    }
    
    // Look for patterns that suggest titles
    const words = content.toLowerCase().split(/\s+/);
    
    if (words.includes('meeting') || words.includes('call')) {
      return 'Meeting Notes';
    }
    
    if (words.includes('todo') || words.includes('task')) {
      return 'Task List';
    }
    
    if (words.includes('idea') || words.includes('brainstorm')) {
      return 'Ideas and Notes';
    }
    
    if (words.includes('research') || words.includes('study')) {
      return 'Research Notes';
    }
    
    // Generate title from first few words
    const titleWords = content.split(/\s+/).slice(0, 4);
    const title = titleWords.join(' ');
    
    return title.length > 30 ? title.substring(0, 30) + '...' : title;
  }

  private classifyContentWithRules(content: string): string {
    const lowerContent = content.toLowerCase();
    
    // Meeting indicators
    if (lowerContent.includes('meeting') || 
        lowerContent.includes('agenda') || 
        lowerContent.includes('attendees') ||
        lowerContent.includes('action items')) {
      return ContentType.MEETING_NOTES;
    }
    
    // Task list indicators
    if (lowerContent.includes('todo') || 
        lowerContent.includes('task') || 
        lowerContent.includes('- [ ]') ||
        lowerContent.includes('checkbox')) {
      return ContentType.TASK_LIST;
    }
    
    // Shopping list indicators
    if (lowerContent.includes('buy') || 
        lowerContent.includes('grocery') || 
        lowerContent.includes('shopping') ||
        /\b(milk|bread|eggs|store)\b/.test(lowerContent)) {
      return ContentType.SHOPPING_LIST;
    }
    
    // Idea indicators
    if (lowerContent.includes('idea') || 
        lowerContent.includes('brainstorm') || 
        lowerContent.includes('concept') ||
        lowerContent.includes('thought')) {
      return ContentType.IDEA;
    }
    
    // Reference indicators
    if (lowerContent.includes('reference') || 
        lowerContent.includes('documentation') || 
        lowerContent.includes('guide') ||
        /https?:\/\//.test(content)) {
      return ContentType.REFERENCE;
    }
    
    // Journal indicators
    if (lowerContent.includes('today') || 
        lowerContent.includes('yesterday') || 
        lowerContent.includes('feeling') ||
        /\b(i am|i was|i feel)\b/.test(lowerContent)) {
      return ContentType.JOURNAL;
    }
    
    // Default classification
    return ContentType.OTHER;
  }

  private generateExplanationWithRules(request: LLMRequest): string {
    const explanations = [
      'This recommendation is based on content length, keyword analysis, and structural patterns.',
      'The analysis considers word frequency, content type indicators, and organizational structure.',
      'This suggestion uses rule-based classification considering content patterns and usage indicators.',
      'The recommendation is derived from text analysis, content categorization, and structural assessment.'
    ];
    
    return explanations[Math.floor(Math.random() * explanations.length)];
  }

  private summarizeWithRules(content: string): string {
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 10);
    
    if (sentences.length <= 2) {
      return content.length > 100 ? content.substring(0, 100) + '...' : content;
    }
    
    // Take first and last sentences for basic summary
    const summary = [sentences[0].trim(), sentences[sentences.length - 1].trim()];
    
    return summary.join('. ') + '.';
  }

  private detectRelationshipsWithRules(content: string): string {
    const relationships = [];
    
    // Look for common relationship indicators
    if (content.includes('related to') || content.includes('similar to')) {
      relationships.push('Contains explicit relationship references.');
    }
    
    if (content.includes('follow up') || content.includes('continuation')) {
      relationships.push('May be part of a series or follow-up.');
    }
    
    if (/\b(project|client|customer)\b/i.test(content)) {
      relationships.push('Contains project or client references.');
    }
    
    if (relationships.length === 0) {
      return 'No clear relationships detected using rule-based analysis.';
    }
    
    return relationships.join(' ');
  }

  getCapabilities(): LLMCapabilities {
    return {
      maxTokens: 512,
      supportedRequestTypes: [
        LLMRequestType.CONTENT_ANALYSIS,
        LLMRequestType.TITLE_GENERATION,
        LLMRequestType.CLASSIFICATION,
        LLMRequestType.EXPLANATION,
        LLMRequestType.SUMMARIZATION,
        LLMRequestType.RELATIONSHIP_DETECTION
      ],
      supportsStreaming: false,
      requiresNetwork: false,
      privacyCompliant: true
    };
  }

  getResourceUsage(): ProviderResourceUsage {
    return { ...this.resourceUsage };
  }

  private updateResourceUsage(processingTime: number): void {
    this.resourceUsage.requestCount++;
    
    // Update average latency
    const totalLatency = this.resourceUsage.averageLatency * (this.resourceUsage.requestCount - 1) + processingTime;
    this.resourceUsage.averageLatency = totalLatency / this.resourceUsage.requestCount;
    
    // Rule-based processing uses minimal resources
    this.resourceUsage.memoryUsage = 10; // MB
    this.resourceUsage.cpuUsage = Math.min(5, Math.random() * 10); // Percentage
  }

  private generateResponseId(): string {
    return `fallback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async shutdown(): Promise<void> {
    console.log('Fallback provider shut down');
  }
}