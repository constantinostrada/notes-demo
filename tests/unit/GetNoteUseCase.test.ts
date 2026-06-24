import { beforeEach, describe, expect, it } from 'vitest';

import { CreateNoteUseCase } from '@/application/use-cases/CreateNoteUseCase';
import { GetNoteUseCase } from '@/application/use-cases/GetNoteUseCase';
import { NoteNotFoundException } from '@/domain/exceptions/DomainException';
import { InMemoryNoteRepository } from '@/infrastructure/persistence/InMemoryNoteRepository';

describe('GetNoteUseCase', () => {
  let repository: InMemoryNoteRepository;
  let getNote: GetNoteUseCase;
  let createNote: CreateNoteUseCase;

  beforeEach(() => {
    repository = new InMemoryNoteRepository();
    getNote = new GetNoteUseCase(repository);
    createNote = new CreateNoteUseCase(repository);
  });

  it('returns the note when it exists', async () => {
    const created = await createNote.execute({ title: 'Hello', content: 'World' });

    const fetched = await getNote.execute({ id: created.id });

    expect(fetched).toEqual(created);
  });

  it('throws NoteNotFoundException for an unknown id', async () => {
    await expect(getNote.execute({ id: 'missing-id' })).rejects.toBeInstanceOf(
      NoteNotFoundException
    );
  });
});
