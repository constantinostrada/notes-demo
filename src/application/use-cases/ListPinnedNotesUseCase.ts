/**
 * Use Case: List Pinned Notes
 *
 * Returns one cursor-paginated page of pinned notes plus the `next_cursor`
 * token for the following page. Ordering (newest-first, id as a stable
 * tiebreaker), the keyset paging, and the archived-note exclusion all live in
 * the repository; this use case just resolves defaults and shapes the DTO.
 */

import { INoteRepository } from '@/domain/repositories/INoteRepository';
import {
  ListPinnedNotesInputDTO,
  ListPinnedNotesOutputDTO,
  DEFAULT_LIMIT,
} from '../dtos/NoteDTO';
import { NoteMapper } from '../mappers/NoteMapper';
import { encodeSearchCursor } from '../pagination/searchCursor';

export class ListPinnedNotesUseCase {
  constructor(private readonly noteRepository: INoteRepository) {}

  async execute(
    input: ListPinnedNotesInputDTO = {}
  ): Promise<ListPinnedNotesOutputDTO> {
    const { notes, nextCursor } = await this.noteRepository.listPinned({
      limit: input.limit ?? DEFAULT_LIMIT,
      cursor: input.cursor,
    });

    return {
      notes: NoteMapper.toDTOList(notes),
      next_cursor: nextCursor ? encodeSearchCursor(nextCursor) : null,
    };
  }
}
