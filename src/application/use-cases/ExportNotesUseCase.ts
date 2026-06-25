/**
 * Use Case: Export Notes
 *
 * Produces a full JSON snapshot of every note in the store — archived notes
 * included — so the data can be backed up or moved between environments. The
 * snapshot shape mirrors what ImportNotesUseCase consumes, giving a lossless
 * export → import round-trip (ids and timestamps are preserved).
 */

import { INoteRepository } from '@/domain/repositories/INoteRepository';
import { ExportNotesOutputDTO } from '../dtos/NoteDTO';
import { NoteMapper } from '../mappers/NoteMapper';

export class ExportNotesUseCase {
  constructor(private readonly noteRepository: INoteRepository) {}

  async execute(): Promise<ExportNotesOutputDTO> {
    // findAll() returns every note (archived ones too), which is what a complete
    // export needs — listing filters would silently drop archived notes.
    const notes = await this.noteRepository.findAll();

    return {
      exportedAt: new Date().toISOString(),
      count: notes.length,
      notes: NoteMapper.toDTOList(notes),
    };
  }
}
