/**
 * Next.js API Route: /api/v1/notes
 *
 * Collection endpoint for the Notes resource.
 *   - GET  → list notes (paginated/sorted via `?page=&limit=&sort=`,
 *            optionally filtered by `?tag=` and by a created-at range via
 *            `?createdAfter=&createdBefore=` (ISO dates)). Archived
 *            (soft-deleted) notes are excluded by default; pass
 *            `?includeArchived=true` to include them.
 *   - POST → create a note
 *
 * Searching lives on its own endpoint (`GET /api/v1/notes/search?q=`).
 *
 * This handler is a thin transport adapter: it parses the HTTP request and
 * delegates to the NoteController, which validates input, resolves the use case
 * from the DI container, and returns a uniform result. Response serialization
 * (including the error envelope) is handled by `toNextResponse`.
 */

import { NextRequest } from 'next/server';
import { NoteController } from '@/interfaces/http/controllers/NoteController';
import { toNextResponse } from '@/interfaces/http/apiResponse';
import { requireApiKey } from '@/interfaces/http/auth';
import { enforceRateLimit } from '@/interfaces/http/rateLimit';

export async function GET(request: NextRequest) {
  // Per-IP rate limit (429 + Retry-After when exceeded).
  const limited = enforceRateLimit(request);
  if (limited) return toNextResponse(limited);

  // Forward the listing query params (pagination, sort, tag filter). Absent or
  // empty values become `undefined` so the schema applies its defaults rather
  // than choking on `null`/`""`.
  const params = request.nextUrl.searchParams;
  const param = (key: string): string | undefined => {
    const value = params.get(key);
    return value === null || value === '' ? undefined : value;
  };

  const result = await NoteController.listNotes({
    tag: param('tag'),
    page: param('page'),
    limit: param('limit'),
    sort: param('sort'),
    includeArchived: param('includeArchived'),
    createdAfter: param('createdAfter'),
    createdBefore: param('createdBefore'),
  });
  return toNextResponse(result);
}

export async function POST(request: NextRequest) {
  // Per-IP rate limit (429 + Retry-After when exceeded).
  const limited = enforceRateLimit(request);
  if (limited) return toNextResponse(limited);

  // Writes require a valid API key (no-op when none is configured).
  const unauthorized = requireApiKey(request);
  if (unauthorized) return toNextResponse(unauthorized);

  // `undefined` on malformed JSON → caught by schema validation as a 400.
  const body = await request.json().catch(() => undefined);
  const result = await NoteController.createNote(body);
  return toNextResponse(result);
}
