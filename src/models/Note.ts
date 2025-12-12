/**
 * Core Note model representing an Apple Note
 */
export interface Note {
  id: string;
  title: string;
  content: string;
  createdDate: Date;
  modifiedDate: Date;
  folder: string;
  attachments: Attachment[];
  checklists: ChecklistItem[];
  metadata: NoteMetadata;
}

/**
 * Attachment within a note
 */
export interface Attachment {
  id: string;
  type: AttachmentType;
  filename: string;
  size: number;
  mimeType: string;
  content?: string; // Extracted text content if applicable
}

/**
 * Checklist item within a note
 */
export interface ChecklistItem {
  id: string;
  text: string;
  completed: boolean;
  order: number;
}

/**
 * Additional metadata for a note
 */
export interface NoteMetadata {
  accessCount: number;
  lastAccessDate?: Date;
  shareCount: number;
  tags: string[];
  isShared: boolean;
  wordCount: number;
  hasHandwriting: boolean;
  hasImages: boolean;
}

/**
 * Types of attachments supported
 */
export enum AttachmentType {
  IMAGE = 'image',
  PDF = 'pdf',
  DOCUMENT = 'document',
  AUDIO = 'audio',
  VIDEO = 'video',
  OTHER = 'other'
}