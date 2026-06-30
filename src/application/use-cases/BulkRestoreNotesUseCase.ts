/**
 * Use Case: Bulk Restore Notes
 *
 * Restores several archived notes at once by id (the inverse of bulk archive).
 * Each note is loaded, un-archived via the domain action `Note.restore()`, then
 * persisted — so the notes reappear in default listings/search. The row was
 * never removed (soft delete), so restoring simply clears the archive tombstone.
 *
 * The batch is forgiving: an id that doesn't point at an archived note (unknown,
 * or already active) is silently skipped rather than failing the whole request.
 * Ids repeated within the payload are processed once (restoring is idempotent).
 * The same flow runs against either repository implementation, so the contract
 * holds for both InMemory and SQLite.
 */

import { Note } from '@/domain/entities/Note';
import { INoteRepository } from '@/domain/repositories/INoteRepository';
import {
  BulkRestoreNotesInputDTO,
  BulkRestoreNotesOutputDTO,
} from '../dtos/NoteDTO';
import { NoteMapper } from '../mappers/NoteMapper';

export class BulkRestoreNotesUseCase {
  constructor(private readonly noteRepository: INoteRepository) {}

  async execute(
    input: BulkRestoreNotesInputDTO
  ): Promise<BulkRestoreNotesOutputDTO> {
    const ids = input.ids;
    const seen = new Set<string>();
    const restored: Note[] = [];

    for (const id of ids) {
      // Skip ids repeated within the same payload — restoring is idempotent, so
      // re-processing one would only waste a lookup.
      if (seen.has(id)) continue;
      seen.add(id);

      const note = await this.noteRepository.findById(id);
      // Unknown or already-active ids are ignored without error: the batch must
      // not break just because some ids don't point at an archived note.
      if (!note || !note.isArchived()) continue;

      note.restore();
      await this.noteRepository.save(note);
      restored.push(note);
    }

    return {
      restored: restored.length,
      skipped: ids.length - restored.length,
      total: ids.length,
      notes: NoteMapper.toDTOList(restored),
    };
  }
}
