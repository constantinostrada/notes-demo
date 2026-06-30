/**
 * Use Case: List Notes
 *
 * Retrieves one cursor-paginated page of notes, ordered by the requested field
 * and direction, with an optional tag / created-at filter. Returns the page plus
 * the `next_cursor` token for the following page. Ordering and keyset paging
 * live in the repository; this use case resolves defaults and shapes the DTO.
 */

import { Note } from '@/domain/entities/Note';
import { INoteRepository } from '@/domain/repositories/INoteRepository';
import {
  ListNotesInputDTO,
  ListNotesOutputDTO,
  DEFAULT_LIMIT,
  DEFAULT_SORT_FIELD,
  DEFAULT_SORT_DIRECTION,
} from '../dtos/NoteDTO';
import { NoteMapper } from '../mappers/NoteMapper';
import { encodeListCursor } from '../pagination/listCursor';

export class ListNotesUseCase {
  constructor(private readonly noteRepository: INoteRepository) {}

  async execute(input: ListNotesInputDTO = {}): Promise<ListNotesOutputDTO> {
    // Normalize the tag the same way the entity does so the filter matches the
    // stored form. A blank/whitespace-only tag is treated as "no filter".
    const normalizedTag = input.tag ? Note.normalizeTag(input.tag) : '';

    const { notes, nextCursor } = await this.noteRepository.list({
      tag: normalizedTag || undefined,
      includeArchived: input.includeArchived ?? false,
      createdAfter: input.createdAfter,
      createdBefore: input.createdBefore,
      limit: input.limit ?? DEFAULT_LIMIT,
      sortField: input.sortField ?? DEFAULT_SORT_FIELD,
      sortDirection: input.sortDirection ?? DEFAULT_SORT_DIRECTION,
      cursor: input.cursor,
    });

    return {
      notes: NoteMapper.toDTOList(notes),
      next_cursor: nextCursor ? encodeListCursor(nextCursor) : null,
    };
  }
}
