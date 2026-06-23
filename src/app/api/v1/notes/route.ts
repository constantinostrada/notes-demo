/**
 * Next.js API Route: /api/v1/notes
 *
 * Collection endpoint for the Notes resource.
 *   - GET  → list all notes (or search when `?q=` is present)
 *   - POST → create a note
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
  const query = request.nextUrl.searchParams.get('q');

  // If a query parameter exists, search notes; otherwise list all.
  const result = query
    ? await NoteController.searchNotes(query)
    : await NoteController.listNotes();

  return toNextResponse(result);
}

export async function POST(request: NextRequest) {
  // `undefined` on malformed JSON → caught by schema validation as a 400.
  const body = await request.json().catch(() => undefined);
  const result = await NoteController.createNote(body);
  return toNextResponse(result);
}
