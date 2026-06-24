/**
 * Next.js API Route: /api/v1/notes
 *
 * Collection endpoint for the Notes resource.
 *   - GET  → list all notes (optionally filtered by `?tag=`)
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

export async function GET(request: NextRequest) {
  // `?tag=` filters the list; absent → list everything. Normalize null→undefined
  // so the optional query schema sees "not provided" rather than an invalid null.
  const tag = request.nextUrl.searchParams.get('tag') ?? undefined;
  const result = await NoteController.listNotes(tag);
  return toNextResponse(result);
}

export async function POST(request: NextRequest) {
  // `undefined` on malformed JSON → caught by schema validation as a 400.
  const body = await request.json().catch(() => undefined);
  const result = await NoteController.createNote(body);
  return toNextResponse(result);
}
