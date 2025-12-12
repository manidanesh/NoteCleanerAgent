/**
 * Group of duplicate or similar notes identified by Duplicate Detector Agent
 */
export interface DuplicateGroup {
  id: string;
  noteIds: string[];
  similarityScores: number[];
  recommendedPrimary: string;
  mergeStrategy: MergeStrategy;
  conflictAreas: ConflictArea[];
  confidence: number;
  timestamp: Date;
}

/**
 * Strategy for merging duplicate notes
 */
export interface MergeStrategy {
  type: MergeType;
  primaryNoteId: string;
  contentCombination: ContentCombinationRule[];
  metadataHandling: MetadataHandlingRule;
}

/**
 * Area where duplicate notes have conflicting information
 */
export interface ConflictArea {
  field: string;
  values: ConflictValue[];
  resolutionStrategy: ConflictResolution;
}

/**
 * Conflicting value in duplicate notes
 */
export interface ConflictValue {
  noteId: string;
  value: any;
  confidence: number;
}

/**
 * Types of merge strategies
 */
export enum MergeType {
  KEEP_PRIMARY = 'keep_primary',
  COMBINE_CONTENT = 'combine_content',
  MANUAL_REVIEW = 'manual_review'
}

/**
 * Rules for combining content during merge
 */
export enum ContentCombinationRule {
  APPEND = 'append',
  PREPEND = 'prepend',
  MERGE_SECTIONS = 'merge_sections',
  KEEP_LONGEST = 'keep_longest',
  KEEP_NEWEST = 'keep_newest'
}

/**
 * Rules for handling metadata during merge
 */
export enum MetadataHandlingRule {
  KEEP_PRIMARY = 'keep_primary',
  COMBINE_ALL = 'combine_all',
  KEEP_NEWEST = 'keep_newest',
  KEEP_OLDEST = 'keep_oldest'
}

/**
 * Strategies for resolving conflicts
 */
export enum ConflictResolution {
  KEEP_PRIMARY = 'keep_primary',
  KEEP_NEWEST = 'keep_newest',
  KEEP_LONGEST = 'keep_longest',
  MANUAL_REVIEW = 'manual_review'
}