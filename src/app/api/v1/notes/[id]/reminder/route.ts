/**
 * Next.js API Route: /api/v1/notes/[id]/reminder
 *
 *   - PUT → set or clear a note's reminder (`dueAt`). The body is
 *           `{ "dueAt": <ISO date/datetime> | null }`; a value schedules the
 *           reminder, `null` clears it. Returns the updated note.
 *
 * A write, so it mirrors the other mutating routes: per-IP rate limit first,
 * then API-key auth. A missing note yields 404 NOTE_NOT_FOUND and a malformed
 * `dueAt` yields 400 VALIDATION_ERROR — both via the uniform error envelope.
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

export async function PUT(request: NextRequest, { params }: RouteContext) {
  // Per-IP rate limit (429 + Retry-After when exceeded).
  const limited = enforceRateLimit(request);
  if (limited) return toNextResponse(limited);

  // Writes require a valid API key (no-op when none is configured).
  const unauthorized = requireApiKey(request);
  if (unauthorized) return toNextResponse(unauthorized);

  // `undefined` on malformed JSON → caught by schema validation as a 400.
  const body = await request.json().catch(() => undefined);
  const result = await NoteController.setReminder(params.id, body);
  return toNextResponse(result);
}
