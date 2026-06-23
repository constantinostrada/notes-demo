/**
 * Domain Value Object: NoteId
 * 
 * Represents a unique identifier for a Note.
 * Value objects are immutable and compared by value.
 */

export class NoteId {
  private readonly value: string;

  private constructor(value: string) {
    this.validate(value);
    this.value = value;
  }

  /**
   * Create a new NoteId
   */
  static create(value: string): NoteId {
    return new NoteId(value);
  }

  /**
   * Generate a new unique NoteId
   */
  static generate(): NoteId {
    // Simple UUID v4 implementation without external dependencies
    const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(
      /[xy]/g,
      (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      }
    );
    return new NoteId(uuid);
  }

  private validate(value: string): void {
    if (!value || value.trim().length === 0) {
      throw new Error('NoteId cannot be empty');
    }
    
    // Basic UUID format validation (optional but recommended)
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(value)) {
      throw new Error('NoteId must be a valid UUID format');
    }
  }

  /**
   * Get the string value
   */
  toString(): string {
    return this.value;
  }

  /**
   * Check equality with another NoteId
   */
  equals(other: NoteId): boolean {
    return this.value === other.value;
  }
}
