import { beforeEach, describe, expect, it } from 'vitest';

import { ImportNotesUseCase } from '@/application/use-cases/ImportNotesUseCase';
import { ExportNotesUseCase } from '@/application/use-cases/ExportNotesUseCase';
import { InvalidNoteException } from '@/domain/exceptions/DomainException';
import { InMemoryNoteRepository } from '@/infrastructure/persistence/InMemoryNoteRepository';

/**
 * Unit tests for ImportNotesUseCase.
 *
 * Covers the two behaviours the feature exists to provide: strong read-back
 * (ids/timestamps preserved) and de-duplication (existing/repeated ids skipped).
 */
describe('ImportNotesUseCase', () => {
  let repository: InMemoryNoteRepository;
  let useCase: ImportNotesUseCase;

  const UUID_A = '11111111-1111-4111-8111-111111111111';
  const UUID_B = '22222222-2222-4222-8222-222222222222';

  beforeEach(() => {
    repository = new InMemoryNoteRepository();
    useCase = new ImportNotesUseCase(repository);
  });

  it('creates notes and assigns a fresh id when none is provided', async () => {
    const result = await useCase.execute({
      notes: [
        { title: 'No id', content: 'body', tags: ['Work', 'work'] },
      ],
    });

    expect(result.imported).toBe(1);
    expect(result.skipped).toBe(0);
    expect(result.total).toBe(1);
    expect(result.notes[0].id).toBeTruthy();
    expect(result.notes[0].tags).toEqual(['work']); // normalized + de-duped
    expect(repository.size()).toBe(1);
  });

  it('preserves the provided id and timestamps (strong read-back)', async () => {
    const created = '2024-01-01T00:00:00.000Z';
    const updated = '2024-02-01T00:00:00.000Z';
    const deleted = '2024-03-01T00:00:00.000Z';

    const result = await useCase.execute({
      notes: [
        {
          id: UUID_A,
          title: 'Kept',
          content: 'verbatim',
          createdAt: created,
          updatedAt: updated,
          deletedAt: deleted,
        },
      ],
    });

    expect(result.notes[0].id).toBe(UUID_A);
    expect(result.notes[0].createdAt).toBe(created);
    expect(result.notes[0].updatedAt).toBe(updated);
    expect(result.notes[0].deletedAt).toBe(deleted);

    const stored = await repository.findById(UUID_A);
    expect(stored?.createdAt.toISOString()).toBe(created);
  });

  it('skips a note whose id already exists in the store', async () => {
    await useCase.execute({ notes: [{ id: UUID_A, title: 'Original' }] });

    const result = await useCase.execute({
      notes: [
        { id: UUID_A, title: 'Duplicate — should be skipped' },
        { id: UUID_B, title: 'Fresh' },
      ],
    });

    expect(result.imported).toBe(1);
    expect(result.skipped).toBe(1);
    expect(result.total).toBe(2);
    expect(result.notes.map((n) => n.id)).toEqual([UUID_B]);

    // The original is untouched (not overwritten by the duplicate).
    const original = await repository.findById(UUID_A);
    expect(original?.title).toBe('Original');
  });

  it('de-duplicates repeated ids within a single payload', async () => {
    const result = await useCase.execute({
      notes: [
        { id: UUID_A, title: 'First wins' },
        { id: UUID_A, title: 'Repeat — skipped' },
      ],
    });

    expect(result.imported).toBe(1);
    expect(result.skipped).toBe(1);
    expect(repository.size()).toBe(1);
    expect((await repository.findById(UUID_A))?.title).toBe('First wins');
  });

  it('round-trips an export back into an empty store unchanged', async () => {
    // Seed and export from one store.
    const source = new InMemoryNoteRepository();
    const sourceImport = new ImportNotesUseCase(source);
    await sourceImport.execute({
      notes: [
        { id: UUID_A, title: 'Alpha', content: 'a', tags: ['x'] },
        { id: UUID_B, title: 'Beta', content: 'b' },
      ],
    });
    const snapshot = await new ExportNotesUseCase(source).execute();

    // Import the snapshot into a fresh store.
    const result = await useCase.execute({ notes: snapshot.notes });

    expect(result.imported).toBe(2);
    expect(result.skipped).toBe(0);
    const reExported = await new ExportNotesUseCase(repository).execute();
    expect(reExported.notes).toEqual(snapshot.notes);
  });

  it('fails the whole batch (atomically) when a note breaks a domain invariant', async () => {
    await expect(
      useCase.execute({
        notes: [
          { title: 'Fine' },
          { title: 'x'.repeat(201) }, // exceeds the 200-char title rule
        ],
      })
    ).rejects.toBeInstanceOf(InvalidNoteException);

    // Nothing was persisted — the build phase threw before any save.
    expect(repository.size()).toBe(0);
  });
});
