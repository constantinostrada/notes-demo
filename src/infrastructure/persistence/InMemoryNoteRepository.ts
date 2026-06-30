/**
 * Infrastructure: In-Memory Note Repository
 * 
 * Implementation of INoteRepository using in-memory storage.
 * This is suitable for development and demos. In production,
 * this would be replaced with a database implementation.
 */

import { Note } from '@/domain/entities/Note';
import {
  INoteRepository,
  ListCursor,
  NoteCountCriteria,
  NoteFilterCriteria,
  NoteListCriteria,
  NoteListPage,
  NotePinnedCriteria,
  NoteSearchCriteria,
  NoteSearchPage,
  NoteSortField,
  SearchCursor,
  SortDirection,
} from '@/domain/repositories/INoteRepository';

export class InMemoryNoteRepository implements INoteRepository {
  private notes: Map<string, Note> = new Map();

  async save(note: Note): Promise<void> {
    // Clone the note data to simulate persistence
    const serialized = {
      id: note.id,
      title: note.title,
      content: note.content,
      tags: note.tags,
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
      deletedAt: note.deletedAt,
      color: note.color,
      isPinned: note.isPinned,
      dueAt: note.dueAt,
    };

    // Reconstitute to create a fresh instance
    const persistedNote = Note.reconstitute(
      serialized.id,
      serialized.title,
      serialized.content,
      serialized.tags,
      serialized.createdAt,
      serialized.updatedAt,
      serialized.deletedAt,
      serialized.color,
      serialized.isPinned,
      serialized.dueAt
    );

    this.notes.set(note.id, persistedNote);
  }

  async findById(id: string): Promise<Note | null> {
    const note = this.notes.get(id);
    return note || null;
  }

  async findAll(): Promise<Note[]> {
    return Array.from(this.notes.values()).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
  }

  async delete(id: string): Promise<boolean> {
    return this.notes.delete(id);
  }

  async exists(id: string): Promise<boolean> {
    return this.notes.has(id);
  }

  async search(criteria: NoteSearchCriteria): Promise<NoteSearchPage> {
    const { query, limit, cursor } = criteria;
    const lowerQuery = query.toLowerCase();

    // Match on title or content, then order newest-first with id as a stable
    // tiebreaker (mirrors the SQLite repository's ORDER BY) so cursor paging is
    // deterministic. Archived (soft-deleted) notes are excluded — search is a
    // read endpoint and must never surface notes carrying a deletedAt tombstone.
    const matches = Array.from(this.notes.values())
      .filter(
        (note) =>
          !note.isArchived() &&
          (note.title.toLowerCase().includes(lowerQuery) ||
            note.content.toLowerCase().includes(lowerQuery))
      )
      .sort(compareSearch);

    // Keyset: drop everything up to and including the cursor position.
    const afterCursor = cursor
      ? matches.filter((note) => isAfterCursor(note, cursor))
      : matches;

    // Over-fetch one row to learn whether a further page exists.
    const page = afterCursor.slice(0, limit);
    const hasMore = afterCursor.length > limit;
    const last = page[page.length - 1];
    const nextCursor: SearchCursor | null =
      hasMore && last ? { createdAt: last.createdAt.getTime(), id: last.id } : null;

    return { notes: page, nextCursor };
  }

  async listPinned(criteria: NotePinnedCriteria): Promise<NoteSearchPage> {
    const { limit, cursor } = criteria;

    // Only pinned, active notes — archived (soft-deleted) notes never surface
    // here. Same ordering/keyset as search so paging is stable across both
    // backends.
    const matches = Array.from(this.notes.values())
      .filter((note) => note.isPinned && !note.isArchived())
      .sort(compareSearch);

    const afterCursor = cursor
      ? matches.filter((note) => isAfterCursor(note, cursor))
      : matches;

    // Over-fetch one row to learn whether a further page exists.
    const page = afterCursor.slice(0, limit);
    const hasMore = afterCursor.length > limit;
    const last = page[page.length - 1];
    const nextCursor: SearchCursor | null =
      hasMore && last ? { createdAt: last.createdAt.getTime(), id: last.id } : null;

    return { notes: page, nextCursor };
  }

  async findDue(now: Date): Promise<Note[]> {
    // Overdue notes only: a reminder strictly in the past relative to `now`.
    // The archived-never-overdue invariant lives in Note.isOverdue, which
    // excludes archived notes first — mirroring the SQLite repo's WHERE clause.
    return Array.from(this.notes.values())
      .filter((note) => note.isOverdue(now))
      .sort(compareDue);
  }

  async countDue(now: Date): Promise<number> {
    // Same predicate as findDue (Note.isOverdue, which excludes archived
    // notes), so the count always matches the listing length.
    return Array.from(this.notes.values()).filter((note) => note.isOverdue(now))
      .length;
  }

  async list(criteria: NoteListCriteria): Promise<NoteListPage> {
    const { limit, sortField, sortDirection, cursor } = criteria;

    // Order by the requested field/direction with id as a stable tiebreaker,
    // matching the SQLite repository's ORDER BY so paging behaves identically.
    const sorted = this.filterNotes(criteria).sort((a, b) =>
      compareNotes(a, b, sortField, sortDirection)
    );

    // Keyset: drop everything up to and including the cursor position.
    const afterCursor = cursor
      ? sorted.filter((note) => isAfterListCursor(note, cursor))
      : sorted;

    // Over-fetch one row to learn whether a further page exists.
    const page = afterCursor.slice(0, limit);
    const hasMore = afterCursor.length > limit;
    const last = page[page.length - 1];
    const nextCursor: ListCursor | null =
      hasMore && last ? toListCursor(last, sortField, sortDirection) : null;

    return { notes: page, nextCursor };
  }

