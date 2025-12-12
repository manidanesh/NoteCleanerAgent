import { Note, Attachment, ChecklistItem, NoteMetadata, AttachmentType } from '../../models/Note';
import { PermissionStatus, APIResult } from '../NotesAPIService';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * macOS AppleScript bridge for Apple Notes access
 */
export class AppleScriptBridge {
  private static instance: AppleScriptBridge;

  private constructor() {}

  static getInstance(): AppleScriptBridge {
    if (!AppleScriptBridge.instance) {
      AppleScriptBridge.instance = new AppleScriptBridge();
    }
    return AppleScriptBridge.instance;
  }

  /**
   * Request permission to access Notes via AppleScript
   */
  async requestPermission(): Promise<PermissionStatus> {
    try {
      // Test AppleScript access by trying to get Notes app info
      const script = `
        tell application "Notes"
          get name
        end tell
      `;
      
      await this.executeAppleScript(script);
      return PermissionStatus.GRANTED;
    } catch (error) {
      console.error('AppleScript permission request failed:', error);
      return PermissionStatus.DENIED;
    }
  }

  /**
   * Check current AppleScript permission status
   */
  async checkPermissionStatus(): Promise<PermissionStatus> {
    try {
      // Test if we can access Notes app
      const script = `
        tell application "Notes"
          return "accessible"
        end tell
      `;
      
      const result = await this.executeAppleScript(script);
      return result.includes('accessible') ? PermissionStatus.GRANTED : PermissionStatus.DENIED;
    } catch (error) {
      // Check if it's a permission error
      if (error instanceof Error && error.message.includes('not allowed')) {
        return PermissionStatus.DENIED;
      }
      return PermissionStatus.DENIED;
    }
  }

  /**
   * Get all notes from Apple Notes app
   */
  async getAllNotes(): Promise<APIResult<Note[]>> {
    try {
      const script = `
        tell application "Notes"
          set notesList to {}
          repeat with acc in accounts
            repeat with folder in folders of acc
              repeat with note in notes of folder
                set noteInfo to {id of note, name of note, body of note, creation date of note, modification date of note, name of folder}
                set end of notesList to noteInfo
              end repeat
            end repeat
          end repeat
          return notesList
        end tell
      `;

      const result = await this.executeAppleScript(script);
      const notes = this.parseNotesFromAppleScript(result);
      
      return { success: true, data: notes };
    } catch (error) {
      console.error('AppleScript getAllNotes failed:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to fetch notes' 
      };
    }
  }

  /**
   * Get note by ID from Apple Notes app
   */
  async getNoteById(id: string): Promise<APIResult<Note>> {
    try {
      const script = `
        tell application "Notes"
          repeat with acc in accounts
            repeat with folder in folders of acc
              repeat with note in notes of folder
                if id of note as string is "${id}" then
                  return {id of note, name of note, body of note, creation date of note, modification date of note, name of folder}
                end if
              end repeat
            end repeat
          end repeat
          return "not found"
        end tell
      `;

      const result = await this.executeAppleScript(script);
      
      if (result.includes('not found')) {
        return { success: false, error: 'Note not found' };
      }

      const notes = this.parseNotesFromAppleScript(result);
      if (notes.length > 0) {
        return { success: true, data: notes[0] };
      }

      return { success: false, error: 'Note not found' };
    } catch (error) {
      console.error('AppleScript getNoteById failed:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to fetch note' 
      };
    }
  }

