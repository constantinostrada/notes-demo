/**
 * Next.js API Route: /api/v1/notes/count
 *
 * Count endpoint for the Notes resource.
 *   - GET → return how many notes match the listing filters
 *           (`?tag=`, `?createdAfter=&createdBefore=`, `?includeArchived=`).
 *           Archived (soft-deleted) notes are excluded by default. The response
 *           is `{ data: { count: N } }`.
 *
 * Like the other note routes, this is a thin transport adapter: it forwards the
 * filter query params to the NoteController, which validates them, resolves
 * CountNotesUseCase from the DI container, and returns a uniform result.
 * Response serialization (including the 400 error envelope for an invalid
 * filter) is handled by `toNextResponse`.
 */

import { NextRequest } from 'next/server';
import { NoteController } from '@/interfaces/http/controllers/NoteController';
import { toNextResponse } from '@/interfaces/http/apiResponse';
import { enforceRateLimit } from '@/interfaces/http/rateLimit';

export async function GET(request: NextRequest) {
  // Per-IP rate limit (429 + Retry-After when exceeded).
  const limited = enforceRateLimit(request);
  if (limited) return toNextResponse(limited);

  // Forward the filter query params. Absent or empty values become `undefined`
  // so the schema applies its defaults rather than choking on `null`/`""`.
  const params = request.nextUrl.searchParams;
  const param = (key: string): string | undefined => {
    const value = params.get(key);
    return value === null || value === '' ? undefined : value;
  };

  const result = await NoteController.countNotes({
    tag: param('tag'),
    includeArchived: param('includeArchived'),
    createdAfter: param('createdAfter'),
    createdBefore: param('createdBefore'),
  });
  return toNextResponse(result);
}
