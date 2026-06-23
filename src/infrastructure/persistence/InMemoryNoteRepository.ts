/**
 * Infrastructure: In-Memory Note Repository
 * 
 * Implementation of INoteRepository using in-memory storage.
 * This is suitable for development and demos. In production,
 * this would be replaced with a database implementation.
 */

import { Note } from '@/domain/entities/Note';
import { INoteRepository } from '@/domain/repositories/INoteRepository';

export class InMemoryNoteRepository implements INoteRepository {
  private notes: Map<string, Note> = new Map();

  async save(note: Note): Promise<void> {
    // Clone the note data to simulate persistence
    const serialized = {
      id: note.id,
      title: note.title,
      content: note.content,
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
    };

    // Reconstitute to create a fresh instance
    const persistedNote = Note.reconstitute(
      serialized.id,
      serialized.title,
      serialized.content,
      serialized.createdAt,
      serialized.updatedAt
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

  // Utility method for testing/development
  clear(): void {
    this.notes.clear();
  }

  // Utility method for getting size (testing)
  size(): number {
    return this.notes.size;
  }
}
