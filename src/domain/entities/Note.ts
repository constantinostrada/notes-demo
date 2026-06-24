/**
 * Domain Entity: Note
 *
 * Represents a note with business rules and invariants.
 * Entities have identity and lifecycle.
 */

import { InvalidNoteException } from '../exceptions/DomainException';

export class Note {
  /** Business rule: a single tag cannot exceed this many characters. */
  private static readonly MAX_TAG_LENGTH = 50;
  /** Business rule: a note cannot carry more than this many distinct tags. */
  private static readonly MAX_TAGS = 20;

  private _tags: string[];

  private constructor(
    private readonly _id: string,
    private _title: string,
    private _content: string,
    tags: string[],
    private readonly _createdAt: Date,
    private _updatedAt: Date,
    /** When set, the note is archived (soft-deleted); null means active. */
    private _deletedAt: Date | null
  ) {
    this.validateTitle(this._title);
    this._tags = Note.normalizeTags(tags);
    this.validateTags(this._tags);
  }

  /**
   * Factory method to create a new Note
   */
  static create(id: string, title: string, content: string, tags: string[] = []): Note {
    const now = new Date();
    return new Note(id, title, content, tags, now, now, null);
  }

  /**
   * Factory method to reconstitute a Note from persistence
   */
  static reconstitute(
    id: string,
    title: string,
    content: string,
    tags: string[],
    createdAt: Date,
    updatedAt: Date,
    deletedAt: Date | null = null
  ): Note {
    return new Note(id, title, content, tags, createdAt, updatedAt, deletedAt);
  }

  /**
   * Business rule: Title must be between 1 and 200 characters
   */
  private validateTitle(title: string): void {
    if (!title || title.trim().length === 0) {
      throw new InvalidNoteException('Note title cannot be empty');
    }
    if (title.length > 200) {
      throw new InvalidNoteException('Note title cannot exceed 200 characters');
    }
  }

  /**
   * Normalize a single tag to its canonical form (trimmed, lower-cased).
   * Exposed so callers that filter by tag can match the stored form exactly.
   */
  static normalizeTag(tag: string): string {
    return tag.trim().toLowerCase();
  }

  /**
   * Normalize a list of tags: canonicalize each, drop blanks, and de-duplicate
   * while preserving first-seen order. The canonical form is what gets stored.
   */
  private static normalizeTags(tags: string[]): string[] {
    const normalized = tags
      .map((tag) => Note.normalizeTag(tag))
      .filter((tag) => tag.length > 0);
    return Array.from(new Set(normalized));
  }

  /**
   * Business rule: bounded number of tags, each within a length limit.
   */
  private validateTags(tags: string[]): void {
    if (tags.length > Note.MAX_TAGS) {
      throw new InvalidNoteException(`Note cannot have more than ${Note.MAX_TAGS} tags`);
    }
    for (const tag of tags) {
      if (tag.length > Note.MAX_TAG_LENGTH) {
        throw new InvalidNoteException(
          `Tag cannot exceed ${Note.MAX_TAG_LENGTH} characters`
        );
      }
    }
  }

  /**
   * Update the note's title with validation
   */
  updateTitle(newTitle: string): void {
    this.validateTitle(newTitle);
    this._title = newTitle;
    this._updatedAt = new Date();
  }

  /**
   * Update the note's content
   */
  updateContent(newContent: string): void {
    this._content = newContent;
    this._updatedAt = new Date();
  }

  /**
   * Replace the note's tags with validation (normalized + de-duplicated)
   */
  updateTags(newTags: string[]): void {
    const normalized = Note.normalizeTags(newTags);
    this.validateTags(normalized);
    this._tags = normalized;
    this._updatedAt = new Date();
  }

  /**
   * Archive the note (soft delete). Idempotent: archiving an already-archived
   * note preserves the original archive time. Stamps `updatedAt` on first
   * archive so the change is reflected in listings/sorting.
   */
  archive(): void {
    if (this._deletedAt !== null) {
      return;
    }
    const now = new Date();
    this._deletedAt = now;
    this._updatedAt = now;
  }

  /**
   * Whether the note is archived (soft-deleted).
   */
  isArchived(): boolean {
    return this._deletedAt !== null;
  }

  /**
   * Check if the note is empty (no content)
   */
  isEmpty(): boolean {
    return this._content.trim().length === 0;
  }

  /**
   * Get the note's word count
   */
  getWordCount(): number {
    return this._content
      .trim()
      .split(/\s+/)
      .filter((word) => word.length > 0).length;
  }

  // Getters
  get id(): string {
    return this._id;
  }

  get title(): string {
    return this._title;
  }

  get content(): string {
    return this._content;
  }

  /** Returns a copy so callers can't mutate the note's internal tag list. */
  get tags(): string[] {
    return [...this._tags];
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  /** Archive timestamp, or null when the note is active. */
  get deletedAt(): Date | null {
    return this._deletedAt;
  }
}
