/**
 * Next.js API Route: /api/notes/[id]
 * 
 * Handles GET (retrieve), PUT (update), and DELETE requests for individual notes.
 */

import { NextRequest, NextResponse } from 'next/server';
import { NoteController } from '@/interfaces/http/controllers/NoteController';

interface RouteContext {
  params: {
    id: string;
  };
}

export async function GET(
  request: NextRequest,
  { params }: RouteContext
) {
  const result = await NoteController.getNote(params.id);
  return NextResponse.json(result, { status: result.status });
}

export async function PUT(
  request: NextRequest,
  { params }: RouteContext
) {
  const body = await request.json();
  const result = await NoteController.updateNote(params.id, body);
  return NextResponse.json(result, { status: result.status });
}

export async function DELETE(
  request: NextRequest,
  { params }: RouteContext
) {
  const result = await NoteController.deleteNote(params.id);
  return NextResponse.json(result, { status: result.status });
}
