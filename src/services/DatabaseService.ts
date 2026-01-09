import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

/**
 * Service for handling persistent SQLite storage
 * Implements persistent storage for vectors and metadata
 */
export class DatabaseService {
    private db: Database.Database | null = null;
    private dbPath: string;

    constructor(storagePath?: string) {
        // Default to a 'data' directory in the project root if not specified
        // In production electron app this should be app.getPath('userData')
        this.dbPath = storagePath || path.join(process.cwd(), 'data', 'notes-organizer.db');
    }

    /**
     * Initialize the database connection and run migrations
     */
    initialize(): void {
        try {
            const dataDir = path.dirname(this.dbPath);
            if (!fs.existsSync(dataDir)) {
                fs.mkdirSync(dataDir, { recursive: true });
            }

            this.db = new Database(this.dbPath);

            // Optimize for performance
            this.db.pragma('journal_mode = WAL');
            this.db.pragma('synchronous = NORMAL');

            console.log(`[DatabaseService] Connected to SQLite at ${this.dbPath}`);

            this.runMigrations();
        } catch (error) {
            console.error('[DatabaseService] Failed to initialize database:', error);
            throw error;
        }
    }

    /**
     * Run schema migrations
     */
    private runMigrations(): void {
        if (!this.db) throw new Error('Database not initialized');

        const run = this.db.transaction(() => {
            // Table for storing vector embeddings
            this.db!.exec(`
        CREATE TABLE IF NOT EXISTS vectors (
          id TEXT PRIMARY KEY,
          vector TEXT NOT NULL,      -- JSON string of number[]
          metadata TEXT NOT NULL,    -- JSON string of object
          created_at INTEGER NOT NULL
        )
      `);

            // Table for generic key-value storage (settings, state)
            this.db!.exec(`
        CREATE TABLE IF NOT EXISTS kv_store (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at INTEGER NOT NULL
        )
      `);

            // Optional: Add more tables as needed (e.g. jobs, notes_cache)
        });

        run();
    }

    /**
     * Execute a query that returns multiple rows
     */
    query<T>(sql: string, params: any[] = []): T[] {
        if (!this.db) throw new Error('Database not initialized');
        return this.db.prepare(sql).all(...params) as T[];
    }

    /**
     * Execute a query that returns a single row
     */
    queryOne<T>(sql: string, params: any[] = []): T | undefined {
        if (!this.db) throw new Error('Database not initialized');
        return this.db.prepare(sql).get(...params) as T | undefined;
    }

    /**
     * Execute a statement (INSERT, UPDATE, DELETE)
     */
    execute(sql: string, params: any[] = []): Database.RunResult {
        if (!this.db) throw new Error('Database not initialized');
        return this.db.prepare(sql).run(...params);
    }

    /**
     * Execute a transaction
     */
    transaction<T>(fn: () => T): T {
        if (!this.db) throw new Error('Database not initialized');
        return this.db.transaction(fn)();
    }

    /**
     * Close the database connection
     */
    close(): void {
        if (this.db) {
            this.db.close();
            this.db = null;
            console.log('[DatabaseService] Database connection closed');
        }
    }

    /**
     * Check if database is initialized
     */
    isInitialized(): boolean {
        return this.db !== null;
    }
}
