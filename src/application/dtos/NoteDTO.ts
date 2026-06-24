/**
 * Application DTOs (Data Transfer Objects)
 * 
 * Contracts for data flowing in and out of use cases.
 * DTOs decouple the application layer from domain entities.
 */

export interface CreateNoteInputDTO {
  title: string;
  content: string;
  tags?: string[];
}

export interface UpdateNoteInputDTO {
  id: string;
  title?: string;
  content?: string;
  tags?: string[];
}

export interface NoteOutputDTO {
  id: string;
  title: string;
  content: string;
  tags: string[];
  wordCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface DeleteNoteInputDTO {
  id: string;
}

export interface GetNoteInputDTO {
  id: string;
}

export interface SearchNotesInputDTO {
  query: string;
}

export interface ListNotesInputDTO {
  /** Optional tag filter; when present, only notes with this tag are returned. */
  tag?: string;
}

export interface ListNotesOutputDTO {
  notes: NoteOutputDTO[];
  total: number;
}
