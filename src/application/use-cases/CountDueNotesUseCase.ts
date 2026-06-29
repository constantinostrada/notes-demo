/**
 * Use Case: Count Due Notes
 *
 * Returns how many notes are overdue — those whose reminder (`dueAt`) lies in
 * the past relative to the current server time (read here, in UTC). The "vencido"
 * comparison and the archived-never-overdue exclusion both live in the
 * repository (the read level, via the same predicate as `findDue`); this use
 * case just supplies the clock reading and shapes the DTO. As a result the count
 * always agrees with the `ListDueNotesUseCase` listing.
 */

import { INoteRepository } from '@/domain/repositories/INoteRepository';
import { CountNotesOutputDTO } from '../dtos/NoteDTO';

export class CountDueNotesUseCase {
  constructor(private readonly noteRepository: INoteRepository) {}

  async execute(): Promise<CountNotesOutputDTO> {
    // The server clock, in UTC (epoch ms is timezone-agnostic). The repository
    // compares each note's dueAt against this instant — the same predicate the
    // due listing uses.
    const now = new Date();
    const count = await this.noteRepository.countDue(now);

    return { count };
  }
}
