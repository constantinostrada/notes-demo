/**
 * Interface: Note payload schemas (zod)
 *
 * Structural/shape validation for incoming HTTP payloads. This layer checks
 * that the request is well-formed (required fields, correct types); business
 * invariants (e.g. max title length) remain enforced by the domain entity.
 *
 * A failed `.parse()` throws a ZodError, which the central `mapError` turns
 * into a 400 VALIDATION_ERROR response.
 */

import { z } from 'zod';

/**
 * Tags payload: an optional array of strings. Shape-only — canonicalization
 * (trim/lowercase/de-dupe) and length/count rules live in the Note entity.
 */
const tagsSchema = z.array(z.string({ message: 'Each tag must be a string' }));

/** Body for POST /api/v1/notes */
export const createNoteSchema = z.object({
  title: z
    .string({ message: 'Title is required and must be a string' })
    .trim()
    .min(1, { message: 'Title is required' }),
  content: z.string({ message: 'Content must be a string' }).optional().default(''),
  tags: tagsSchema.optional().default([]),
});

/** Body for PUT /api/v1/notes/:id (partial update; at least one field) */
export const updateNoteSchema = z
  .object({
    title: z.string().trim().min(1, { message: 'Title cannot be empty' }).optional(),
    content: z.string().optional(),
    tags: tagsSchema.optional(),
  })
  .refine(
    (data) =>
      data.title !== undefined || data.content !== undefined || data.tags !== undefined,
    {
      message: 'Provide at least one field to update (title, content or tags)',
    }
  );

/** Query params for GET /api/v1/notes (`tag` is an optional filter). */
export const listNotesSchema = z.object({
  tag: z.string().trim().min(1, { message: 'Tag filter cannot be empty' }).optional(),
});

/** Query params for GET /api/v1/notes/search (`q` is required, non-empty). */
export const searchNotesSchema = z.object({
  q: z
    .string({ message: 'Search query (q) is required and must be a string' })
    .trim()
    .min(1, { message: 'Search query (q) cannot be empty' }),
});

export type CreateNotePayload = z.infer<typeof createNoteSchema>;
export type UpdateNotePayload = z.infer<typeof updateNoteSchema>;
export type SearchNotesQuery = z.infer<typeof searchNotesSchema>;
export type ListNotesQuery = z.infer<typeof listNotesSchema>;