  /**
   * Update note in Apple Notes app
   */
  async updateNote(note: Note): Promise<APIResult<Note>> {
    try {
      const escapedTitle = note.title.replace(/"/g, '\\"');
      const escapedContent = note.content.replace(/"/g, '\\"');
      
      const script = `
        tell application "Notes"
          repeat with acc in accounts
            repeat with folder in folders of acc
              repeat with targetNote in notes of folder
                if id of targetNote as string is "${note.id}" then
                  set name of targetNote to "${escapedTitle}"
                  set body of targetNote to "${escapedContent}"
                  return {id of targetNote, name of targetNote, body of targetNote, creation date of targetNote, modification date of targetNote, name of folder}
                end if
              end repeat
            end repeat
          end repeat
          return "not found"
        end tell
      `;

      const result = await this.executeAppleScript(script);
      
      if (result.includes('not found')) {
        return { success: false, error: 'Note not found' };
      }

      const updatedNotes = this.parseNotesFromAppleScript(result);
      if (updatedNotes.length > 0) {
        return { success: true, data: updatedNotes[0] };
      }

      return { success: false, error: 'Failed to update note' };
    } catch (error) {
      console.error('AppleScript updateNote failed:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to update note' 
      };
    }
  }

  /**
   * Delete note from Apple Notes app
   */
  async deleteNote(id: string): Promise<APIResult<void>> {
    try {
      const script = `
        tell application "Notes"
          repeat with acc in accounts
            repeat with folder in folders of acc
              repeat with note in notes of folder
                if id of note as string is "${id}" then
                  delete note
                  return "deleted"
                end if
              end repeat
            end repeat
          end repeat
          return "not found"
        end tell
      `;

      const result = await this.executeAppleScript(script);
      
      if (result.includes('not found')) {
        return { success: false, error: 'Note not found' };
      }

      return { success: true };
    } catch (error) {
      console.error('AppleScript deleteNote failed:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to delete note' 
      };
    }
  }

  /**
   * Execute AppleScript command
   */
  private async executeAppleScript(script: string): Promise<string> {
    try {
      const { stdout, stderr } = await execAsync(`osascript -e '${script}'`);
      
      if (stderr) {
        throw new Error(`AppleScript error: ${stderr}`);
      }
      
      return stdout.trim();
    } catch (error) {
      if (error instanceof Error) {
        // Check for common permission errors
        if (error.message.includes('not allowed assistive access') || 
            error.message.includes('operation not permitted')) {
          throw new Error('AppleScript access not permitted. Please grant accessibility permissions.');
        }
      }
      throw error;
    }
  }

  /**
   * Parse notes data from AppleScript output
   */
  private parseNotesFromAppleScript(output: string): Note[] {
    const notes: Note[] = [];
    
    try {
      // AppleScript returns data in a specific format that needs parsing
      // This is a simplified parser - real implementation would be more robust
      const lines = output.split('\n').filter(line => line.trim());
      
      for (const line of lines) {
        // Parse AppleScript list format: {id, title, content, createdDate, modifiedDate, folder}
        const match = line.match(/\{([^}]+)\}/);
        if (match) {
          const parts = match[1].split(',').map(part => part.trim().replace(/^"|"$/g, ''));
          
          if (parts.length >= 6) {
            const note: Note = {
              id: parts[0],
              title: parts[1] || 'Untitled',
              content: parts[2] || '',
              createdDate: this.parseAppleScriptDate(parts[3]),
              modifiedDate: this.parseAppleScriptDate(parts[4]),
              folder: parts[5] || 'Notes',
              attachments: this.extractAttachments(parts[2] || ''),
              checklists: this.extractChecklists(parts[2] || ''),
              metadata: this.createMetadata(parts[2] || '')
            };
            
            notes.push(note);
          }
        }
      }
    } catch (error) {
      console.error('Failed to parse AppleScript output:', error);
    }
    
    return notes;
  }

  /**
   * Parse AppleScript date format
   */
  private parseAppleScriptDate(dateString: string): Date {
    try {
      // AppleScript dates are in format: "Monday, January 1, 2024 at 12:00:00 PM"
      // Convert to standard format for parsing
      const cleanDate = dateString.replace(/^date\s+"|"$/g, '');
      return new Date(cleanDate);
    } catch (error) {
      console.error('Failed to parse date:', dateString, error);
      return new Date();
    }
  }

  /**
   * Extract attachments from note content
   */
  private extractAttachments(content: string): Attachment[] {
    const attachments: Attachment[] = [];
    
    // Look for attachment patterns in content
    // Apple Notes embeds attachments as special markers
    const attachmentPattern = /\[Attachment:\s*([^\]]+)\]/g;
    let match;
    let attachmentId = 0;

    while ((match = attachmentPattern.exec(content)) !== null) {
      const filename = match[1].trim();
      const extension = filename.split('.').pop()?.toLowerCase() || '';
      
      let type = AttachmentType.OTHER;
      if (['jpg', 'jpeg', 'png', 'gif', 'bmp'].includes(extension)) {
        type = AttachmentType.IMAGE;
      } else if (extension === 'pdf') {
        type = AttachmentType.PDF;
      } else if (['doc', 'docx', 'txt', 'rtf'].includes(extension)) {
        type = AttachmentType.DOCUMENT;
      } else if (['mp3', 'wav', 'm4a'].includes(extension)) {
        type = AttachmentType.AUDIO;
      } else if (['mp4', 'mov', 'avi'].includes(extension)) {
        type = AttachmentType.VIDEO;
      }

      attachments.push({
        id: `attachment_${attachmentId++}`,
        type,
        filename,
        size: 0, // Size not available through AppleScript
        mimeType: this.getMimeType(extension),
        content: undefined
      });
    }

    return attachments;
  }

  /**
   * Extract checklist items from note content
   */
  private extractChecklists(content: string): ChecklistItem[] {
    const checklists: ChecklistItem[] = [];
    const lines = content.split('\n');
    let order = 0;

    for (const line of lines) {
      // Look for checkbox patterns: ☐, ☑, [ ], [x]
      const checkboxMatch = line.match(/^(\s*)(☐|☑|\[\s*\]|\[x\])\s*(.+)$/);
      if (checkboxMatch) {
        const text = checkboxMatch[3].trim();
        const completed = checkboxMatch[2] === '☑' || checkboxMatch[2] === '[x]';
        
        checklists.push({
          id: `checklist_${order}`,
          text,
          completed,
          order
        });
        order++;
      }
    }

    return checklists;
  }

  /**
   * Create metadata from note content
   */
  private createMetadata(content: string): NoteMetadata {
    return {
      accessCount: 0, // Not available through AppleScript
      lastAccessDate: undefined,
      shareCount: 0, // Not available through AppleScript
      tags: this.extractTags(content),
      isShared: false, // Not easily detectable through AppleScript
      wordCount: content.split(/\s+/).filter(word => word.length > 0).length,
      hasHandwriting: content.includes('[Handwriting]') || content.includes('✏️'),
      hasImages: /\[Attachment:.*\.(jpg|jpeg|png|gif|bmp)\]/i.test(content)
    };
  }

  /**
   * Extract tags from note content
   */
  private extractTags(content: string): string[] {
    const tagPattern = /#(\w+)/g;
    const tags: string[] = [];
    let match;

    while ((match = tagPattern.exec(content)) !== null) {
      tags.push(match[1]);
    }

    return [...new Set(tags)]; // Remove duplicates
  }

  /**
   * Get MIME type from file extension
   */
  private getMimeType(extension: string): string {
    const mimeTypes: { [key: string]: string } = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'bmp': 'image/bmp',
      'pdf': 'application/pdf',
      'doc': 'application/msword',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'txt': 'text/plain',
      'rtf': 'application/rtf',
      'mp3': 'audio/mpeg',
      'wav': 'audio/wav',
      'm4a': 'audio/mp4',
      'mp4': 'video/mp4',
      'mov': 'video/quicktime',
      'avi': 'video/x-msvideo'
    };

    return mimeTypes[extension] || 'application/octet-stream';
  }
}