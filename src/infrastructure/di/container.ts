/**
 * Infrastructure: Dependency Injection Container
 * 
 * Wires up dependencies and provides instances to the application.
 * This is where we decide which implementations to use.
 */

import { INoteRepository } from '@/domain/repositories/INoteRepository';
import { InMemoryNoteRepository } from '../persistence/InMemoryNoteRepository';
import { CreateNoteUseCase } from '@/application/use-cases/CreateNoteUseCase';
import { GetNoteUseCase } from '@/application/use-cases/GetNoteUseCase';
import { ListNotesUseCase } from '@/application/use-cases/ListNotesUseCase';
import { UpdateNoteUseCase } from '@/application/use-cases/UpdateNoteUseCase';
import { DeleteNoteUseCase } from '@/application/use-cases/DeleteNoteUseCase';
import { SearchNotesUseCase } from '@/application/use-cases/SearchNotesUseCase';

/**
 * Dependency Container (Singleton)
 */
class DIContainer {
  private static instance: DIContainer;
  private noteRepository: INoteRepository;

  private constructor() {
    // Initialize repositories
    this.noteRepository = new InMemoryNoteRepository();
  }

  static getInstance(): DIContainer {
    if (!DIContainer.instance) {
      DIContainer.instance = new DIContainer();
    }
    return DIContainer.instance;
  }

  // Repository providers
  getNoteRepository(): INoteRepository {
    return this.noteRepository;
  }

  // Use case providers
  getCreateNoteUseCase(): CreateNoteUseCase {
    return new CreateNoteUseCase(this.getNoteRepository());
  }

  getGetNoteUseCase(): GetNoteUseCase {
    return new GetNoteUseCase(this.getNoteRepository());
  }

  getListNotesUseCase(): ListNotesUseCase {
    return new ListNotesUseCase(this.getNoteRepository());
  }

  getUpdateNoteUseCase(): UpdateNoteUseCase {
    return new UpdateNoteUseCase(this.getNoteRepository());
  }

  getDeleteNoteUseCase(): DeleteNoteUseCase {
    return new DeleteNoteUseCase(this.getNoteRepository());
  }

  getSearchNotesUseCase(): SearchNotesUseCase {
    return new SearchNotesUseCase(this.getNoteRepository());
  }
}

// Export singleton instance
export const container = DIContainer.getInstance();
