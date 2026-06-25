/**
 * Next.js API Route: /api/v1/notes/search
 *
 * Search endpoint for the Notes resource.
 *   - GET → search notes by title or content via the `?q=` query param
 *
 * Like the other note routes, this is a thin transport adapter: it reads the
 * `q` query param and delegates to the NoteController, which validates the
 * input, resolves SearchNotesUseCase from the DI container, and returns a
 * uniform result. Response serialization (including the error envelope for an
 * invalid/missing `q`) is handled by `toNextResponse`.
 */

import { NextRequest } from 'next/server';
import { NoteController } from '@/interfaces/http/controllers/NoteController';
import { toNextResponse } from '@/interfaces/http/apiResponse';
import { enforceRateLimit } from '@/interfaces/http/rateLimit';

export async function GET(request: NextRequest) {
  // Per-IP rate limit (429 + Retry-After when exceeded).
  const limited = enforceRateLimit(request);
  if (limited) return toNextResponse(limited);

  // `null` when `q` is absent → caught by schema validation as a 400.
  const query = request.nextUrl.searchParams.get('q');
  const result = await NoteController.searchNotes(query);
  return toNextResponse(result);
}
