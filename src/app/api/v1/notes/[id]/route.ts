/**
 * Next.js API Route: /api/v1/notes/[id]
 *
 * Single-resource endpoint for the Notes resource.
 *   - GET    → retrieve a note by id
 *   - PUT    → update a note
 *   - DELETE → archive a note (soft delete; returns 204)
 *
 * Like the collection route, this is a thin transport adapter that delegates
 * to the NoteController; response serialization (success, error envelope, and
 * body-less 204) is handled uniformly by `toNextResponse`.
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

export async function GET(request: NextRequest, { params }: RouteContext) {
  // Per-IP rate limit (429 + Retry-After when exceeded).
  const limited = enforceRateLimit(request);
  if (limited) return toNextResponse(limited);

  const result = await NoteController.getNote(params.id);
  return toNextResponse(result);
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
  const result = await NoteController.updateNote(params.id, body);
  return toNextResponse(result);
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  // Per-IP rate limit (429 + Retry-After when exceeded).
  const limited = enforceRateLimit(request);
  if (limited) return toNextResponse(limited);

  // Writes require a valid API key (no-op when none is configured).
  const unauthorized = requireApiKey(request);
  if (unauthorized) return toNextResponse(unauthorized);

  const result = await NoteController.deleteNote(params.id);
  return toNextResponse(result);
}
