/**
 * Use Case: List Notes
 * 
 * Retrieves all notes.
 */

import { Note } from '@/domain/entities/Note';
import { INoteRepository } from '@/domain/repositories/INoteRepository';
import { ListNotesInputDTO, ListNotesOutputDTO } from '../dtos/NoteDTO';
import { NoteMapper } from '../mappers/NoteMapper';

export class ListNotesUseCase {
  constructor(private readonly noteRepository: INoteRepository) {}

  async execute(input: ListNotesInputDTO = {}): Promise<ListNotesOutputDTO> {
    // Normalize the tag the same way the entity does, so the filter matches the
    // stored form. A blank/whitespace-only tag is treated as "no filter".
    const tag = input.tag ? Note.normalizeTag(input.tag) : '';

    const notes = tag
      ? await this.noteRepository.findByTag(tag)
      : await this.noteRepository.findAll();

    return {
      notes: NoteMapper.toDTOList(notes),
      total: notes.length,
    };
  }
}
