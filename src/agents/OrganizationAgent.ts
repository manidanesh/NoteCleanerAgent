import { Note } from '../models/Note';
import { Recommendation, RecommendationAction, ImpactLevel, RecommendationStatus } from '../models/Recommendation';
import { UtilityScore } from '../models/UtilityScore';
import { LLMService } from '../services/LLMService';
import { LLMRequest, LLMRequestType } from '../models/LLMModels';

/**
 * Title analysis result
 */
export interface TitleAnalysis {
  isGeneric: boolean;
  isUnclear: boolean;
  hasContentMismatch: boolean;
  clarity: number; // 0-100
  specificity: number; // 0-100
  searchability: number; // 0-100
  issues: string[];
}

/**
 * Title suggestion with reasoning
 */
export interface TitleSuggestion {
  suggestedTitle: string;
  reasoning: string;
  confidence: number;
  keywords: string[];
}

/**
 * Folder organization suggestion
 */
export interface FolderSuggestion {
  suggestedFolder: string;
  reasoning: string;
  confidence: number;
  themes: string[];
  relatedNotes?: string[];
}

/**
 * Batch organizational improvement
 */
export interface BatchImprovement {
  type: 'title_improvements' | 'folder_reorganization' | 'content_grouping';
  noteIds: string[];
  description: string;
  estimatedImpact: ImpactLevel;
  suggestions: (TitleSuggestion | FolderSuggestion)[];
}

/**
 * Before/after comparison for organizational changes
 */
export interface OrganizationComparison {
  noteId: string;
  before: {
    title: string;
    folder: string;
    themes: string[];
  };
  after: {
    title?: string;
    folder?: string;
    themes: string[];
  };
  improvements: string[];
  impact: ImpactLevel;
}

/**
 * Organization Agent - Generates recommendations for note organization improvements
 */
export class OrganizationAgent {
  private llmService: LLMService;
  private readonly GENERIC_TITLE_PATTERNS = [
    /^(note|untitled|new|temp|test|draft)(\s*\d*)?$/i,
    /^(meeting|call|discussion)(\s*\d*)?$/i,
    /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/,
    /^(today|yesterday|tomorrow)$/i,
    /^(ideas?|thoughts?|notes?)(\s*\d*)?$/i
  ];

  private readonly UNCLEAR_TITLE_INDICATORS = [
    'stuff', 'things', 'misc', 'random', 'various', 'other',
    'todo', 'list', 'items', 'info'
  ];

  constructor(llmService: LLMService) {
    this.llmService = llmService;
  }

  /**
   * Generate organization recommendations for a note
   */
  async generateRecommendations(note: Note, utilityScore: UtilityScore): Promise<Recommendation[]> {
    const recommendations: Recommendation[] = [];

    try {
      // Analyze title quality
      const titleAnalysis = this.analyzeTitleQuality(note);
      
      // Generate title suggestions if needed
      if (titleAnalysis.isGeneric || titleAnalysis.isUnclear || titleAnalysis.hasContentMismatch) {
        const titleSuggestion = await this.generateTitleSuggestion(note, titleAnalysis);
        
        if (titleSuggestion) {
          recommendations.push({
            id: `title_${note.id}_${Date.now()}`,
            noteId: note.id,
            action: RecommendationAction.RENAME,
            confidence: titleSuggestion.confidence,
            reasoning: titleSuggestion.reasoning,
            impact: this.determineImpactLevel(titleSuggestion.confidence),
            reversible: true,
            suggestedTitle: titleSuggestion.suggestedTitle,
            timestamp: new Date(),
            status: RecommendationStatus.PENDING
          });
        }
      }

      // Generate folder organization suggestions
      const folderSuggestion = await this.generateFolderSuggestion(note);
      
      if (folderSuggestion && folderSuggestion.suggestedFolder !== note.folder) {
        recommendations.push({
          id: `folder_${note.id}_${Date.now()}`,
          noteId: note.id,
          action: RecommendationAction.REVIEW, // Folder changes need review
          confidence: folderSuggestion.confidence,
          reasoning: `Folder organization: ${folderSuggestion.reasoning}`,
          impact: this.determineImpactLevel(folderSuggestion.confidence),
          reversible: true,
          suggestedFolder: folderSuggestion.suggestedFolder,
          timestamp: new Date(),
          status: RecommendationStatus.PENDING
        });
      }

      // Generate action recommendations based on utility score
      const actionRecommendation = this.generateActionRecommendation(note, utilityScore);
      if (actionRecommendation) {
        recommendations.push(actionRecommendation);
      }

    } catch (error) {
      console.error(`Error generating recommendations for note ${note.id}:`, error);
      
      // Provide fallback recommendation
      recommendations.push({
        id: `fallback_${note.id}_${Date.now()}`,
        noteId: note.id,
        action: RecommendationAction.REVIEW,
        confidence: 0.3,
        reasoning: 'Manual review recommended due to processing error',
        impact: ImpactLevel.LOW,
        reversible: true,
        timestamp: new Date(),
        status: RecommendationStatus.PENDING
      });
    }

    return recommendations;
  }

