/**
 * Use Case: List Notes
 * 
 * Retrieves all notes.
 */

import { INoteRepository } from '@/domain/repositories/INoteRepository';
import { ListNotesOutputDTO } from '../dtos/NoteDTO';
import { NoteMapper } from '../mappers/NoteMapper';

export class ListNotesUseCase {
  constructor(private readonly noteRepository: INoteRepository) {}

  async execute(): Promise<ListNotesOutputDTO> {
    const notes = await this.noteRepository.findAll();

    return {
      notes: NoteMapper.toDTOList(notes),
      total: notes.length,
    };
  }
}
