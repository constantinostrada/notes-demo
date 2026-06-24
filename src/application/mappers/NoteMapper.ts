/**
 * Application Mapper: NoteMapper
 * 
 * Converts between domain entities and DTOs.
 * This prevents domain entities from leaking into outer layers.
 */

import { Note } from '@/domain/entities/Note';
import { NoteOutputDTO } from '../dtos/NoteDTO';

export class NoteMapper {
  /**
   * Convert a domain Note entity to an output DTO
   */
  static toDTO(note: Note): NoteOutputDTO {
    return {
      id: note.id,
      title: note.title,
      content: note.content,
      tags: note.tags,
      wordCount: note.getWordCount(),
      createdAt: note.createdAt.toISOString(),
      updatedAt: note.updatedAt.toISOString(),
    };
  }

  /**
   * Convert multiple Note entities to DTOs
   */
  static toDTOList(notes: Note[]): NoteOutputDTO[] {
    return notes.map((note) => this.toDTO(note));
  }
}
