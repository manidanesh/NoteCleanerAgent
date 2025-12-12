/**
 * LLM request and response models
 */
export interface LLMRequest {
  agentId: string;
  requestType: LLMRequestType;
  context: string;
  noteContent: string;
  systemPrompt: string;
  userPrompt: string;
  maxTokens: number;
  temperature: number;
}

/**
 * LLM response model
 */
export interface LLMResponse {
  requestId: string;
  response: string;
  confidence: number;
  tokensUsed: number;
  processingTime: number;
  model: string;
  fallbackUsed: boolean;
}

/**
 * Types of LLM requests
 */
export enum LLMRequestType {
  CONTENT_ANALYSIS = 'content_analysis',
  TITLE_GENERATION = 'title_generation',
  EXPLANATION = 'explanation',
  CLASSIFICATION = 'classification',
  SUMMARIZATION = 'summarization',
  RELATIONSHIP_DETECTION = 'relationship_detection'
}

/**
 * Content analysis result from LLM
 */
export interface ContentAnalysis {
  topics: string[];
  entities: Entity[];
  contentType: ContentType;
  actionItems: string[];
  importanceIndicators: string[];
  summary: string;
}

/**
 * Entity extracted from content
 */
export interface Entity {
  type: EntityType;
  value: string;
  confidence: number;
}

/**
 * Types of entities
 */
export enum EntityType {
  PERSON = 'person',
  DATE = 'date',
  LOCATION = 'location',
  ORGANIZATION = 'organization',
  TASK = 'task',
  CONCEPT = 'concept'
}

/**
 * Types of note content
 */
export enum ContentType {
  MEETING_NOTES = 'meeting_notes',
  IDEA = 'idea',
  TASK_LIST = 'task_list',
  REFERENCE = 'reference',
  JOURNAL = 'journal',
  SCRATCH_PAD = 'scratch_pad',
  SHOPPING_LIST = 'shopping_list',
  OTHER = 'other'
}