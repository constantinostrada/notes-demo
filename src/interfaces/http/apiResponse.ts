/**
 * Interface: HTTP Response Contract
 *
 * Single source of truth for the API's response envelope and error mapping.
 * Reused by every controller/route so success and error payloads stay uniform.
 *
 * ── Response shapes ──────────────────────────────────────────────────────────
 *   Success (2xx):   { "data": <payload> }
 *   Error   (4xx/5xx): { "error": { "code": string, "message": string,
 *                                     "details"?: [{ path, message }] } }
 *   204 No Content:  empty body
 *
 * The HTTP status code is authoritative; clients branch on `response.ok`.
 *
 * Mapping of errors → status:
 *   ZodError (invalid payload) ............ 400 VALIDATION_ERROR
 *   missing/invalid API key ............... 401 UNAUTHORIZED (see http/auth.ts)
 *   NoteNotFoundException ................. 404 NOTE_NOT_FOUND
 *   InvalidNoteException (broken invariant) 422 INVALID_NOTE
 *   other DomainException ................. 400 DOMAIN_ERROR
 *   too many requests ..................... 429 RATE_LIMITED (see http/rateLimit.ts)
 *   anything else (bug) .................... 500 INTERNAL_ERROR
 *
 * A ControllerResult may carry response `headers` (e.g. `Retry-After` on a 429);
 * `toNextResponse` copies them onto the outgoing response.
 */

import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import {
  DomainException,
  NoteNotFoundException,
  InvalidNoteException,
} from '@/domain/exceptions/DomainException';

/** Machine-readable, stable error codes returned to clients. */
export const ErrorCode = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  NOTE_NOT_FOUND: 'NOTE_NOT_FOUND',
  INVALID_NOTE: 'INVALID_NOTE',
  DOMAIN_ERROR: 'DOMAIN_ERROR',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

/** Field-level detail, used mainly for validation errors. */
export interface ApiErrorDetail {
  path: string;
  message: string;
}

export interface ApiErrorBody {
  error: {
    code: ErrorCode;
    message: string;
    details?: ApiErrorDetail[];
  };
}

export interface ApiSuccessBody<T = unknown> {
  data: T;
}

/**
 * What a controller method returns: an HTTP status plus the JSON body to send
 * (or `null` for a body-less response such as 204).
 */
export interface ControllerResult {
  status: number;
  body: ApiSuccessBody | ApiErrorBody | null;
  /** Extra response headers (e.g. `Retry-After` on a 429). */
  headers?: Record<string, string>;
}

/** Build a success result. */
export function ok<T>(data: T, status = 200): ControllerResult {
  return { status, body: { data } };
}

/** Build a body-less result (e.g. 204 No Content). */
export function noContent(): ControllerResult {
  return { status: 204, body: null };
}

/** Build an error result from an explicit code/message. */
export function errorResult(
  status: number,
  code: ErrorCode,
  message: string,
  details?: ApiErrorDetail[],
  headers?: Record<string, string>
): ControllerResult {
  return {
    status,
    body: { error: { code, message, ...(details ? { details } : {}) } },
    ...(headers ? { headers } : {}),
  };
}

/**
 * Central error → response mapper. Turns any thrown error into a uniform
 * `{ status, body: { error } }` result. This is the only place that decides
 * which HTTP status a domain/validation error maps to.
 */
export function mapError(error: unknown): ControllerResult {
  if (error instanceof ZodError) {
    const details = error.issues.map((issue) => ({
      path: issue.path.join('.') || '(root)',
      message: issue.message,
    }));
    return errorResult(400, ErrorCode.VALIDATION_ERROR, 'Request payload is invalid', details);
  }

  if (error instanceof NoteNotFoundException) {
    return errorResult(404, ErrorCode.NOTE_NOT_FOUND, error.message);
  }

  if (error instanceof InvalidNoteException) {
    return errorResult(422, ErrorCode.INVALID_NOTE, error.message);
  }

  if (error instanceof DomainException) {
    return errorResult(400, ErrorCode.DOMAIN_ERROR, error.message);
  }

  // Unknown/unexpected error: never leak internals to the client.
  return errorResult(500, ErrorCode.INTERNAL_ERROR, 'Internal server error');
}

/** Serialize a ControllerResult into a Next.js response. */
export function toNextResponse(result: ControllerResult): NextResponse {
  const init = {
    status: result.status,
    ...(result.headers ? { headers: result.headers } : {}),
  };
  if (result.body === null) {
    return new NextResponse(null, init);
  }
  return NextResponse.json(result.body, init);
}
