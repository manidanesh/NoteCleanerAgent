import { Note } from '../models/Note';
import { DuplicateGroup, MergeStrategy, MergeType, ConflictArea, ConflictResolution, ContentCombinationRule, MetadataHandlingRule } from '../models/DuplicateGroup';
import { VectorIndexingService, VectorIndexingServiceImpl, VectorIndex, IndexType } from '../services/VectorIndexingService';
import { LLMService } from '../services/LLMService';
import { LLMRequest, LLMRequestType } from '../models/LLMModels';

/**
 * Duplicate Detector Agent - Identifies and manages duplicate or similar notes
 * Implements FAISS-like vector indexing and LLM-powered semantic comparison
 */
export class DuplicateDetectorAgent {
  private vectorIndex: VectorIndexingService;
  private llmService: LLMService;
  private readonly SIMILARITY_THRESHOLD = 0.8;
  private readonly EMBEDDING_DIMENSION = 384; // MobileBERT embedding size
  private readonly MAX_NOTES_FLAT_INDEX = 100000;

  constructor(llmService: LLMService, vectorIndexingService?: VectorIndexingService) {
    this.llmService = llmService;
    this.vectorIndex = vectorIndexingService || new VectorIndexingServiceImpl();
  }

  /**
   * Initialize the duplicate detector with appropriate indexing strategy
   */
  async initialize(totalNotes: number): Promise<void> {
    const indexType = totalNotes < this.MAX_NOTES_FLAT_INDEX
      ? IndexType.FLAT_IP
      : IndexType.IVF_FLAT;

    await this.vectorIndex.initialize({
      dimension: this.EMBEDDING_DIMENSION,
      indexType,
      threshold: this.SIMILARITY_THRESHOLD
    });
  }

  /**
   * Detect duplicates in a collection of notes
   */
  async detectDuplicates(notes: Note[]): Promise<DuplicateGroup[]> {
    // Initialize if not already done
    if (this.vectorIndex.getStats().totalVectors === 0) {
      await this.initialize(notes.length);
    }

    // Generate embeddings and build index
    const embeddings = await this.generateEmbeddings(notes);
    await this.vectorIndex.addVectors(embeddings);

    // Find similar note pairs
    const duplicateGroups: DuplicateGroup[] = [];
    const processedNotes = new Set<string>();

    for (const note of notes) {
      if (processedNotes.has(note.id)) {
        continue;
      }

      const embedding = embeddings.find(e => e.id === note.id);
      if (!embedding) {
        continue;
      }

      // Search for similar notes
      const similarResults = await this.vectorIndex.search(embedding.vector, 10);
      const similarNotes = similarResults
        .filter(result => result.id !== note.id && !processedNotes.has(result.id))
        .filter(result => result.similarity >= this.SIMILARITY_THRESHOLD);

      if (similarNotes.length > 0) {
        // Create duplicate group
        const noteIds = [note.id, ...similarNotes.map(r => r.id)];

        // Use LLM for semantic comparison and ranking
        const notesForGroup = noteIds.map(id => notes.find(n => n.id === id)).filter((note): note is Note => note !== undefined);
        if (notesForGroup.length > 1) {
          // Create similarity scores array that matches the notes in the group
          // The first note is the primary note, so we need similarities between it and the rest
          const groupSimilarities: number[] = [];
          for (let i = 1; i < notesForGroup.length; i++) {
            const noteId = notesForGroup[i].id;
            const similarResult = similarNotes.find(r => r.id === noteId);
            if (similarResult) {
              groupSimilarities.push(similarResult.similarity);
            } else {
              // Fallback similarity if not found (shouldn't happen in normal cases)
              groupSimilarities.push(this.SIMILARITY_THRESHOLD);
            }
          }

          const duplicateGroup = await this.createDuplicateGroup(
            notesForGroup,
            groupSimilarities
          );

          duplicateGroups.push(duplicateGroup);

          // Mark all notes in this group as processed
          noteIds.forEach(id => processedNotes.add(id));
        }
      }
    }

    return duplicateGroups;
  }

  /**
   * Generate embeddings for notes using LLM
   */
  private async generateEmbeddings(notes: Note[]): Promise<VectorIndex[]> {
    const embeddings: VectorIndex[] = [];

    for (const note of notes) {
      try {
        // Create content for embedding
        const content = this.prepareContentForEmbedding(note);

        // Generate embedding using LLM
        const embedding = await this.generateEmbedding(content);

        embeddings.push({
          id: note.id,
          vector: embedding,
          metadata: {
            title: note.title,
            wordCount: note.metadata.wordCount,
            modifiedDate: note.modifiedDate.toISOString()
          }
        });
      } catch (error) {
        console.warn(`Failed to generate embedding for note ${note.id}:`, error);
        // Create zero vector as fallback
        embeddings.push({
          id: note.id,
          vector: new Array(this.EMBEDDING_DIMENSION).fill(0),
          metadata: {
            title: note.title,
            wordCount: note.metadata.wordCount,
            modifiedDate: note.modifiedDate.toISOString()
          }
        });
      }
    }

    return embeddings;
  }

