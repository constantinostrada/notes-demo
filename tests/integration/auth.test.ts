import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { container } from '@/infrastructure/di/container';
import { GET as listNotes, POST as createNote } from '@/app/api/v1/notes/route';
import {
  PUT as updateNoteById,
  DELETE as deleteNoteById,
} from '@/app/api/v1/notes/[id]/route';

/**
 * Integration tests for the API-key guard on the write endpoints.
 *
 * The guard reads `process.env.API_KEY` at request time, so each test sets the
 * variable explicitly and restores the previous value afterwards. With a key
 * configured, writes require the `x-api-key` header; reads stay public. With the
 * key unset, authentication is disabled (covered by the rest of the suite, which
 * writes without any header).
 */

const BASE = 'http://localhost/api/v1/notes';
const TEST_KEY = 's3cret-test-key';

/** Build a JSON write request, optionally with an API key header. */
function writeRequest(
  url: string,
  method: string,
  body: unknown,
  apiKey?: string
): NextRequest {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (apiKey !== undefined) headers['x-api-key'] = apiKey;
  return new NextRequest(url, { method, headers, body: JSON.stringify(body) });
}

let previousApiKey: string | undefined;

beforeEach(async () => {
  previousApiKey = process.env.API_KEY;
  process.env.API_KEY = TEST_KEY;

  const repository = container.getNoteRepository();
  for (const note of await repository.findAll()) {
    await repository.delete(note.id);
  }
});

afterEach(() => {
  if (previousApiKey === undefined) {
    delete process.env.API_KEY;
  } else {
    process.env.API_KEY = previousApiKey;
  }
});

describe('API key guard on write endpoints', () => {
  it('rejects POST with no key: 401 UNAUTHORIZED envelope', async () => {
    const res = await createNote(
      writeRequest(BASE, 'POST', { title: 'No key', content: 'nope' })
    );

    expect(res.status).toBe(401);
    const { error } = await res.json();
    expect(error.code).toBe('UNAUTHORIZED');
    expect(error.message).toBe('Missing or invalid API key');
  });

  it('rejects POST with a wrong key: 401 UNAUTHORIZED', async () => {
    const res = await createNote(
      writeRequest(BASE, 'POST', { title: 'Bad key', content: 'nope' }, 'wrong')
    );

    expect(res.status).toBe(401);
    const { error } = await res.json();
    expect(error.code).toBe('UNAUTHORIZED');
  });

  it('accepts POST with the correct key: 201', async () => {
    const res = await createNote(
      writeRequest(BASE, 'POST', { title: 'Good key', content: 'ok' }, TEST_KEY)
    );

    expect(res.status).toBe(201);
    const { data } = await res.json();
    expect(data.title).toBe('Good key');
  });

  it('guards PUT and DELETE the same way', async () => {
    // Seed a note with a valid key so there is something to mutate.
    const created = await createNote(
      writeRequest(BASE, 'POST', { title: 'Seed', content: 'seed' }, TEST_KEY)
    );
    const { data: note } = await created.json();

    const putNoKey = await updateNoteById(
      writeRequest(`${BASE}/${note.id}`, 'PUT', { title: 'Renamed' }),
      { params: { id: note.id } }
    );
    expect(putNoKey.status).toBe(401);

    const delNoKey = await deleteNoteById(
      new NextRequest(`${BASE}/${note.id}`, { method: 'DELETE' }),
      { params: { id: note.id } }
    );
    expect(delNoKey.status).toBe(401);

    // With the key, the delete goes through (204).
    const delWithKey = await deleteNoteById(
      new NextRequest(`${BASE}/${note.id}`, {
        method: 'DELETE',
        headers: { 'x-api-key': TEST_KEY },
      }),
      { params: { id: note.id } }
    );
    expect(delWithKey.status).toBe(204);
  });

  it('leaves read endpoints public even when a key is configured', async () => {
    const res = await listNotes(new NextRequest(BASE));
    expect(res.status).toBe(200);
  });
});
