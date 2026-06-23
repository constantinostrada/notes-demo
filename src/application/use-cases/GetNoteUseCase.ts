/**
 * Use Case: Get Note
 * 
 * Retrieves a single note by ID.
 */

import { INoteRepository } from '@/domain/repositories/INoteRepository';
import { NoteNotFoundException } from '@/domain/exceptions/DomainException';
import { GetNoteInputDTO, NoteOutputDTO } from '../dtos/NoteDTO';
import { NoteMapper } from '../mappers/NoteMapper';

export class GetNoteUseCase {
  constructor(private readonly noteRepository: INoteRepository) {}

  async execute(input: GetNoteInputDTO): Promise<NoteOutputDTO> {
    const note = await this.noteRepository.findById(input.id);

    if (!note) {
      throw new NoteNotFoundException(input.id);
    }

    return NoteMapper.toDTO(note);
  }
}
