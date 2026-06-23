/**
 * Interface: API Route Convention
 *
 * Single source of truth for the public REST route convention.
 *
 * Convention: versioned, plural, resource-oriented paths under `/api/v{n}`.
 *   - Base prefix:        /api/v1
 *   - Notes collection:   /api/v1/notes
 *   - Single note:        /api/v1/notes/:id
 *
 * The Next.js App Router derives server paths from the folder structure
 * (`src/app/api/v1/notes/...`), so this module is the client-facing mirror
 * of that structure. Keep both in sync when the version changes.
 */

export const API_VERSION = 'v1';
export const API_BASE = `/api/${API_VERSION}`;

export const notesApi = {
  /** Collection endpoint: list (GET) and create (POST). */
  collection: () => `${API_BASE}/notes`,
  /** Search via the collection endpoint with a `q` query param. */
  search: (query: string) => `${API_BASE}/notes?q=${encodeURIComponent(query)}`,
  /** Single-resource endpoint: get (GET), update (PUT), delete (DELETE). */
  resource: (id: string) => `${API_BASE}/notes/${id}`,
};
