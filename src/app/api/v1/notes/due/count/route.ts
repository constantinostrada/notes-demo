/**
 * Next.js API Route: /api/v1/notes/due/count
 *
 *   - GET → return how many notes are overdue, i.e. whose reminder (`dueAt`)
 *           lies in the past relative to the server clock (UTC). Archived
 *           (soft-deleted) notes are never overdue and so are always excluded.
 *           The response is `{ data: { count: N } }`.
 *
 * This count reuses the very same overdue + not-archived predicate as the
 * sibling `GET /notes/due` listing (both go through the repository), so the
 * count always agrees with the listing length.
 *
 * Thin transport adapter: it delegates to the NoteController, which resolves
 * CountDueNotesUseCase and returns a uniform result.
 */

import { NextRequest } from 'next/server';
import { NoteController } from '@/interfaces/http/controllers/NoteController';
import { toNextResponse } from '@/interfaces/http/apiResponse';
import { enforceRateLimit } from '@/interfaces/http/rateLimit';

export async function GET(request: NextRequest) {
  // Per-IP rate limit (429 + Retry-After when exceeded).
  const limited = enforceRateLimit(request);
  if (limited) return toNextResponse(limited);

  const result = await NoteController.countDueNotes();
  return toNextResponse(result);
}
