import { beforeEach, describe, expect, it } from 'vitest';

import { CreateNoteUseCase } from '@/application/use-cases/CreateNoteUseCase';
import { SearchNotesUseCase } from '@/application/use-cases/SearchNotesUseCase';
import { InMemoryNoteRepository } from '@/infrastructure/persistence/InMemoryNoteRepository';

describe('SearchNotesUseCase', () => {
  let repository: InMemoryNoteRepository;
  let search: SearchNotesUseCase;
  let createNote: CreateNoteUseCase;

  beforeEach(() => {
    repository = new InMemoryNoteRepository();
    search = new SearchNotesUseCase(repository);
    createNote = new CreateNoteUseCase(repository);
  });

  it('matches notes by title or content, case-insensitively', async () => {
    await createNote.execute({ title: 'Grocery list', content: 'buy milk' });
    await createNote.execute({ title: 'Reading', content: 'Milk Duds review' });
    await createNote.execute({ title: 'Unrelated', content: 'nothing here' });

    const result = await search.execute({ query: 'milk' });

    expect(result.total).toBe(2);
    const titles = result.notes.map((n) => n.title).sort();
    expect(titles).toEqual(['Grocery list', 'Reading']);
  });

  it('trims the query before searching', async () => {
    await createNote.execute({ title: 'Trimmed', content: 'findme' });

    const result = await search.execute({ query: '  findme  ' });

    expect(result.total).toBe(1);
    expect(result.notes[0].title).toBe('Trimmed');
  });

  it('returns an empty result for a blank query without hitting the repository', async () => {
    await createNote.execute({ title: 'Anything', content: 'data' });

    const result = await search.execute({ query: '   ' });

    expect(result).toEqual({ notes: [], total: 0 });
  });
});
