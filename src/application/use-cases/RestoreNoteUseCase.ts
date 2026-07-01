/**
 * Use Case: Restore Note
 *
 * Reverts a single note's soft-delete by id: the archive tombstone (`deletedAt`)
 * is cleared via the domain action `Note.restore()`, so the note reappears in
 * default listings/search. The row was never removed (soft delete), so this just
 * un-archives it.
 *
 * A missing id raises NoteNotFoundException (mapped to a uniform 404 at the
 * edge). Restoring is idempotent: because `Note.restore()` is a no-op on an
 * already-active note, restoring one that is not archived succeeds without a
 * spurious `updatedAt` bump and simply returns the current note (200).
 */

import { INoteRepository } from '@/domain/repositories/INoteRepository';
import { NoteNotFoundException } from '@/domain/exceptions/DomainException';
import { RestoreNoteInputDTO, NoteOutputDTO } from '../dtos/NoteDTO';
import { NoteMapper } from '../mappers/NoteMapper';

export class RestoreNoteUseCase {
  constructor(private readonly noteRepository: INoteRepository) {}

  async execute(input: RestoreNoteInputDTO): Promise<NoteOutputDTO> {
    const note = await this.noteRepository.findById(input.id);

    if (!note) {
      throw new NoteNotFoundException(input.id);
    }

    // Idempotent: a no-op on an already-active note (see Note.restore()).
    note.restore();
    await this.noteRepository.save(note);

    return NoteMapper.toDTO(note);
  }
}
