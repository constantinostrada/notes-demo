/**
 * Interface: Note Controller
 *
 * Thin adapter that validates input, calls use cases, and formats responses.
 * No business logic - just orchestration and HTTP concerns.
 *
 * Validation is done with zod schemas; every error path goes through the
 * central `mapError` so responses stay uniform (see `apiResponse.ts`).
 */

import { container } from '@/infrastructure/di/container';
import {
  ControllerResult,
  ok,
  noContent,
  mapError,
} from '@/interfaces/http/apiResponse';
import {
  createNoteSchema,
  updateNoteSchema,
  searchNotesSchema,
  listNotesSchema,
  countNotesSchema,
  importNotesSchema,
  pinnedNotesSchema,
  reminderSchema,
} from '@/interfaces/http/validation/noteSchemas';

export class NoteController {
  static async createNote(body: unknown): Promise<ControllerResult> {
    try {
      const input = createNoteSchema.parse(body);

      const useCase = container.getCreateNoteUseCase();
      const result = await useCase.execute(input);

      return ok(result, 201);
    } catch (error) {
      return mapError(error);
    }
  }

  static async getNote(id: string): Promise<ControllerResult> {
    try {
      const useCase = container.getGetNoteUseCase();
      const result = await useCase.execute({ id });

      return ok(result);
    } catch (error) {
      return mapError(error);
    }
  }

  static async listNotes(rawQuery?: unknown): Promise<ControllerResult> {
    try {
      const { tag, includeArchived, createdAfter, createdBefore, page, limit, sort } =
        listNotesSchema.parse(rawQuery ?? {});

      const useCase = container.getListNotesUseCase();
      const result = await useCase.execute({
        tag,
        includeArchived,
        createdAfter,
        createdBefore,
        page,
        limit,
        sort,
      });

      return ok(result);
    } catch (error) {
      return mapError(error);
    }
  }

  static async countNotes(rawQuery?: unknown): Promise<ControllerResult> {
    try {
      const { tag, includeArchived, createdAfter, createdBefore } =
        countNotesSchema.parse(rawQuery ?? {});

      const useCase = container.getCountNotesUseCase();
      const result = await useCase.execute({
        tag,
        includeArchived,
        createdAfter,
        createdBefore,
      });

      return ok(result);
    } catch (error) {
      return mapError(error);
    }
  }

  static async updateNote(id: string, body: unknown): Promise<ControllerResult> {
    try {
      const input = updateNoteSchema.parse(body);

      const useCase = container.getUpdateNoteUseCase();
      const result = await useCase.execute({ id, ...input });

      return ok(result);
    } catch (error) {
      return mapError(error);
    }
  }

  static async deleteNote(id: string): Promise<ControllerResult> {
    try {
      const useCase = container.getDeleteNoteUseCase();
      await useCase.execute({ id });

      return noContent();
    } catch (error) {
      return mapError(error);
    }
  }

  static async searchNotes(rawQuery?: unknown): Promise<ControllerResult> {
    try {
      const { q, cursor, limit } = searchNotesSchema.parse(rawQuery ?? {});

      const useCase = container.getSearchNotesUseCase();
      const result = await useCase.execute({ query: q, cursor, limit });

      return ok(result);
    } catch (error) {
      return mapError(error);
    }
  }

  static async pinNote(id: string): Promise<ControllerResult> {
    try {
      const useCase = container.getPinNoteUseCase();
      const result = await useCase.execute({ id });

      return ok(result);
    } catch (error) {
      return mapError(error);
    }
  }

  static async unpinNote(id: string): Promise<ControllerResult> {
    try {
      const useCase = container.getUnpinNoteUseCase();
      const result = await useCase.execute({ id });

      return ok(result);
    } catch (error) {
      return mapError(error);
    }
  }

  static async listPinnedNotes(rawQuery?: unknown): Promise<ControllerResult> {
    try {
      const { cursor, limit } = pinnedNotesSchema.parse(rawQuery ?? {});

      const useCase = container.getListPinnedNotesUseCase();
      const result = await useCase.execute({ cursor, limit });

      return ok(result);
    } catch (error) {
      return mapError(error);
    }
  }

  static async setReminder(id: string, body: unknown): Promise<ControllerResult> {
    try {
      const { dueAt } = reminderSchema.parse(body);

      const useCase = container.getSetReminderUseCase();
      const result = await useCase.execute({ id, dueAt });

      return ok(result);
    } catch (error) {
      return mapError(error);
    }
  }

  static async listDueNotes(): Promise<ControllerResult> {
    try {
      const useCase = container.getListDueNotesUseCase();
      const result = await useCase.execute();

      return ok(result);
    } catch (error) {
      return mapError(error);
    }
  }

  static async exportNotes(): Promise<ControllerResult> {
    try {
      const useCase = container.getExportNotesUseCase();
      const result = await useCase.execute();

      return ok(result);
    } catch (error) {
      return mapError(error);
    }
  }

  static async importNotes(body: unknown): Promise<ControllerResult> {
    try {
      const input = importNotesSchema.parse(body);

      const useCase = container.getImportNotesUseCase();
      const result = await useCase.execute(input);

      return ok(result, 201);
    } catch (error) {
      return mapError(error);
    }
  }
}
