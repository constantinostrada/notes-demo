import { describe, expect, it } from 'vitest';

import {
  encodeSearchCursor,
  decodeSearchCursor,
  InvalidCursorError,
} from '@/application/pagination/searchCursor';

describe('searchCursor codec', () => {
  it('round-trips a cursor through encode/decode', () => {
    const cursor = { createdAt: 1_700_000_000_000, id: 'abc-123' };
    const token = encodeSearchCursor(cursor);

    expect(typeof token).toBe('string');
    expect(decodeSearchCursor(token)).toEqual(cursor);
  });

  it('preserves ids that contain unusual characters', () => {
    // The id is everything after the first ':' — a colon inside it survives.
    const cursor = { createdAt: 42, id: 'weird:id-with-colon' };
    expect(decodeSearchCursor(encodeSearchCursor(cursor))).toEqual(cursor);
  });

  it('rejects a token with no separator', () => {
    const bad = Buffer.from('no-separator', 'utf8').toString('base64url');
    expect(() => decodeSearchCursor(bad)).toThrow(InvalidCursorError);
  });

  it('rejects a token with a non-numeric timestamp', () => {
    const bad = Buffer.from('notanumber:abc', 'utf8').toString('base64url');
    expect(() => decodeSearchCursor(bad)).toThrow(InvalidCursorError);
  });

  it('rejects a token with an empty id', () => {
    const bad = Buffer.from('123:', 'utf8').toString('base64url');
    expect(() => decodeSearchCursor(bad)).toThrow(InvalidCursorError);
  });
});
