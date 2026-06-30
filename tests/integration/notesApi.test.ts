import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it } from 'vitest';

import { container } from '@/infrastructure/di/container';
import { Note } from '@/domain/entities/Note';
import { GET as listNotes, POST as createNote } from '@/app/api/v1/notes/route';
import {
  GET as getNoteById,
  PUT as updateNoteById,
  DELETE as deleteNoteById,
} from '@/app/api/v1/notes/[id]/route';
import { GET as searchNotes } from '@/app/api/v1/notes/search/route';
import { GET as countNotes } from '@/app/api/v1/notes/count/route';
import { GET as listPinnedNotes } from '@/app/api/v1/notes/pinned/route';
import { POST as pinNoteById } from '@/app/api/v1/notes/[id]/pin/route';
import { POST as unpinNoteById } from '@/app/api/v1/notes/[id]/unpin/route';
import { PUT as setReminderById } from '@/app/api/v1/notes/[id]/reminder/route';
import { GET as listDueNotes } from '@/app/api/v1/notes/due/route';
import { GET as countDueNotes } from '@/app/api/v1/notes/due/count/route';
import { POST as bulkArchiveNotes } from '@/app/api/v1/notes/bulk-archive/route';
import { POST as bulkRestoreNotes } from '@/app/api/v1/notes/bulk-restore/route';

/**
 * Integration tests for the Notes HTTP API.
 *
 * These drive the *real* Next.js route handlers end to end — through the
 * controller, validation (zod), the use cases, and the SQLite repository. The
 * repository runs against an in-process `:memory:` database (configured via
 * SQLITE_DB_PATH in vitest.config.ts), so the tests hit real SQL without
 * touching the on-disk `data/notes.db`.
 *
 * Covered endpoints:
 *   - POST   /api/v1/notes            (create)
 *   - GET    /api/v1/notes/:id        (read one)
 *   - GET    /api/v1/notes            (list / paginate / filter)
 *   - GET    /api/v1/notes/search     (search)
 */

const BASE = 'http://localhost/api/v1/notes';

