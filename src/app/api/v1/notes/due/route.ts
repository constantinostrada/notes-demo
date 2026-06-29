/**
 * Next.js API Route: /api/v1/notes/due
 *
 *   - GET → list overdue notes, those whose reminder (`dueAt`) lies in the past
 *           relative to the server clock (UTC). Archived (soft-deleted) notes
 *           are never overdue and so are always excluded. Results are ordered
 *           most-overdue first.
 *
 * A static sibling of the `[id]` route (Next.js matches it before the dynamic
 * segment). Thin transport adapter: it delegates to the NoteController, which
 * resolves ListDueNotesUseCase and returns a uniform result.
 */

import { NextRequest } from 'next/server';
import { NoteController } from '@/interfaces/http/controllers/NoteController';
import { toNextResponse } from '@/interfaces/http/apiResponse';
import { enforceRateLimit } from '@/interfaces/http/rateLimit';

export async function GET(request: NextRequest) {
  // Per-IP rate limit (429 + Retry-After when exceeded).
  const limited = enforceRateLimit(request);
  if (limited) return toNextResponse(limited);

  const result = await NoteController.listDueNotes();
  return toNextResponse(result);
}
