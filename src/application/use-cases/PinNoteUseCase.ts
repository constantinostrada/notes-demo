/**
 * Use Case: Pin Note
 *
 * Marks a note as pinned so it surfaces in the pinned listing. The business
 * rule (an archived note cannot be pinned) lives in the domain entity; this use
 * case just loads, mutates, persists, and returns the updated DTO. A missing id
 * raises NoteNotFoundException (mapped to a uniform 404 at the edge).
 */

import { INoteRepository } from '@/domain/repositories/INoteRepository';
import { NoteNotFoundException } from '@/domain/exceptions/DomainException';
import { SetPinInputDTO, NoteOutputDTO } from '../dtos/NoteDTO';
import { NoteMapper } from '../mappers/NoteMapper';

export class PinNoteUseCase {
  constructor(private readonly noteRepository: INoteRepository) {}

  async execute(input: SetPinInputDTO): Promise<NoteOutputDTO> {
    const note = await this.noteRepository.findById(input.id);

    if (!note) {
      throw new NoteNotFoundException(input.id);
    }

    // Domain enforces "cannot pin an archived note" (InvalidNoteException → 422).
    note.pin();
    await this.noteRepository.save(note);

    return NoteMapper.toDTO(note);
  }
}
