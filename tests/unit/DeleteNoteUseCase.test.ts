import { beforeEach, describe, expect, it } from 'vitest';

import { CreateNoteUseCase } from '@/application/use-cases/CreateNoteUseCase';
import { DeleteNoteUseCase } from '@/application/use-cases/DeleteNoteUseCase';
import { ListNotesUseCase } from '@/application/use-cases/ListNotesUseCase';
import { GetNoteUseCase } from '@/application/use-cases/GetNoteUseCase';
import { NoteNotFoundException } from '@/domain/exceptions/DomainException';
import { InMemoryNoteRepository } from '@/infrastructure/persistence/InMemoryNoteRepository';

describe('DeleteNoteUseCase (soft delete / archive)', () => {
  let repository: InMemoryNoteRepository;
  let createNote: CreateNoteUseCase;
  let deleteNote: DeleteNoteUseCase;
  let listNotes: ListNotesUseCase;
  let getNote: GetNoteUseCase;

  beforeEach(() => {
    repository = new InMemoryNoteRepository();
    createNote = new CreateNoteUseCase(repository);
    deleteNote = new DeleteNoteUseCase(repository);
    listNotes = new ListNotesUseCase(repository);
    getNote = new GetNoteUseCase(repository);
  });

  it('archives the note instead of removing it from storage', async () => {
    const created = await createNote.execute({ title: 'To archive', content: 'x' });

    await deleteNote.execute({ id: created.id });

    // Still retrievable by id, now flagged as archived (deletedAt is set).
    const fetched = await getNote.execute({ id: created.id });
    expect(fetched.deletedAt).not.toBeNull();
    expect(repository.size()).toBe(1);
  });

  it('excludes archived notes from the default listing', async () => {
    const a = await createNote.execute({ title: 'Active', content: 'a' });
    const b = await createNote.execute({ title: 'Archived', content: 'b' });

    await deleteNote.execute({ id: b.id });

    const visible = await listNotes.execute();
    expect(visible.pagination.total).toBe(1);
    expect(visible.notes.map((n) => n.id)).toEqual([a.id]);
  });

  it('includes archived notes when includeArchived is true', async () => {
    const a = await createNote.execute({ title: 'Active', content: 'a' });
    const b = await createNote.execute({ title: 'Archived', content: 'b' });

    await deleteNote.execute({ id: b.id });

    const all = await listNotes.execute({ includeArchived: true, sort: 'title' });
    expect(all.pagination.total).toBe(2);
    expect(all.notes.map((n) => n.id).sort()).toEqual([a.id, b.id].sort());
  });

  it('throws NoteNotFoundException for an unknown id', async () => {
    await expect(deleteNote.execute({ id: 'missing-id' })).rejects.toBeInstanceOf(
      NoteNotFoundException
    );
  });
});
