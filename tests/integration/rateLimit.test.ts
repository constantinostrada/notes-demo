import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { container } from '@/infrastructure/di/container';
import { GET as listNotes } from '@/app/api/v1/notes/route';
import { resetRateLimiter, RETRY_AFTER_HEADER } from '@/interfaces/http/rateLimit';

/**
 * Integration tests for the per-IP rate-limit guard on the HTTP API.
 *
 * The suite disables rate limiting globally (RATE_LIMIT_DISABLED=true, see
 * vitest.config.ts) so the process-wide limiter can't leak state between
 * unrelated tests. Here we re-enable it per case with a small limit and reset
 * the limiter between tests for isolation. The guard reads env at request time,
 * exactly like the API-key guard.
 *
 * We exercise GET /api/v1/notes (a read endpoint) because rate limiting applies
 * to every request regardless of auth, and reads need no API key.
 */

const BASE = 'http://localhost/api/v1/notes';

/** A request from a specific client IP (via x-forwarded-for). */
function requestFrom(ip: string): NextRequest {
  return new NextRequest(BASE, { headers: { 'x-forwarded-for': ip } });
}

let previousDisabled: string | undefined;
let previousLimit: string | undefined;

beforeEach(async () => {
  previousDisabled = process.env.RATE_LIMIT_DISABLED;
  previousLimit = process.env.RATE_LIMIT_PER_MINUTE;

  // Turn limiting ON with a small budget so the limit is easy to hit.
  delete process.env.RATE_LIMIT_DISABLED;
  process.env.RATE_LIMIT_PER_MINUTE = '3';
  resetRateLimiter();

  const repository = container.getNoteRepository();
  for (const note of await repository.findAll()) {
    await repository.delete(note.id);
  }
});

afterEach(() => {
  if (previousDisabled === undefined) delete process.env.RATE_LIMIT_DISABLED;
  else process.env.RATE_LIMIT_DISABLED = previousDisabled;

  if (previousLimit === undefined) delete process.env.RATE_LIMIT_PER_MINUTE;
  else process.env.RATE_LIMIT_PER_MINUTE = previousLimit;

  resetRateLimiter();
});

describe('Per-IP rate limiting', () => {
  it('returns 429 with the error envelope and Retry-After once the limit is exceeded', async () => {
    // Spend the whole budget (limit = 3).
    for (let i = 0; i < 3; i += 1) {
      const ok = await listNotes(requestFrom('1.2.3.4'));
      expect(ok.status).toBe(200);
    }

    // The next request from the same IP is throttled.
    const res = await listNotes(requestFrom('1.2.3.4'));
    expect(res.status).toBe(429);

    // Standard project error envelope.
    const { error } = await res.json();
    expect(error.code).toBe('RATE_LIMITED');
    expect(typeof error.message).toBe('string');

    // Retry-After header present and a positive integer number of seconds.
    const retryAfter = res.headers.get(RETRY_AFTER_HEADER);
    expect(retryAfter).not.toBeNull();
    expect(Number(retryAfter)).toBeGreaterThanOrEqual(1);
  });

  it('limits each IP independently', async () => {
    for (let i = 0; i < 3; i += 1) {
      expect((await listNotes(requestFrom('10.0.0.1'))).status).toBe(200);
    }
    // First IP is now throttled...
    expect((await listNotes(requestFrom('10.0.0.1'))).status).toBe(429);
    // ...but a different IP still has its full budget.
    expect((await listNotes(requestFrom('10.0.0.2'))).status).toBe(200);
  });

  it('does nothing when disabled via env', async () => {
    process.env.RATE_LIMIT_DISABLED = 'true';
    resetRateLimiter();

    // Far more requests than the configured limit, all allowed.
    for (let i = 0; i < 10; i += 1) {
      expect((await listNotes(requestFrom('9.9.9.9'))).status).toBe(200);
    }
  });
});
