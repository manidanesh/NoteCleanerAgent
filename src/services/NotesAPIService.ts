import { Note, Attachment, ChecklistItem, NoteMetadata, AttachmentType } from '../models/Note';
import { EventKitBridge } from './platforms/EventKitBridge';
import { AppleScriptBridge } from './platforms/AppleScriptBridge';
import { FSEventsMonitor } from './platforms/FSEventsMonitor';
import { ErrorHandlingService, ErrorCategory } from './ErrorHandlingService';

/**
 * Permission status for Apple Notes access
 */
export enum PermissionStatus {
  NOT_REQUESTED = 'not_requested',
  GRANTED = 'granted',
  DENIED = 'denied',
  REVOKED = 'revoked'
}

/**
 * Rate limiting configuration
 */
interface RateLimitConfig {
  maxNotesPerSecond: number;
  retryAttempts: number;
  backoffMultiplier: number;
  initialDelayMs: number;
}

/**
 * API operation result
 */
export interface APIResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  retryAfter?: number;
}

/**
 * Notes change event for real-time monitoring
 */
export interface NotesChangeEvent {
  type: 'created' | 'updated' | 'deleted';
  noteId: string;
  timestamp: Date;
}

/**
 * Apple Notes API Service interface
 */
export interface NotesAPIService {
  // Permission management
  requestPermission(): Promise<PermissionStatus>;
  checkPermissionStatus(): Promise<PermissionStatus>;
  onPermissionRevoked(callback: () => void): void;

  // Note operations
  getAllNotes(): Promise<APIResult<Note[]>>;
  getNoteById(id: string): Promise<APIResult<Note>>;
  updateNote(note: Note): Promise<APIResult<Note>>;
  deleteNote(id: string): Promise<APIResult<void>>;
  
  // Real-time monitoring
  startMonitoring(): Promise<void>;
  stopMonitoring(): void;
  onNotesChanged(callback: (event: NotesChangeEvent) => void): void;

  // Rate limiting and retry
  setRateLimitConfig(config: Partial<RateLimitConfig>): void;
}

/**
 * Cross-platform Apple Notes API implementation
 */
export class AppleNotesAPIService implements NotesAPIService {
  private permissionStatus: PermissionStatus = PermissionStatus.NOT_REQUESTED;
  private permissionCallbacks: (() => void)[] = [];
  private changeCallbacks: ((event: NotesChangeEvent) => void)[] = [];
  private isMonitoring = false;
  private rateLimitConfig: RateLimitConfig = {
    maxNotesPerSecond: 100,
    retryAttempts: 3,
    backoffMultiplier: 2,
    initialDelayMs: 1000
  };
  private lastRequestTime = 0;
  private requestCount = 0;
  private eventKitBridge?: EventKitBridge;
  private appleScriptBridge?: AppleScriptBridge;
  private fsEventsMonitor?: FSEventsMonitor;
  private errorHandlingService: ErrorHandlingService;

  constructor(errorHandlingService?: ErrorHandlingService) {
    this.errorHandlingService = errorHandlingService || new ErrorHandlingService();
    this.initializePlatformSpecific();
  }

  /**
   * Initialize platform-specific implementations
   */
  private initializePlatformSpecific(): void {
    if (this.isIOS()) {
      this.eventKitBridge = EventKitBridge.getInstance();
    } else if (this.isMacOS()) {
      this.appleScriptBridge = AppleScriptBridge.getInstance();
      this.fsEventsMonitor = FSEventsMonitor.getInstance();
      
      // Set up FSEvents change monitoring
      this.fsEventsMonitor.onNotesChanged((event) => {
        this.notifyNotesChanged(event);
      });
    }
  }

