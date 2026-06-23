/**
 * Domain Service: NoteService
 * 
 * Contains domain logic that doesn't naturally fit within a single entity.
 * Domain services are stateless and operate on domain objects.
 */

import { Note } from '../entities/Note';

export class NoteService {
  /**
   * Check if two notes have similar content (simple similarity check)
   */
  static areSimilar(note1: Note, note2: Note): boolean {
    const content1 = note1.content.toLowerCase().trim();
    const content2 = note2.content.toLowerCase().trim();

    // Simple similarity: check if one contains significant portion of the other
    if (content1.length === 0 || content2.length === 0) {
      return false;
    }

    const shorter = content1.length < content2.length ? content1 : content2;
    const longer = content1.length < content2.length ? content2 : content1;

    // If the shorter content is found in the longer one and represents
    // at least 70% of the longer content, consider them similar
    if (longer.includes(shorter)) {
      return shorter.length / longer.length >= 0.7;
    }

    return false;
  }

  /**
   * Merge multiple notes into one
   */
  static merge(notes: Note[], separator: string = '\n\n---\n\n'): string {
    if (notes.length === 0) {
      return '';
    }

    return notes
      .map((note) => {
        const header = `# ${note.title}\n\n`;
        return header + note.content;
      })
      .join(separator);
  }

  /**
   * Calculate total word count across multiple notes
   */
  static getTotalWordCount(notes: Note[]): number {
    return notes.reduce((total, note) => total + note.getWordCount(), 0);
  }

  /**
   * Filter notes by minimum word count
   */
  static filterByMinWordCount(notes: Note[], minWords: number): Note[] {
    return notes.filter((note) => note.getWordCount() >= minWords);
  }
}
