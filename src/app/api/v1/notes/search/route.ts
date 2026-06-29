/**
 * Next.js API Route: /api/v1/notes/search
 *
 * Search endpoint for the Notes resource.
 *   - GET → search notes by title or content via the `?q=` query param,
 *           cursor-paginated with `?cursor=&limit=` (same limit bounds as the
 *           listing). The response carries `next_cursor` for the following page.
 *
 * Like the other note routes, this is a thin transport adapter: it reads the
 * query params and delegates to the NoteController, which validates the input,
 * resolves SearchNotesUseCase from the DI container, and returns a uniform
 * result. Response serialization (including the error envelope for an
 * invalid/missing `q` or a malformed `cursor`) is handled by `toNextResponse`.
 */

import { NextRequest } from 'next/server';
import { NoteController } from '@/interfaces/http/controllers/NoteController';
import { toNextResponse } from '@/interfaces/http/apiResponse';
import { enforceRateLimit } from '@/interfaces/http/rateLimit';

export async function GET(request: NextRequest) {
  // Per-IP rate limit (429 + Retry-After when exceeded).
  const limited = enforceRateLimit(request);
  if (limited) return toNextResponse(limited);

  // Forward the search query params. Absent/empty values become `undefined` so
  // the schema applies its defaults (limit) or treats them as missing — a
  // missing/blank `q` is caught by validation as a 400.
  const params = request.nextUrl.searchParams;
  const param = (key: string): string | undefined => {
    const value = params.get(key);
    return value === null || value === '' ? undefined : value;
  };

  const result = await NoteController.searchNotes({
    q: param('q'),
    cursor: param('cursor'),
    limit: param('limit'),
  });
  return toNextResponse(result);
}
