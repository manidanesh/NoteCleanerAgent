import { NotesChangeEvent } from '../NotesAPIService';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as os from 'os';

const execAsync = promisify(exec);

/**
 * FSEvents monitor for real-time Apple Notes changes on macOS
 */
export class FSEventsMonitor {
  private static instance: FSEventsMonitor;
  private isMonitoring = false;
  private monitorProcess: any = null;
  private changeCallbacks: ((event: NotesChangeEvent) => void)[] = [];
  private notesDirectory: string;

  private constructor() {
    // Apple Notes stores data in ~/Library/Group Containers/group.com.apple.notes/
    this.notesDirectory = path.join(
      os.homedir(),
      'Library/Group Containers/group.com.apple.notes'
    );
  }

  static getInstance(): FSEventsMonitor {
    if (!FSEventsMonitor.instance) {
      FSEventsMonitor.instance = new FSEventsMonitor();
    }
    return FSEventsMonitor.instance;
  }

  /**
   * Start monitoring Notes directory for changes
   */
  async startMonitoring(): Promise<void> {
    if (this.isMonitoring) {
      return;
    }

    try {
      // Check if fswatch is available (common macOS file monitoring tool)
      await this.checkFSWatchAvailability();
      
      this.isMonitoring = true;
      await this.startFSWatchMonitoring();
    } catch (error) {
      console.error('Failed to start FSEvents monitoring:', error);
      // Fall back to polling-based monitoring
      this.startPollingMonitoring();
    }
  }

  /**
   * Stop monitoring for changes
   */
  stopMonitoring(): void {
    if (!this.isMonitoring) {
      return;
    }

    this.isMonitoring = false;

    if (this.monitorProcess) {
      try {
        this.monitorProcess.kill();
        this.monitorProcess = null;
      } catch (error) {
        console.error('Failed to stop monitoring process:', error);
      }
    }
  }

  /**
   * Register callback for change events
   */
  onNotesChanged(callback: (event: NotesChangeEvent) => void): void {
    this.changeCallbacks.push(callback);
  }

  /**
   * Remove change callback
   */
  removeChangeCallback(callback: (event: NotesChangeEvent) => void): void {
    const index = this.changeCallbacks.indexOf(callback);
    if (index > -1) {
      this.changeCallbacks.splice(index, 1);
    }
  }

  /**
   * Check if fswatch is available on the system
   */
  private async checkFSWatchAvailability(): Promise<void> {
    try {
      await execAsync('which fswatch');
    } catch (error) {
      throw new Error('fswatch not available. Install with: brew install fswatch');
    }
  }

  /**
   * Start FSWatch-based monitoring
   */
  private async startFSWatchMonitoring(): Promise<void> {
    try {
      const { spawn } = require('child_process');
      
      // Monitor the Notes directory with fswatch
      this.monitorProcess = spawn('fswatch', [
        '-r', // recursive
        '-l', '1', // latency of 1 second
        '--event=Created',
        '--event=Updated', 
        '--event=Removed',
        '--event=Renamed',
        this.notesDirectory
      ]);

      this.monitorProcess.stdout.on('data', (data: Buffer) => {
        const output = data.toString().trim();
        this.processFSWatchOutput(output);
      });

      this.monitorProcess.stderr.on('data', (data: Buffer) => {
        console.error('FSWatch error:', data.toString());
      });

      this.monitorProcess.on('close', (code: number) => {
        if (this.isMonitoring && code !== 0) {
          console.error('FSWatch process closed with code:', code);
          // Attempt to restart monitoring
          setTimeout(() => {
            if (this.isMonitoring) {
              this.startFSWatchMonitoring();
            }
          }, 5000);
        }
      });

      console.log('FSWatch monitoring started for Notes directory');
    } catch (error) {
      console.error('Failed to start FSWatch monitoring:', error);
      throw error;
    }
  }

  /**
   * Process FSWatch output to detect note changes
   */
  private processFSWatchOutput(output: string): void {
    const lines = output.split('\n').filter(line => line.trim());
    
    for (const line of lines) {
      try {
        // FSWatch outputs file paths that changed
        const filePath = line.trim();
        
        // Filter for relevant Notes database files
        if (this.isNotesRelatedFile(filePath)) {
          const event = this.createChangeEvent(filePath);
          if (event) {
            this.notifyChangeCallbacks(event);
          }
        }
      } catch (error) {
        console.error('Error processing FSWatch output:', error);
      }
    }
  }

  /**
   * Check if file path is related to Notes data
   */
  private isNotesRelatedFile(filePath: string): boolean {
    // Apple Notes uses Core Data with .sqlite files
    return filePath.includes('NoteStore.sqlite') ||
           filePath.includes('NotesV') ||
           filePath.includes('.sqlite-wal') ||
           filePath.includes('.sqlite-shm');
  }

  /**
   * Create change event from file path
   */
  private createChangeEvent(filePath: string): NotesChangeEvent | null {
    try {
      // Extract note ID from file path or database changes
      // This is simplified - real implementation would need to query the database
      const noteId = this.extractNoteIdFromPath(filePath);
      
      if (!noteId) {
        return null;
      }

      // Determine change type based on file operation
      let changeType: 'created' | 'updated' | 'deleted' = 'updated';
      
      if (filePath.includes('INSERT')) {
        changeType = 'created';
      } else if (filePath.includes('DELETE')) {
        changeType = 'deleted';
      }

      return {
        type: changeType,
        noteId,
        timestamp: new Date()
      };
    } catch (error) {
      console.error('Error creating change event:', error);
      return null;
    }
  }

  /**
   * Extract note ID from file path (simplified)
   */
  private extractNoteIdFromPath(filePath: string): string | null {
    // This is a simplified implementation
    // Real implementation would need to monitor database changes more precisely
    const timestamp = Date.now().toString();
    return `note_${timestamp}`;
  }

  /**
   * Start polling-based monitoring as fallback
   */
  private startPollingMonitoring(): void {
    console.log('Starting polling-based monitoring as fallback');
    
    let lastModified = new Map<string, number>();
    
    const pollInterval = setInterval(async () => {
      if (!this.isMonitoring) {
        clearInterval(pollInterval);
        return;
      }

      try {
        // Check modification times of Notes database files
        const { stat } = require('fs').promises;
        const dbPath = path.join(this.notesDirectory, 'NoteStore.sqlite');
        
        try {
          const stats = await stat(dbPath);
          const currentModified = stats.mtime.getTime();
          const previousModified = lastModified.get(dbPath);
          
          if (previousModified && currentModified > previousModified) {
            // Database was modified, notify of potential changes
            const event: NotesChangeEvent = {
              type: 'updated',
              noteId: `polling_${Date.now()}`,
              timestamp: new Date()
            };
            
            this.notifyChangeCallbacks(event);
          }
          
          lastModified.set(dbPath, currentModified);
        } catch (error) {
          // Database file might not exist or be accessible
          console.debug('Could not access Notes database for polling:', error);
        }
      } catch (error) {
        console.error('Error in polling monitoring:', error);
      }
    }, 5000); // Poll every 5 seconds
  }

  /**
   * Notify all registered callbacks of changes
   */
  private notifyChangeCallbacks(event: NotesChangeEvent): void {
    this.changeCallbacks.forEach(callback => {
      try {
        callback(event);
      } catch (error) {
        console.error('Error in change callback:', error);
      }
    });
  }

  /**
   * Get Notes directory path
   */
  getNotesDirectory(): string {
    return this.notesDirectory;
  }

  /**
   * Check if monitoring is active
   */
  isActive(): boolean {
    return this.isMonitoring;
  }
}