import { beforeEach, describe, expect, it } from 'vitest';

import { CreateNoteUseCase } from '@/application/use-cases/CreateNoteUseCase';
import { DeleteNoteUseCase } from '@/application/use-cases/DeleteNoteUseCase';
import { RestoreNoteUseCase } from '@/application/use-cases/RestoreNoteUseCase';
import { ListNotesUseCase } from '@/application/use-cases/ListNotesUseCase';
import { NoteNotFoundException } from '@/domain/exceptions/DomainException';
import { InMemoryNoteRepository } from '@/infrastructure/persistence/InMemoryNoteRepository';

describe('RestoreNoteUseCase (restore a single note by id)', () => {
  let repository: InMemoryNoteRepository;
  let createNote: CreateNoteUseCase;
  let deleteNote: DeleteNoteUseCase;
  let restoreNote: RestoreNoteUseCase;
  let listNotes: ListNotesUseCase;

  beforeEach(() => {
    repository = new InMemoryNoteRepository();
    createNote = new CreateNoteUseCase(repository);
    deleteNote = new DeleteNoteUseCase(repository);
    restoreNote = new RestoreNoteUseCase(repository);
    listNotes = new ListNotesUseCase(repository);
  });

  it('restores an archived note: deletedAt cleared and it reappears in the listing', async () => {
    const created = await createNote.execute({ title: 'Recover me', content: 'x' });
    await deleteNote.execute({ id: created.id });

    // Hidden from the default listing while archived.
    const hidden = await listNotes.execute();
    expect(hidden.notes.map((n) => n.id)).not.toContain(created.id);

    const restored = await restoreNote.execute({ id: created.id });
    expect(restored.id).toBe(created.id);
    expect(restored.deletedAt).toBeNull();

    // Back in the default listing.
    const listed = await listNotes.execute();
    expect(listed.notes.map((n) => n.id)).toContain(created.id);
  });

  it('throws NoteNotFoundException for an unknown id', async () => {
    await expect(restoreNote.execute({ id: 'does-not-exist' })).rejects.toBeInstanceOf(
      NoteNotFoundException
    );
  });

  it('is idempotent: restoring an already-active note is a no-op', async () => {
    const created = await createNote.execute({ title: 'Already active', content: 'x' });

    const restored = await restoreNote.execute({ id: created.id });
    expect(restored.deletedAt).toBeNull();
    // updatedAt is not bumped when the note was never archived (no-op restore).
    expect(restored.updatedAt).toBe(created.updatedAt);
  });

  it('is idempotent: restoring twice keeps the note active', async () => {
    const created = await createNote.execute({ title: 'Twice', content: 'x' });
    await deleteNote.execute({ id: created.id });

    const first = await restoreNote.execute({ id: created.id });
    expect(first.deletedAt).toBeNull();

    const second = await restoreNote.execute({ id: created.id });
    expect(second.deletedAt).toBeNull();

    const listed = await listNotes.execute();
    expect(listed.notes.filter((n) => n.id === created.id)).toHaveLength(1);
  });
});
