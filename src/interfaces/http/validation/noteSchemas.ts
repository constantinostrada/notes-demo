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
import {
  NOTE_SORT_OPTIONS,
  DEFAULT_PAGE,
  DEFAULT_LIMIT,
  MAX_LIMIT,
  DEFAULT_SORT,
} from '@/application/dtos/NoteDTO';
import {
  decodeSearchCursor,
  InvalidCursorError,
} from '@/application/pagination/searchCursor';

/**
 * Tags payload: an optional array of strings. Shape-only — canonicalization
 * (trim/lowercase/de-dupe) and length/count rules live in the Note entity.
 */
const tagsSchema = z.array(z.string({ message: 'Each tag must be a string' }));

/**
 * Colour payload: an optional `#RRGGBB` hex string. Shape/format check only —
 * the same invariant is re-enforced by the Note entity. A malformed value
 * throws a ZodError → 400 VALIDATION_ERROR via the central `mapError`.
 */
const colorSchema = z
  .string({ message: 'Color must be a string' })
  .regex(/^#[0-9A-Fa-f]{6}$/, {
    message: 'Color must be a hex string in #RRGGBB format',
  });

/**
 * An optional ISO 8601 date *or* datetime filter (e.g. `2026-06-29` or
 * `2026-06-29T10:00:00Z`), parsed into a `Date`. A malformed value throws a
 * ZodError → 400 VALIDATION_ERROR via the central `mapError`. Bare dates are
 * read as UTC midnight, matching how timestamps are stored.
 */
const isoDateFilter = (field: string) =>
  z
    .union([z.iso.datetime(), z.iso.date()], {
      message: `${field} must be an ISO 8601 date or datetime`,
    })
    .transform((value) => new Date(value))
    .optional();

/** Body for POST /api/v1/notes */
export const createNoteSchema = z.object({
  title: z
    .string({ message: 'Title is required and must be a string' })
    .trim()
    .min(1, { message: 'Title is required' }),
  content: z.string({ message: 'Content must be a string' }).optional().default(''),
  tags: tagsSchema.optional().default([]),
  color: colorSchema.optional(),
});

/** Body for PUT /api/v1/notes/:id (partial update; at least one field) */
export const updateNoteSchema = z
  .object({
    title: z.string().trim().min(1, { message: 'Title cannot be empty' }).optional(),
    content: z.string().optional(),
    tags: tagsSchema.optional(),
    color: colorSchema.optional(),
  })
  .refine(
    (data) =>
      data.title !== undefined ||
      data.content !== undefined ||
      data.tags !== undefined ||
      data.color !== undefined,
    {
      message: 'Provide at least one field to update (title, content, tags or color)',
    }
  );

/**
 * Body for PUT /api/v1/notes/:id/reminder. `dueAt` sets the reminder when given
 * an ISO 8601 date or datetime (parsed to a `Date`), or clears it when `null`.
 * The key is required (present but nullable): a malformed or missing value
 * yields a 400 VALIDATION_ERROR via the central `mapError`. Bare dates are read
 * as UTC midnight, matching how timestamps are stored/compared (server UTC).
 */
export const reminderSchema = z.object({
  dueAt: z
    .union([z.iso.datetime(), z.iso.date()], {
      message: 'dueAt must be an ISO 8601 date or datetime, or null',
    })
    .transform((value) => new Date(value))
    .nullable(),
});

/**
 * Query params for GET /api/v1/notes — all optional, each with a sensible
 * default. Values arrive as strings from the URL, so `page`/`limit` are coerced
 * to integers and bounded; `sort` is constrained to the known tokens.
 */
export const listNotesSchema = z.object({
  tag: z.string().trim().min(1, { message: 'Tag filter cannot be empty' }).optional(),
  // Optional inclusive created-at bounds (combine with tag/archived). Each is an
  // ISO 8601 date or datetime; an invalid value yields a 400 VALIDATION_ERROR.
  createdAfter: isoDateFilter('createdAfter'),
  createdBefore: isoDateFilter('createdBefore'),
  page: z.coerce
    .number({ message: 'page must be a number' })
    .int({ message: 'page must be an integer' })
    .min(1, { message: 'page must be >= 1' })
    .default(DEFAULT_PAGE),
  limit: z.coerce
    .number({ message: 'limit must be a number' })
    .int({ message: 'limit must be an integer' })
    .min(1, { message: 'limit must be >= 1' })
    .max(MAX_LIMIT, { message: `limit cannot exceed ${MAX_LIMIT}` })
    .default(DEFAULT_LIMIT),
  sort: z
    .enum(NOTE_SORT_OPTIONS, {
      message: `sort must be one of: ${NOTE_SORT_OPTIONS.join(', ')}`,
    })
    .default(DEFAULT_SORT),
  // Query values arrive as strings; accept the literal 'true'/'false' tokens and
  // coerce to a boolean. Absent → defaults to false (archived notes hidden).
  includeArchived: z
    .enum(['true', 'false'], {
      message: "includeArchived must be 'true' or 'false'",
    })
    .transform((value) => value === 'true')
    .default(false),
});