  /**
   * Generate embedding vector for content using LLM
   */
  private async generateEmbedding(content: string): Promise<number[]> {
    // For now, create a simple hash-based embedding
    // In a real implementation, this would use the LLM's embedding capabilities
    const embedding = new Array(this.EMBEDDING_DIMENSION).fill(0);

    // Simple hash-based embedding generation
    for (let i = 0; i < content.length && i < this.EMBEDDING_DIMENSION; i++) {
      const charCode = content.charCodeAt(i);
      embedding[i % this.EMBEDDING_DIMENSION] += charCode / 255.0;
    }

    // Normalize the embedding
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    if (magnitude > 0) {
      for (let i = 0; i < embedding.length; i++) {
        embedding[i] /= magnitude;
      }
    }

    return embedding;
  }

  /**
   * Prepare note content for embedding generation
   */
  private prepareContentForEmbedding(note: Note): string {
    let content = `${note.title}\n${note.content}`;

    // Add checklist content
    if (note.checklists.length > 0) {
      const checklistText = note.checklists
        .map(item => `${item.completed ? '✓' : '○'} ${item.text}`)
        .join('\n');
      content += `\n${checklistText}`;
    }

    // Add attachment information
    if (note.attachments.length > 0) {
      const attachmentText = note.attachments
        .map(att => `[${att.type}] ${att.filename}`)
        .join('\n');
      content += `\n${attachmentText}`;
    }

    return content.trim();
  }

