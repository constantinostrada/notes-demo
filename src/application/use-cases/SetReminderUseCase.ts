/**
 * Use Case: Set Reminder
 *
 * Sets or clears a note's reminder (due date). The reminder time arrives as an
 * already-validated `Date` (or `null` to clear); this use case just loads,
 * mutates via the domain entity, persists, and returns the updated DTO. A
 * missing id raises NoteNotFoundException (mapped to a uniform 404 at the edge).
 */

import { INoteRepository } from '@/domain/repositories/INoteRepository';
import { NoteNotFoundException } from '@/domain/exceptions/DomainException';
import { SetReminderInputDTO, NoteOutputDTO } from '../dtos/NoteDTO';
import { NoteMapper } from '../mappers/NoteMapper';

export class SetReminderUseCase {
  constructor(private readonly noteRepository: INoteRepository) {}

  async execute(input: SetReminderInputDTO): Promise<NoteOutputDTO> {
    const note = await this.noteRepository.findById(input.id);

    if (!note) {
      throw new NoteNotFoundException(input.id);
    }

    note.setReminder(input.dueAt);
    await this.noteRepository.save(note);

    return NoteMapper.toDTO(note);
  }
}
