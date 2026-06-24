/**
 * Domain Repository Interface: INoteRepository
 * 
 * Defines the contract for Note persistence without implementation details.
 * This is an abstraction - implementations live in the infrastructure layer.
 */

import { Note } from '../entities/Note';

/** Fields a note listing can be ordered by. */
export type NoteSortField = 'createdAt' | 'updatedAt' | 'title';

/** Sort direction for a note listing. */
export type SortDirection = 'asc' | 'desc';

/**
 * Criteria for a paginated, sorted (and optionally tag-filtered) listing.
 * `page` is 1-based and `limit` is the page size; both are expected to be
 * already-validated positive integers (bounds are enforced at the edge).
 */
export interface NoteListCriteria {
  /** Optional, already-normalized tag filter. */
  tag?: string;
  /** When false (the default), archived (soft-deleted) notes are excluded. */
  includeArchived: boolean;
  page: number;
  limit: number;
  sortField: NoteSortField;
  sortDirection: SortDirection;
}

/** A single page of notes plus the total number of matches (ignoring paging). */
export interface NotePage {
  notes: Note[];
  total: number;
}

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
   * Permanently (hard) delete a note by its ID.
   * Returns true if deleted, false if not found.
   *
   * Note: the public DELETE endpoint archives instead (soft delete via
   * `Note.archive()` + `save`); this hard delete is kept for maintenance/tests.
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
   * List notes with pagination, sorting and an optional tag filter.
   * Returns the requested page together with the total number of matches
   * (so callers can compute pagination metadata).
   */
  list(criteria: NoteListCriteria): Promise<NotePage>;
}
