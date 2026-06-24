/**
 * Domain Repository Interface: INoteRepository
 * 
 * Defines the contract for Note persistence without implementation details.
 * This is an abstraction - implementations live in the infrastructure layer.
 */

import { Note } from '../entities/Note';

export interface INoteRepository {
  /**
   * Save a note (create or update)
   */
  save(note: Note): Promise<void>;

  /**
   * Find a note by its ID
   * Returns null if not found
   */
  findById(id: string): Promise<Note | null>;

  /**
   * Find all notes
   * Returns empty array if no notes exist
   */
  findAll(): Promise<Note[]>;

  /**
   * Delete a note by its ID
   * Returns true if deleted, false if not found
   */
  delete(id: string): Promise<boolean>;

  /**
   * Check if a note exists
   */
  exists(id: string): Promise<boolean>;

  /**
   * Search notes by title or content
   */
  search(query: string): Promise<Note[]>;

  /**
   * Find all notes that carry the given (already-normalized) tag.
   * Returns empty array if none match.
   */
  findByTag(tag: string): Promise<Note[]>;
}
