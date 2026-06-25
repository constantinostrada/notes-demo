/**
 * Next.js API Route: /api/v1/notes/export
 *
 * Export endpoint for the Notes resource.
 *   - GET → return every note (archived included) as a JSON snapshot suitable
 *           for backup or for feeding straight into `POST /api/v1/notes/import`.
 *
 * Like the other note routes, this is a thin transport adapter: it delegates to
 * the NoteController, which resolves ExportNotesUseCase from the DI container
 * and returns a uniform result. Response serialization (and the error envelope)
 * is handled by `toNextResponse`.
 */

import { NextRequest } from 'next/server';
import { NoteController } from '@/interfaces/http/controllers/NoteController';
import { toNextResponse } from '@/interfaces/http/apiResponse';
import { enforceRateLimit } from '@/interfaces/http/rateLimit';

export async function GET(request: NextRequest) {
  // Per-IP rate limit (429 + Retry-After when exceeded).
  const limited = enforceRateLimit(request);
  if (limited) return toNextResponse(limited);

  // Read-only: no API key required (mirrors the other GET endpoints).
  const result = await NoteController.exportNotes();
  return toNextResponse(result);
}
