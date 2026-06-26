/**
 * Use Case: Create Note
 * 
 * Orchestrates the creation of a new note.
 * Each use case is a single application operation.
 */

import { Note } from '@/domain/entities/Note';
import { NoteId } from '@/domain/value-objects/NoteId';
import { INoteRepository } from '@/domain/repositories/INoteRepository';
import { InvalidNoteException } from '@/domain/exceptions/DomainException';
import { CreateNoteInputDTO, NoteOutputDTO } from '../dtos/NoteDTO';
import { NoteMapper } from '../mappers/NoteMapper';

export class CreateNoteUseCase {
  constructor(private readonly noteRepository: INoteRepository) {}

  async execute(input: CreateNoteInputDTO): Promise<NoteOutputDTO> {
    // Validate input
    if (!input.title || input.title.trim().length === 0) {
      throw new InvalidNoteException('Title is required');
    }

    // Generate new ID
    const noteId = NoteId.generate();

    // Create domain entity (business rules are enforced here)
    const note = Note.create(
      noteId.toString(),
      input.title.trim(),
      input.content || '',
      input.tags ?? [],
      input.color ?? null
    );

    // Persist via repository
    await this.noteRepository.save(note);

    // Return DTO
    return NoteMapper.toDTO(note);
  }
}
