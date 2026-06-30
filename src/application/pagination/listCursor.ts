/**
 * Application: List cursor codec
 *
 * Translates between the domain `ListCursor` (a decoded position in a sortable
 * listing) and the opaque string token exchanged with HTTP clients. Clients
 * treat the token as a black box; only this module knows its shape.
 *
 * Unlike the search cursor (which only ever orders by created_at), a listing can
 * be ordered by different fields/directions, so the token also carries the
 * `sortField`/`direction` it was minted under. The edge can then reject a cursor
 * replayed against a different ordering — mixing them would page incorrectly.
 *
 * Encoding: base64url of a compact JSON object `{ f, d, v, id }`. JSON keeps
 * arbitrary title strings (any character, including `:`) intact. A tampered or
 * malformed token throws `InvalidCursorError`, which the HTTP edge maps to a
 * 400 VALIDATION_ERROR — same contract as the search cursor.
 */

import {
  ListCursor,
  NoteSortField,
  SortDirection,
} from '@/domain/repositories/INoteRepository';
import { InvalidCursorError } from './searchCursor';

const SORT_FIELDS: readonly NoteSortField[] = ['createdAt', 'title'];
const DIRECTIONS: readonly SortDirection[] = ['asc', 'desc'];

/** Encode a list position into the opaque token returned as `next_cursor`. */
export function encodeListCursor(cursor: ListCursor): string {
  const payload = JSON.stringify({
    f: cursor.sortField,
    d: cursor.direction,
    v: cursor.value,
    id: cursor.id,
  });
  return Buffer.from(payload, 'utf8').toString('base64url');
}

/**
 * Decode a client-supplied token back into a `ListCursor`. Throws
 * `InvalidCursorError` for anything that isn't a well-formed token (bad base64,
 * non-JSON, unknown sort field/direction, empty id, or a `value` whose type
 * doesn't match the sort field — number for `createdAt`, string for `title`).
 */
export function decodeListCursor(token: string): ListCursor {
  let parsed: unknown;
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf8');
    parsed = JSON.parse(decoded);
  } catch {
    throw new InvalidCursorError();
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw new InvalidCursorError();
  }

  const { f, d, v, id } = parsed as Record<string, unknown>;

  if (!SORT_FIELDS.includes(f as NoteSortField)) throw new InvalidCursorError();
  if (!DIRECTIONS.includes(d as SortDirection)) throw new InvalidCursorError();
  if (typeof id !== 'string' || id.length === 0) throw new InvalidCursorError();

  const sortField = f as NoteSortField;
  // The sort key's type is dictated by the field: createdAt is an integer epoch
  // (ms), title is the raw string. Anything else is a tampered token.
  if (sortField === 'createdAt') {
    if (typeof v !== 'number' || !Number.isInteger(v)) throw new InvalidCursorError();
  } else if (typeof v !== 'string') {
    throw new InvalidCursorError();
  }

  return { sortField, direction: d as SortDirection, value: v as number | string, id };
}
