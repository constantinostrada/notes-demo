/**
 * Application DTOs (Data Transfer Objects)
 * 
 * Contracts for data flowing in and out of use cases.
 * DTOs decouple the application layer from domain entities.
 */

import { SearchCursor } from '@/domain/repositories/INoteRepository';

export interface CreateNoteInputDTO {
  title: string;
  content: string;
  tags?: string[];
  /** Optional `#RRGGBB` colour. */
  color?: string | null;
}

export interface UpdateNoteInputDTO {
  id: string;
  title?: string;
  content?: string;
  tags?: string[];
  /** Optional `#RRGGBB` colour. */
  color?: string | null;
}

export interface NoteOutputDTO {
  id: string;
  title: string;
  content: string;
  tags: string[];
  wordCount: number;
  createdAt: string;
  updatedAt: string;
  /** ISO archive timestamp when the note is archived, otherwise null. */
  deletedAt: string | null;
  /** `#RRGGBB` colour, or null when the note has no colour. */
  color: string | null;
  /** Whether the note is pinned. */
  isPinned: boolean;
  /** ISO reminder timestamp, or null when no reminder is set. */
  dueAt: string | null;
}

export interface DeleteNoteInputDTO {
  id: string;
}

export interface GetNoteInputDTO {
  id: string;
}

export interface SearchNotesInputDTO {
  query: string;
  /** Page size (defaults to DEFAULT_LIMIT, capped at MAX_LIMIT). */
  limit?: number;
  /** Decoded keyset cursor; when set, results resume after this position. */
  cursor?: SearchCursor;
}

/**
 * A cursor-paginated page of search results. `notes` stays top-level so the
 * existing frontend keeps reading `data.notes`. `next_cursor` is the opaque
 * token to fetch the following page, or `null` on the last page.
 */
export interface SearchNotesOutputDTO {
  notes: NoteOutputDTO[];
  next_cursor: string | null;
}

/**
 * Input for listing pinned notes — same cursor pagination knobs as search,
 * minus the query (the listing is implicitly filtered to `isPinned`).
 */
export interface ListPinnedNotesInputDTO {
  /** Page size (defaults to DEFAULT_LIMIT, capped at MAX_LIMIT). */
  limit?: number;
  /** Decoded keyset cursor; when set, results resume after this position. */
  cursor?: SearchCursor;
}

/**
 * A cursor-paginated page of pinned notes. Mirrors the search output contract
 * ({ notes, next_cursor }) since both share the keyset iteration model.
 */
export interface ListPinnedNotesOutputDTO {
  notes: NoteOutputDTO[];
  next_cursor: string | null;
}

/** Input for pinning/unpinning a single note. */
export interface SetPinInputDTO {
  id: string;
}

/**
 * Input for setting/clearing a note's reminder. `dueAt` is the reminder time
 * (a `Date`), or `null` to clear the reminder.
 */
export interface SetReminderInputDTO {
  id: string;
  dueAt: Date | null;
}

/** A listing of overdue notes (those past their reminder time). */
export interface DueNotesOutputDTO {
  notes: NoteOutputDTO[];
}

/**
 * Listing knobs shared by the interface (validation/defaults) and the use case.
 *
 * `sort` is a single token: a sort field optionally prefixed with `-` for
 * descending order (e.g. `createdAt`, `-createdAt`, `title`). Keeping the
 * allowed tokens here lets the zod schema and the use case agree on one source.
 */
export const NOTE_SORT_OPTIONS = [
  'createdAt',
  '-createdAt',
  'updatedAt',
  '-updatedAt',
  'title',
  '-title',
] as const;

export type NoteSortOption = (typeof NOTE_SORT_OPTIONS)[number];

/** Sensible listing defaults / bounds (newest-first, 20 per page, cap 100). */
export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;
export const DEFAULT_SORT: NoteSortOption = '-createdAt';

export interface ListNotesInputDTO {
  /** Optional tag filter; when present, only notes with this tag are returned. */
  tag?: string;
  /** Include archived (soft-deleted) notes in the listing (defaults to false). */
  includeArchived?: boolean;
  /** Inclusive lower bound on a note's creation time (createdAt >= this). */
  createdAfter?: Date;
  /** Inclusive upper bound on a note's creation time (createdAt <= this). */
  createdBefore?: Date;
  /** 1-based page number (defaults to DEFAULT_PAGE). */
  page?: number;
  /** Page size (defaults to DEFAULT_LIMIT). */
  limit?: number;
  /** Sort token (defaults to DEFAULT_SORT). */
  sort?: string;
}

/**
 * Filters for counting notes — the same narrowing knobs as a listing, minus
 * pagination and sorting (which don't affect a count).
 */
export interface CountNotesInputDTO {
  /** Optional tag filter; when present, only notes with this tag are counted. */
  tag?: string;
  /** Include archived (soft-deleted) notes in the count (defaults to false). */
  includeArchived?: boolean;
  /** Inclusive lower bound on a note's creation time (createdAt >= this). */
  createdAfter?: Date;
  /** Inclusive upper bound on a note's creation time (createdAt <= this). */
  createdBefore?: Date;
}

/** Result of a count: the number of notes matching the filters. */
export interface CountNotesOutputDTO {
  count: number;
}

/**
 * A single note inside an import payload. `id` and the timestamps are optional
 * so the exact shape produced by the export endpoint can be fed straight back
 * into import (strong read-back): when present they are preserved, when absent
 * a fresh id / "now" timestamps are assigned.
 */
export interface ImportNoteInputDTO {
  id?: string;
  title: string;
  content?: string;
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
  color?: string | null;
  isPinned?: boolean;
  dueAt?: string | null;
}

export interface ImportNotesInputDTO {
  notes: ImportNoteInputDTO[];
}

/**
 * Outcome of an import. `imported` notes were created; `skipped` notes were
 * de-duplicated (their id already existed in the store or repeated within the
 * payload). `total` is the number of notes received.
 */
export interface ImportNotesOutputDTO {
  imported: number;
  skipped: number;
  total: number;
  notes: NoteOutputDTO[];
}

/** Input for archiving several notes at once by id. */
export interface BulkArchiveNotesInputDTO {
  ids: string[];
}

/**
 * Outcome of a bulk archive. `archived` notes were newly soft-deleted; the
 * remaining ids (`skipped` = unknown, already-archived, or repeated within the
 * payload) were ignored without error. `total` is the number of ids received.
 * Archived notes keep their row (soft-delete), so they stay recoverable.
 */
export interface BulkArchiveNotesOutputDTO {
  archived: number;
  skipped: number;
  total: number;
  notes: NoteOutputDTO[];
}

/**
 * Full snapshot of every note (archived included), shaped so it can be re-imported.
 */
export interface ExportNotesOutputDTO {
  exportedAt: string;
  count: number;
  notes: NoteOutputDTO[];
}

/** Pagination metadata returned alongside a page of notes. */
export interface PaginationMetaDTO {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  sort: string;
}

export interface PaginatedNotesOutputDTO {
  notes: NoteOutputDTO[];
  pagination: PaginationMetaDTO;
}
