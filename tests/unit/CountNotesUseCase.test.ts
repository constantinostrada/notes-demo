import { beforeEach, describe, expect, it } from 'vitest';

import { CountNotesUseCase } from '@/application/use-cases/CountNotesUseCase';
import { CreateNoteUseCase } from '@/application/use-cases/CreateNoteUseCase';
import { DeleteNoteUseCase } from '@/application/use-cases/DeleteNoteUseCase';
import { Note } from '@/domain/entities/Note';
import { InMemoryNoteRepository } from '@/infrastructure/persistence/InMemoryNoteRepository';

describe('CountNotesUseCase', () => {
  let repository: InMemoryNoteRepository;
  let countNotes: CountNotesUseCase;
  let createNote: CreateNoteUseCase;
  let deleteNote: DeleteNoteUseCase;

  beforeEach(() => {
    repository = new InMemoryNoteRepository();
    countNotes = new CountNotesUseCase(repository);
    createNote = new CreateNoteUseCase(repository);
    deleteNote = new DeleteNoteUseCase(repository);
  });

  async function seed(titles: string[], tags: string[] = []): Promise<void> {
    for (const title of titles) {
      await createNote.execute({ title, content: 'body', tags });
    }
  }

  it('counts zero when there are no notes', async () => {
    expect(await countNotes.execute()).toEqual({ count: 0 });
  });

  it('counts every (active) note when no filter is given', async () => {
    await seed(['a', 'b', 'c']);

    expect(await countNotes.execute()).toEqual({ count: 3 });
  });

  it('filters by tag (normalizing the incoming filter)', async () => {
    await seed(['work-1', 'work-2'], ['work']);
    await seed(['personal-1'], ['personal']);

    // A messy filter ("  WORK ") must still match the normalized stored tag.
    expect(await countNotes.execute({ tag: '  WORK ' })).toEqual({ count: 2 });
  });

  it('excludes archived notes by default, includes them on request', async () => {
    const keep = await createNote.execute({ title: 'keep', content: 'b' });
    const gone = await createNote.execute({ title: 'gone', content: 'b' });
    await deleteNote.execute({ id: gone.id });
    void keep;

    expect(await countNotes.execute()).toEqual({ count: 1 });
    expect(await countNotes.execute({ includeArchived: true })).toEqual({ count: 2 });
  });

  describe('created-at range filter', () => {
    async function seedAt(title: string, createdAt: string, tags: string[] = []) {
      const at = new Date(createdAt);
      await repository.save(
        Note.reconstitute(`id-${title}`, title, 'body', tags, at, at, null, null)
      );
    }

    beforeEach(async () => {
      await seedAt('jan', '2026-01-15T00:00:00Z');
      await seedAt('mar', '2026-03-15T00:00:00Z');
      await seedAt('may', '2026-05-15T00:00:00Z');
    });

    it('counts with an inclusive createdAfter bound', async () => {
      expect(
        await countNotes.execute({ createdAfter: new Date('2026-03-15T00:00:00Z') })
      ).toEqual({ count: 2 });
    });

    it('counts with an inclusive createdBefore bound', async () => {
      expect(
        await countNotes.execute({ createdBefore: new Date('2026-03-15T00:00:00Z') })
      ).toEqual({ count: 2 });
    });

    it('combines both bounds and a tag filter (AND)', async () => {
      await seedAt('tagged-feb', '2026-02-10T00:00:00Z', ['work']);

      expect(
        await countNotes.execute({
          tag: 'work',
          createdAfter: new Date('2026-01-01T00:00:00Z'),
          createdBefore: new Date('2026-04-01T00:00:00Z'),
        })
      ).toEqual({ count: 1 });
    });
  });
});
