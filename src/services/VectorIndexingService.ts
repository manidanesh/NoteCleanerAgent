/**
 * Vector Indexing Service for similarity search and duplicate detection
 * Implements FAISS-like functionality with SQLite persistence
 */

import { DatabaseService } from './DatabaseService';

export interface VectorIndex {
  id: string;
  vector: number[];
  metadata: Record<string, any>;
}

export interface SimilarityResult {
  id: string;
  similarity: number;
  metadata: Record<string, any>;
}

export interface IndexConfig {
  dimension: number;
  indexType: IndexType;
  threshold: number;
}

export enum IndexType {
  FLAT_IP = 'flat_ip', // Inner Product (for <100K notes)
  IVF_FLAT = 'ivf_flat' // Inverted File Flat (for larger collections)
}

/**
 * Vector Indexing Service interface
 */
export interface VectorIndexingService {
  /**
   * Initialize the index with configuration
   */
  initialize(config: IndexConfig): Promise<void>;

  /**
   * Add vectors to the index
   */
  addVectors(vectors: VectorIndex[]): Promise<void>;

  /**
   * Search for similar vectors
   */
  search(queryVector: number[], k: number): Promise<SimilarityResult[]>;

  /**
   * Remove vectors from index
   */
  removeVectors(ids: string[]): Promise<void>;

  /**
   * Get index statistics
   */
  getStats(): IndexStats;

  /**
   * Clear the entire index
   */
  clear(): Promise<void>;
}

export interface IndexStats {
  totalVectors: number;
  dimension: number;
  indexType: IndexType;
  memoryUsage: number;
}

/**
 * JavaScript implementation of vector indexing with SQLite persistence
 */
export class VectorIndexingServiceImpl implements VectorIndexingService {
  private vectors: Map<string, VectorIndex> = new Map();
  private config: IndexConfig | null = null;
  private clusters: Map<number, string[]> = new Map(); // For IVF implementation
  private db: DatabaseService;

  constructor(db?: DatabaseService) {
    this.db = db || new DatabaseService();
    if (!this.db.isInitialized()) {
      this.db.initialize();
    }
  }

  async initialize(config: IndexConfig): Promise<void> {
    this.config = config;
    this.vectors.clear();
    this.clusters.clear();

    // Load vectors from database
    try {
      const rows = this.db.query<{ id: string, vector: string, metadata: string }>('SELECT id, vector, metadata FROM vectors');

      console.log(`[VectorIndex] Loading ${rows.length} vectors from database...`);

      for (const row of rows) {
        try {
          const vector = JSON.parse(row.vector);
          const metadata = JSON.parse(row.metadata);

          if (vector.length === config.dimension) {
            this.vectors.set(row.id, {
              id: row.id,
              vector,
              metadata
            });

            // Rebuild clusters if needed
            if (config.indexType === IndexType.IVF_FLAT) {
              const clusterId = this.assignToCluster(vector);
              if (!this.clusters.has(clusterId)) {
                this.clusters.set(clusterId, []);
              }
              this.clusters.get(clusterId)!.push(row.id);
            }
          }
        } catch (e) {
          console.warn(`[VectorIndex] Failed to load vector ${row.id}:`, e);
        }
      }

      console.log(`[VectorIndex] Loaded ${this.vectors.size} vectors`);

    } catch (error) {
      console.error('[VectorIndex] Failed to load vectors from DB:', error);
      // Fallback: start empty if DB read fails (rare)
    }
  }

  async addVectors(vectors: VectorIndex[]): Promise<void> {
    if (!this.config) {
      throw new Error('Index not initialized');
    }

    // Persist to DB first
    this.db.transaction(() => {
      for (const vector of vectors) {
        this.db.execute(
          `INSERT OR REPLACE INTO vectors (id, vector, metadata, created_at) VALUES (?, ?, ?, ?)`,
          [
            vector.id,
            JSON.stringify(vector.vector),
            JSON.stringify(vector.metadata),
            Date.now()
          ]
        );
      }
    });

    // specific memory updates
    for (const vector of vectors) {
      if (vector.vector.length !== this.config.dimension) {
        console.warn(`Vector dimension mismatch for ${vector.id}: expected ${this.config.dimension}, got ${vector.vector.length}`);
        continue;
      }

      this.vectors.set(vector.id, vector);

      // For IVF index, assign to cluster
      if (this.config.indexType === IndexType.IVF_FLAT) {
        const clusterId = this.assignToCluster(vector.vector);
        if (!this.clusters.has(clusterId)) {
          this.clusters.set(clusterId, []);
        }
        this.clusters.get(clusterId)!.push(vector.id);
      }
    }
  }

