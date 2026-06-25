import { beforeEach, describe, expect, it } from 'vitest';

import { ExportNotesUseCase } from '@/application/use-cases/ExportNotesUseCase';
import { CreateNoteUseCase } from '@/application/use-cases/CreateNoteUseCase';
import { Note } from '@/domain/entities/Note';
import { NoteId } from '@/domain/value-objects/NoteId';
import { InMemoryNoteRepository } from '@/infrastructure/persistence/InMemoryNoteRepository';

/**
 * Unit tests for ExportNotesUseCase.
 *
 * Exercised against the InMemoryNoteRepository so the test stays fast and
 * storage-agnostic.
 */
describe('ExportNotesUseCase', () => {
  let repository: InMemoryNoteRepository;
  let useCase: ExportNotesUseCase;

  beforeEach(() => {
    repository = new InMemoryNoteRepository();
    useCase = new ExportNotesUseCase(repository);
  });

  it('returns an empty snapshot when there are no notes', async () => {
    const result = await useCase.execute();

    expect(result.count).toBe(0);
    expect(result.notes).toEqual([]);
    expect(result.exportedAt).toEqual(expect.any(String));
  });

  it('exports every note via the DTO mapper', async () => {
    const create = new CreateNoteUseCase(repository);
    await create.execute({ title: 'First', content: 'one' });
    await create.execute({ title: 'Second', content: 'two two' });

    const result = await useCase.execute();

    expect(result.count).toBe(2);
    expect(result.notes.map((n) => n.title).sort()).toEqual(['First', 'Second']);
    // DTO fields are present (proof it went through NoteMapper).
    expect(result.notes[0]).toHaveProperty('wordCount');
    expect(result.notes[0]).toHaveProperty('createdAt');
  });

  it('includes archived notes in the export', async () => {
    const note = Note.reconstitute(
      NoteId.generate().toString(),
      'Archived',
      'gone',
      [],
      new Date('2024-01-01T00:00:00.000Z'),
      new Date('2024-01-02T00:00:00.000Z'),
      new Date('2024-01-03T00:00:00.000Z')
    );
    await repository.save(note);

    const result = await useCase.execute();

    expect(result.count).toBe(1);
    expect(result.notes[0].deletedAt).toBe('2024-01-03T00:00:00.000Z');
  });
});
