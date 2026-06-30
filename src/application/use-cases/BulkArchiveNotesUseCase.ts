/**
 * Use Case: Bulk Archive Notes
 *
 * Archives several notes at once by id (soft delete). Like the single-note
 * archive (see DeleteNoteUseCase), each note is loaded, archived via the domain
 * action `Note.archive()`, then persisted — so archived notes disappear from
 * default listings/search but are never removed from storage (recoverable).
 *
 * The batch is forgiving: an id that doesn't point at an active note (unknown,
 * or already archived) is silently skipped rather than failing the whole
 * request. Ids repeated within the payload are processed once (archiving is
 * idempotent). The same flow runs against either repository implementation, so
 * the contract holds for both InMemory and SQLite.
 */

import { Note } from '@/domain/entities/Note';
import { INoteRepository } from '@/domain/repositories/INoteRepository';
import {
  BulkArchiveNotesInputDTO,
  BulkArchiveNotesOutputDTO,
} from '../dtos/NoteDTO';
import { NoteMapper } from '../mappers/NoteMapper';

export class BulkArchiveNotesUseCase {
  constructor(private readonly noteRepository: INoteRepository) {}

  async execute(
    input: BulkArchiveNotesInputDTO
  ): Promise<BulkArchiveNotesOutputDTO> {
    const ids = input.ids;
    const seen = new Set<string>();
    const archived: Note[] = [];

    for (const id of ids) {
      // Skip ids repeated within the same payload — archiving is idempotent, so
      // re-processing one would only waste a lookup.
      if (seen.has(id)) continue;
      seen.add(id);

      const note = await this.noteRepository.findById(id);
      // Unknown or already-archived ids are ignored without error: the batch
      // must not break just because some ids don't point at an active note.
      if (!note || note.isArchived()) continue;

      note.archive();
      await this.noteRepository.save(note);
      archived.push(note);
    }

    return {
      archived: archived.length,
      skipped: ids.length - archived.length,
      total: ids.length,
      notes: NoteMapper.toDTOList(archived),
    };
  }
}
