/**
 * Next.js API Route: /api/v1/notes
 *
 * Collection endpoint for the Notes resource.
 *   - GET  → list all notes (or search when `?q=` is present)
 *   - POST → create a note
 *
 * This handler is a thin transport adapter: it parses the HTTP request and
 * delegates to the NoteController, which resolves the appropriate use case
 * from the DI container. No business logic lives here.
 */

import { NextRequest, NextResponse } from 'next/server';
import { NoteController } from '@/interfaces/http/controllers/NoteController';

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q');

  // If a query parameter exists, search notes; otherwise list all.
  const result = query
    ? await NoteController.searchNotes(query)
    : await NoteController.listNotes();

  return NextResponse.json(result, { status: result.status });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const result = await NoteController.createNote(body);
  return NextResponse.json(result, { status: result.status });
}
