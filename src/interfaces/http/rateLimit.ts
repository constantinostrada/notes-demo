/**
 * Interface: Per-IP Rate Limiting Guard
 *
 * Throttles the HTTP API by client IP so a single caller can't overwhelm the
 * service. When a caller exceeds its allowance the request is rejected with a
 * `429 RATE_LIMITED` response that reuses the project's standard error envelope
 * (see `apiResponse.ts`) and carries a `Retry-After` header telling the client
 * how many seconds to wait before retrying.
 *
 * ── Strategy: in-memory token bucket ─────────────────────────────────────────
 * Each IP gets a bucket of `capacity` tokens (default 100). Every request spends
 * one token; tokens refill continuously at `capacity / 60s` (i.e. the bucket
 * fully refills once per minute), so the steady-state limit is ~100 req/min
 * while still tolerating a short burst up to `capacity`.
 *
 * Why token bucket (vs. a fixed window or sliding-log):
 *   - Smooths bursts: a fixed window lets a client fire 2×limit across a window
 *     boundary; the bucket's continuous refill avoids that edge.
 *   - O(1) memory and time per IP — just `{ tokens, lastRefill }`, no per-request
 *     timestamp log to scan (which a sliding-log would need).
 *   - Natural `Retry-After`: the time until the next token refills.
 *
 * Why in-memory (vs. Redis/external store):
 *   - Zero infra dependency, matching the rest of this demo (SQLite, in-process
 *     DI singletons). State lives on `globalThis` so it survives Next.js route
 *     module re-evaluation within a single server process.
 *   - Trade-off: the limit is per-process, not shared across a horizontally
 *     scaled fleet. For multi-instance deployments, swap `TokenBucketRateLimiter`
 *     for a Redis-backed implementation behind the same `enforceRateLimit` API.
 *
 * Configuration (read at request time, like the API-key guard):
 *   - `RATE_LIMIT_PER_MINUTE` — requests/minute per IP (default 100).
 *   - `RATE_LIMIT_DISABLED=true|1` — turn the guard off entirely (dev/test).
 *
 * This lives in the interfaces layer: it is a pure transport/HTTP concern and
 * never touches use cases, the domain, or persistence.
 */

import { NextRequest } from 'next/server';
import { ControllerResult, errorResult, ErrorCode } from '@/interfaces/http/apiResponse';

/** Standard HTTP header advertising how long to wait before retrying. */
export const RETRY_AFTER_HEADER = 'Retry-After';

/** Default requests-per-minute allowance per IP. */
export const DEFAULT_LIMIT_PER_MINUTE = 100;

/** Refill period: the bucket fully refills once per minute. */
const WINDOW_MS = 60_000;

/** Evict idle (fully-refilled) buckets once the map grows past this size. */
const SWEEP_THRESHOLD = 10_000;

interface Bucket {
  /** Remaining tokens (fractional; refills continuously). */
  tokens: number;
  /** Timestamp (ms) the tokens were last refilled. */
  lastRefill: number;
}

export interface RateLimitDecision {
  allowed: boolean;
  /** Seconds the client should wait before retrying (0 when allowed). */
  retryAfterSeconds: number;
}

/**
 * In-memory token-bucket rate limiter, keyed by an arbitrary string (here, IP).
 *
 * The clock is injectable (`now`) so tests can advance time deterministically
 * without sleeping.
 */
export class TokenBucketRateLimiter {
  private readonly capacity: number;
  private readonly refillPerMs: number;
  private readonly now: () => number;
  private readonly buckets = new Map<string, Bucket>();

  constructor(opts: { capacity: number; windowMs?: number; now?: () => number }) {
    this.capacity = opts.capacity;
    const windowMs = opts.windowMs ?? WINDOW_MS;
    this.refillPerMs = opts.capacity / windowMs;
    this.now = opts.now ?? Date.now;
  }