  async count(criteria: NoteCountCriteria): Promise<number> {
    return this.filterNotes(criteria).length;
  }

  /**
   * Apply the shared listing filters (tag / archived / created-at range) to the
   * stored notes. The tag arrives already normalized (see Note.normalizeTag);
   * note.tags are stored in canonical form too, so an exact match is correct.
   * Archived notes are excluded unless the caller opts in. Optional created-at
   * bounds (inclusive) narrow the range; all filters compose via AND.
   */
  private filterNotes(criteria: NoteFilterCriteria): Note[] {
    const { tag, includeArchived, createdAfter, createdBefore } = criteria;
    const afterMs = createdAfter?.getTime();
    const beforeMs = createdBefore?.getTime();
    return Array.from(this.notes.values()).filter((note) => {
      if (!includeArchived && note.isArchived()) return false;
      if (tag && !note.tags.includes(tag)) return false;
      const createdMs = note.createdAt.getTime();
      if (afterMs !== undefined && createdMs < afterMs) return false;
      if (beforeMs !== undefined && createdMs > beforeMs) return false;
      return true;
    });
  }

  // Utility method for testing/development
  clear(): void {
    this.notes.clear();
  }

  // Utility method for getting size (testing)
  size(): number {
    return this.notes.size;
  }
}

/**
 * Search ordering: newest-first by creation time, with `id` ascending as a
 * stable tiebreaker so equal timestamps page deterministically (mirrors the
 * SQLite repository's `ORDER BY n.created_at DESC, n.id ASC`).
 */
function compareSearch(a: Note, b: Note): number {
  const byCreated = b.createdAt.getTime() - a.createdAt.getTime();
  if (byCreated !== 0) return byCreated;
  // Binary (code-unit) comparison so the sort agrees exactly with the keyset
  // predicate (`isAfterCursor`) and with SQLite's binary `id ASC`.
  if (a.id < b.id) return -1;
  if (a.id > b.id) return 1;
  return 0;
}

/**
 * Due ordering: most-overdue first (dueAt ascending), with `id` ascending as a
 * stable tiebreaker so equal due times order deterministically (mirrors the
 * SQLite repository's `ORDER BY n.due_at ASC, n.id ASC`). Only overdue notes
 * reach this comparator, so `dueAt` is always set.
 */
function compareDue(a: Note, b: Note): number {
  const byDue = (a.dueAt?.getTime() ?? 0) - (b.dueAt?.getTime() ?? 0);
  if (byDue !== 0) return byDue;
  if (a.id < b.id) return -1;
  if (a.id > b.id) return 1;
  return 0;
}

/**
 * Whether `note` falls strictly after the cursor position in the search
 * ordering (created_at DESC, id ASC): an older note, or the same instant with a
 * higher id.
 */
function isAfterCursor(note: Note, cursor: SearchCursor): boolean {
  const createdMs = note.createdAt.getTime();
  if (createdMs !== cursor.createdAt) return createdMs < cursor.createdAt;
  return note.id > cursor.id;
}

/**
 * Compare a note's primary sort key (the chosen field only, no tiebreaker)
 * against another value, in *ascending* order. Titles compare
 * case-insensitively; `createdAt` compares by epoch milliseconds. The directed
 * comparison and the id tiebreaker are layered on top by the callers.
 */
function comparePrimary(
  field: NoteSortField,
  aValue: string | number,
  bValue: string | number
): number {
  if (field === 'title') {
    return String(aValue).localeCompare(String(bValue), undefined, {
      sensitivity: 'base',
    });
  }
  return Number(aValue) - Number(bValue);
}

/**
 * Compare two notes by the requested field/direction. The primary key follows
 * `direction`, but `id` is *always* an ascending binary tiebreaker — matching
 * SQLite's `ORDER BY <field> <dir>, n.id ASC` and the keyset predicate below, so
 * equal keys page deterministically across both backends.
 */
function compareNotes(
  a: Note,
  b: Note,
  field: NoteSortField,
  direction: SortDirection
): number {
  const primary = comparePrimary(field, sortKey(a, field), sortKey(b, field));
  let cmp = direction === 'desc' ? -primary : primary;
  if (cmp === 0) {
    // Binary (code-unit) compare so it agrees with SQLite's binary `id ASC`.
    if (a.id < b.id) cmp = -1;
    else if (a.id > b.id) cmp = 1;
  }
  return cmp;
}

/** A note's sort key for the given field (title string, or createdAt epoch ms). */
function sortKey(note: Note, field: NoteSortField): string | number {
  return field === 'title' ? note.title : note.createdAt.getTime();
}

/**
 * Whether `note` falls strictly after the cursor position in the listing's
 * ordering: a later note in the directed primary order, or an equal primary key
 * with a higher id. Mirrors the SQLite keyset WHERE clause exactly.
 */
function isAfterListCursor(note: Note, cursor: ListCursor): boolean {
  const primary = comparePrimary(cursor.sortField, sortKey(note, cursor.sortField), cursor.value);
  const directed = cursor.direction === 'desc' ? -primary : primary;
  if (directed !== 0) return directed > 0;
  return note.id > cursor.id;
}

/** Build the keyset cursor for the last note of a page. */
function toListCursor(
  note: Note,
  field: NoteSortField,
  direction: SortDirection
): ListCursor {
  return { sortField: field, direction, value: sortKey(note, field), id: note.id };
}
