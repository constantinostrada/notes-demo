/**
 * Use Case: Update Note
 * 
 * Updates an existing note's title and/or content.
 */

import { INoteRepository } from '@/domain/repositories/INoteRepository';
import { NoteNotFoundException } from '@/domain/exceptions/DomainException';
import { UpdateNoteInputDTO, NoteOutputDTO } from '../dtos/NoteDTO';
import { NoteMapper } from '../mappers/NoteMapper';

export class UpdateNoteUseCase {
  constructor(private readonly noteRepository: INoteRepository) {}

  async execute(input: UpdateNoteInputDTO): Promise<NoteOutputDTO> {
    // Find existing note
    const note = await this.noteRepository.findById(input.id);

    if (!note) {
      throw new NoteNotFoundException(input.id);
    }

    // Update title if provided (business rules enforced in entity)
    if (input.title !== undefined) {
      note.updateTitle(input.title);
    }

    // Update content if provided
    if (input.content !== undefined) {
      note.updateContent(input.content);
    }

    // Update tags if provided (normalization + rules enforced in entity)
    if (input.tags !== undefined) {
      note.updateTags(input.tags);
    }

    // Update colour if provided (format enforced in entity)
    if (input.color !== undefined) {
      note.updateColor(input.color);
    }

    // Persist changes
    await this.noteRepository.save(note);

    // Return updated DTO
    return NoteMapper.toDTO(note);
  }
}
