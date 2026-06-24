import path from 'path';
import { defineConfig } from 'vitest/config';

/**
 * Vitest configuration.
 *
 * - `node` environment: tests exercise server-side code (use cases, Next.js
 *   route handlers, the SQLite repository / better-sqlite3 native module), none
 *   of which need a DOM.
 * - `@` alias mirrors the tsconfig `paths` so `@/domain/...` etc. resolve the
 *   same way they do under Next.js.
 * - `SQLITE_DB_PATH=:memory:` makes the DI container open an ephemeral, in-process
 *   database for the whole test run, so integration tests never touch the real
 *   `data/notes.db` file (see infrastructure/SqliteNoteRepository.resolveDbPath).
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/**/*.test.ts'],
    env: {
      SQLITE_DB_PATH: ':memory:',
    },
  },
});
