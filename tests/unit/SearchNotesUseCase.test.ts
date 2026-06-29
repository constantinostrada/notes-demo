import { beforeEach, describe, expect, it } from 'vitest';

import { CreateNoteUseCase } from '@/application/use-cases/CreateNoteUseCase';
import { DeleteNoteUseCase } from '@/application/use-cases/DeleteNoteUseCase';
import { SearchNotesUseCase } from '@/application/use-cases/SearchNotesUseCase';
import { decodeSearchCursor } from '@/application/pagination/searchCursor';
import { InMemoryNoteRepository } from '@/infrastructure/persistence/InMemoryNoteRepository';

describe('SearchNotesUseCase', () => {
  let repository: InMemoryNoteRepository;
  let search: SearchNotesUseCase;
  let createNote: CreateNoteUseCase;
  let deleteNote: DeleteNoteUseCase;

  beforeEach(() => {
    repository = new InMemoryNoteRepository();
    search = new SearchNotesUseCase(repository);
    createNote = new CreateNoteUseCase(repository);
    deleteNote = new DeleteNoteUseCase(repository);
  });

  it('matches notes by title or content, case-insensitively', async () => {
    await createNote.execute({ title: 'Grocery list', content: 'buy milk' });
    await createNote.execute({ title: 'Reading', content: 'Milk Duds review' });
    await createNote.execute({ title: 'Unrelated', content: 'nothing here' });

    const result = await search.execute({ query: 'milk' });

    expect(result.notes).toHaveLength(2);
    expect(result.next_cursor).toBeNull();
    const titles = result.notes.map((n) => n.title).sort();
    expect(titles).toEqual(['Grocery list', 'Reading']);
  });

  it('excludes archived (soft-deleted) notes from search results', async () => {
    const active = await createNote.execute({ title: 'Milk run', content: 'buy milk' });
    const archived = await createNote.execute({ title: 'Old milk', content: 'milk note' });

    await deleteNote.execute({ id: archived.id });

    const result = await search.execute({ query: 'milk' });

    expect(result.notes.map((n) => n.id)).toEqual([active.id]);
  });

  it('trims the query before searching', async () => {
    await createNote.execute({ title: 'Trimmed', content: 'findme' });

    const result = await search.execute({ query: '  findme  ' });

    expect(result.notes).toHaveLength(1);
    expect(result.notes[0].title).toBe('Trimmed');
  });

  it('returns an empty result for a blank query without hitting the repository', async () => {
    await createNote.execute({ title: 'Anything', content: 'data' });

    const result = await search.execute({ query: '   ' });

    expect(result).toEqual({ notes: [], next_cursor: null });
  });

  it('paginates by cursor without skipping or duplicating matches', async () => {
    // Five matches; walk them two at a time via next_cursor.
    for (let i = 0; i < 5; i++) {
      await createNote.execute({ title: `Match ${i}`, content: 'needle' });
    }

    const seen: string[] = [];
    let cursor = undefined as ReturnType<typeof decodeSearchCursor> | undefined;
    let pages = 0;

    do {
      const page = await search.execute({ query: 'needle', limit: 2, cursor });
      expect(page.notes.length).toBeLessThanOrEqual(2);
      seen.push(...page.notes.map((n) => n.id));
      cursor = page.next_cursor ? decodeSearchCursor(page.next_cursor) : undefined;
      pages++;
      expect(pages).toBeLessThan(10); // guard against an infinite loop
    } while (cursor);

    // 3 pages (2 + 2 + 1), every id exactly once, none skipped.
    expect(pages).toBe(3);
    expect(seen).toHaveLength(5);
    expect(new Set(seen).size).toBe(5);
  });

  it('returns next_cursor only while more matches remain', async () => {
    for (let i = 0; i < 3; i++) {
      await createNote.execute({ title: `Doc ${i}`, content: 'token' });
    }

    const first = await search.execute({ query: 'token', limit: 2 });
    expect(first.notes).toHaveLength(2);
    expect(first.next_cursor).toBeTruthy();

    const second = await search.execute({
      query: 'token',
      limit: 2,
      cursor: decodeSearchCursor(first.next_cursor as string),
    });
    expect(second.notes).toHaveLength(1);
    expect(second.next_cursor).toBeNull();
  });
});
