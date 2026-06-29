/**
 * Use Case: List Due Notes
 *
 * Returns every overdue note — one whose reminder (`dueAt`) lies in the past
 * relative to the current server time (read here, in UTC). The "vencido"
 * comparison and the archived-never-overdue exclusion both live in the
 * repository (the read level); this use case just supplies the clock reading
 * and shapes the DTO.
 */

import { INoteRepository } from '@/domain/repositories/INoteRepository';
import { DueNotesOutputDTO } from '../dtos/NoteDTO';
import { NoteMapper } from '../mappers/NoteMapper';

export class ListDueNotesUseCase {
  constructor(private readonly noteRepository: INoteRepository) {}

  async execute(): Promise<DueNotesOutputDTO> {
    // The server clock, in UTC (epoch ms is timezone-agnostic). The repository
    // compares each note's dueAt against this instant.
    const now = new Date();
    const notes = await this.noteRepository.findDue(now);

    return { notes: NoteMapper.toDTOList(notes) };
  }
}
