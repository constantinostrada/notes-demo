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

/** Body for POST /api/v1/notes */
export const createNoteSchema = z.object({
  title: z
    .string({ message: 'Title is required and must be a string' })
    .trim()
    .min(1, { message: 'Title is required' }),
  content: z.string({ message: 'Content must be a string' }).optional().default(''),
});

/** Body for PUT /api/v1/notes/:id (partial update; at least one field) */
export const updateNoteSchema = z
  .object({
    title: z.string().trim().min(1, { message: 'Title cannot be empty' }).optional(),
    content: z.string().optional(),
  })
  .refine((data) => data.title !== undefined || data.content !== undefined, {
    message: 'Provide at least one field to update (title or content)',
  });

export type CreateNotePayload = z.infer<typeof createNoteSchema>;
export type UpdateNotePayload = z.infer<typeof updateNoteSchema>;
