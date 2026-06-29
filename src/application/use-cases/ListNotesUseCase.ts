/**
 * Use Case: List Notes
 *
 * Retrieves a page of notes with pagination, sorting and an optional tag
 * filter. Returns the page plus pagination metadata.
 */

import { Note } from '@/domain/entities/Note';
import {
  INoteRepository,
  NoteSortField,
  SortDirection,
} from '@/domain/repositories/INoteRepository';
import {
  ListNotesInputDTO,
  PaginatedNotesOutputDTO,
  DEFAULT_PAGE,
  DEFAULT_LIMIT,
  DEFAULT_SORT,
} from '../dtos/NoteDTO';
import { NoteMapper } from '../mappers/NoteMapper';

export class ListNotesUseCase {
  constructor(private readonly noteRepository: INoteRepository) {}

  async execute(input: ListNotesInputDTO = {}): Promise<PaginatedNotesOutputDTO> {
    const page = input.page ?? DEFAULT_PAGE;
    const limit = input.limit ?? DEFAULT_LIMIT;
    const sort = input.sort ?? DEFAULT_SORT;
    const { sortField, sortDirection } = parseSort(sort);

    // Normalize the tag the same way the entity does so the filter matches the
    // stored form. A blank/whitespace-only tag is treated as "no filter".
    const normalizedTag = input.tag ? Note.normalizeTag(input.tag) : '';

    const { notes, total } = await this.noteRepository.list({
      tag: normalizedTag || undefined,
      includeArchived: input.includeArchived ?? false,
      createdAfter: input.createdAfter,
      createdBefore: input.createdBefore,
      page,
      limit,
      sortField,
      sortDirection,
    });

    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

    return {
      notes: NoteMapper.toDTOList(notes),
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
        sort,
      },
    };
  }
}

/**
 * Split a sort token (`field` or `-field`) into a field + direction. A leading
 * `-` means descending. The token is validated at the edge (zod), so any field
 * arriving here is one the repository understands.
 */
function parseSort(sort: string): {
  sortField: NoteSortField;
  sortDirection: SortDirection;
} {
  const descending = sort.startsWith('-');
  const field = (descending ? sort.slice(1) : sort) as NoteSortField;
  return { sortField: field, sortDirection: descending ? 'desc' : 'asc' };
}
