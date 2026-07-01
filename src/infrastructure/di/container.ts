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
import { CountNotesUseCase } from '@/application/use-cases/CountNotesUseCase';
import { UpdateNoteUseCase } from '@/application/use-cases/UpdateNoteUseCase';
import { DeleteNoteUseCase } from '@/application/use-cases/DeleteNoteUseCase';
import { BulkArchiveNotesUseCase } from '@/application/use-cases/BulkArchiveNotesUseCase';
import { BulkRestoreNotesUseCase } from '@/application/use-cases/BulkRestoreNotesUseCase';
import { RestoreNoteUseCase } from '@/application/use-cases/RestoreNoteUseCase';
import { SearchNotesUseCase } from '@/application/use-cases/SearchNotesUseCase';
import { ExportNotesUseCase } from '@/application/use-cases/ExportNotesUseCase';
import { ImportNotesUseCase } from '@/application/use-cases/ImportNotesUseCase';
import { PinNoteUseCase } from '@/application/use-cases/PinNoteUseCase';
import { UnpinNoteUseCase } from '@/application/use-cases/UnpinNoteUseCase';
import { ListPinnedNotesUseCase } from '@/application/use-cases/ListPinnedNotesUseCase';
import { SetReminderUseCase } from '@/application/use-cases/SetReminderUseCase';
import { ListDueNotesUseCase } from '@/application/use-cases/ListDueNotesUseCase';
import { CountDueNotesUseCase } from '@/application/use-cases/CountDueNotesUseCase';

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

  getCountNotesUseCase(): CountNotesUseCase {
    return new CountNotesUseCase(this.getNoteRepository());
  }

  getUpdateNoteUseCase(): UpdateNoteUseCase {
    return new UpdateNoteUseCase(this.getNoteRepository());
  }

  getDeleteNoteUseCase(): DeleteNoteUseCase {
    return new DeleteNoteUseCase(this.getNoteRepository());
  }

  getBulkArchiveNotesUseCase(): BulkArchiveNotesUseCase {
    return new BulkArchiveNotesUseCase(this.getNoteRepository());
  }

  getBulkRestoreNotesUseCase(): BulkRestoreNotesUseCase {
    return new BulkRestoreNotesUseCase(this.getNoteRepository());
  }

  getRestoreNoteUseCase(): RestoreNoteUseCase {
    return new RestoreNoteUseCase(this.getNoteRepository());
  }

  getSearchNotesUseCase(): SearchNotesUseCase {
    return new SearchNotesUseCase(this.getNoteRepository());
  }

  getExportNotesUseCase(): ExportNotesUseCase {
    return new ExportNotesUseCase(this.getNoteRepository());
  }

  getImportNotesUseCase(): ImportNotesUseCase {
    return new ImportNotesUseCase(this.getNoteRepository());
  }

  getPinNoteUseCase(): PinNoteUseCase {
    return new PinNoteUseCase(this.getNoteRepository());
  }

  getUnpinNoteUseCase(): UnpinNoteUseCase {
    return new UnpinNoteUseCase(this.getNoteRepository());
  }

  getListPinnedNotesUseCase(): ListPinnedNotesUseCase {
    return new ListPinnedNotesUseCase(this.getNoteRepository());
  }

  getSetReminderUseCase(): SetReminderUseCase {
    return new SetReminderUseCase(this.getNoteRepository());
  }

  getListDueNotesUseCase(): ListDueNotesUseCase {
    return new ListDueNotesUseCase(this.getNoteRepository());
  }

  getCountDueNotesUseCase(): CountDueNotesUseCase {
    return new CountDueNotesUseCase(this.getNoteRepository());
  }
}

// Export singleton instance
export const container = DIContainer.getInstance();
