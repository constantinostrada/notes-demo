import { describe, expect, it } from 'vitest';

import { encodeListCursor, decodeListCursor } from '@/application/pagination/listCursor';
import { InvalidCursorError } from '@/application/pagination/searchCursor';
import { ListCursor } from '@/domain/repositories/INoteRepository';

describe('listCursor codec', () => {
  it('round-trips a createdAt cursor through encode/decode', () => {
    const cursor: ListCursor = {
      sortField: 'createdAt',
      direction: 'desc',
      value: 1_700_000_000_000,
      id: 'abc-123',
    };
    const token = encodeListCursor(cursor);

    expect(typeof token).toBe('string');
    expect(decodeListCursor(token)).toEqual(cursor);
  });

  it('round-trips a title cursor, preserving unusual characters', () => {
    // JSON encoding keeps any character (colon, quotes, unicode) intact.
    const cursor: ListCursor = {
      sortField: 'title',
      direction: 'asc',
      value: 'weird: "title" — ünïçode',
      id: 'id-1',
    };
    expect(decodeListCursor(encodeListCursor(cursor))).toEqual(cursor);
  });

  it('rejects a non-base64/non-JSON token', () => {
    expect(() => decodeListCursor('!!! not valid !!!')).toThrow(InvalidCursorError);
  });

  it('rejects an unknown sort field', () => {
    const bad = Buffer.from(
      JSON.stringify({ f: 'updatedAt', d: 'asc', v: 1, id: 'x' }),
      'utf8'
    ).toString('base64url');
    expect(() => decodeListCursor(bad)).toThrow(InvalidCursorError);
  });

  it('rejects an unknown direction', () => {
    const bad = Buffer.from(
      JSON.stringify({ f: 'title', d: 'sideways', v: 'a', id: 'x' }),
      'utf8'
    ).toString('base64url');
    expect(() => decodeListCursor(bad)).toThrow(InvalidCursorError);
  });

  it('rejects an empty id', () => {
    const bad = Buffer.from(
      JSON.stringify({ f: 'title', d: 'asc', v: 'a', id: '' }),
      'utf8'
    ).toString('base64url');
    expect(() => decodeListCursor(bad)).toThrow(InvalidCursorError);
  });

  it('rejects a createdAt cursor whose value is not an integer', () => {
    const bad = Buffer.from(
      JSON.stringify({ f: 'createdAt', d: 'asc', v: 'not-a-number', id: 'x' }),
      'utf8'
    ).toString('base64url');
    expect(() => decodeListCursor(bad)).toThrow(InvalidCursorError);
  });

  it('rejects a title cursor whose value is not a string', () => {
    const bad = Buffer.from(
      JSON.stringify({ f: 'title', d: 'asc', v: 123, id: 'x' }),
      'utf8'
    ).toString('base64url');
    expect(() => decodeListCursor(bad)).toThrow(InvalidCursorError);
  });
});
