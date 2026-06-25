/**
 * Interface: API Key Authentication Guard
 *
 * Lightweight middleware that protects the write endpoints (POST/PUT/DELETE).
 * Callers present a shared secret in the `x-api-key` header; requests without a
 * valid key are rejected with a `401 UNAUTHORIZED` response that reuses the
 * project's standard error envelope (see `apiResponse.ts`).
 *
 * Configuration
 * ─────────────
 * The expected key is read from the `API_KEY` environment variable at request
 * time (not module-load time, so tests can set/unset it per case). When
 * `API_KEY` is unset or empty the guard is DISABLED and lets every request
 * through — this keeps local development and the test suite friction-free while
 * still enforcing the key in any environment that configures one. Set `API_KEY`
 * in production to require authentication for all writes.
 *
 * This lives in the interfaces layer: it is a pure transport/HTTP concern and
 * never touches use cases, the domain, or persistence.
 */

import { NextRequest } from 'next/server';
import { ControllerResult, errorResult, ErrorCode } from '@/interfaces/http/apiResponse';

/** Header that carries the shared API key. */
export const API_KEY_HEADER = 'x-api-key';

/**
 * Enforce the API key on a request.
 *
 * @returns `null` when the request is authorized (no key configured, or a valid
 *          key was supplied), or a `401 UNAUTHORIZED` ControllerResult to return
 *          to the client when the key is missing or wrong.
 */
export function requireApiKey(request: NextRequest): ControllerResult | null {
  const configuredKey = process.env.API_KEY;

  // No key configured → authentication is disabled (dev/test convenience).
  if (!configuredKey) {
    return null;
  }

  const providedKey = request.headers.get(API_KEY_HEADER);
  if (providedKey !== null && providedKey === configuredKey) {
    return null;
  }

  return errorResult(
    401,
    ErrorCode.UNAUTHORIZED,
    'Missing or invalid API key'
  );
}