  /**
   * Analyze title quality and identify issues
   */
  analyzeTitleQuality(note: Note): TitleAnalysis {
    const title = note.title?.trim() || '';
    const content = note.content?.trim() || '';
    
    // Check for generic patterns
    const isGeneric = this.GENERIC_TITLE_PATTERNS.some(pattern => pattern.test(title));
    
    // Check for unclear indicators
    const isUnclear = this.UNCLEAR_TITLE_INDICATORS.some(indicator => 
      title.toLowerCase().includes(indicator)
    );
    
    // Check for content mismatch
    const hasContentMismatch = this.detectContentMismatch(title, content);
    
    // Calculate quality scores
    const clarity = this.calculateClarity(title, content);
    const specificity = this.calculateSpecificity(title, content);
    const searchability = this.calculateSearchability(title);
    
    // Identify specific issues
    const issues: string[] = [];
    if (isGeneric) issues.push('Title is too generic');
    if (isUnclear) issues.push('Title contains vague terms');
    if (hasContentMismatch) issues.push('Title does not match content');
    if (title.length < 3) issues.push('Title is too short');
    if (title.length > 100) issues.push('Title is too long');
    if (clarity < 50) issues.push('Title lacks clarity');
    if (specificity < 40) issues.push('Title is not specific enough');
    
    return {
      isGeneric,
      isUnclear,
      hasContentMismatch,
      clarity,
      specificity,
      searchability,
      issues
    };
  }

  /**
   * Generate improved title suggestion using LLM
   */
  async generateTitleSuggestion(note: Note, analysis: TitleAnalysis): Promise<TitleSuggestion | null> {
    try {
      const request: LLMRequest = {
        agentId: 'organization-agent',
        requestType: LLMRequestType.TITLE_GENERATION,
        context: 'Generating improved title for note organization',
        noteContent: note.content.substring(0, 1000),
        systemPrompt: `You are a note organization expert. Generate descriptive, searchable titles that accurately reflect note content.`,
        userPrompt: `Generate an improved title for this note:

Current title: "${note.title}"
Content preview: "${note.content.substring(0, 500)}..."

Issues identified: ${analysis.issues.join(', ')}

Requirements:
- 3-8 words maximum
- Descriptive and specific
- Contains searchable keywords
- Professional and clear
- Accurately reflects content

Respond with JSON:
{
  "title": "suggested title",
  "reasoning": "brief explanation",
  "keywords": ["key", "words"],
  "confidence": 0.85
}`,
        maxTokens: 200,
        temperature: 0.3
      };

      const response = await this.llmService.processRequest(request);
      
      try {
        const parsed = JSON.parse(response.response);
        
        // Validate the suggestion
        if (this.validateTitleSuggestion(parsed.title, note)) {
          return {
            suggestedTitle: parsed.title,
            reasoning: parsed.reasoning || 'LLM-generated title improvement',
            confidence: Math.min(0.95, Math.max(0.3, parsed.confidence || 0.7)),
            keywords: parsed.keywords || []
          };
        }
      } catch (parseError) {
        console.warn('Failed to parse LLM title suggestion, using fallback');
      }
      
      // Fallback title generation
      return this.generateFallbackTitle(note, analysis);
      
    } catch (error) {
      console.warn('LLM title generation failed, using fallback:', error);
      return this.generateFallbackTitle(note, analysis);
    }
  }

