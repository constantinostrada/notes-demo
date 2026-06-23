/**
 * Domain Exceptions
 * 
 * Custom exceptions for domain-specific errors
 */

export class DomainException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DomainException';
  }
}

export class NoteNotFoundException extends DomainException {
  constructor(id: string) {
    super(`Note with id ${id} not found`);
    this.name = 'NoteNotFoundException';
  }
}

export class InvalidNoteException extends DomainException {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidNoteException';
  }
}
