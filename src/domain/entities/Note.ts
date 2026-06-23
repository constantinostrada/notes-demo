/**
 * Domain Entity: Note
 *
 * Represents a note with business rules and invariants.
 * Entities have identity and lifecycle.
 */

import { InvalidNoteException } from '../exceptions/DomainException';

export class Note {
  private constructor(
    private readonly _id: string,
    private _title: string,
    private _content: string,
    private readonly _createdAt: Date,
    private _updatedAt: Date
  ) {
    this.validateTitle(this._title);
  }

  /**
   * Factory method to create a new Note
   */
  static create(id: string, title: string, content: string): Note {
    const now = new Date();
    return new Note(id, title, content, now, now);
  }

  /**
   * Factory method to reconstitute a Note from persistence
   */
  static reconstitute(
    id: string,
    title: string,
    content: string,
    createdAt: Date,
    updatedAt: Date
  ): Note {
    return new Note(id, title, content, createdAt, updatedAt);
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

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }
}