  /**
   * Generate folder organization suggestion using content themes
   */
  async generateFolderSuggestion(note: Note): Promise<FolderSuggestion | null> {
    try {
      const request: LLMRequest = {
        agentId: 'organization-agent',
        requestType: LLMRequestType.CLASSIFICATION,
        context: 'Analyzing note content for folder organization',
        noteContent: note.content.substring(0, 1000),
        systemPrompt: `You are a note organization expert. Analyze content to suggest appropriate folder categories.`,
        userPrompt: `Analyze this note and suggest the best folder organization:

Title: "${note.title}"
Current folder: "${note.folder}"
Content: "${note.content.substring(0, 500)}..."

Common folder categories:
- Work/Projects
- Personal
- Ideas/Brainstorming  
- Meeting Notes
- Reference/Documentation
- Tasks/Todo
- Research
- Finance
- Health
- Travel
- Education

Respond with JSON:
{
  "folder": "suggested folder name",
  "reasoning": "why this folder fits",
  "themes": ["theme1", "theme2"],
  "confidence": 0.80
}`,
        maxTokens: 200,
        temperature: 0.2
      };

      const response = await this.llmService.processRequest(request);
      
      try {
        const parsed = JSON.parse(response.response);
        
        return {
          suggestedFolder: parsed.folder,
          reasoning: parsed.reasoning || 'Content-based folder suggestion',
          confidence: Math.min(0.95, Math.max(0.3, parsed.confidence || 0.6)),
          themes: parsed.themes || []
        };
      } catch (parseError) {
        console.warn('Failed to parse LLM folder suggestion');
      }
      
    } catch (error) {
      console.warn('LLM folder suggestion failed:', error);
    }
    
    // Fallback folder suggestion based on content analysis
    return this.generateFallbackFolderSuggestion(note);
  }

  /**
   * Generate batch organizational improvements for multiple notes
   */
  async generateBatchImprovements(notes: Note[]): Promise<BatchImprovement[]> {
    const improvements: BatchImprovement[] = [];
    
    // Group notes by common issues
    const titleIssues = notes.filter(note => {
      const analysis = this.analyzeTitleQuality(note);
      return analysis.isGeneric || analysis.isUnclear || analysis.issues.length > 0;
    });
    
    if (titleIssues.length >= 3) {
      improvements.push({
        type: 'title_improvements',
        noteIds: titleIssues.map(n => n.id),
        description: `${titleIssues.length} notes have generic or unclear titles that could be improved`,
        estimatedImpact: titleIssues.length > 10 ? ImpactLevel.HIGH : ImpactLevel.MEDIUM,
        suggestions: [] // Would be populated with individual suggestions
      });
    }
    
    // Analyze folder organization opportunities
    const folderGroups = this.groupNotesByPotentialFolders(notes);
    for (const [suggestedFolder, groupNotes] of folderGroups) {
      if (groupNotes.length >= 3 && groupNotes.some(n => n.folder !== suggestedFolder)) {
        improvements.push({
          type: 'folder_reorganization',
          noteIds: groupNotes.map(n => n.id),
          description: `${groupNotes.length} notes could be organized into "${suggestedFolder}" folder`,
          estimatedImpact: groupNotes.length > 15 ? ImpactLevel.HIGH : ImpactLevel.MEDIUM,
          suggestions: [] // Would be populated with folder suggestions
        });
      }
    }
    
    return improvements;
  }

  /**
   * Generate before/after comparison for organizational changes
   */
  generateComparison(
    note: Note, 
    titleSuggestion?: TitleSuggestion, 
    folderSuggestion?: FolderSuggestion
  ): OrganizationComparison {
    const improvements: string[] = [];
    
    if (titleSuggestion) {
      improvements.push(`Title: "${note.title}" → "${titleSuggestion.suggestedTitle}"`);
    }
    
    if (folderSuggestion) {
      improvements.push(`Folder: "${note.folder}" → "${folderSuggestion.suggestedFolder}"`);
    }
    
    // Determine overall impact
    let impact = ImpactLevel.LOW;
    if (titleSuggestion && titleSuggestion.confidence > 0.8) {
      impact = ImpactLevel.MEDIUM;
    }
    if (folderSuggestion && folderSuggestion.confidence > 0.8) {
      impact = ImpactLevel.MEDIUM;
    }
    if (titleSuggestion && folderSuggestion && 
        titleSuggestion.confidence > 0.7 && folderSuggestion.confidence > 0.7) {
      impact = ImpactLevel.HIGH;
    }
    
    return {
      noteId: note.id,
      before: {
        title: note.title,
        folder: note.folder,
        themes: this.extractThemesFromContent(note.content)
      },
      after: {
        title: titleSuggestion?.suggestedTitle,
        folder: folderSuggestion?.suggestedFolder,
        themes: folderSuggestion?.themes || this.extractThemesFromContent(note.content)
      },
      improvements,
      impact
    };
  }

