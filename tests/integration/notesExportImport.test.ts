import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it } from 'vitest';

import { container } from '@/infrastructure/di/container';
import { POST as createNote } from '@/app/api/v1/notes/route';
import { GET as exportNotes } from '@/app/api/v1/notes/export/route';
import { POST as importNotes } from '@/app/api/v1/notes/import/route';

/**
 * Integration tests for the export/import endpoints.
 *
 * These drive the real Next.js route handlers end to end — through the
 * controller, zod validation, the use cases, and the SQLite repository (an
 * in-process `:memory:` DB configured via SQLITE_DB_PATH in vitest.config.ts).
 *
 * Covered endpoints:
 *   - GET  /api/v1/notes/export
 *   - POST /api/v1/notes/import
 */

const BASE = 'http://localhost/api/v1/notes';

function jsonRequest(url: string, method: string, body: unknown): NextRequest {
  return new NextRequest(url, {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function postNote(body: unknown) {
  const res = await createNote(jsonRequest(BASE, 'POST', body));
  expect(res.status).toBe(201);
  return (await res.json()).data;
}

// Wipe the shared repository between tests (same pattern as notesApi.test.ts).
beforeEach(async () => {
  const repository = container.getNoteRepository();
  for (const note of await repository.findAll()) {
    await repository.delete(note.id);
  }
});

describe('GET /api/v1/notes/export', () => {
  it('returns valid JSON with every note and a count', async () => {
    await postNote({ title: 'Alpha', content: 'a', tags: ['work'] });
    await postNote({ title: 'Beta', content: 'b' });

    const res = await exportNotes(new NextRequest(`${BASE}/export`));
    expect(res.status).toBe(200);

    const { data } = await res.json();
    expect(data.count).toBe(2);
    expect(data.exportedAt).toEqual(expect.any(String));
    expect(data.notes.map((n: { title: string }) => n.title).sort()).toEqual([
      'Alpha',
      'Beta',
    ]);
  });

  it('returns an empty snapshot when there are no notes', async () => {
    const res = await exportNotes(new NextRequest(`${BASE}/export`));
    expect(res.status).toBe(200);
    const { data } = await res.json();
    expect(data.count).toBe(0);
    expect(data.notes).toEqual([]);
  });
});

describe('POST /api/v1/notes/import', () => {
  it('validates and creates an array of notes (201)', async () => {
    const res = await importNotes(
      jsonRequest(`${BASE}/import`, 'POST', {
        notes: [
          { title: 'One', content: 'first' },
          { title: 'Two', content: 'second', tags: ['x'] },
        ],
      })
    );

    expect(res.status).toBe(201);
    const { data } = await res.json();
    expect(data.imported).toBe(2);
    expect(data.skipped).toBe(0);
    expect(data.total).toBe(2);

    // The created notes are now retrievable through export.
    const exported = await exportNotes(new NextRequest(`${BASE}/export`));
    expect((await exported.json()).data.count).toBe(2);
  });

  it('round-trips an export payload back into import (read-back + dedup)', async () => {
    await postNote({ title: 'Persisted', content: 'body', tags: ['demo'] });
    const snapshot = (await (await exportNotes(new NextRequest(`${BASE}/export`))).json())
      .data;

    // Re-importing the same snapshot is a no-op: the id already exists.
    const res = await importNotes(
      jsonRequest(`${BASE}/import`, 'POST', { notes: snapshot.notes })
    );
    expect(res.status).toBe(201);
    const { data } = await res.json();
    expect(data.imported).toBe(0);
    expect(data.skipped).toBe(1);

    // Still exactly one note — nothing was duplicated.
    const after = (await (await exportNotes(new NextRequest(`${BASE}/export`))).json())
      .data;
    expect(after.count).toBe(1);
    expect(after.notes[0]).toEqual(snapshot.notes[0]); // verbatim read-back
  });

  it('preserves a note colour across an export/import round-trip', async () => {
    await postNote({ title: 'Coloured', content: 'body', color: '#0F0F0F' });
    const snapshot = (await (await exportNotes(new NextRequest(`${BASE}/export`))).json())
      .data;
    expect(snapshot.notes[0].color).toBe('#0F0F0F');

    // Wipe and re-import the snapshot; the colour comes back intact.
    const repository = container.getNoteRepository();
    for (const note of await repository.findAll()) {
      await repository.delete(note.id);
    }

    const res = await importNotes(
      jsonRequest(`${BASE}/import`, 'POST', { notes: snapshot.notes })
    );
    expect(res.status).toBe(201);
    expect((await res.json()).data.imported).toBe(1);

    const after = (await (await exportNotes(new NextRequest(`${BASE}/export`))).json())
      .data;
    expect(after.notes[0].color).toBe('#0F0F0F');
  });

  it('returns 400 VALIDATION_ERROR for an empty notes array', async () => {
    const res = await importNotes(
      jsonRequest(`${BASE}/import`, 'POST', { notes: [] })
    );

    expect(res.status).toBe(400);
    const { error } = await res.json();
    expect(error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 VALIDATION_ERROR when a note is missing its title', async () => {
    const res = await importNotes(
      jsonRequest(`${BASE}/import`, 'POST', {
        notes: [{ content: 'no title here' }],
      })
    );

    expect(res.status).toBe(400);
    const { error } = await res.json();
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.details).toBeInstanceOf(Array);
  });

  it('returns 422 INVALID_NOTE when a note breaks a business rule', async () => {
    const res = await importNotes(
      jsonRequest(`${BASE}/import`, 'POST', {
        notes: [{ title: 'x'.repeat(201) }], // exceeds the 200-char title rule
      })
    );

    expect(res.status).toBe(422);
    const { error } = await res.json();
    expect(error.code).toBe('INVALID_NOTE');
  });
});
