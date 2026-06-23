/**
 * Next.js API Route: /api/v1/notes/[id]
 *
 * Single-resource endpoint for the Notes resource.
 *   - GET    → retrieve a note by id
 *   - PUT    → update a note
 *   - DELETE → delete a note
 *
 * Like the collection route, this is a thin transport adapter that delegates
 * to the NoteController; use cases are resolved from the DI container there.
 */

import { NextRequest, NextResponse } from 'next/server';
import { NoteController } from '@/interfaces/http/controllers/NoteController';

interface RouteContext {
  params: {
    id: string;
  };
}

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const result = await NoteController.getNote(params.id);
  return NextResponse.json(result, { status: result.status });
}

export async function PUT(request: NextRequest, { params }: RouteContext) {
  const body = await request.json().catch(() => null);
  const result = await NoteController.updateNote(params.id, body);
  return NextResponse.json(result, { status: result.status });
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const result = await NoteController.deleteNote(params.id);

  // A 204 "No Content" response must not carry a body (per the HTTP spec the
  // Response constructor rejects a body with status 204), so return an empty one.
  if (result.status === 204) {
    return new NextResponse(null, { status: 204 });
  }

  return NextResponse.json(result, { status: result.status });
}