  // Private helper methods

  private detectContentMismatch(title: string, content: string): boolean {
    if (!title || !content || title.length < 3 || content.length < 10) {
      return false;
    }
    
    const titleWords = title.toLowerCase().split(/\s+/);
    const contentWords = content.toLowerCase().split(/\s+/).slice(0, 50); // First 50 words
    
    // Check if any title words appear in content
    const matchingWords = titleWords.filter(word => 
      word.length > 2 && contentWords.some(cWord => cWord.includes(word))
    );
    
    // Mismatch if less than 30% of title words appear in content
    return matchingWords.length / titleWords.length < 0.3;
  }

  private calculateClarity(title: string, content: string): number {
    let score = 50; // Base score
    
    // Length appropriateness
    if (title.length >= 10 && title.length <= 60) score += 20;
    else if (title.length < 5 || title.length > 100) score -= 20;
    
    // Word count
    const wordCount = title.split(/\s+/).length;
    if (wordCount >= 3 && wordCount <= 8) score += 15;
    
    // Contains meaningful words (not just articles/prepositions)
    const meaningfulWords = title.split(/\s+/).filter(word => 
      word.length > 2 && !['the', 'and', 'for', 'with', 'from'].includes(word.toLowerCase())
    );
    score += Math.min(20, meaningfulWords.length * 5);
    
    return Math.min(100, Math.max(0, score));
  }

  private calculateSpecificity(title: string, content: string): number {
    let score = 40; // Base score
    
    // Avoid generic words
    const genericWords = ['note', 'notes', 'stuff', 'things', 'misc', 'various'];
    const hasGeneric = genericWords.some(word => title.toLowerCase().includes(word));
    if (!hasGeneric) score += 25;
    
    // Contains specific terms
    const specificPatterns = [
      /\b(project|meeting|call|interview|research|analysis|plan|strategy)\b/i,
      /\b(review|summary|report|proposal|presentation|document)\b/i,
      /\b(budget|planning|quarterly|q[1-4])\b/i, // Business terms
      /\b\d{4}\b/, // Years
      /\b[A-Z][a-z]+\s[A-Z][a-z]+\b/ // Proper names
    ];
    
    specificPatterns.forEach(pattern => {
      if (pattern.test(title)) score += 10;
    });
    
    return Math.min(100, Math.max(0, score));
  }

  private calculateSearchability(title: string): number {
    let score = 50; // Base score
    
    // Contains keywords that would be useful for search
    const keywordPatterns = [
      /\b(meeting|project|task|idea|plan|review|summary|notes?)\b/i,
      /\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/, // Dates
      /\b[A-Z][a-z]+(?:\s[A-Z][a-z]+)*\b/ // Proper nouns
    ];
    
    keywordPatterns.forEach(pattern => {
      if (pattern.test(title)) score += 15;
    });
    
    // Penalize very short or very long titles
    if (title.length < 5) score -= 20;
    if (title.length > 80) score -= 15;
    
    return Math.min(100, Math.max(0, score));
  }

  private validateTitleSuggestion(suggestedTitle: string, note: Note): boolean {
    if (!suggestedTitle || typeof suggestedTitle !== 'string') return false;
    if (suggestedTitle.length < 3 || suggestedTitle.length > 100) return false;
    if (suggestedTitle === note.title) return false;
    
    // Check if suggestion is actually better
    const currentAnalysis = this.analyzeTitleQuality(note);
    const mockNoteWithNewTitle = { ...note, title: suggestedTitle };
    const newAnalysis = this.analyzeTitleQuality(mockNoteWithNewTitle);
    
    return newAnalysis.clarity > currentAnalysis.clarity || 
           newAnalysis.specificity > currentAnalysis.specificity;
  }

  private generateFallbackTitle(note: Note, analysis: TitleAnalysis): TitleSuggestion | null {
    const content = note.content.substring(0, 200);
    const words = content.split(/\s+/).filter(word => 
      word.length > 3 && 
      !['the', 'and', 'for', 'with', 'that', 'this', 'have', 'will', 'been'].includes(word.toLowerCase())
    );
    
    if (words.length >= 2) {
      const suggestedTitle = words.slice(0, 4).join(' ');
      return {
        suggestedTitle,
        reasoning: 'Generated from key content words',
        confidence: 0.6,
        keywords: words.slice(0, 4)
      };
    }
    
    return null;
  }

