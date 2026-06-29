/**
 * Use Case: Unpin Note
 *
 * Clears a note's pinned flag so it drops out of the pinned listing. Mirrors
 * PinNoteUseCase: the archived-note guard lives in the domain entity; a missing
 * id raises NoteNotFoundException (uniform 404 at the edge).
 */

import { INoteRepository } from '@/domain/repositories/INoteRepository';
import { NoteNotFoundException } from '@/domain/exceptions/DomainException';
import { SetPinInputDTO, NoteOutputDTO } from '../dtos/NoteDTO';
import { NoteMapper } from '../mappers/NoteMapper';

export class UnpinNoteUseCase {
  constructor(private readonly noteRepository: INoteRepository) {}

  async execute(input: SetPinInputDTO): Promise<NoteOutputDTO> {
    const note = await this.noteRepository.findById(input.id);

    if (!note) {
      throw new NoteNotFoundException(input.id);
    }

    // Domain enforces "cannot unpin an archived note" (InvalidNoteException → 422).
    note.unpin();
    await this.noteRepository.save(note);

    return NoteMapper.toDTO(note);
  }
}
