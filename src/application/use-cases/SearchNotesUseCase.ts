/**
 * Use Case: Search Notes
 * 
 * Searches notes by title or content.
 */

import { INoteRepository } from '@/domain/repositories/INoteRepository';
import { SearchNotesInputDTO, ListNotesOutputDTO } from '../dtos/NoteDTO';
import { NoteMapper } from '../mappers/NoteMapper';

export class SearchNotesUseCase {
  constructor(private readonly noteRepository: INoteRepository) {}

  async execute(input: SearchNotesInputDTO): Promise<ListNotesOutputDTO> {
    if (!input.query || input.query.trim().length === 0) {
      return { notes: [], total: 0 };
    }

    const notes = await this.noteRepository.search(input.query.trim());

    return {
      notes: NoteMapper.toDTOList(notes),
      total: notes.length,
    };
  }
}