/** Build a POST/PUT request with a JSON body. */
function jsonRequest(url: string, method: string, body: unknown): NextRequest {
  return new NextRequest(url, {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/** POST a note and return the parsed `data` payload (asserts 201). */
async function postNote(body: unknown) {
  const res = await createNote(jsonRequest(BASE, 'POST', body));
  expect(res.status).toBe(201);
  const json = await res.json();
  return json.data;
}

/**
 * Persist a note straight through the repository with an explicit creation time.
 * Rapid POSTs can share a millisecond (where only the id tiebreaker decides
 * order), so createdAt-ordering tests seed distinct timestamps this way.
 */
async function seedAt(id: string, title: string, createdAt: string): Promise<string> {
  const at = new Date(createdAt);
  await container
    .getNoteRepository()
    .save(Note.reconstitute(id, title, 'body', [], at, at, null, null));
  return id;
}

// The DI container caches a single repository on globalThis, and the exported
// `container` is the very same instance the route handlers use. Wiping its rows
// between tests gives each test an isolated, empty database.
beforeEach(async () => {
  const repository = container.getNoteRepository();
  for (const note of await repository.findAll()) {
    await repository.delete(note.id);
  }
});

describe('POST /api/v1/notes + GET /api/v1/notes/:id', () => {
  it('creates a note and reads it back by id', async () => {
    const created = await postNote({
      title: 'Integration note',
      content: 'persisted through real SQL',
      tags: ['Demo', 'demo'],
    });

    expect(created.id).toBeTruthy();
    expect(created.title).toBe('Integration note');
    expect(created.tags).toEqual(['demo']); // normalized + de-duplicated

    const res = await getNoteById(new NextRequest(`${BASE}/${created.id}`), {
      params: { id: created.id },
    });
    expect(res.status).toBe(200);

    const { data } = await res.json();
    expect(data).toEqual(created);
  });

  it('returns 404 with a NOTE_NOT_FOUND error for an unknown id', async () => {
    const res = await getNoteById(new NextRequest(`${BASE}/does-not-exist`), {
      params: { id: 'does-not-exist' },
    });

    expect(res.status).toBe(404);
    const { error } = await res.json();
    expect(error.code).toBe('NOTE_NOT_FOUND');
  });

  it('returns 400 VALIDATION_ERROR when the title is missing', async () => {
    const res = await createNote(jsonRequest(BASE, 'POST', { content: 'no title' }));

    expect(res.status).toBe(400);
    const { error } = await res.json();
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.details).toBeInstanceOf(Array);
  });

  it('accepts an optional hex colour and reads it back', async () => {
    const created = await postNote({
      title: 'Coloured note',
      content: 'has a colour',
      color: '#1A2B3C',
    });

    expect(created.color).toBe('#1A2B3C');

    const res = await getNoteById(new NextRequest(`${BASE}/${created.id}`), {
      params: { id: created.id },
    });
    const { data } = await res.json();
    expect(data.color).toBe('#1A2B3C');
  });

  it('defaults colour to null when omitted', async () => {
    const created = await postNote({ title: 'No colour', content: '' });
    expect(created.color).toBeNull();
  });

  it('returns 400 VALIDATION_ERROR for a malformed colour', async () => {
    const res = await createNote(
      jsonRequest(BASE, 'POST', { title: 'Bad colour', color: 'blue' })
    );

    expect(res.status).toBe(400);
    const { error } = await res.json();
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.details).toBeInstanceOf(Array);
  });
});

describe('PUT /api/v1/notes/:id (update colour)', () => {
  it('updates the colour of an existing note', async () => {
    const created = await postNote({ title: 'Recolour me', content: '' });
    expect(created.color).toBeNull();

    const res = await updateNoteById(
      jsonRequest(`${BASE}/${created.id}`, 'PUT', { color: '#ABCDEF' }),
      { params: { id: created.id } }
    );
    expect(res.status).toBe(200);

    const { data } = await res.json();
    expect(data.color).toBe('#ABCDEF');
  });

  it('returns 400 VALIDATION_ERROR for a malformed colour on update', async () => {
    const created = await postNote({ title: 'Keep colour', content: '' });

    const res = await updateNoteById(
      jsonRequest(`${BASE}/${created.id}`, 'PUT', { color: '#GGGGGG' }),
      { params: { id: created.id } }
    );

    expect(res.status).toBe(400);
    const { error } = await res.json();
    expect(error.code).toBe('VALIDATION_ERROR');
  });
});

describe('GET /api/v1/notes (list)', () => {
  it('cursor-paginates and sorts by title, with a tag filter', async () => {
    await postNote({ title: 'Alpha', content: 'a', tags: ['work'] });
    await postNote({ title: 'Beta', content: 'b', tags: ['work'] });
    await postNote({ title: 'Gamma', content: 'c', tags: ['home'] });

    // First page, 2 at a time, sorted by title ascending.
    const res = await listNotes(new NextRequest(`${BASE}?limit=2&sort=title&dir=asc`));
    expect(res.status).toBe(200);

    const { data } = await res.json();
    expect(data.notes.map((n: { title: string }) => n.title)).toEqual([
      'Alpha',
      'Beta',
    ]);
    expect(data.next_cursor).toEqual(expect.any(String));

    // Second page resumes strictly after the cursor — no skip, no duplicate.
    const next = await listNotes(
      new NextRequest(`${BASE}?limit=2&sort=title&dir=asc&cursor=${data.next_cursor}`)
    );
    const nextJson = await next.json();
    expect(nextJson.data.notes.map((n: { title: string }) => n.title)).toEqual(['Gamma']);
    expect(nextJson.data.next_cursor).toBeNull();

    // Tag filter narrows the result set.
    const filtered = await listNotes(new NextRequest(`${BASE}?tag=home`));
    const filteredJson = await filtered.json();
    expect(filteredJson.data.notes).toHaveLength(1);
    expect(filteredJson.data.notes[0].title).toBe('Gamma');
  });

  it('sorts by createdAt in both directions (newest-first is the default)', async () => {
    // Distinct timestamps so ordering is by creation time, not the id tiebreaker.
    const first = await seedAt('id-first', 'First', '2026-01-01T00:00:00Z');
    const second = await seedAt('id-second', 'Second', '2026-02-01T00:00:00Z');
    const third = await seedAt('id-third', 'Third', '2026-03-01T00:00:00Z');

    const desc = await listNotes(new NextRequest(BASE)); // default sort=createdAt&dir=desc
    expect((await desc.json()).data.notes.map((n: { id: string }) => n.id)).toEqual([
      third,
      second,
      first,
    ]);

    const asc = await listNotes(new NextRequest(`${BASE}?sort=createdAt&dir=asc`));
    expect((await asc.json()).data.notes.map((n: { id: string }) => n.id)).toEqual([
      first,
      second,
      third,
    ]);
  });

  it('pages stably through notes that share a title (equal sort keys)', async () => {
    // Five notes with an identical title — ordering by title alone is ambiguous,
    // so the id tiebreaker must keep paging deterministic across requests.
    const created = [];
    for (let i = 0; i < 5; i++) {
      created.push(await postNote({ title: 'Same', content: `n${i}` }));
    }
    const expectedIds = created.map((n) => n.id).sort();

    const seen: string[] = [];
    let cursor: string | null = null;
    for (let guard = 0; guard < 100; guard++) {
      const url = cursor
        ? `${BASE}?sort=title&dir=asc&limit=2&cursor=${cursor}`
        : `${BASE}?sort=title&dir=asc&limit=2`;
      const page = await listNotes(new NextRequest(url));
      const json = await page.json();
      seen.push(...json.data.notes.map((n: { id: string }) => n.id));
      cursor = json.data.next_cursor;
      if (!cursor) break;
    }

    expect(seen).toHaveLength(5);
    expect(new Set(seen).size).toBe(5); // no duplicates
    expect([...seen].sort()).toEqual(expectedIds); // none skipped
  });

  it('rejects an invalid sort with 400 VALIDATION_ERROR', async () => {
    const res = await listNotes(new NextRequest(`${BASE}?sort=bogus`));

    expect(res.status).toBe(400);
    const { error } = await res.json();
    expect(error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects an invalid dir with 400 VALIDATION_ERROR', async () => {
    const res = await listNotes(new NextRequest(`${BASE}?dir=sideways`));

    expect(res.status).toBe(400);
    const { error } = await res.json();
    expect(error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a malformed cursor with 400 VALIDATION_ERROR', async () => {
    const res = await listNotes(new NextRequest(`${BASE}?cursor=not-a-real-cursor`));

    expect(res.status).toBe(400);
    const { error } = await res.json();
    expect(error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a cursor minted under a different sort/dir with 400', async () => {
    await postNote({ title: 'Alpha', content: 'a' });
    await postNote({ title: 'Beta', content: 'b' });

    // Mint a cursor under title/asc...
    const first = await listNotes(new NextRequest(`${BASE}?sort=title&dir=asc&limit=1`));
    const { data } = await first.json();
    expect(data.next_cursor).toEqual(expect.any(String));

    // ...then replay it under a different ordering → rejected.
    const mismatched = await listNotes(
      new NextRequest(`${BASE}?sort=createdAt&dir=desc&cursor=${data.next_cursor}`)
    );
    expect(mismatched.status).toBe(400);
    expect((await mismatched.json()).error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects an out-of-range limit with 400 VALIDATION_ERROR', async () => {
    const res = await listNotes(new NextRequest(`${BASE}?limit=9999`));

    expect(res.status).toBe(400);
    const { error } = await res.json();
    expect(error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a malformed createdAfter with 400 VALIDATION_ERROR', async () => {
    const res = await listNotes(new NextRequest(`${BASE}?createdAfter=not-a-date`));

    expect(res.status).toBe(400);
    const { error } = await res.json();
    expect(error.code).toBe('VALIDATION_ERROR');
  });

  it('accepts ISO created-at bounds and combines them with a tag filter', async () => {
    await postNote({ title: 'Alpha', content: 'a', tags: ['work'] });
    await postNote({ title: 'Beta', content: 'b', tags: ['home'] });

    // A range spanning "now" keeps freshly-created notes; the tag narrows further.
    const res = await listNotes(
      new NextRequest(
        `${BASE}?tag=work&createdAfter=2020-01-01&createdBefore=2999-01-01`
      )
    );
    expect(res.status).toBe(200);

    const { data } = await res.json();
    expect(data.notes).toHaveLength(1);
    expect(data.notes[0].title).toBe('Alpha');

    // A past-only upper bound excludes the just-created notes (stable, no rows).
    const empty = await listNotes(new NextRequest(`${BASE}?createdBefore=2020-01-01`));
    const emptyJson = await empty.json();
    expect(emptyJson.data.notes).toHaveLength(0);
    expect(emptyJson.data.next_cursor).toBeNull();
  });
});

describe('GET /api/v1/notes/count', () => {
  const COUNT = `${BASE}/count`;

  it('returns { data: { count } } respecting the tag filter', async () => {
    await postNote({ title: 'Alpha', content: 'a', tags: ['work'] });
    await postNote({ title: 'Beta', content: 'b', tags: ['work'] });
    await postNote({ title: 'Gamma', content: 'c', tags: ['home'] });

    const all = await countNotes(new NextRequest(COUNT));
    expect(all.status).toBe(200);
    expect(await all.json()).toEqual({ data: { count: 3 } });

    const work = await countNotes(new NextRequest(`${COUNT}?tag=work`));
    expect((await work.json()).data.count).toBe(2);
  });

  it('excludes archived notes by default, includes them with includeArchived', async () => {
    const keep = await postNote({ title: 'Keep', content: 'stays' });
    const archived = await postNote({ title: 'Archive me', content: 'gone' });
    void keep;

    const del = await deleteNoteById(new NextRequest(`${BASE}/${archived.id}`), {
      params: { id: archived.id },
    });
    expect(del.status).toBe(204);

    const def = await countNotes(new NextRequest(COUNT));
    expect((await def.json()).data.count).toBe(1);

    const withArchived = await countNotes(
      new NextRequest(`${COUNT}?includeArchived=true`)
    );
    expect((await withArchived.json()).data.count).toBe(2);
  });

  it('respects an inclusive created-at range combined with a tag', async () => {
    await postNote({ title: 'Alpha', content: 'a', tags: ['work'] });
    await postNote({ title: 'Beta', content: 'b', tags: ['home'] });

    const inRange = await countNotes(
      new NextRequest(`${COUNT}?tag=work&createdAfter=2020-01-01&createdBefore=2999-01-01`)
    );
    expect((await inRange.json()).data.count).toBe(1);

    // A past-only upper bound excludes the just-created notes (stable, count 0).
    const empty = await countNotes(new NextRequest(`${COUNT}?createdBefore=2020-01-01`));
    expect((await empty.json()).data.count).toBe(0);
  });

  it('rejects a malformed createdAfter with 400 VALIDATION_ERROR', async () => {
    const res = await countNotes(new NextRequest(`${COUNT}?createdAfter=not-a-date`));

    expect(res.status).toBe(400);
    const { error } = await res.json();
    expect(error.code).toBe('VALIDATION_ERROR');
  });
});

describe('DELETE /api/v1/notes/:id (soft delete / archive)', () => {
  it('archives a note: 204, hidden from list, visible with includeArchived', async () => {
    const keep = await postNote({ title: 'Keep', content: 'stays' });
    const archived = await postNote({ title: 'Archive me', content: 'gone' });

    const del = await deleteNoteById(new NextRequest(`${BASE}/${archived.id}`), {
      params: { id: archived.id },
    });
    expect(del.status).toBe(204);

    // Default listing excludes the archived note.
    const listed = await listNotes(new NextRequest(BASE));
    const listedJson = await listed.json();
    expect(listedJson.data.notes).toHaveLength(1);
    expect(listedJson.data.notes.map((n: { id: string }) => n.id)).toEqual([keep.id]);

    // ?includeArchived=true surfaces it, flagged with a deletedAt timestamp.
    const withArchived = await listNotes(
      new NextRequest(`${BASE}?includeArchived=true&sort=title`)
    );
    const withArchivedJson = await withArchived.json();
    expect(withArchivedJson.data.notes).toHaveLength(2);
    const archivedRow = withArchivedJson.data.notes.find(
      (n: { id: string }) => n.id === archived.id
    );
    expect(archivedRow.deletedAt).toEqual(expect.any(String));
  });

  it('returns 404 NOTE_NOT_FOUND when archiving an unknown id', async () => {
    const res = await deleteNoteById(new NextRequest(`${BASE}/nope`), {
      params: { id: 'nope' },
    });

    expect(res.status).toBe(404);
    const { error } = await res.json();
    expect(error.code).toBe('NOTE_NOT_FOUND');
  });
});

describe('GET /api/v1/notes/search', () => {
  it('finds notes matching the query in title or content', async () => {
    await postNote({ title: 'Grocery list', content: 'buy milk' });
    await postNote({ title: 'Book notes', content: 'milk frother review' });
    await postNote({ title: 'Unrelated', content: 'nothing relevant' });

    const res = await searchNotes(new NextRequest(`${BASE}/search?q=milk`));
    expect(res.status).toBe(200);

    const { data } = await res.json();
    expect(data.notes).toHaveLength(2);
    expect(data.next_cursor).toBeNull();
    expect(data.notes.map((n: { title: string }) => n.title).sort()).toEqual([
      'Book notes',
      'Grocery list',
    ]);
  });

  it('paginates matches by cursor, returning next_cursor and a stable order', async () => {
    // Six matching notes; page through them three at a time.
    for (let i = 0; i < 6; i++) {
      await postNote({ title: `Entry ${i}`, content: 'paginate-me' });
    }

    const first = await searchNotes(
      new NextRequest(`${BASE}/search?q=paginate-me&limit=3`)
    );
    expect(first.status).toBe(200);
    const firstData = (await first.json()).data;
    expect(firstData.notes).toHaveLength(3);
    expect(firstData.next_cursor).toBeTruthy();

    const second = await searchNotes(
      new NextRequest(
        `${BASE}/search?q=paginate-me&limit=3&cursor=${encodeURIComponent(
          firstData.next_cursor
        )}`
      )
    );
    expect(second.status).toBe(200);
    const secondData = (await second.json()).data;
    expect(secondData.notes).toHaveLength(3);
    expect(secondData.next_cursor).toBeNull();

    // No id appears on both pages and all six are covered (no skip/duplicate).
    const ids = [...firstData.notes, ...secondData.notes].map(
      (n: { id: string }) => n.id
    );
    expect(new Set(ids).size).toBe(6);
  });

  it('returns 400 VALIDATION_ERROR when q is missing', async () => {
    const res = await searchNotes(new NextRequest(`${BASE}/search`));

    expect(res.status).toBe(400);
    const { error } = await res.json();
    expect(error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 VALIDATION_ERROR for a malformed cursor', async () => {
    const res = await searchNotes(
      new NextRequest(`${BASE}/search?q=milk&cursor=not-a-real-cursor`)
    );

    expect(res.status).toBe(400);
    const { error } = await res.json();
    expect(error.code).toBe('VALIDATION_ERROR');
  });
});

describe('Notes pinning (POST /:id/pin, /:id/unpin + GET /notes/pinned)', () => {
  const PINNED = `${BASE}/pinned`;

  /** POST /:id/pin and return the parsed response (status + body). */
  async function pin(id: string) {
    const res = await pinNoteById(new NextRequest(`${BASE}/${id}/pin`, { method: 'POST' }), {
      params: { id },
    });
    return { status: res.status, json: await res.json().catch(() => null) };
  }

  /** POST /:id/unpin and return the parsed response (status + body). */
  async function unpin(id: string) {
    const res = await unpinNoteById(
      new NextRequest(`${BASE}/${id}/unpin`, { method: 'POST' }),
      { params: { id } }
    );
    return { status: res.status, json: await res.json().catch(() => null) };
  }

  it('pins and unpins a note, toggling isPinned', async () => {
    const created = await postNote({ title: 'Toggle', content: 'x' });
    expect(created.isPinned).toBe(false);

    const pinned = await pin(created.id);
    expect(pinned.status).toBe(200);
    expect(pinned.json.data.isPinned).toBe(true);

    const unpinned = await unpin(created.id);
    expect(unpinned.status).toBe(200);
    expect(unpinned.json.data.isPinned).toBe(false);
  });

  it('lists only pinned, non-archived notes, cursor-paginated', async () => {
    const a = await postNote({ title: 'Pinned A', content: 'a' });
    const b = await postNote({ title: 'Pinned B', content: 'b' });
    await postNote({ title: 'Plain', content: 'c' }); // never pinned

    await pin(a.id);
    await pin(b.id);

    const res = await listPinnedNotes(new NextRequest(PINNED));
    expect(res.status).toBe(200);
    const { data } = await res.json();
    expect(data.notes).toHaveLength(2);
    expect(data.next_cursor).toBeNull();
    expect(new Set(data.notes.map((n: { id: string }) => n.id))).toEqual(
      new Set([a.id, b.id])
    );

    // Page size 1 → first page returns a next_cursor for the second.
    const firstPage = await listPinnedNotes(new NextRequest(`${PINNED}?limit=1`));
    const firstData = (await firstPage.json()).data;
    expect(firstData.notes).toHaveLength(1);
    expect(firstData.next_cursor).toBeTruthy();

    const secondPage = await listPinnedNotes(
      new NextRequest(`${PINNED}?limit=1&cursor=${encodeURIComponent(firstData.next_cursor)}`)
    );
    const secondData = (await secondPage.json()).data;
    expect(secondData.notes).toHaveLength(1);
    // The two pages together cover both pinned notes with no overlap.
    const ids = [...firstData.notes, ...secondData.notes].map((n: { id: string }) => n.id);
    expect(new Set(ids)).toEqual(new Set([a.id, b.id]));
  });

  it('excludes an archived note from the pinned listing', async () => {
    const keep = await postNote({ title: 'Keep pinned', content: 'a' });
    const gone = await postNote({ title: 'Pinned then archived', content: 'b' });
    await pin(keep.id);
    await pin(gone.id);

    const del = await deleteNoteById(new NextRequest(`${BASE}/${gone.id}`), {
      params: { id: gone.id },
    });
    expect(del.status).toBe(204);

    const res = await listPinnedNotes(new NextRequest(PINNED));
    const { data } = await res.json();
    expect(data.notes.map((n: { id: string }) => n.id)).toEqual([keep.id]);
  });

  it('returns 404 NOTE_NOT_FOUND when pinning an unknown id', async () => {
    const { status, json } = await pin('does-not-exist');
    expect(status).toBe(404);
    expect(json.error.code).toBe('NOTE_NOT_FOUND');
  });

  it('returns 422 INVALID_NOTE when pinning an archived note', async () => {
    const created = await postNote({ title: 'Archive me', content: 'x' });
    const del = await deleteNoteById(new NextRequest(`${BASE}/${created.id}`), {
      params: { id: created.id },
    });
    expect(del.status).toBe(204);

    const { status, json } = await pin(created.id);
    expect(status).toBe(422);
    expect(json.error.code).toBe('INVALID_NOTE');
  });

  it('returns 400 VALIDATION_ERROR for a malformed pinned cursor', async () => {
    const res = await listPinnedNotes(new NextRequest(`${PINNED}?cursor=not-a-real-cursor`));
    expect(res.status).toBe(400);
    const { error } = await res.json();
    expect(error.code).toBe('VALIDATION_ERROR');
  });
});

describe('Notes reminders (PUT /:id/reminder + GET /notes/due)', () => {
  const DUE = `${BASE}/due`;
  // A reminder comfortably in the past (overdue) and one in the future.
  const PAST = '2000-01-01T00:00:00.000Z';
  const FUTURE = '2999-01-01T00:00:00.000Z';

  /** PUT /:id/reminder with the given body, returning status + parsed body. */
  async function setReminder(id: string, body: unknown) {
    const res = await setReminderById(jsonRequest(`${BASE}/${id}/reminder`, 'PUT', body), {
      params: { id },
    });
    return { status: res.status, json: await res.json().catch(() => null) };
  }

  it('sets and clears a reminder, toggling dueAt', async () => {
    const created = await postNote({ title: 'Remind me', content: 'x' });
    expect(created.dueAt).toBeNull();

    const set = await setReminder(created.id, { dueAt: PAST });
    expect(set.status).toBe(200);
    expect(set.json.data.dueAt).toBe(PAST);

    const cleared = await setReminder(created.id, { dueAt: null });
    expect(cleared.status).toBe(200);
    expect(cleared.json.data.dueAt).toBeNull();
  });

  it('lists overdue notes and excludes future + archived ones', async () => {
    const overdue = await postNote({ title: 'Overdue', content: 'a' });
    const upcoming = await postNote({ title: 'Upcoming', content: 'b' });
    const archived = await postNote({ title: 'Archived overdue', content: 'c' });

    await setReminder(overdue.id, { dueAt: PAST });
    await setReminder(upcoming.id, { dueAt: FUTURE });
    await setReminder(archived.id, { dueAt: PAST });

    // Archive the third note after giving it a past reminder.
    const del = await deleteNoteById(new NextRequest(`${BASE}/${archived.id}`), {
      params: { id: archived.id },
    });
    expect(del.status).toBe(204);

    const res = await listDueNotes(new NextRequest(DUE));
    expect(res.status).toBe(200);
    const { data } = await res.json();
    expect(data.notes.map((n: { id: string }) => n.id)).toEqual([overdue.id]);
  });

  it('counts overdue notes, matching the due listing (same predicate)', async () => {
    const overdue = await postNote({ title: 'Overdue', content: 'a' });
    const upcoming = await postNote({ title: 'Upcoming', content: 'b' });
    const archived = await postNote({ title: 'Archived overdue', content: 'c' });

    await setReminder(overdue.id, { dueAt: PAST });
    await setReminder(upcoming.id, { dueAt: FUTURE });
    await setReminder(archived.id, { dueAt: PAST });

    // Archive the third note; like the listing, it must drop out of the count.
    const del = await deleteNoteById(new NextRequest(`${BASE}/${archived.id}`), {
      params: { id: archived.id },
    });
    expect(del.status).toBe(204);

    const countRes = await countDueNotes(new NextRequest(`${DUE}/count`));
    expect(countRes.status).toBe(200);
    const { data: countData } = await countRes.json();
    expect(countData.count).toBe(1);

    // The count agrees with the length of the due listing.
    const listRes = await listDueNotes(new NextRequest(DUE));
    const { data: listData } = await listRes.json();
    expect(countData.count).toBe(listData.notes.length);
  });

  it('counts zero overdue notes when none are due', async () => {
    const upcoming = await postNote({ title: 'Upcoming', content: 'a' });
    await setReminder(upcoming.id, { dueAt: FUTURE });

    const countRes = await countDueNotes(new NextRequest(`${DUE}/count`));
    expect(countRes.status).toBe(200);
    const { data } = await countRes.json();
    expect(data.count).toBe(0);
  });

  it('returns 404 NOTE_NOT_FOUND when setting a reminder on an unknown id', async () => {
    const { status, json } = await setReminder('does-not-exist', { dueAt: PAST });
    expect(status).toBe(404);
    expect(json.error.code).toBe('NOTE_NOT_FOUND');
  });

  it('returns 400 VALIDATION_ERROR for a malformed dueAt', async () => {
    const created = await postNote({ title: 'Bad reminder', content: 'x' });
    const { status, json } = await setReminder(created.id, { dueAt: 'not-a-date' });
    expect(status).toBe(400);
    expect(json.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('POST /api/v1/notes/bulk-archive', () => {
  /** POST a bulk-archive request and return { status, json }. */
  async function bulkArchive(body: unknown) {
    const res = await bulkArchiveNotes(
      jsonRequest(`${BASE}/bulk-archive`, 'POST', body)
    );
    return { status: res.status, json: await res.json() };
  }

  it('archives every listed note: hidden from list and search, still recoverable', async () => {
    const a = await postNote({ title: 'Alpha', content: 'find me' });
    const b = await postNote({ title: 'Beta', content: 'find me' });
    const keep = await postNote({ title: 'Gamma', content: 'find me' });

    const { status, json } = await bulkArchive({ ids: [a.id, b.id] });
    expect(status).toBe(200);
    expect(json.data).toMatchObject({ archived: 2, skipped: 0, total: 2 });

    // Both are gone from the default listing and from search...
    const listed = await listNotes(new NextRequest(BASE));
    const listedJson = await listed.json();
    expect(listedJson.data.notes.map((n: { id: string }) => n.id)).toEqual([keep.id]);

    const found = await searchNotes(new NextRequest(`${BASE}/search?q=find%20me`));
    const foundJson = await found.json();
    expect(foundJson.data.notes.map((n: { id: string }) => n.id)).toEqual([keep.id]);

    // ...but recoverable: ?includeArchived=true surfaces them with deletedAt set.
    const withArchived = await listNotes(
      new NextRequest(`${BASE}?includeArchived=true`)
    );
    const withArchivedJson = await withArchived.json();
    expect(withArchivedJson.data.notes).toHaveLength(3);
    const archivedRow = withArchivedJson.data.notes.find(
      (n: { id: string }) => n.id === a.id
    );
    expect(archivedRow.deletedAt).toEqual(expect.any(String));
  });

  it('ignores unknown and already-archived ids without failing the batch', async () => {
    const a = await postNote({ title: 'Alpha', content: 'x' });

    // First call archives `a`; second sees it as already-archived.
    await bulkArchive({ ids: [a.id] });
    const { status, json } = await bulkArchive({
      ids: [a.id, 'does-not-exist'],
    });

    expect(status).toBe(200);
    expect(json.data).toMatchObject({ archived: 0, skipped: 2, total: 2 });
  });

  it('returns 400 VALIDATION_ERROR for an empty id list', async () => {
    const { status, json } = await bulkArchive({ ids: [] });
    expect(status).toBe(400);
    expect(json.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('POST /api/v1/notes/bulk-restore', () => {
  /** POST a bulk-archive request and return { status, json }. */
  async function bulkArchive(body: unknown) {
    const res = await bulkArchiveNotes(
      jsonRequest(`${BASE}/bulk-archive`, 'POST', body)
    );
    return { status: res.status, json: await res.json() };
  }

  /** POST a bulk-restore request and return { status, json }. */
  async function bulkRestore(body: unknown) {
    const res = await bulkRestoreNotes(
      jsonRequest(`${BASE}/bulk-restore`, 'POST', body)
    );
    return { status: res.status, json: await res.json() };
  }

  it('restores every listed note: reappears in list and search', async () => {
    const a = await postNote({ title: 'Alpha', content: 'find me' });
    const b = await postNote({ title: 'Beta', content: 'find me' });

    await bulkArchive({ ids: [a.id, b.id] });

    const { status, json } = await bulkRestore({ ids: [a.id, b.id] });
    expect(status).toBe(200);
    expect(json.data).toMatchObject({ restored: 2, skipped: 0, total: 2 });

    // Both are back in the default listing and in search.
    const listed = await listNotes(new NextRequest(BASE));
    const listedJson = await listed.json();
    expect(
      listedJson.data.notes.map((n: { id: string }) => n.id).sort()
    ).toEqual([a.id, b.id].sort());

    const found = await searchNotes(new NextRequest(`${BASE}/search?q=find%20me`));
    const foundJson = await found.json();
    expect(
      foundJson.data.notes.map((n: { id: string }) => n.id).sort()
    ).toEqual([a.id, b.id].sort());
  });

  it('ignores unknown and not-archived ids without failing the batch', async () => {
    // `a` is active (never archived); 'does-not-exist' is unknown.
    const a = await postNote({ title: 'Alpha', content: 'x' });

    const { status, json } = await bulkRestore({
      ids: [a.id, 'does-not-exist'],
    });

    expect(status).toBe(200);
    expect(json.data).toMatchObject({ restored: 0, skipped: 2, total: 2 });
  });

  it('returns 400 VALIDATION_ERROR for an empty id list', async () => {
    const { status, json } = await bulkRestore({ ids: [] });
    expect(status).toBe(400);
    expect(json.error.code).toBe('VALIDATION_ERROR');
  });
});
