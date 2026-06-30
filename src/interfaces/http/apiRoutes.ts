/**
 * Interface: API Route Convention
 *
 * Single source of truth for the public REST route convention.
 *
 * Convention: versioned, plural, resource-oriented paths under `/api/v{n}`.
 *   - Base prefix:        /api/v1
 *   - Notes collection:   /api/v1/notes  (list supports ?page=&limit=&sort=&tag=&createdAfter=&createdBefore=)
 *   - Notes search:       /api/v1/notes/search?q= (cursor-paginated via &cursor=&limit=)
 *   - Notes pinned:       /api/v1/notes/pinned (cursor-paginated via &cursor=&limit=)
 *   - Notes due:          /api/v1/notes/due (overdue notes; reminder in the past)
 *   - Notes export:       /api/v1/notes/export
 *   - Notes import:       /api/v1/notes/import
 *   - Notes bulk-archive: /api/v1/notes/bulk-archive (POST; body `{ ids: [...] }`)
 *   - Notes bulk-restore: /api/v1/notes/bulk-restore (POST; body `{ ids: [...] }`)
 *   - Single note:        /api/v1/notes/:id
 *   - Pin / unpin note:   /api/v1/notes/:id/pin, /api/v1/notes/:id/unpin (POST)
 *   - Set/clear reminder: /api/v1/notes/:id/reminder (PUT)
 *
 * The Next.js App Router derives server paths from the folder structure
 * (`src/app/api/v1/notes/...`), so this module is the client-facing mirror
 * of that structure. Keep both in sync when the version changes.
 */

export const API_VERSION = 'v1';
export const API_BASE = `/api/${API_VERSION}`;

/** Optional query params accepted by the notes list endpoint. */
export interface ListNotesParams {
  page?: number;
  limit?: number;
  sort?: string;
  tag?: string;
  /** Inclusive lower bound on creation time (ISO 8601 date or datetime). */
  createdAfter?: string;
  /** Inclusive upper bound on creation time (ISO 8601 date or datetime). */
  createdBefore?: string;
}

/** Optional cursor-pagination params accepted by the notes search endpoint. */
export interface SearchNotesParams {
  /** Page size (defaults to the server's limit; capped server-side). */
  limit?: number;
  /** Opaque `next_cursor` token from a previous page. */
  cursor?: string;
}

export const notesApi = {
  /** Collection endpoint: list (GET) and create (POST). */
  collection: () => `${API_BASE}/notes`,
  /**
   * List endpoint with optional pagination/sort/tag params. Omitted params fall
   * back to the server defaults; only the provided ones are appended.
   */
  list: (params: ListNotesParams = {}) => {
    const qs = new URLSearchParams();
    if (params.page != null) qs.set('page', String(params.page));
    if (params.limit != null) qs.set('limit', String(params.limit));
    if (params.sort) qs.set('sort', params.sort);
    if (params.tag) qs.set('tag', params.tag);
    if (params.createdAfter) qs.set('createdAfter', params.createdAfter);
    if (params.createdBefore) qs.set('createdBefore', params.createdBefore);
    const query = qs.toString();
    return query ? `${API_BASE}/notes?${query}` : `${API_BASE}/notes`;
  },
  /**
   * Search endpoint: search notes (GET) with a required `q` query param and
   * optional cursor pagination. Only provided params are appended; the server
   * fills in defaults and returns `next_cursor` to fetch the following page.
   */
  search: (query: string, params: SearchNotesParams = {}) => {
    const qs = new URLSearchParams({ q: query });
    if (params.limit != null) qs.set('limit', String(params.limit));
    if (params.cursor) qs.set('cursor', params.cursor);
    return `${API_BASE}/notes/search?${qs.toString()}`;
  },
  /**
   * Pinned endpoint: list pinned notes (GET) with optional cursor pagination.
   * Reuses the search pagination params; the server fills in defaults and
   * returns `next_cursor` to fetch the following page.
   */
  pinned: (params: SearchNotesParams = {}) => {
    const qs = new URLSearchParams();
    if (params.limit != null) qs.set('limit', String(params.limit));
    if (params.cursor) qs.set('cursor', params.cursor);
    const query = qs.toString();
    return query ? `${API_BASE}/notes/pinned?${query}` : `${API_BASE}/notes/pinned`;
  },
  /** Due endpoint: list overdue notes — reminder in the past, archived excluded (GET). */
  due: () => `${API_BASE}/notes/due`,
  /** Export endpoint: download every note as a JSON snapshot (GET). */
  export: () => `${API_BASE}/notes/export`,
  /** Import endpoint: load an array of notes from a JSON payload (POST). */
  import: () => `${API_BASE}/notes/import`,
  /** Bulk-archive endpoint: soft-delete many notes by id (POST; `{ ids: [...] }`). */
  bulkArchive: () => `${API_BASE}/notes/bulk-archive`,
  /** Bulk-restore endpoint: un-archive many notes by id (POST; `{ ids: [...] }`). */
  bulkRestore: () => `${API_BASE}/notes/bulk-restore`,
  /** Single-resource endpoint: get (GET), update (PUT), delete (DELETE). */
  resource: (id: string) => `${API_BASE}/notes/${id}`,
  /** Pin a note (POST). */
  pin: (id: string) => `${API_BASE}/notes/${id}/pin`,
  /** Unpin a note (POST). */
  unpin: (id: string) => `${API_BASE}/notes/${id}/unpin`,
  /** Set or clear a note's reminder (PUT; body `{ dueAt: <ISO> | null }`). */
  reminder: (id: string) => `${API_BASE}/notes/${id}/reminder`,
};
