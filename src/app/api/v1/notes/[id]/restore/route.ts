/**
 * Next.js API Route: /api/v1/notes/[id]/restore
 *
 *   - POST → restore a note (reverts the soft-delete by clearing deletedAt).
 *            Returns the updated note.
 *
 * A write, so it mirrors the other mutating routes: per-IP rate limit first,
 * then API-key auth. Restoring a missing note yields 404 NOTE_NOT_FOUND via the
 * uniform error envelope. Restoring an already-active note is idempotent (200,
 * the note is returned unchanged) — see Note.restore().
 */

import { NextRequest } from 'next/server';
import { NoteController } from '@/interfaces/http/controllers/NoteController';
import { toNextResponse } from '@/interfaces/http/apiResponse';
import { requireApiKey } from '@/interfaces/http/auth';
import { enforceRateLimit } from '@/interfaces/http/rateLimit';

interface RouteContext {
  params: {
    id: string;
  };
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  // Per-IP rate limit (429 + Retry-After when exceeded).
  const limited = enforceRateLimit(request);
  if (limited) return toNextResponse(limited);

  // Writes require a valid API key (no-op when none is configured).
  const unauthorized = requireApiKey(request);
  if (unauthorized) return toNextResponse(unauthorized);

  const result = await NoteController.restoreNote(params.id);
  return toNextResponse(result);
}
