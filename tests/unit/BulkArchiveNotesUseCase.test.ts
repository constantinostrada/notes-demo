import { beforeEach, describe, expect, it } from 'vitest';

import { CreateNoteUseCase } from '@/application/use-cases/CreateNoteUseCase';
import { BulkArchiveNotesUseCase } from '@/application/use-cases/BulkArchiveNotesUseCase';
import { ListNotesUseCase } from '@/application/use-cases/ListNotesUseCase';
import { SearchNotesUseCase } from '@/application/use-cases/SearchNotesUseCase';
import { InMemoryNoteRepository } from '@/infrastructure/persistence/InMemoryNoteRepository';

describe('BulkArchiveNotesUseCase (bulk soft delete / archive)', () => {
  let repository: InMemoryNoteRepository;
  let createNote: CreateNoteUseCase;
  let bulkArchive: BulkArchiveNotesUseCase;
  let listNotes: ListNotesUseCase;
  let searchNotes: SearchNotesUseCase;

  beforeEach(() => {
    repository = new InMemoryNoteRepository();
    createNote = new CreateNoteUseCase(repository);
    bulkArchive = new BulkArchiveNotesUseCase(repository);
    listNotes = new ListNotesUseCase(repository);
    searchNotes = new SearchNotesUseCase(repository);
  });

  it('archives every given note: hidden from list and search, still in storage', async () => {
    const a = await createNote.execute({ title: 'Alpha', content: 'find me' });
    const b = await createNote.execute({ title: 'Beta', content: 'find me' });
    const keep = await createNote.execute({ title: 'Gamma', content: 'find me' });

    const result = await bulkArchive.execute({ ids: [a.id, b.id] });

    expect(result).toMatchObject({ archived: 2, skipped: 0, total: 2 });

    // Both disappear from the default listing; only the untouched note remains.
    const listed = await listNotes.execute();
    expect(listed.notes.map((n) => n.id)).toEqual([keep.id]);

    // ...and from search, even though all three match the query.
    const found = await searchNotes.execute({ query: 'find me' });
    expect(found.notes.map((n) => n.id)).toEqual([keep.id]);

    // Soft delete: nothing was removed from storage (recoverable).
    expect(repository.size()).toBe(3);
  });

  it('keeps archived notes recoverable via includeArchived', async () => {
    const a = await createNote.execute({ title: 'Alpha', content: 'x' });

    await bulkArchive.execute({ ids: [a.id] });

    const all = await listNotes.execute({ includeArchived: true });
    const row = all.notes.find((n) => n.id === a.id);
    expect(row?.deletedAt).toEqual(expect.any(String));
  });

  it('ignores unknown and already-archived ids without error', async () => {
    const a = await createNote.execute({ title: 'Alpha', content: 'x' });

    // Pre-archive `a` so it counts as already-archived on the next call.
    await bulkArchive.execute({ ids: [a.id] });

    const result = await bulkArchive.execute({
      ids: [a.id, 'does-not-exist'],
    });

    // Neither id yields a new archive; the batch still succeeds.
    expect(result).toMatchObject({ archived: 0, skipped: 2, total: 2 });
    expect(result.notes).toEqual([]);
  });

  it('processes ids repeated within the payload only once', async () => {
    const a = await createNote.execute({ title: 'Alpha', content: 'x' });

    const result = await bulkArchive.execute({ ids: [a.id, a.id, a.id] });

    expect(result.archived).toBe(1);
    expect(result.notes.map((n) => n.id)).toEqual([a.id]);
  });
});
