/**
 * Utility score assigned to a note by the Utility Scorer Agent
 */
export interface UtilityScore {
  noteId: string;
  overallScore: number; // 0-100
  contentScore: number;
  behavioralScore: number;
  semanticScore: number;
  ruleBasedScore: number;
  explanation: string;
  confidence: number;
  factors: ScoringFactor[];
  timestamp: Date;
}

/**
 * Individual factor contributing to utility score
 */
export interface ScoringFactor {
  name: string;
  weight: number;
  value: number;
  description: string;
}

/**
 * Scoring algorithm types
 */
export enum ScoringAlgorithm {
  TF_IDF = 'tf_idf',
  BEHAVIORAL = 'behavioral',
  SEMANTIC = 'semantic',
  RULE_BASED = 'rule_based',
  HYBRID = 'hybrid'
}