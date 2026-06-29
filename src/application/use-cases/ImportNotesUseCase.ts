/**
 * Use Case: Import Notes
 *
 * Loads a batch of notes from a (validated) JSON payload. Each note is turned
 * into a domain entity — so domain invariants are enforced exactly as on a
 * normal create — and then persisted.
 *
 * Two behaviours worth calling out:
 *   - Strong read-back: when a note carries an `id` and/or timestamps they are
 *     preserved, so importing an export reproduces the original notes verbatim.
 *     Notes without an id get a fresh one and "now" timestamps.
 *   - De-duplication: a note whose id already exists in the store, or repeats an
 *     id seen earlier in the same payload, is skipped (never duplicated or
 *     overwritten). Re-importing the same export is therefore a no-op.
 *
 * Validation is atomic: every note is constructed (and its invariants checked)
 * before anything is written, so a single invalid note fails the whole batch
 * without leaving a partial import behind.
 */

import { Note } from '@/domain/entities/Note';
import { NoteId } from '@/domain/value-objects/NoteId';
import { INoteRepository } from '@/domain/repositories/INoteRepository';
import {
  ImportNoteInputDTO,
  ImportNotesInputDTO,
  ImportNotesOutputDTO,
} from '../dtos/NoteDTO';
import { NoteMapper } from '../mappers/NoteMapper';

export class ImportNotesUseCase {
  constructor(private readonly noteRepository: INoteRepository) {}

  async execute(input: ImportNotesInputDTO): Promise<ImportNotesOutputDTO> {
    const incoming = input.notes;
    const seenIds = new Set<string>();
    const toCreate: Note[] = [];
    let skipped = 0;

    for (const raw of incoming) {
      // De-dup only applies to notes that bring their own id; a note without one
      // always gets a fresh, collision-free id and so is always created.
      if (raw.id !== undefined) {
        const alreadyInBatch = seenIds.has(raw.id);
        const alreadyStored = await this.noteRepository.exists(raw.id);
        if (alreadyInBatch || alreadyStored) {
          skipped += 1;
          continue;
        }
        seenIds.add(raw.id);
      }

      // Build the entity now so any invariant violation (e.g. title too long)
      // throws BEFORE the persistence loop runs — keeping the import atomic.
      toCreate.push(this.toEntity(raw));
    }

    for (const note of toCreate) {
      await this.noteRepository.save(note);
    }

    return {
      imported: toCreate.length,
      skipped,
      total: incoming.length,
      notes: NoteMapper.toDTOList(toCreate),
    };
  }

  /** Reconstitute a domain Note from an import row, defaulting what's absent. */
  private toEntity(raw: ImportNoteInputDTO): Note {
    const id = raw.id ?? NoteId.generate().toString();
    const now = new Date();
    const createdAt = raw.createdAt ? new Date(raw.createdAt) : now;
    const updatedAt = raw.updatedAt ? new Date(raw.updatedAt) : now;
    const deletedAt = raw.deletedAt ? new Date(raw.deletedAt) : null;
    const dueAt = raw.dueAt ? new Date(raw.dueAt) : null;

    return Note.reconstitute(
      id,
      raw.title.trim(),
      raw.content ?? '',
      raw.tags ?? [],
      createdAt,
      updatedAt,
      deletedAt,
      raw.color ?? null,
      raw.isPinned ?? false,
      dueAt
    );
  }
}
