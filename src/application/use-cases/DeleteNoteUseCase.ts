/**
 * Use Case: Delete Note
 *
 * Archives a note by ID (soft delete). The note is not removed from storage;
 * instead the entity is archived and persisted, so it disappears from default
 * listings but can still be surfaced with `?includeArchived=true`.
 */

import { INoteRepository } from '@/domain/repositories/INoteRepository';
import { NoteNotFoundException } from '@/domain/exceptions/DomainException';
import { DeleteNoteInputDTO } from '../dtos/NoteDTO';

export class DeleteNoteUseCase {
  constructor(private readonly noteRepository: INoteRepository) {}

  async execute(input: DeleteNoteInputDTO): Promise<void> {
    const note = await this.noteRepository.findById(input.id);

    if (!note) {
      throw new NoteNotFoundException(input.id);
    }

    note.archive();
    await this.noteRepository.save(note);
  }
}
