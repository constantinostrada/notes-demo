/**
 * Next.js API Route: /api/v1/notes/bulk-restore
 *
 * Bulk-restore endpoint for the Notes resource (the inverse of bulk-archive).
 *   - POST → restore several archived notes at once (body `{ ids: [...] }`).
 *            Each id is un-archived (the soft-delete tombstone is cleared), so
 *            the notes reappear in listings/search. Ids that don't point at an
 *            archived note (unknown or already active) are ignored without
 *            failing the batch.
 *
 * Like the other write routes, this is a thin transport adapter: it parses the
 * JSON body and delegates to the NoteController, which validates the payload
 * (zod), resolves BulkRestoreNotesUseCase from the DI container, and returns a
 * uniform result. Response serialization (including the error envelope) is
 * handled by `toNextResponse`.
 */

import { NextRequest } from 'next/server';
import { NoteController } from '@/interfaces/http/controllers/NoteController';
import { toNextResponse } from '@/interfaces/http/apiResponse';
import { requireApiKey } from '@/interfaces/http/auth';
import { enforceRateLimit } from '@/interfaces/http/rateLimit';

export async function POST(request: NextRequest) {
  // Per-IP rate limit (429 + Retry-After when exceeded).
  const limited = enforceRateLimit(request);
  if (limited) return toNextResponse(limited);

  // Writes require a valid API key (no-op when none is configured).
  const unauthorized = requireApiKey(request);
  if (unauthorized) return toNextResponse(unauthorized);

  // `undefined` on malformed JSON → caught by schema validation as a 400.
  const body = await request.json().catch(() => undefined);
  const result = await NoteController.bulkRestoreNotes(body);
  return toNextResponse(result);
}
