import { beforeEach, describe, expect, it } from 'vitest';

import { CreateNoteUseCase } from '@/application/use-cases/CreateNoteUseCase';
import { ListNotesUseCase } from '@/application/use-cases/ListNotesUseCase';
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

  it('returns an empty page with zeroed metadata when there are no notes', async () => {
    const result = await listNotes.execute();

    expect(result.notes).toEqual([]);
    expect(result.pagination).toMatchObject({
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 0,
      hasNextPage: false,
      hasPreviousPage: false,
      sort: '-createdAt',
    });
  });

  it('paginates and reports accurate pagination metadata', async () => {
    await seed(['a', 'b', 'c', 'd', 'e']);

    const page2 = await listNotes.execute({ page: 2, limit: 2, sort: 'title' });

    expect(page2.notes.map((n) => n.title)).toEqual(['c', 'd']);
    expect(page2.pagination).toMatchObject({
      page: 2,
      limit: 2,
      total: 5,
      totalPages: 3,
      hasNextPage: true,
      hasPreviousPage: true,
    });
  });

  it('sorts by title ascending and descending', async () => {
    await seed(['Banana', 'apple', 'Cherry']);

    const asc = await listNotes.execute({ sort: 'title' });
    expect(asc.notes.map((n) => n.title)).toEqual(['apple', 'Banana', 'Cherry']);

    const desc = await listNotes.execute({ sort: '-title' });
    expect(desc.notes.map((n) => n.title)).toEqual(['Cherry', 'Banana', 'apple']);
  });

  it('filters by tag (normalizing the incoming filter)', async () => {
    await seed(['work-1', 'work-2'], ['work']);
    await seed(['personal-1'], ['personal']);

    // A messy filter ("  WORK ") must still match the normalized stored tag.
    const result = await listNotes.execute({ tag: '  WORK ', sort: 'title' });

    expect(result.pagination.total).toBe(2);
    expect(result.notes.map((n) => n.title)).toEqual(['work-1', 'work-2']);
  });
});
