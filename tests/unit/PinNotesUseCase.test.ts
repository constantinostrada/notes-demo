import { beforeEach, describe, expect, it } from 'vitest';

import { CreateNoteUseCase } from '@/application/use-cases/CreateNoteUseCase';
import { DeleteNoteUseCase } from '@/application/use-cases/DeleteNoteUseCase';
import { PinNoteUseCase } from '@/application/use-cases/PinNoteUseCase';
import { UnpinNoteUseCase } from '@/application/use-cases/UnpinNoteUseCase';
import { ListPinnedNotesUseCase } from '@/application/use-cases/ListPinnedNotesUseCase';
import { decodeSearchCursor } from '@/application/pagination/searchCursor';
import {
  InvalidNoteException,
  NoteNotFoundException,
} from '@/domain/exceptions/DomainException';
import { InMemoryNoteRepository } from '@/infrastructure/persistence/InMemoryNoteRepository';

describe('Pin / Unpin / ListPinned use cases', () => {
  let repository: InMemoryNoteRepository;
  let createNote: CreateNoteUseCase;
  let deleteNote: DeleteNoteUseCase;
  let pinNote: PinNoteUseCase;
  let unpinNote: UnpinNoteUseCase;
  let listPinned: ListPinnedNotesUseCase;

  beforeEach(() => {
    repository = new InMemoryNoteRepository();
    createNote = new CreateNoteUseCase(repository);
    deleteNote = new DeleteNoteUseCase(repository);
    pinNote = new PinNoteUseCase(repository);
    unpinNote = new UnpinNoteUseCase(repository);
    listPinned = new ListPinnedNotesUseCase(repository);
  });

  it('pins a note (isPinned becomes true) and persists it', async () => {
    const created = await createNote.execute({ title: 'Pin me', content: 'x' });
    expect(created.isPinned).toBe(false);

    const pinned = await pinNote.execute({ id: created.id });
    expect(pinned.isPinned).toBe(true);

    // Surfaced in the pinned listing.
    const { notes } = await listPinned.execute();
    expect(notes.map((n) => n.id)).toEqual([created.id]);
  });

  it('unpins a note (isPinned becomes false) and drops it from the listing', async () => {
    const created = await createNote.execute({ title: 'Toggle', content: 'x' });
    await pinNote.execute({ id: created.id });

    const unpinned = await unpinNote.execute({ id: created.id });
    expect(unpinned.isPinned).toBe(false);

    const { notes } = await listPinned.execute();
    expect(notes).toHaveLength(0);
  });

  it('is idempotent: pinning twice keeps a single pinned note', async () => {
    const created = await createNote.execute({ title: 'Twice', content: 'x' });
    await pinNote.execute({ id: created.id });
    const again = await pinNote.execute({ id: created.id });
    expect(again.isPinned).toBe(true);

    const { notes } = await listPinned.execute();
    expect(notes).toHaveLength(1);
  });

  it('throws NoteNotFoundException when pinning/unpinning an unknown id', async () => {
    await expect(pinNote.execute({ id: 'missing' })).rejects.toBeInstanceOf(
      NoteNotFoundException
    );
    await expect(unpinNote.execute({ id: 'missing' })).rejects.toBeInstanceOf(
      NoteNotFoundException
    );
  });

  it('refuses to pin an archived note (InvalidNoteException)', async () => {
    const created = await createNote.execute({ title: 'Archived', content: 'x' });
    await deleteNote.execute({ id: created.id });

    await expect(pinNote.execute({ id: created.id })).rejects.toBeInstanceOf(
      InvalidNoteException
    );
  });

  it('excludes archived notes from the pinned listing even if they were pinned', async () => {
    const a = await createNote.execute({ title: 'Stays pinned', content: 'a' });
    const b = await createNote.execute({ title: 'Pinned then archived', content: 'b' });
    await pinNote.execute({ id: a.id });
    await pinNote.execute({ id: b.id });

    // Archive b after pinning it; it must drop out of the pinned read path.
    await deleteNote.execute({ id: b.id });

    const { notes } = await listPinned.execute();
    expect(notes.map((n) => n.id)).toEqual([a.id]);
  });

  it('only lists pinned notes, never the unpinned ones', async () => {
    const pinned = await createNote.execute({ title: 'Pinned', content: 'x' });
    await createNote.execute({ title: 'Plain', content: 'y' });
    await pinNote.execute({ id: pinned.id });

    const { notes } = await listPinned.execute();
    expect(notes.map((n) => n.id)).toEqual([pinned.id]);
  });

  it('paginates pinned notes by cursor without skipping or duplicating', async () => {
    const ids: string[] = [];
    for (let i = 0; i < 5; i++) {
      const note = await createNote.execute({ title: `Pinned ${i}`, content: 'x' });
      await pinNote.execute({ id: note.id });
      ids.push(note.id);
    }

    const seen: string[] = [];
    let cursor = undefined as ReturnType<typeof decodeSearchCursor> | undefined;
    let pages = 0;

    do {
      const page = await listPinned.execute({ limit: 2, cursor });
      expect(page.notes.length).toBeLessThanOrEqual(2);
      seen.push(...page.notes.map((n) => n.id));
      cursor = page.next_cursor ? decodeSearchCursor(page.next_cursor) : undefined;
      pages++;
      expect(pages).toBeLessThan(10); // guard against an infinite loop
    } while (cursor);

    // 3 pages (2 + 2 + 1), each of the five pinned ids exactly once.
    expect(pages).toBe(3);
    expect(seen).toHaveLength(5);
    expect(new Set(seen)).toEqual(new Set(ids));
  });

  it('returns next_cursor only while more pinned notes remain', async () => {
    for (let i = 0; i < 3; i++) {
      const note = await createNote.execute({ title: `Doc ${i}`, content: 'x' });
      await pinNote.execute({ id: note.id });
    }

    const first = await listPinned.execute({ limit: 2 });
    expect(first.notes).toHaveLength(2);
    expect(first.next_cursor).toBeTruthy();

    const second = await listPinned.execute({
      limit: 2,
      cursor: decodeSearchCursor(first.next_cursor as string),
    });
    expect(second.notes).toHaveLength(1);
    expect(second.next_cursor).toBeNull();
  });
});
