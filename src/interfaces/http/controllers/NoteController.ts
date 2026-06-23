/**
 * Interface: Note Controller
 * 
 * Thin adapter that validates input, calls use cases, and formats responses.
 * No business logic - just orchestration and HTTP concerns.
 */

import { container } from '@/infrastructure/di/container';
import { NoteNotFoundException } from '@/domain/exceptions/DomainException';

export class NoteController {
  static async createNote(body: unknown) {
    try {
      const useCase = container.getCreateNoteUseCase();
      
      // Basic input validation
      if (!body || typeof body !== 'object') {
        return {
          success: false,
          error: 'Invalid request body',
          status: 400,
        };
      }

      const { title, content } = body as { title?: string; content?: string };

      if (!title) {
        return {
          success: false,
          error: 'Title is required',
          status: 400,
        };
      }

      const result = await useCase.execute({
        title,
        content: content || '',
      });

      return {
        success: true,
        data: result,
        status: 201,
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  static async getNote(id: string) {
    try {
      const useCase = container.getGetNoteUseCase();
      const result = await useCase.execute({ id });

      return {
        success: true,
        data: result,
        status: 200,
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  static async listNotes() {
    try {
      const useCase = container.getListNotesUseCase();
      const result = await useCase.execute();

      return {
        success: true,
        data: result,
        status: 200,
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  static async updateNote(id: string, body: unknown) {
    try {
      const useCase = container.getUpdateNoteUseCase();

      if (!body || typeof body !== 'object') {
        return {
          success: false,
          error: 'Invalid request body',
          status: 400,
        };
      }

      const { title, content } = body as { title?: string; content?: string };

      const result = await useCase.execute({
        id,
        title,
        content,
      });

      return {
        success: true,
        data: result,
        status: 200,
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  static async deleteNote(id: string) {
    try {
      const useCase = container.getDeleteNoteUseCase();
      await useCase.execute({ id });

      return {
        success: true,
        status: 204,
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  static async searchNotes(query: string) {
    try {
      const useCase = container.getSearchNotesUseCase();
      const result = await useCase.execute({ query });

      return {
        success: true,
        data: result,
        status: 200,
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  private static handleError(error: unknown) {
    if (error instanceof NoteNotFoundException) {
      return {
        success: false,
        error: error.message,
        status: 404,
      };
    }

    if (error instanceof Error) {
      return {
        success: false,
        error: error.message,
        status: 400,
      };
    }

    return {
      success: false,
      error: 'Internal server error',
      status: 500,
    };
  }
}
