/**
 * Application: Search cursor codec
 *
 * Translates between the domain `SearchCursor` (the decoded sort-key position)
 * and the opaque string token exchanged with HTTP clients. Clients should treat
 * the token as a black box; only this module knows its shape.
 *
 * Encoding: base64url of `"<createdAtMs>:<id>"`. The id is a UUID (no colon), so
 * splitting on the first `:` is unambiguous. A tampered or malformed token
 * throws `InvalidCursorError`, which the HTTP edge maps to a 400 VALIDATION_ERROR.
 */

import { SearchCursor } from '@/domain/repositories/INoteRepository';

/** Thrown when an incoming cursor token can't be decoded into a SearchCursor. */
export class InvalidCursorError extends Error {
  constructor(message = 'cursor is not a valid pagination token') {
    super(message);
    this.name = 'InvalidCursorError';
  }
}

/** Encode a cursor position into the opaque token returned as `next_cursor`. */
export function encodeSearchCursor(cursor: SearchCursor): string {
  return Buffer.from(`${cursor.createdAt}:${cursor.id}`, 'utf8').toString('base64url');
}

/**
 * Decode a client-supplied token back into a `SearchCursor`. Throws
 * `InvalidCursorError` for anything that isn't a well-formed token (bad base64,
 * missing separator, non-numeric timestamp, empty id).
 */
export function decodeSearchCursor(token: string): SearchCursor {
  let decoded: string;
  try {
    decoded = Buffer.from(token, 'base64url').toString('utf8');
  } catch {
    throw new InvalidCursorError();
  }

  const separator = decoded.indexOf(':');
  if (separator === -1) {
    throw new InvalidCursorError();
  }

  const createdAt = Number(decoded.slice(0, separator));
  const id = decoded.slice(separator + 1);
  if (!Number.isInteger(createdAt) || id.length === 0) {
    throw new InvalidCursorError();
  }

  return { createdAt, id };
}
