import { beforeEach, describe, expect, it } from 'vitest';

import { CreateNoteUseCase } from '@/application/use-cases/CreateNoteUseCase';
import { BulkArchiveNotesUseCase } from '@/application/use-cases/BulkArchiveNotesUseCase';
import { BulkRestoreNotesUseCase } from '@/application/use-cases/BulkRestoreNotesUseCase';
import { ListNotesUseCase } from '@/application/use-cases/ListNotesUseCase';
import { SearchNotesUseCase } from '@/application/use-cases/SearchNotesUseCase';
import { InMemoryNoteRepository } from '@/infrastructure/persistence/InMemoryNoteRepository';

describe('BulkRestoreNotesUseCase (bulk restore / un-archive)', () => {
  let repository: InMemoryNoteRepository;
  let createNote: CreateNoteUseCase;
  let bulkArchive: BulkArchiveNotesUseCase;
  let bulkRestore: BulkRestoreNotesUseCase;
  let listNotes: ListNotesUseCase;
  let searchNotes: SearchNotesUseCase;

  beforeEach(() => {
    repository = new InMemoryNoteRepository();
    createNote = new CreateNoteUseCase(repository);
    bulkArchive = new BulkArchiveNotesUseCase(repository);
    bulkRestore = new BulkRestoreNotesUseCase(repository);
    listNotes = new ListNotesUseCase(repository);
    searchNotes = new SearchNotesUseCase(repository);
  });

  it('restores every given note: reappears in list and search', async () => {
    const a = await createNote.execute({ title: 'Alpha', content: 'find me' });
    const b = await createNote.execute({ title: 'Beta', content: 'find me' });

    await bulkArchive.execute({ ids: [a.id, b.id] });

    const result = await bulkRestore.execute({ ids: [a.id, b.id] });

    expect(result).toMatchObject({ restored: 2, skipped: 0, total: 2 });
    // The output notes are active again (tombstone cleared).
    expect(result.notes.every((n) => n.deletedAt === null)).toBe(true);

    // Both reappear in the default listing...
    const listed = await listNotes.execute();
    expect(listed.notes.map((n) => n.id).sort()).toEqual([a.id, b.id].sort());

    // ...and in search.
    const found = await searchNotes.execute({ query: 'find me' });
    expect(found.notes.map((n) => n.id).sort()).toEqual([a.id, b.id].sort());
  });

  it('ignores unknown and not-archived ids without error', async () => {
    // `a` stays active (never archived); 'does-not-exist' is unknown.
    const a = await createNote.execute({ title: 'Alpha', content: 'x' });

    const result = await bulkRestore.execute({
      ids: [a.id, 'does-not-exist'],
    });

    // Neither id yields a restore; the batch still succeeds.
    expect(result).toMatchObject({ restored: 0, skipped: 2, total: 2 });
    expect(result.notes).toEqual([]);
  });

  it('processes ids repeated within the payload only once', async () => {
    const a = await createNote.execute({ title: 'Alpha', content: 'x' });
    await bulkArchive.execute({ ids: [a.id] });

    const result = await bulkRestore.execute({ ids: [a.id, a.id, a.id] });

    expect(result.restored).toBe(1);
    expect(result.notes.map((n) => n.id)).toEqual([a.id]);
  });
});
