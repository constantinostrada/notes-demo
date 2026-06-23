/**
 * Use Case: Delete Note
 * 
 * Deletes a note by ID.
 */

import { INoteRepository } from '@/domain/repositories/INoteRepository';
import { NoteNotFoundException } from '@/domain/exceptions/DomainException';
import { DeleteNoteInputDTO } from '../dtos/NoteDTO';

export class DeleteNoteUseCase {
  constructor(private readonly noteRepository: INoteRepository) {}

  async execute(input: DeleteNoteInputDTO): Promise<void> {
    const deleted = await this.noteRepository.delete(input.id);

    if (!deleted) {
      throw new NoteNotFoundException(input.id);
    }
  }
}