  /** Account for one request from `key` and decide whether to allow it. */
  check(key: string): RateLimitDecision {
    const now = this.now();
    let bucket = this.buckets.get(key);

    if (!bucket) {
      this.maybeSweep();
      bucket = { tokens: this.capacity, lastRefill: now };
      this.buckets.set(key, bucket);
    } else {
      // Continuously refill based on elapsed time, capped at capacity.
      const elapsed = now - bucket.lastRefill;
      if (elapsed > 0) {
        bucket.tokens = Math.min(this.capacity, bucket.tokens + elapsed * this.refillPerMs);
        bucket.lastRefill = now;
      }
    }

    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return { allowed: true, retryAfterSeconds: 0 };
    }

    // Time for the bucket to accrue the fraction of a token still needed.
    const deficit = 1 - bucket.tokens;
    const retryAfterSeconds = Math.max(1, Math.ceil(deficit / this.refillPerMs / 1000));
    return { allowed: false, retryAfterSeconds };
  }

  /** Drop all tracked buckets (used by tests). */
  reset(): void {
    this.buckets.clear();
  }

  /** Number of IPs currently tracked (used by tests). */
  size(): number {
    return this.buckets.size;
  }

  /**
   * Bound memory: when the map grows large, drop buckets that have fully
   * refilled. A full bucket is indistinguishable from a brand-new one, so
   * forgetting it is lossless.
   */
  private maybeSweep(): void {
    if (this.buckets.size < SWEEP_THRESHOLD) return;
    const now = this.now();
    for (const [key, bucket] of this.buckets) {
      const tokens = Math.min(
        this.capacity,
        bucket.tokens + (now - bucket.lastRefill) * this.refillPerMs
      );
      if (tokens >= this.capacity) this.buckets.delete(key);
    }
  }
}

/**
 * The limiter is cached on `globalThis` for the same reason the DI container
 * caches the repository: Next.js re-evaluates route modules between requests, so
 * a module-level instance would reset every time. We also remember the capacity
 * it was built with and rebuild if `RATE_LIMIT_PER_MINUTE` changes.
 */
const globalStore = globalThis as typeof globalThis & {
  __notesRateLimiter?: TokenBucketRateLimiter;
  __notesRateLimiterCapacity?: number;
};

function limitPerMinute(): number {
  const raw = process.env.RATE_LIMIT_PER_MINUTE;
  if (!raw) return DEFAULT_LIMIT_PER_MINUTE;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : DEFAULT_LIMIT_PER_MINUTE;
}

function isDisabled(): boolean {
  const raw = process.env.RATE_LIMIT_DISABLED;
  return raw === 'true' || raw === '1';
}

function getLimiter(): TokenBucketRateLimiter {
  const capacity = limitPerMinute();
  if (!globalStore.__notesRateLimiter || globalStore.__notesRateLimiterCapacity !== capacity) {
    globalStore.__notesRateLimiter = new TokenBucketRateLimiter({ capacity });
    globalStore.__notesRateLimiterCapacity = capacity;
  }
  return globalStore.__notesRateLimiter;
}

/**
 * Best-effort client IP. Behind a proxy/load balancer the real client sits in
 * `x-forwarded-for` (first hop) or `x-real-ip`; absent those we fall back to a
 * shared bucket so the guard still degrades to a global limit rather than
 * failing open per-request.
 */
export function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  const real = request.headers.get('x-real-ip')?.trim();
  if (real) return real;
  return 'unknown';
}

/**
 * Enforce the per-IP rate limit on a request.
 *
 * @returns `null` when the request is within budget (or limiting is disabled),
 *          or a `429 RATE_LIMITED` ControllerResult — including a `Retry-After`
 *          header — to return to the client when the limit is exceeded.
 */
export function enforceRateLimit(request: NextRequest): ControllerResult | null {
  if (isDisabled()) return null;

  const decision = getLimiter().check(clientIp(request));
  if (decision.allowed) return null;

  return errorResult(
    429,
    ErrorCode.RATE_LIMITED,
    'Rate limit exceeded. Please retry later.',
    undefined,
    { [RETRY_AFTER_HEADER]: String(decision.retryAfterSeconds) }
  );
}

/** Discard the process-wide limiter (used by tests for isolation). */
export function resetRateLimiter(): void {
  globalStore.__notesRateLimiter = undefined;
  globalStore.__notesRateLimiterCapacity = undefined;
}