  /**
   * Create a duplicate group with LLM-powered analysis
   */
  private async createDuplicateGroup(notes: Note[], similarities: number[]): Promise<DuplicateGroup> {
    // Rank notes by completeness, recency, and quality
    const rankedNotes = await this.rankNotesByQuality(notes);
    const primaryNote = rankedNotes[0];

    // Determine merge strategy using LLM
    const mergeStrategy = await this.determineMergeStrategy(notes, primaryNote);

    // Identify conflict areas
    const conflictAreas = await this.identifyConflictAreas(notes);

    return {
      id: `dup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      noteIds: notes.map(n => n.id),
      similarityScores: similarities,
      recommendedPrimary: primaryNote.id,
      mergeStrategy,
      conflictAreas,
      confidence: this.calculateGroupConfidence(similarities),
      timestamp: new Date()
    };
  }

  /**
   * Rank notes by completeness, recency, and quality
   */
  private async rankNotesByQuality(notes: Note[]): Promise<Note[]> {
    const scoredNotes = await Promise.all(notes.map(async (note) => {
      const qualityScore = await this.calculateQualityScore(note);
      return { note, score: qualityScore };
    }));

    scoredNotes.sort((a, b) => b.score - a.score);
    return scoredNotes.map(item => item.note);
  }

  /**
   * Calculate quality score for a note
   */
  private async calculateQualityScore(note: Note): Promise<number> {
    let score = 0;

    // Content completeness (40% weight)
    const contentLength = note.content?.length || 0;
    const contentScore = Math.min(contentLength / 1000, 1) * 40;
    score += contentScore;

    // Recency (30% weight)
    const daysSinceModified = (Date.now() - note.modifiedDate.getTime()) / (1000 * 60 * 60 * 24);
    const recencyScore = Math.max(0, (30 - daysSinceModified) / 30) * 30;
    score += recencyScore;

    // Metadata richness (20% weight)
    const metadataScore = (
      (note.attachments.length > 0 ? 5 : 0) +
      (note.checklists.length > 0 ? 5 : 0) +
      (note.metadata.tags.length > 0 ? 5 : 0) +
      (note.title.length > 10 ? 5 : 0)
    );
    score += metadataScore;

    // Usage patterns (10% weight)
    const usageScore = Math.min(note.metadata.accessCount / 10, 1) * 10;
    score += usageScore;

    return score;
  }

  /**
   * Determine merge strategy using LLM analysis
   */
  private async determineMergeStrategy(notes: Note[], primaryNote: Note): Promise<MergeStrategy> {
    try {
      const request: LLMRequest = {
        agentId: 'duplicate-detector',
        requestType: LLMRequestType.CONTENT_ANALYSIS,
        context: 'Analyzing duplicate notes for merge strategy',
        noteContent: notes.map(n => `Note ${n.id}: ${n.title}\n${n.content.substring(0, 500)}`).join('\n\n'),
        systemPrompt: 'You are analyzing duplicate notes to determine the best merge strategy.',
        userPrompt: `Analyze these duplicate notes and determine the best merge strategy:

${notes.map((n, i) => `Note ${i + 1} (${n.id}): "${n.title}"
Content: ${n.content.substring(0, 300)}...
Modified: ${n.modifiedDate.toISOString()}
Word Count: ${n.metadata.wordCount}
`).join('\n')}

Primary note: ${primaryNote.id}

Determine if these notes should be:
1. KEEP_PRIMARY - Keep only the primary note
2. COMBINE_CONTENT - Merge content from all notes
3. MANUAL_REVIEW - Require human review

Respond with just the strategy name.`,
        maxTokens: 50,
        temperature: 0.1
      };

      const response = await this.llmService.processRequest(request);
      const strategyText = response.response.trim().toUpperCase();

      let mergeType: MergeType;
      if (strategyText.includes('KEEP_PRIMARY')) {
        mergeType = MergeType.KEEP_PRIMARY;
      } else if (strategyText.includes('COMBINE_CONTENT')) {
        mergeType = MergeType.COMBINE_CONTENT;
      } else {
        mergeType = MergeType.MANUAL_REVIEW;
      }

      return {
        type: mergeType,
        primaryNoteId: primaryNote.id,
        contentCombination: this.getContentCombinationRules(mergeType),
        metadataHandling: MetadataHandlingRule.KEEP_PRIMARY
      };
    } catch (error) {
      console.warn('LLM merge strategy analysis failed, using fallback:', error);
      return {
        type: MergeType.MANUAL_REVIEW,
        primaryNoteId: primaryNote.id,
        contentCombination: [ContentCombinationRule.KEEP_LONGEST],
        metadataHandling: MetadataHandlingRule.KEEP_PRIMARY
      };
    }
  }

  /**
   * Get content combination rules based on merge type
   */
  private getContentCombinationRules(mergeType: MergeType): ContentCombinationRule[] {
    switch (mergeType) {
      case MergeType.KEEP_PRIMARY:
        return [ContentCombinationRule.KEEP_LONGEST];
      case MergeType.COMBINE_CONTENT:
        return [ContentCombinationRule.MERGE_SECTIONS, ContentCombinationRule.APPEND];
      default:
        return [ContentCombinationRule.KEEP_LONGEST];
    }
  }

  /**
   * Identify areas where notes have conflicting information
   */
  private async identifyConflictAreas(notes: Note[]): Promise<ConflictArea[]> {
    const conflicts: ConflictArea[] = [];

    // Check for title conflicts
    const uniqueTitles = [...new Set(notes.map(n => n.title))];
    if (uniqueTitles.length > 1) {
      conflicts.push({
        field: 'title',
        values: notes.map(n => ({
          noteId: n.id,
          value: n.title,
          confidence: n.title.length > 10 ? 0.8 : 0.4
        })),
        resolutionStrategy: ConflictResolution.KEEP_LONGEST
      });
    }

    // Check for folder conflicts
    const uniqueFolders = [...new Set(notes.map(n => n.folder))];
    if (uniqueFolders.length > 1) {
      conflicts.push({
        field: 'folder',
        values: notes.map(n => ({
          noteId: n.id,
          value: n.folder,
          confidence: 0.7
        })),
        resolutionStrategy: ConflictResolution.KEEP_PRIMARY
      });
    }

    // Check for significant content differences
    const contentLengths = notes.map(n => n.content.length);
    const maxLength = Math.max(...contentLengths);
    const minLength = Math.min(...contentLengths);

    if (maxLength > minLength * 1.5) {
      conflicts.push({
        field: 'content_length',
        values: notes.map(n => ({
          noteId: n.id,
          value: n.content.length,
          confidence: 0.6
        })),
        resolutionStrategy: ConflictResolution.KEEP_LONGEST
      });
    }

    return conflicts;
  }

  /**
   * Calculate confidence score for duplicate group
   */
  private calculateGroupConfidence(similarities: number[]): number {
    if (similarities.length === 0) return 0;

    const avgSimilarity = similarities.reduce((sum, sim) => sum + sim, 0) / similarities.length;
    const minSimilarity = Math.min(...similarities);

    // Confidence is based on average similarity and minimum similarity
    return (avgSimilarity * 0.7 + minSimilarity * 0.3);
  }

  /**
   * Get statistics about the current index
   */
  getIndexStats() {
    return this.vectorIndex.getStats();
  }

  /**
   * Clear the vector index
   */
  async clearIndex(): Promise<void> {
    await this.vectorIndex.clear();
  }
}