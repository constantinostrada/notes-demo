/**
 * Next.js API Route: /api/notes
 * 
 * Handles GET (list all) and POST (create) requests for notes.
 */

import { NextRequest, NextResponse } from 'next/server';
import { NoteController } from '@/interfaces/http/controllers/NoteController';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q');

  // If query parameter exists, search notes
  if (query) {
    const result = await NoteController.searchNotes(query);
    return NextResponse.json(result, { status: result.status });
  }

  // Otherwise list all notes
  const result = await NoteController.listNotes();
  return NextResponse.json(result, { status: result.status });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const result = await NoteController.createNote(body);
  return NextResponse.json(result, { status: result.status });
}