  /**
   * Request permission to access Apple Notes
   */
  async requestPermission(): Promise<PermissionStatus> {
    try {
      if (this.isIOS() && this.eventKitBridge) {
        this.permissionStatus = await this.eventKitBridge.requestPermission();
      } else if (this.isMacOS() && this.appleScriptBridge) {
        this.permissionStatus = await this.appleScriptBridge.requestPermission();
      } else {
        this.permissionStatus = PermissionStatus.DENIED;
      }
      
      return this.permissionStatus;
    } catch (error) {
      console.error('Permission request failed:', error);
      this.permissionStatus = PermissionStatus.DENIED;
      return this.permissionStatus;
    }
  }

  /**
   * Check current permission status
   */
  async checkPermissionStatus(): Promise<PermissionStatus> {
    try {
      // If permission was explicitly revoked, return that status
      if (this.permissionStatus === PermissionStatus.REVOKED) {
        return PermissionStatus.REVOKED;
      }

      if (this.isIOS() && this.eventKitBridge) {
        this.permissionStatus = await this.eventKitBridge.checkPermissionStatus();
      } else if (this.isMacOS() && this.appleScriptBridge) {
        this.permissionStatus = await this.appleScriptBridge.checkPermissionStatus();
      } else {
        this.permissionStatus = PermissionStatus.DENIED;
      }
      
      return this.permissionStatus;
    } catch (error) {
      console.error('Permission check failed:', error);
      return PermissionStatus.DENIED;
    }
  }

  /**
   * Register callback for permission revocation
   */
  onPermissionRevoked(callback: () => void): void {
    this.permissionCallbacks.push(callback);
  }

  /**
   * Get all notes with rate limiting and retry logic
   * Requirement 15.2: API retry logic with exponential backoff
   */
  async getAllNotes(): Promise<APIResult<Note[]>> {
    return await this.errorHandlingService.handleAPIFailure(
      async () => {
        const permissionStatus = await this.checkPermissionStatus();
        if (permissionStatus !== PermissionStatus.GRANTED) {
          throw new Error('Permission not granted');
        }

        if (this.isIOS() && this.eventKitBridge) {
          const result = await this.eventKitBridge.getAllNotes();
          if (!result.success) {
            throw new Error(result.error || 'EventKit operation failed');
          }
          return result.data!;
        } else if (this.isMacOS() && this.appleScriptBridge) {
          const result = await this.appleScriptBridge.getAllNotes();
          if (!result.success) {
            throw new Error(result.error || 'AppleScript operation failed');
          }
          return result.data!;
        }
        
        throw new Error('Platform not supported');
      },
      'getAllNotes',
      ErrorCategory.API_FAILURE
    ).then(data => ({ success: true, data }))
     .catch(error => ({ success: false, error: error.message }));
  }

  /**
   * Get note by ID with rate limiting
   * Requirement 15.2: API retry logic with exponential backoff
   */
  async getNoteById(id: string): Promise<APIResult<Note>> {
    return await this.errorHandlingService.handleAPIFailure(
      async () => {
        const permissionStatus = await this.checkPermissionStatus();
        if (permissionStatus !== PermissionStatus.GRANTED) {
          throw new Error('Permission not granted');
        }

        if (this.isIOS() && this.eventKitBridge) {
          const result = await this.eventKitBridge.getNoteById(id);
          if (!result.success) {
            throw new Error(result.error || 'EventKit operation failed');
          }
          return result.data!;
        } else if (this.isMacOS() && this.appleScriptBridge) {
          const result = await this.appleScriptBridge.getNoteById(id);
          if (!result.success) {
            throw new Error(result.error || 'AppleScript operation failed');
          }
          return result.data!;
        }
        
        throw new Error('Platform not supported');
      },
      `getNoteById(${id})`,
      ErrorCategory.API_FAILURE
    ).then(data => ({ success: true, data }))
     .catch(error => ({ success: false, error: error.message }));
  }

