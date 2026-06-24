/**
 * Infrastructure: Dependency Injection Container
 * 
 * Wires up dependencies and provides instances to the application.
 * This is where we decide which implementations to use.
 */

import { INoteRepository } from '@/domain/repositories/INoteRepository';
import { SqliteNoteRepository } from '../persistence/SqliteNoteRepository';
import { CreateNoteUseCase } from '@/application/use-cases/CreateNoteUseCase';
import { GetNoteUseCase } from '@/application/use-cases/GetNoteUseCase';
import { ListNotesUseCase } from '@/application/use-cases/ListNotesUseCase';
import { UpdateNoteUseCase } from '@/application/use-cases/UpdateNoteUseCase';
import { DeleteNoteUseCase } from '@/application/use-cases/DeleteNoteUseCase';
import { SearchNotesUseCase } from '@/application/use-cases/SearchNotesUseCase';

/**
 * The repository is cached on `globalThis`.
 *
 * Next.js re-evaluates route modules between requests (and on every HMR reload
 * in dev). Caching the repository on the global object keeps a single
 * SQLite connection alive for the whole server process instead of reopening the
 * database file on each request/reload.
 *
 * We deliberately cache ONLY the repository, not the whole container: the
 * container, use cases, and exception classes are rebuilt per evaluation so
 * their class identity stays consistent within a request (e.g. so
 * `error instanceof NoteNotFoundException` works in the controller).
 *
 * Data itself lives in SQLite (see SqliteNoteRepository), so it persists across
 * restarts regardless of this in-memory cache.
 */
const globalStore = globalThis as typeof globalThis & {
  __notesRepository?: INoteRepository;
};

function getOrCreateNoteRepository(): INoteRepository {
  if (!globalStore.__notesRepository) {
    globalStore.__notesRepository = new SqliteNoteRepository();
  }
  return globalStore.__notesRepository;
}

/**
 * Dependency Container (Singleton)
 */
class DIContainer {
  private static instance: DIContainer;
  private noteRepository: INoteRepository;

  private constructor() {
    // Resolve the process-wide repository (state survives module reloads).
    this.noteRepository = getOrCreateNoteRepository();
  }

  static getInstance(): DIContainer {
    if (!DIContainer.instance) {
      DIContainer.instance = new DIContainer();
    }
    return DIContainer.instance;
  }

  /**
   * Reset shared state (used by tests). Clears the persisted repository so the
   * next resolution starts from an empty store.
   */
  static reset(): void {
    DIContainer.instance = undefined as unknown as DIContainer;
    globalStore.__notesRepository = undefined;
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
