import { beforeEach, describe, expect, it } from 'vitest';

import { CreateNoteUseCase } from '@/application/use-cases/CreateNoteUseCase';
import { DeleteNoteUseCase } from '@/application/use-cases/DeleteNoteUseCase';
import { SetReminderUseCase } from '@/application/use-cases/SetReminderUseCase';
import { ListDueNotesUseCase } from '@/application/use-cases/ListDueNotesUseCase';
import { NoteNotFoundException } from '@/domain/exceptions/DomainException';
import { InMemoryNoteRepository } from '@/infrastructure/persistence/InMemoryNoteRepository';

/** A timestamp comfortably in the past (overdue) and one in the future. */
const PAST = new Date('2000-01-01T00:00:00.000Z');
const FUTURE = new Date('2999-01-01T00:00:00.000Z');

describe('SetReminder / ListDue use cases', () => {
  let repository: InMemoryNoteRepository;
  let createNote: CreateNoteUseCase;
  let deleteNote: DeleteNoteUseCase;
  let setReminder: SetReminderUseCase;
  let listDue: ListDueNotesUseCase;

  beforeEach(() => {
    repository = new InMemoryNoteRepository();
    createNote = new CreateNoteUseCase(repository);
    deleteNote = new DeleteNoteUseCase(repository);
    setReminder = new SetReminderUseCase(repository);
    listDue = new ListDueNotesUseCase(repository);
  });

  it('sets a reminder (dueAt) and persists it', async () => {
    const created = await createNote.execute({ title: 'Remind me', content: 'x' });
    expect(created.dueAt).toBeNull();

    const updated = await setReminder.execute({ id: created.id, dueAt: PAST });
    expect(updated.dueAt).toBe(PAST.toISOString());

    const reloaded = await repository.findById(created.id);
    expect(reloaded?.dueAt?.getTime()).toBe(PAST.getTime());
  });

  it('clears a reminder when dueAt is null', async () => {
    const created = await createNote.execute({ title: 'Toggle', content: 'x' });
    await setReminder.execute({ id: created.id, dueAt: FUTURE });

    const cleared = await setReminder.execute({ id: created.id, dueAt: null });
    expect(cleared.dueAt).toBeNull();
  });

  it('throws NoteNotFoundException when setting a reminder on an unknown id', async () => {
    await expect(
      setReminder.execute({ id: 'missing', dueAt: PAST })
    ).rejects.toBeInstanceOf(NoteNotFoundException);
  });

  it('lists overdue notes (dueAt in the past) and excludes future reminders', async () => {
    const overdue = await createNote.execute({ title: 'Overdue', content: 'a' });
    const upcoming = await createNote.execute({ title: 'Upcoming', content: 'b' });
    await createNote.execute({ title: 'No reminder', content: 'c' }); // never due

    await setReminder.execute({ id: overdue.id, dueAt: PAST });
    await setReminder.execute({ id: upcoming.id, dueAt: FUTURE });

    const { notes } = await listDue.execute();
    expect(notes.map((n) => n.id)).toEqual([overdue.id]);
  });

  it('never lists an archived note, even when its reminder is in the past', async () => {
    const active = await createNote.execute({ title: 'Active overdue', content: 'a' });
    const archived = await createNote.execute({ title: 'Archived overdue', content: 'b' });
    await setReminder.execute({ id: active.id, dueAt: PAST });
    await setReminder.execute({ id: archived.id, dueAt: PAST });

    // Archive after setting the reminder; it must drop out of the due listing.
    await deleteNote.execute({ id: archived.id });

    const { notes } = await listDue.execute();
    expect(notes.map((n) => n.id)).toEqual([active.id]);
  });

  it('orders overdue notes most-overdue first (dueAt ascending)', async () => {
    const older = await createNote.execute({ title: 'Older due', content: 'a' });
    const newer = await createNote.execute({ title: 'Newer due', content: 'b' });
    await setReminder.execute({
      id: older.id,
      dueAt: new Date('2001-01-01T00:00:00.000Z'),
    });
    await setReminder.execute({
      id: newer.id,
      dueAt: new Date('2010-01-01T00:00:00.000Z'),
    });

    const { notes } = await listDue.execute();
    expect(notes.map((n) => n.id)).toEqual([older.id, newer.id]);
  });
});
