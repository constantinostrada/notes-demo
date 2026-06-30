import { beforeEach, describe, expect, it } from 'vitest';

import { CreateNoteUseCase } from '@/application/use-cases/CreateNoteUseCase';
import { ListNotesUseCase } from '@/application/use-cases/ListNotesUseCase';
import { decodeListCursor } from '@/application/pagination/listCursor';
import { ListNotesInputDTO } from '@/application/dtos/NoteDTO';
import { Note } from '@/domain/entities/Note';
import { InMemoryNoteRepository } from '@/infrastructure/persistence/InMemoryNoteRepository';

describe('ListNotesUseCase', () => {
  let repository: InMemoryNoteRepository;
  let listNotes: ListNotesUseCase;
  let createNote: CreateNoteUseCase;

  beforeEach(() => {
    repository = new InMemoryNoteRepository();
    listNotes = new ListNotesUseCase(repository);
    createNote = new CreateNoteUseCase(repository);
  });

  async function seed(titles: string[], tags: string[] = []): Promise<void> {
    for (const title of titles) {
      await createNote.execute({ title, content: 'body', tags });
    }
  }

  /**
   * Seed notes with explicit, strictly-increasing creation times so ordering by
   * `createdAt` is unambiguous (rapid `createNote` calls can land in the same
   * millisecond, where only the id tiebreaker — not creation order — decides).
   */
  async function seedTimed(titles: string[]): Promise<string[]> {
    const ids: string[] = [];
    for (let i = 0; i < titles.length; i++) {
      const at = new Date(2026, 0, 1, 0, 0, i); // distinct second per note
      const id = `id-${titles[i]}`;
      await repository.save(
        Note.reconstitute(id, titles[i], 'body', [], at, at, null, null)
      );
      ids.push(id);
    }
    return ids;
  }

  /**
   * Walk every page via the keyset cursor (decoding the opaque `next_cursor`
   * back into the position the use case consumes) and return the note ids in
   * encounter order. A hard cap guards against an accidental infinite loop.
   */
  async function pageAllIds(input: ListNotesInputDTO): Promise<string[]> {
    const ids: string[] = [];
    let cursor: ListNotesInputDTO['cursor'];
    for (let guard = 0; guard < 1000; guard++) {
      const result = await listNotes.execute({ ...input, cursor });
      ids.push(...result.notes.map((n) => n.id));
      if (!result.next_cursor) return ids;
      cursor = decodeListCursor(result.next_cursor);
    }
    throw new Error('pagination did not terminate');
  }

  it('returns an empty page with a null cursor when there are no notes', async () => {
    const result = await listNotes.execute();

    expect(result.notes).toEqual([]);
    expect(result.next_cursor).toBeNull();
  });

  it('defaults to newest-first (createdAt desc) with no next cursor on a single page', async () => {
    await seedTimed(['a', 'b', 'c']);

    const result = await listNotes.execute();

    expect(result.notes.map((n) => n.title)).toEqual(['c', 'b', 'a']);
    expect(result.next_cursor).toBeNull();
  });

  it('cursor-paginates by createdAt ascending without skipping or duplicating', async () => {
    await seedTimed(['a', 'b', 'c', 'd', 'e']);

    const ids = await pageAllIds({
      sortField: 'createdAt',
      sortDirection: 'asc',
      limit: 2,
    });

    expect(ids).toEqual(['id-a', 'id-b', 'id-c', 'id-d', 'id-e']);
  });

  it('sorts by title ascending and descending', async () => {
    await seed(['Banana', 'apple', 'Cherry']);

    const asc = await listNotes.execute({ sortField: 'title', sortDirection: 'asc' });
    expect(asc.notes.map((n) => n.title)).toEqual(['apple', 'Banana', 'Cherry']);

    const desc = await listNotes.execute({ sortField: 'title', sortDirection: 'desc' });
    expect(desc.notes.map((n) => n.title)).toEqual(['Cherry', 'Banana', 'apple']);
  });

  it('cursor-paginates by title without skipping or duplicating notes', async () => {
    await seed(['a', 'b', 'c', 'd', 'e']);

    // First page, 2 at a time, ascending by title.
    const page1 = await listNotes.execute({
      sortField: 'title',
      sortDirection: 'asc',
      limit: 2,
    });
    expect(page1.notes.map((n) => n.title)).toEqual(['a', 'b']);
    expect(page1.next_cursor).not.toBeNull();

    const page2 = await listNotes.execute({
      sortField: 'title',
      sortDirection: 'asc',
      limit: 2,
      cursor: decodeListCursor(page1.next_cursor!),
    });
    expect(page2.notes.map((n) => n.title)).toEqual(['c', 'd']);

    // Walking every page yields each title exactly once, in order.
    const allTitles = (
      await pageAllIds({ sortField: 'title', sortDirection: 'asc', limit: 2 })
    ).length;
    expect(allTitles).toBe(5);
  });

  it('pages stably when many notes share the same sort key (equal titles)', async () => {
    // Five notes with an identical title: ordering by title alone is ambiguous,
    // so the id tiebreaker must keep paging deterministic.
    await seed(['same', 'same', 'same', 'same', 'same']);
    const expectedIds = (await listNotes.execute({ limit: 100 })).notes
      .map((n) => n.id)
      .sort();

    // Page one-at-a-time by title; every id must appear exactly once.
    const pagedIds = await pageAllIds({
      sortField: 'title',
      sortDirection: 'asc',
      limit: 1,
    });

    expect(pagedIds).toHaveLength(5);
    expect(new Set(pagedIds).size).toBe(5); // no duplicates
    expect([...pagedIds].sort()).toEqual(expectedIds); // none skipped
  });

  it('filters by tag (normalizing the incoming filter)', async () => {
    await seed(['work-1', 'work-2'], ['work']);
    await seed(['personal-1'], ['personal']);

    // A messy filter ("  WORK ") must still match the normalized stored tag.
    const result = await listNotes.execute({
      tag: '  WORK ',
      sortField: 'title',
      sortDirection: 'asc',
    });

    expect(result.notes.map((n) => n.title)).toEqual(['work-1', 'work-2']);
    expect(result.next_cursor).toBeNull();
  });

  describe('created-at range filter', () => {
    /** Save a note with an explicit createdAt so range bounds are testable. */
    async function seedAt(title: string, createdAt: string, tags: string[] = []) {
      const at = new Date(createdAt);
      await repository.save(
        Note.reconstitute(`id-${title}`, title, 'body', tags, at, at, null, null)
      );
    }

    beforeEach(async () => {
      await seedAt('jan', '2026-01-15T00:00:00Z');
      await seedAt('mar', '2026-03-15T00:00:00Z');
      await seedAt('may', '2026-05-15T00:00:00Z');
    });

    it('filters with an inclusive createdAfter bound', async () => {
      const result = await listNotes.execute({
        createdAfter: new Date('2026-03-15T00:00:00Z'),
        sortField: 'createdAt',
        sortDirection: 'asc',
      });

      expect(result.notes.map((n) => n.title)).toEqual(['mar', 'may']);
    });

    it('filters with an inclusive createdBefore bound', async () => {
      const result = await listNotes.execute({
        createdBefore: new Date('2026-03-15T00:00:00Z'),
        sortField: 'createdAt',
        sortDirection: 'asc',
      });

      expect(result.notes.map((n) => n.title)).toEqual(['jan', 'mar']);
    });

    it('combines both bounds into a closed range', async () => {
      const result = await listNotes.execute({
        createdAfter: new Date('2026-02-01T00:00:00Z'),
        createdBefore: new Date('2026-04-01T00:00:00Z'),
      });

      expect(result.notes.map((n) => n.title)).toEqual(['mar']);
    });

    it('combines the range with a tag filter (AND)', async () => {
      await seedAt('tagged-feb', '2026-02-10T00:00:00Z', ['work']);

      const result = await listNotes.execute({
        tag: 'work',
        createdAfter: new Date('2026-01-01T00:00:00Z'),
        createdBefore: new Date('2026-04-01T00:00:00Z'),
      });

      expect(result.notes.map((n) => n.title)).toEqual(['tagged-feb']);
    });
  });
});
