/**
 * Use Case: Count Notes
 *
 * Returns how many notes match the same filters as the listing (tag, archived,
 * created-at range). Like the listing, archived notes are excluded by default.
 */

import { Note } from '@/domain/entities/Note';
import { INoteRepository } from '@/domain/repositories/INoteRepository';
import { CountNotesInputDTO, CountNotesOutputDTO } from '../dtos/NoteDTO';

export class CountNotesUseCase {
  constructor(private readonly noteRepository: INoteRepository) {}

  async execute(input: CountNotesInputDTO = {}): Promise<CountNotesOutputDTO> {
    // Normalize the tag the same way the entity does so the filter matches the
    // stored form. A blank/whitespace-only tag is treated as "no filter".
    const normalizedTag = input.tag ? Note.normalizeTag(input.tag) : '';

    const count = await this.noteRepository.count({
      tag: normalizedTag || undefined,
      includeArchived: input.includeArchived ?? false,
      createdAfter: input.createdAfter,
      createdBefore: input.createdBefore,
    });

    return { count };
  }
}