  async search(queryVector: number[], k: number): Promise<SimilarityResult[]> {
    if (!this.config) {
      throw new Error('Index not initialized');
    }

    if (queryVector.length !== this.config.dimension) {
      throw new Error(`Query vector dimension mismatch: expected ${this.config.dimension}, got ${queryVector.length}`);
    }

    const results: SimilarityResult[] = [];

    if (this.config.indexType === IndexType.FLAT_IP) {
      // Flat search - check all vectors
      // Since we loaded into memory, we iterate the Map
      for (const [id, vector] of this.vectors) {
        const similarity = this.computeInnerProduct(queryVector, vector.vector);
        if (similarity >= this.config.threshold) {
          results.push({
            id,
            similarity,
            metadata: vector.metadata
          });
        }
      }
    } else if (this.config.indexType === IndexType.IVF_FLAT) {
      // IVF search - search relevant clusters
      const relevantClusters = this.findRelevantClusters(queryVector, 3); // Search top 3 clusters

      for (const clusterId of relevantClusters) {
        const vectorIds = this.clusters.get(clusterId) || [];
        for (const id of vectorIds) {
          const vector = this.vectors.get(id);
          if (vector) {
            const similarity = this.computeInnerProduct(queryVector, vector.vector);
            if (similarity >= this.config.threshold) {
              results.push({
                id,
                similarity,
                metadata: vector.metadata
              });
            }
          }
        }
      }
    }

    // Sort by similarity (descending) and return top k
    results.sort((a, b) => b.similarity - a.similarity);
    return results.slice(0, k);
  }

  async removeVectors(ids: string[]): Promise<void> {
    // Remove from DB
    const placeholders = ids.map(() => '?').join(',');
    this.db.execute(`DELETE FROM vectors WHERE id IN (${placeholders})`, ids);

    // Remove from memory
    for (const id of ids) {
      this.vectors.delete(id);

      // Remove from clusters if using IVF
      if (this.config?.indexType === IndexType.IVF_FLAT) {
        for (const [clusterId, vectorIds] of this.clusters) {
          const index = vectorIds.indexOf(id);
          if (index > -1) {
            vectorIds.splice(index, 1);
            if (vectorIds.length === 0) {
              this.clusters.delete(clusterId);
            }
            break;
          }
        }
      }
    }
  }

  getStats(): IndexStats {
    return {
      totalVectors: this.vectors.size,
      dimension: this.config?.dimension || 0,
      indexType: this.config?.indexType || IndexType.FLAT_IP,
      memoryUsage: this.estimateMemoryUsage()
    };
  }

  async clear(): Promise<void> {
    this.db.execute('DELETE FROM vectors');
    this.vectors.clear();
    this.clusters.clear();
  }

  private computeInnerProduct(a: number[], b: number[]): number {
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      sum += a[i] * b[i];
    }
    return sum;
  }

  private assignToCluster(vector: number[]): number {
    // Simple clustering based on vector hash for IVF
    // In a real implementation, this would use k-means clustering
    const hash = vector.reduce((sum, val, idx) => sum + val * (idx + 1), 0);
    return Math.floor(Math.abs(hash) % 100); // 100 clusters
  }

  private findRelevantClusters(queryVector: number[], numClusters: number): number[] {
    // Find clusters most likely to contain similar vectors
    const clusterScores: Array<{ id: number; score: number }> = [];

    for (const clusterId of this.clusters.keys()) {
      // Simple scoring based on cluster centroid approximation
      const score = this.assignToCluster(queryVector) === clusterId ? 1.0 : 0.1;
      clusterScores.push({ id: clusterId, score });
    }

    clusterScores.sort((a, b) => b.score - a.score);
    return clusterScores.slice(0, numClusters).map(c => c.id);
  }

  private estimateMemoryUsage(): number {
    // Rough estimate in bytes
    const vectorSize = (this.config?.dimension || 0) * 8; // 8 bytes per float64
    const metadataSize = 500; // Estimate for metadata + overhead
    return this.vectors.size * (vectorSize + metadataSize);
  }
}