  /**
   * Update note with rate limiting
   */
  async updateNote(note: Note): Promise<APIResult<Note>> {
    return await this.executeWithRateLimit(async () => {
      const permissionStatus = await this.checkPermissionStatus();
      if (permissionStatus !== PermissionStatus.GRANTED) {
        return { success: false, error: 'Permission not granted' };
      }

      try {
        if (this.isIOS() && this.eventKitBridge) {
          return await this.eventKitBridge.updateNote(note);
        } else if (this.isMacOS() && this.appleScriptBridge) {
          return await this.appleScriptBridge.updateNote(note);
        }
        
        return { success: false, error: 'Platform not supported' };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });
  }

  /**
   * Delete note with rate limiting
   */
  async deleteNote(id: string): Promise<APIResult<void>> {
    return await this.executeWithRateLimit(async () => {
      const permissionStatus = await this.checkPermissionStatus();
      if (permissionStatus !== PermissionStatus.GRANTED) {
        return { success: false, error: 'Permission not granted' };
      }

      try {
        if (this.isIOS()) {
          return await this.deleteNoteEventKit(id);
        } else if (this.isMacOS()) {
          return await this.deleteNoteAppleScript(id);
        }
        
        return { success: false, error: 'Platform not supported' };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });
  }

  /**
   * Start monitoring for note changes
   */
  async startMonitoring(): Promise<void> {
    if (this.isMonitoring) return;

    const permissionStatus = await this.checkPermissionStatus();
    if (permissionStatus !== PermissionStatus.GRANTED) {
      throw new Error('Permission not granted for monitoring');
    }

    this.isMonitoring = true;

    if (this.isMacOS()) {
      await this.startFSEventsMonitoring();
    }
    // iOS monitoring would be handled through app lifecycle events
  }

  /**
   * Stop monitoring for note changes
   */
  stopMonitoring(): void {
    if (!this.isMonitoring) return;

    this.isMonitoring = false;

    if (this.isMacOS()) {
      this.stopFSEventsMonitoring();
    }
  }

  /**
   * Register callback for note changes
   */
  onNotesChanged(callback: (event: NotesChangeEvent) => void): void {
    this.changeCallbacks.push(callback);
  }

  /**
   * Set rate limiting configuration
   */
  setRateLimitConfig(config: Partial<RateLimitConfig>): void {
    this.rateLimitConfig = { ...this.rateLimitConfig, ...config };
  }

  // Platform detection methods
  private isIOS(): boolean {
    // In test environment, default to false unless explicitly set
    if (typeof window === 'undefined') {
      return false;
    }
    return (window as any).navigator?.platform?.includes('iPhone') ||
           (window as any).navigator?.platform?.includes('iPad');
  }

  private isMacOS(): boolean {
    // In test environment, check process.platform if available
    return typeof process !== 'undefined' && process.platform === 'darwin';
  }

  // Rate limiting implementation
  private async executeWithRateLimit<T>(operation: () => Promise<APIResult<T>>): Promise<APIResult<T>> {
    const now = Date.now();
    
    // Reset counter if more than 1 second has passed
    if (now - this.lastRequestTime > 1000) {
      this.requestCount = 0;
      this.lastRequestTime = now;
    }

    // Check rate limit
    if (this.requestCount >= this.rateLimitConfig.maxNotesPerSecond) {
      const waitTime = 1000 - (now - this.lastRequestTime);
      if (waitTime > 0) {
        await new Promise(resolve => setTimeout(resolve, waitTime));
        return this.executeWithRateLimit(operation);
      }
    }

    this.requestCount++;

    // Execute with retry logic
    let lastError: Error | null = null;
    for (let attempt = 0; attempt < this.rateLimitConfig.retryAttempts; attempt++) {
      try {
        const result = await operation();
        if (result.success || !result.error?.includes('rate limit')) {
          return result;
        }
        lastError = new Error(result.error);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
      }

      if (attempt < this.rateLimitConfig.retryAttempts - 1) {
        const delay = this.rateLimitConfig.initialDelayMs * 
                     Math.pow(this.rateLimitConfig.backoffMultiplier, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    return { 
      success: false, 
      error: lastError?.message || 'Operation failed after retries' 
    };
  }

  // iOS EventKit implementation stubs
  private async initializeEventKit(): Promise<void> {
    // EventKit initialization for iOS
    // This would use React Native bridge to EventKit
  }

  private async requestEventKitPermission(): Promise<PermissionStatus> {
    // Request EventKit permission
    // Implementation would use React Native EventKit bridge
    this.permissionStatus = PermissionStatus.GRANTED; // Placeholder
    return this.permissionStatus;
  }

  private async checkEventKitPermission(): Promise<PermissionStatus> {
    // Check EventKit permission status
    return this.permissionStatus;
  }

  private async getAllNotesEventKit(): Promise<APIResult<Note[]>> {
    // EventKit implementation for getting all notes
    return { success: true, data: [] }; // Placeholder
  }

  private async getNoteByIdEventKit(id: string): Promise<APIResult<Note>> {
    // EventKit implementation for getting note by ID
    return { success: false, error: 'Not implemented' }; // Placeholder
  }

  private async updateNoteEventKit(note: Note): Promise<APIResult<Note>> {
    // EventKit implementation for updating note
    return { success: false, error: 'Not implemented' }; // Placeholder
  }

  private async deleteNoteEventKit(id: string): Promise<APIResult<void>> {
    // EventKit implementation for deleting note
    return { success: false, error: 'Not implemented' }; // Placeholder
  }

  // macOS AppleScript implementation stubs
  private async initializeAppleScript(): Promise<void> {
    // AppleScript bridge initialization for macOS
  }

  private async requestAppleScriptPermission(): Promise<PermissionStatus> {
    // Request AppleScript permission for Notes access
    this.permissionStatus = PermissionStatus.GRANTED; // Placeholder
    return this.permissionStatus;
  }

  private async checkAppleScriptPermission(): Promise<PermissionStatus> {
    // Check AppleScript permission status
    return this.permissionStatus;
  }

  private async getAllNotesAppleScript(): Promise<APIResult<Note[]>> {
    // AppleScript implementation for getting all notes
    return { success: true, data: [] }; // Placeholder
  }

  private async getNoteByIdAppleScript(id: string): Promise<APIResult<Note>> {
    // AppleScript implementation for getting note by ID
    return { success: false, error: 'Not implemented' }; // Placeholder
  }

  private async updateNoteAppleScript(note: Note): Promise<APIResult<Note>> {
    // AppleScript implementation for updating note
    return { success: false, error: 'Not implemented' }; // Placeholder
  }

  private async deleteNoteAppleScript(id: string): Promise<APIResult<void>> {
    // AppleScript implementation for deleting note
    return { success: false, error: 'Not implemented' }; // Placeholder
  }

  // macOS FSEvents implementation stubs
  private async initializeFSEvents(): Promise<void> {
    // FSEvents initialization for real-time monitoring
  }

  private async startFSEventsMonitoring(): Promise<void> {
    // Start FSEvents monitoring for Notes directory changes
  }

  private stopFSEventsMonitoring(): void {
    // Stop FSEvents monitoring
  }

  // Helper methods for permission revocation detection
  private notifyPermissionRevoked(): void {
    this.permissionStatus = PermissionStatus.REVOKED;
    this.permissionCallbacks.forEach(callback => {
      try {
        callback();
      } catch (error) {
        console.error('Permission revocation callback failed:', error);
      }
    });
  }

  /**
   * Simulate permission revocation (for testing purposes)
   */
  simulatePermissionRevocation(): void {
    this.notifyPermissionRevoked();
  }

  // Helper methods for change notifications
  private notifyNotesChanged(event: NotesChangeEvent): void {
    this.changeCallbacks.forEach(callback => {
      try {
        callback(event);
      } catch (error) {
        console.error('Notes change callback failed:', error);
      }
    });
  }
}