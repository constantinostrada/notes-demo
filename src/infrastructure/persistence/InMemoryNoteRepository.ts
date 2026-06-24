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
  NoteListCriteria,
  NotePage,
  NoteSortField,
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
    };

    // Reconstitute to create a fresh instance
    const persistedNote = Note.reconstitute(
      serialized.id,
      serialized.title,
      serialized.content,
      serialized.tags,
      serialized.createdAt,
      serialized.updatedAt,
      serialized.deletedAt
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

  async search(query: string): Promise<Note[]> {
    const lowerQuery = query.toLowerCase();
    const allNotes = await this.findAll();

    return allNotes.filter(
      (note) =>
        note.title.toLowerCase().includes(lowerQuery) ||
        note.content.toLowerCase().includes(lowerQuery)
    );
  }

  async list(criteria: NoteListCriteria): Promise<NotePage> {
    const { tag, includeArchived, page, limit, sortField, sortDirection } = criteria;

    // The tag arrives already normalized (see Note.normalizeTag); note.tags are
    // stored in their canonical form too, so an exact match is correct. Archived
    // notes are excluded unless the caller explicitly opts in.
    const all = Array.from(this.notes.values()).filter(
      (note) => includeArchived || !note.isArchived()
    );
    const filtered = tag ? all.filter((note) => note.tags.includes(tag)) : all;

    const sorted = filtered.sort((a, b) =>
      compareNotes(a, b, sortField, sortDirection)
    );

    const offset = (page - 1) * limit;
    return {
      notes: sorted.slice(offset, offset + limit),
      total: sorted.length,
    };
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
 * Compare two notes by the requested field/direction. Titles compare
 * case-insensitively; `id` is a stable tiebreaker so equal keys order
 * deterministically (mirrors the SQLite repository's ORDER BY).
 */
function compareNotes(
  a: Note,
  b: Note,
  field: NoteSortField,
  direction: SortDirection
): number {
  let cmp: number;
  switch (field) {
    case 'title':
      cmp = a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
      break;
    case 'updatedAt':
      cmp = a.updatedAt.getTime() - b.updatedAt.getTime();
      break;
    case 'createdAt':
    default:
      cmp = a.createdAt.getTime() - b.createdAt.getTime();
      break;
  }
  if (cmp === 0) {
    cmp = a.id.localeCompare(b.id);
  }
  return direction === 'desc' ? -cmp : cmp;
}
