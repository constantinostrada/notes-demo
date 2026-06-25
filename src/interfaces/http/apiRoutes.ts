/**
 * Interface: API Route Convention
 *
 * Single source of truth for the public REST route convention.
 *
 * Convention: versioned, plural, resource-oriented paths under `/api/v{n}`.
 *   - Base prefix:        /api/v1
 *   - Notes collection:   /api/v1/notes  (list supports ?page=&limit=&sort=&tag=)
 *   - Notes search:       /api/v1/notes/search?q=
 *   - Notes export:       /api/v1/notes/export
 *   - Notes import:       /api/v1/notes/import
 *   - Single note:        /api/v1/notes/:id
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
    const query = qs.toString();
    return query ? `${API_BASE}/notes?${query}` : `${API_BASE}/notes`;
  },
  /** Search endpoint: search notes (GET) with a required `q` query param. */
  search: (query: string) => `${API_BASE}/notes/search?q=${encodeURIComponent(query)}`,
  /** Export endpoint: download every note as a JSON snapshot (GET). */
  export: () => `${API_BASE}/notes/export`,
  /** Import endpoint: load an array of notes from a JSON payload (POST). */
  import: () => `${API_BASE}/notes/import`,
  /** Single-resource endpoint: get (GET), update (PUT), delete (DELETE). */
  resource: (id: string) => `${API_BASE}/notes/${id}`,
};
