import { beforeEach, describe, expect, it } from 'vitest';

import { CreateNoteUseCase } from '@/application/use-cases/CreateNoteUseCase';
import { InvalidNoteException } from '@/domain/exceptions/DomainException';
import { InMemoryNoteRepository } from '@/infrastructure/persistence/InMemoryNoteRepository';

/**
 * Unit tests for CreateNoteUseCase.
 *
 * The use case is exercised against the InMemoryNoteRepository so the test stays
 * fast and storage-agnostic — exactly the seam the repository interface exists
 * to provide.
 */
describe('CreateNoteUseCase', () => {
  let repository: InMemoryNoteRepository;
  let useCase: CreateNoteUseCase;

  beforeEach(() => {
    repository = new InMemoryNoteRepository();
    useCase = new CreateNoteUseCase(repository);
  });

  it('creates a note and persists it', async () => {
    const result = await useCase.execute({
      title: 'Shopping list',
      content: 'Milk and eggs',
    });

    expect(result.id).toBeTruthy();
    expect(result.title).toBe('Shopping list');
    expect(result.content).toBe('Milk and eggs');
    expect(result.wordCount).toBe(3);
    expect(result.createdAt).toBe(result.updatedAt);
    expect(repository.size()).toBe(1);

    // The returned id must be retrievable from the repository.
    const stored = await repository.findById(result.id);
    expect(stored).not.toBeNull();
    expect(stored?.title).toBe('Shopping list');
  });

  it('trims the title before storing it', async () => {
    const result = await useCase.execute({ title: '  Padded  ', content: '' });
    expect(result.title).toBe('Padded');
  });

  it('defaults content to an empty string when omitted', async () => {
    const result = await useCase.execute({
      title: 'No body',
    } as { title: string; content: string });

    expect(result.content).toBe('');
    expect(result.wordCount).toBe(0);
  });

  it('normalizes and de-duplicates tags', async () => {
    const result = await useCase.execute({
      title: 'Tagged',
      content: '',
      tags: ['Work', 'work', '  URGENT  ', ''],
    });

    expect(result.tags).toEqual(['work', 'urgent']);
  });

  it('rejects an empty title with InvalidNoteException', async () => {
    await expect(
      useCase.execute({ title: '   ', content: 'x' })
    ).rejects.toBeInstanceOf(InvalidNoteException);
    expect(repository.size()).toBe(0);
  });

  it('stores an optional hex colour and returns it', async () => {
    const result = await useCase.execute({
      title: 'Coloured',
      content: '',
      color: '#FF8800',
    });

    expect(result.color).toBe('#FF8800');
    const stored = await repository.findById(result.id);
    expect(stored?.color).toBe('#FF8800');
  });

  it('defaults colour to null when omitted', async () => {
    const result = await useCase.execute({ title: 'No colour', content: '' });
    expect(result.color).toBeNull();
  });

  it('rejects a malformed colour with InvalidNoteException', async () => {
    await expect(
      useCase.execute({ title: 'Bad colour', content: '', color: 'red' })
    ).rejects.toBeInstanceOf(InvalidNoteException);
    expect(repository.size()).toBe(0);
  });
});
