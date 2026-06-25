import { describe, expect, it } from 'vitest';

import { TokenBucketRateLimiter } from '@/interfaces/http/rateLimit';

/**
 * Unit tests for the token-bucket limiter in isolation. The clock is injected so
 * we can advance time deterministically instead of sleeping.
 */
describe('TokenBucketRateLimiter', () => {
  it('allows up to `capacity` requests then denies', () => {
    let now = 1_000;
    const limiter = new TokenBucketRateLimiter({ capacity: 3, now: () => now });

    expect(limiter.check('ip').allowed).toBe(true);
    expect(limiter.check('ip').allowed).toBe(true);
    expect(limiter.check('ip').allowed).toBe(true);

    const denied = limiter.check('ip');
    expect(denied.allowed).toBe(false);
    expect(denied.retryAfterSeconds).toBeGreaterThanOrEqual(1);
  });

  it('tracks buckets independently per key', () => {
    let now = 0;
    const limiter = new TokenBucketRateLimiter({ capacity: 1, now: () => now });

    expect(limiter.check('a').allowed).toBe(true);
    expect(limiter.check('a').allowed).toBe(false); // a is exhausted...
    expect(limiter.check('b').allowed).toBe(true); // ...but b is fresh
  });

  it('refills continuously over time', () => {
    let now = 0;
    // capacity 60 over a 60s window → 1 token per second.
    const limiter = new TokenBucketRateLimiter({
      capacity: 60,
      windowMs: 60_000,
      now: () => now,
    });

    // Drain the bucket.
    for (let i = 0; i < 60; i += 1) expect(limiter.check('ip').allowed).toBe(true);
    expect(limiter.check('ip').allowed).toBe(false);

    // After 1 second, exactly one token should have refilled.
    now += 1_000;
    expect(limiter.check('ip').allowed).toBe(true);
    expect(limiter.check('ip').allowed).toBe(false);
  });

  it('reports a Retry-After that lets the next request through', () => {
    let now = 0;
    const limiter = new TokenBucketRateLimiter({
      capacity: 10,
      windowMs: 60_000,
      now: () => now,
    });

    for (let i = 0; i < 10; i += 1) limiter.check('ip');
    const denied = limiter.check('ip');
    expect(denied.allowed).toBe(false);

    // Waiting the advertised Retry-After must make the next request succeed.
    now += denied.retryAfterSeconds * 1_000;
    expect(limiter.check('ip').allowed).toBe(true);
  });
});