/**
 * Query params for GET /api/v1/notes/count — the listing's filter knobs only
 * (tag / created-at range / includeArchived); pagination and sort don't affect
 * a count. Reuses the listing field definitions so validation stays in lock-step.
 */
export const countNotesSchema = listNotesSchema.pick({
  tag: true,
  createdAfter: true,
  createdBefore: true,
  includeArchived: true,
});

/**
 * Query params for GET /api/v1/notes/search. `q` is required and non-empty.
 * `limit` reuses the listing's bounds; `cursor` is an opaque pagination token
 * decoded here (at the edge) into the keyset position the use case consumes — a
 * malformed token yields a 400 VALIDATION_ERROR like any other bad input.
 */
export const searchNotesSchema = z.object({
  q: z
    .string({ message: 'Search query (q) is required and must be a string' })
    .trim()
    .min(1, { message: 'Search query (q) cannot be empty' }),
  limit: z.coerce
    .number({ message: 'limit must be a number' })
    .int({ message: 'limit must be an integer' })
    .min(1, { message: 'limit must be >= 1' })
    .max(MAX_LIMIT, { message: `limit cannot exceed ${MAX_LIMIT}` })
    .default(DEFAULT_LIMIT),
  cursor: z
    .string({ message: 'cursor must be a string' })
    .transform((value, ctx) => {
      try {
        return decodeSearchCursor(value);
      } catch (error) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            error instanceof InvalidCursorError ? error.message : 'cursor is invalid',
        });
        return z.NEVER;
      }
    })
    .optional(),
});

/**
 * Query params for GET /api/v1/notes/pinned. Same cursor pagination as search
 * (`limit` bounds + opaque `cursor` decoded at the edge), minus the `q` term —
 * the listing is implicitly filtered to pinned notes.
 */
export const pinnedNotesSchema = searchNotesSchema.omit({ q: true });

/**
 * One note inside an import payload. Shape-only validation: business invariants
 * (title length, tag rules) stay in the Note entity. `id`/timestamps are
 * optional so an export snapshot can be re-imported unchanged — when present
 * they must be well-formed (UUID / ISO 8601). Unknown keys (e.g. the export's
 * derived `wordCount`) are stripped, so a round-trip "just works".
 */
const importNoteSchema = z.object({
  id: z.uuid({ message: 'id must be a valid UUID' }).optional(),
  title: z
    .string({ message: 'Title is required and must be a string' })
    .trim()
    .min(1, { message: 'Title is required' }),
  content: z.string({ message: 'Content must be a string' }).optional().default(''),
  tags: tagsSchema.optional().default([]),
  createdAt: z.iso
    .datetime({ message: 'createdAt must be an ISO 8601 datetime' })
    .optional(),
  updatedAt: z.iso
    .datetime({ message: 'updatedAt must be an ISO 8601 datetime' })
    .optional(),
  deletedAt: z.iso
    .datetime({ message: 'deletedAt must be an ISO 8601 datetime' })
    .nullable()
    .optional(),
  color: colorSchema.nullable().optional(),
  isPinned: z.boolean({ message: 'isPinned must be a boolean' }).optional(),
});

/** Body for POST /api/v1/notes/import (a non-empty array under `notes`). */
export const importNotesSchema = z.object({
  notes: z
    .array(importNoteSchema, { message: 'notes must be an array of notes' })
    .min(1, { message: 'Provide at least one note to import' }),
});

export type CreateNotePayload = z.infer<typeof createNoteSchema>;
export type UpdateNotePayload = z.infer<typeof updateNoteSchema>;
export type SearchNotesQuery = z.infer<typeof searchNotesSchema>;
export type ListNotesQuery = z.infer<typeof listNotesSchema>;
export type PinnedNotesQuery = z.infer<typeof pinnedNotesSchema>;
export type CountNotesQuery = z.infer<typeof countNotesSchema>;
export type ReminderPayload = z.infer<typeof reminderSchema>;
export type ImportNotesPayload = z.infer<typeof importNotesSchema>;