  private generateFallbackFolderSuggestion(note: Note): FolderSuggestion | null {
    const content = note.content.toLowerCase();
    const title = note.title.toLowerCase();
    const combined = `${title} ${content}`;
    
    // Simple keyword-based folder suggestions
    const folderKeywords = {
      'Work': ['project', 'meeting', 'work', 'business', 'client', 'deadline', 'task'],
      'Personal': ['personal', 'family', 'home', 'private', 'diary', 'journal'],
      'Ideas': ['idea', 'brainstorm', 'concept', 'innovation', 'creative', 'inspiration'],
      'Reference': ['reference', 'documentation', 'guide', 'manual', 'info', 'research'],
      'Tasks': ['todo', 'task', 'action', 'checklist', 'reminder', 'follow up'],
      'Finance': ['money', 'budget', 'expense', 'income', 'financial', 'bank', 'investment']
    };
    
    for (const [folder, keywords] of Object.entries(folderKeywords)) {
      const matchCount = keywords.filter(keyword => combined.includes(keyword)).length;
      if (matchCount >= 2) {
        return {
          suggestedFolder: folder,
          reasoning: `Content contains ${matchCount} keywords related to ${folder}`,
          confidence: Math.min(0.8, 0.4 + (matchCount * 0.1)),
          themes: keywords.filter(keyword => combined.includes(keyword))
        };
      }
    }
    
    return null;
  }

  private generateActionRecommendation(note: Note, utilityScore: UtilityScore): Recommendation | null {
    let action: RecommendationAction;
    let reasoning: string;
    let impact: ImpactLevel;
    
    if (utilityScore.overallScore >= 75) {
      action = RecommendationAction.KEEP;
      reasoning = `High utility score (${utilityScore.overallScore}/100) indicates this note is valuable and should be kept`;
      impact = ImpactLevel.LOW;
    } else if (utilityScore.overallScore >= 50) {
      action = RecommendationAction.REVIEW;
      reasoning = `Medium utility score (${utilityScore.overallScore}/100) suggests reviewing for potential improvements`;
      impact = ImpactLevel.MEDIUM;
    } else if (utilityScore.overallScore >= 30) {
      action = RecommendationAction.ARCHIVE;
      reasoning = `Lower utility score (${utilityScore.overallScore}/100) suggests archiving unless actively needed`;
      impact = ImpactLevel.MEDIUM;
    } else {
      action = RecommendationAction.DELETE;
      reasoning = `Low utility score (${utilityScore.overallScore}/100) indicates this note may be outdated or unnecessary`;
      impact = ImpactLevel.HIGH;
    }
    
    return {
      id: `action_${note.id}_${Date.now()}`,
      noteId: note.id,
      action,
      confidence: utilityScore.confidence,
      reasoning,
      impact,
      reversible: action !== RecommendationAction.DELETE,
      timestamp: new Date(),
      status: RecommendationStatus.PENDING
    };
  }

  private groupNotesByPotentialFolders(notes: Note[]): Map<string, Note[]> {
    const groups = new Map<string, Note[]>();
    
    // Simple grouping by content keywords - in real implementation would use LLM
    notes.forEach(note => {
      const suggestedFolder = this.generateFallbackFolderSuggestion(note)?.suggestedFolder || 'General';
      
      if (!groups.has(suggestedFolder)) {
        groups.set(suggestedFolder, []);
      }
      groups.get(suggestedFolder)!.push(note);
    });
    
    return groups;
  }

  private extractThemesFromContent(content: string): string[] {
    // Simple theme extraction - in real implementation would use LLM
    const themes: string[] = [];
    const lowerContent = content.toLowerCase();
    
    const themeKeywords = {
      'work': ['project', 'meeting', 'work', 'business', 'client'],
      'personal': ['personal', 'family', 'home', 'private'],
      'planning': ['plan', 'strategy', 'goal', 'objective', 'timeline'],
      'research': ['research', 'study', 'analysis', 'investigation'],
      'creative': ['idea', 'creative', 'design', 'brainstorm', 'innovation']
    };
    
    for (const [theme, keywords] of Object.entries(themeKeywords)) {
      if (keywords.some(keyword => lowerContent.includes(keyword))) {
        themes.push(theme);
      }
    }
    
    return themes.slice(0, 3); // Limit to top 3 themes
  }

  private determineImpactLevel(confidence: number): ImpactLevel {
    if (confidence >= 0.8) return ImpactLevel.HIGH;
    if (confidence >= 0.6) return ImpactLevel.MEDIUM;
    return ImpactLevel.LOW;
  }
}