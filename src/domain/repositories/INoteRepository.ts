/**
 * Domain Repository Interface: INoteRepository
 * 
 * Defines the contract for Note persistence without implementation details.
 * This is an abstraction - implementations live in the infrastructure layer.
 */

import { Note } from '../entities/Note';

/** Fields a note listing can be ordered by. */
export type NoteSortField = 'createdAt' | 'title';

/** Sort direction for a note listing. */
export type SortDirection = 'asc' | 'desc';

/**
 * Filters shared by listing and counting. All are optional narrowing rules that
 * compose via AND; values are expected to be already-validated/normalized.
 */
export interface NoteFilterCriteria {
  /** Optional, already-normalized tag filter. */
  tag?: string;
  /** When false (the default), archived (soft-deleted) notes are excluded. */
  includeArchived: boolean;
  /** Optional inclusive lower bound on a note's creation time. */
  createdAfter?: Date;
  /** Optional inclusive upper bound on a note's creation time. */
  createdBefore?: Date;
}

/**
 * Keyset cursor identifying a position in a *sortable* note listing. Holds the
 * sort key (`value`) and a stable tiebreaker (`id`) of the last returned note,
 * plus the `sortField`/`direction` the page was produced under, so the next
 * request resumes strictly *after* it with no skipped/duplicated rows — even
 * when many notes share the same sort key.
 *
 * `value` is the note's sort key: epoch milliseconds when ordering by
 * `createdAt`, or the raw title string when ordering by `title`. The embedded
 * `sortField`/`direction` let the edge reject a cursor minted under a different
 * ordering (mixing them would page incorrectly).
 *
 * This is the decoded form; the opaque string handed to/from clients is encoded
 * in the application layer (see listCursor codec).
 */
export interface ListCursor {
  sortField: NoteSortField;
  direction: SortDirection;
  value: number | string;
  id: string;
}

/**
 * Criteria for a cursor-paginated, sorted (and optionally tag-filtered) listing.
 * `limit` is the page size (already validated/bounded at the edge). When
 * `cursor` is set, only notes strictly after that position (in the requested
 * `sortField`/`sortDirection` ordering) are returned.
 */
export interface NoteListCriteria extends NoteFilterCriteria {
  limit: number;
  sortField: NoteSortField;
  sortDirection: SortDirection;
  cursor?: ListCursor;
}

/** Criteria for counting notes — the listing filters without paging/sorting. */
export type NoteCountCriteria = NoteFilterCriteria;

/**
 * A single cursor-paginated page of a listing. `nextCursor` points at the last
 * note in this page when more matches remain, or is `null` on the final page.
 */
export interface NoteListPage {
  notes: Note[];
  nextCursor: ListCursor | null;
}

/**
 * Keyset cursor identifying a position in the search ordering
 * (created_at DESC, id ASC). Holds the sort keys of the last returned note so
 * the next page resumes strictly *after* it — deterministic across requests,
 * with no skipped/duplicated rows even as notes are created or archived.
 *
 * This is the decoded form; the opaque string handed to/received from clients
 * is encoded in the application layer (see searchCursor codec).
 */
export interface SearchCursor {
  /** Creation time of the last returned note, in epoch milliseconds. */
  createdAt: number;
  /** Stable tiebreaker: id of the last returned note. */
  id: string;
}

/**
 * Criteria for a cursor-paginated full-text search. `query` is the (trimmed)
 * search term; `limit` is the page size (already validated/bounded at the
 * edge). When `cursor` is set, only notes after that position are returned.
 */
export interface NoteSearchCriteria {
  query: string;
  limit: number;
  cursor?: SearchCursor;
}

/**
 * A single page of search results. `nextCursor` points at the last note in this
 * page when more matches remain, or is `null` when this is the final page.
 */
export interface NoteSearchPage {
  notes: Note[];
  nextCursor: SearchCursor | null;
}

/**
 * Criteria for a cursor-paginated listing of pinned notes. Shares the search
 * keyset model (same `cursor`/`limit`, same `created_at DESC, id ASC` order) so
 * paging behaves identically. Archived notes are always excluded.
 */
export interface NotePinnedCriteria {
  limit: number;
  cursor?: SearchCursor;
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
   * Search notes by title or content, returning one cursor-paginated page.
   * Results are ordered by creation time (newest first) with `id` as a stable
   * tiebreaker, so paging via `nextCursor` never skips or duplicates a note.
   */
  search(criteria: NoteSearchCriteria): Promise<NoteSearchPage>;

  /**
   * List pinned notes, returning one cursor-paginated page. Like `search`,
   * results are ordered newest-first with `id` as a stable tiebreaker and
   * archived (soft-deleted) notes are always excluded.
   */
  listPinned(criteria: NotePinnedCriteria): Promise<NoteSearchPage>;

  /**
   * List overdue notes — those carrying a reminder (`dueAt`) strictly in the
   * past relative to `now` (the server clock, in UTC). Archived (soft-deleted)
   * notes are never overdue and so are always excluded. Results are ordered by
   * `dueAt` ascending (most overdue first) with `id` as a stable tiebreaker.
   */
  findDue(now: Date): Promise<Note[]>;

  /**
   * Count overdue notes — applying the exact same predicate as `findDue`
   * (`dueAt` strictly in the past relative to `now`, archived notes excluded).
   * Returns the total number of matches, so the count always agrees with the
   * length of the `findDue` listing.
   */
  countDue(now: Date): Promise<number>;

  /**
   * List notes as one cursor-paginated page, ordered by the requested
   * `sortField`/`sortDirection` with `id` as a stable tiebreaker, optionally
   * tag/created-at filtered. Like `search`, paging via `nextCursor` never skips
   * or duplicates a note — even when many notes share the same sort key.
   */
  list(criteria: NoteListCriteria): Promise<NoteListPage>;

  /**
   * Count notes matching the given filters (same rules as `list`, without
   * paging or sorting). Returns the total number of matches.
   */
  count(criteria: NoteCountCriteria): Promise<number>;
}
