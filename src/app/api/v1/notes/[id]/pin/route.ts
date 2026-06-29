/**
 * Next.js API Route: /api/v1/notes/[id]/pin
 *
 *   - POST → pin a note (sets isPinned). Returns the updated note.
 *
 * A write, so it mirrors the other mutating routes: per-IP rate limit first,
 * then API-key auth. Pinning a missing note yields 404 NOTE_NOT_FOUND and an
 * archived note yields 422 INVALID_NOTE — both via the uniform error envelope.
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

  const result = await NoteController.pinNote(params.id);
  return toNextResponse(result);
}
