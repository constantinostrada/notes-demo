/**
 * Use Case: Search Notes
 *
 * Searches notes by title or content, returning one cursor-paginated page plus
 * the `next_cursor` token for the following page. Ordering (newest-first, id as
 * a stable tiebreaker) and the keyset paging live in the repository; this use
 * case just resolves defaults and shapes the output DTO.
 */

import { INoteRepository } from '@/domain/repositories/INoteRepository';
import {
  SearchNotesInputDTO,
  SearchNotesOutputDTO,
  DEFAULT_LIMIT,
} from '../dtos/NoteDTO';
import { NoteMapper } from '../mappers/NoteMapper';
import { encodeSearchCursor } from '../pagination/searchCursor';

export class SearchNotesUseCase {
  constructor(private readonly noteRepository: INoteRepository) {}

  async execute(input: SearchNotesInputDTO): Promise<SearchNotesOutputDTO> {
    const query = input.query?.trim() ?? '';
    if (query.length === 0) {
      return { notes: [], next_cursor: null };
    }

    const { notes, nextCursor } = await this.noteRepository.search({
      query,
      limit: input.limit ?? DEFAULT_LIMIT,
      cursor: input.cursor,
    });

    return {
      notes: NoteMapper.toDTOList(notes),
      next_cursor: nextCursor ? encodeSearchCursor(nextCursor) : null,
    };
  }
}
