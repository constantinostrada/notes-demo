/**
 * Next.js API Route: /api/v1/notes/bulk-archive
 *
 * Bulk-archive endpoint for the Notes resource.
 *   - POST → archive several notes at once (body `{ ids: [...] }`). Each id is
 *            soft-deleted (the row is kept, so notes stay recoverable). Ids that
 *            don't point at an active note (unknown or already archived) are
 *            ignored without failing the batch.
 *
 * Like the other write routes, this is a thin transport adapter: it parses the
 * JSON body and delegates to the NoteController, which validates the payload
 * (zod), resolves BulkArchiveNotesUseCase from the DI container, and returns a
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
  const result = await NoteController.bulkArchiveNotes(body);
  return toNextResponse(result);
}
