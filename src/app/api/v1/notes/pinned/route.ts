/**
 * Next.js API Route: /api/v1/notes/pinned
 *
 * Pinned-notes listing for the Notes resource.
 *   - GET → list pinned notes, cursor-paginated with `?cursor=&limit=` (same
 *           limit bounds and cursor codec as `/notes/search`). The response
 *           carries `next_cursor` for the following page and never includes
 *           archived (soft-deleted) notes.
 *
 * Thin transport adapter: it reads the query params and delegates to the
 * NoteController; validation, use-case resolution, and the uniform response
 * envelope (including a 400 for a malformed `cursor`) are handled downstream.
 */

import { NextRequest } from 'next/server';
import { NoteController } from '@/interfaces/http/controllers/NoteController';
import { toNextResponse } from '@/interfaces/http/apiResponse';
import { enforceRateLimit } from '@/interfaces/http/rateLimit';

export async function GET(request: NextRequest) {
  // Per-IP rate limit (429 + Retry-After when exceeded).
  const limited = enforceRateLimit(request);
  if (limited) return toNextResponse(limited);

  // Absent/empty values become `undefined` so the schema applies its defaults
  // (limit) or treats them as missing.
  const params = request.nextUrl.searchParams;
  const param = (key: string): string | undefined => {
    const value = params.get(key);
    return value === null || value === '' ? undefined : value;
  };

  const result = await NoteController.listPinnedNotes({
    cursor: param('cursor'),
    limit: param('limit'),
  });
  return toNextResponse(result);
}
