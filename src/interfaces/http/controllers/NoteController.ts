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

  static async listNotes(rawTag?: unknown): Promise<ControllerResult> {
    try {
      const { tag } = listNotesSchema.parse({ tag: rawTag });

      const useCase = container.getListNotesUseCase();
      const result = await useCase.execute({ tag });

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

  static async searchNotes(rawQuery: unknown): Promise<ControllerResult> {
    try {
      const { q } = searchNotesSchema.parse({ q: rawQuery });

      const useCase = container.getSearchNotesUseCase();
      const result = await useCase.execute({ query: q });

      return ok(result);
    } catch (error) {
      return mapError(error);
    }
  }
}
