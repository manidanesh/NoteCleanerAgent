/**
 * Property-based test generators for LLM models
 */
import fc from 'fast-check';
import { 
  LLMRequest, 
  LLMResponse, 
  LLMRequestType,
  ContentAnalysis,
  Entity,
  EntityType,
  ContentType
} from '@/models/LLMModels';

/**
 * Generator for LLMRequestType enum
 */
export const llmRequestTypeArb = fc.constantFrom(
  LLMRequestType.CONTENT_ANALYSIS,
  LLMRequestType.TITLE_GENERATION,
  LLMRequestType.EXPLANATION,
  LLMRequestType.CLASSIFICATION,
  LLMRequestType.SUMMARIZATION,
  LLMRequestType.RELATIONSHIP_DETECTION
);

/**
 * Generator for agent IDs
 */
export const agentIdArb = fc.constantFrom(
  'content-extractor',
  'utility-scorer',
  'duplicate-detector',
  'organization-agent',
  'learning-component'
);

/**
 * Generator for LLMRequest objects
 */
export const llmRequestArb: fc.Arbitrary<LLMRequest> = fc.record({
  agentId: agentIdArb,
  requestType: llmRequestTypeArb,
  context: fc.string({ maxLength: 500 }),
  noteContent: fc.string({ minLength: 1, maxLength: 5000 }),
  systemPrompt: fc.string({ minLength: 10, maxLength: 200 }),
  userPrompt: fc.string({ minLength: 5, maxLength: 300 }),
  maxTokens: fc.integer({ min: 10, max: 2048 }),
  temperature: fc.float({ min: 0.0, max: 1.0 })
});

/**
 * Generator for valid LLMRequest objects (with constraints)
 */
export const validLLMRequestArb: fc.Arbitrary<LLMRequest> = llmRequestArb.filter(request => {
  return request.noteContent.trim().length > 0 &&
         request.systemPrompt.trim().length > 0 &&
         request.userPrompt.trim().length > 0 &&
         request.maxTokens > 0 &&
         request.temperature >= 0 && request.temperature <= 1;
});

/**
 * Generator for LLMResponse objects
 */
export const llmResponseArb: fc.Arbitrary<LLMResponse> = fc.record({
  requestId: fc.uuid(),
  response: fc.string({ minLength: 1, maxLength: 2000 }),
  confidence: fc.float({ min: 0.0, max: 1.0 }),
  tokensUsed: fc.integer({ min: 1, max: 2048 }),
  processingTime: fc.integer({ min: 1, max: 30000 }), // 1ms to 30s
  model: fc.constantFrom(
    'Core-ML-Local',
    'Ollama-Local',
    'GGML-Local',
    'Rule-Based-Fallback',
    'OpenAI-GPT4',
    'Anthropic-Claude'
  ),
  fallbackUsed: fc.boolean()
});

/**
 * Generator for EntityType enum
 */
export const entityTypeArb = fc.constantFrom(
  EntityType.PERSON,
  EntityType.DATE,
  EntityType.LOCATION,
  EntityType.ORGANIZATION,
  EntityType.TASK,
  EntityType.CONCEPT
);

/**
 * Generator for Entity objects
 */
export const entityArb: fc.Arbitrary<Entity> = fc.record({
  type: entityTypeArb,
  value: fc.string({ minLength: 1, maxLength: 100 }),
  confidence: fc.float({ min: 0.0, max: 1.0 })
});

/**
 * Generator for ContentType enum
 */
export const contentTypeArb = fc.constantFrom(
  ContentType.MEETING_NOTES,
  ContentType.IDEA,
  ContentType.TASK_LIST,
  ContentType.REFERENCE,
  ContentType.JOURNAL,
  ContentType.SCRATCH_PAD,
  ContentType.SHOPPING_LIST,
  ContentType.OTHER
);

/**
 * Generator for ContentAnalysis objects
 */
export const contentAnalysisArb: fc.Arbitrary<ContentAnalysis> = fc.record({
  topics: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { maxLength: 10 }),
  entities: fc.array(entityArb, { maxLength: 20 }),
  contentType: contentTypeArb,
  actionItems: fc.array(fc.string({ minLength: 1, maxLength: 200 }), { maxLength: 10 }),
  importanceIndicators: fc.array(fc.string({ minLength: 1, maxLength: 100 }), { maxLength: 5 }),
  summary: fc.string({ minLength: 10, maxLength: 500 })
});

/**
 * Generator for arrays of LLM requests
 */
export const llmRequestsArrayArb = (minLength = 0, maxLength = 10): fc.Arbitrary<LLMRequest[]> =>
  fc.array(validLLMRequestArb, { minLength, maxLength });