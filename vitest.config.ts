import path from 'path';
import { defineConfig } from 'vitest/config';

/**
 * Vitest configuration.
 *
 * - `node` environment: tests exercise server-side code (use cases, Next.js
 *   route handlers, the SQLite repository / built-in node:sqlite module), none
 *   of which need a DOM.
 * - `@` alias mirrors the tsconfig `paths` so `@/domain/...` etc. resolve the
 *   same way they do under Next.js.
 * - `SQLITE_DB_PATH=:memory:` makes the DI container open an ephemeral, in-process
 *   database for the whole test run, so integration tests never touch the real
 *   `data/notes.db` file (see infrastructure/SqliteNoteRepository.resolveDbPath).
 */
export default defineConfig({
  // Vitest's bundled Vite (5.4) predates `node:sqlite` and doesn't recognise it
  // as a Node builtin: it strips the `node:` prefix and tries to load `sqlite`
  // as a file (`Failed to load url sqlite`). Rather than fight Vite's resolver,
  // we map the import to a tiny virtual module that pulls the real builtin at
  // runtime via `process.getBuiltinModule` (Node ≥ 22.3) — a call Vite never
  // tries to resolve or transform. This only affects the test runner; the
  // production build imports `node:sqlite` directly (see next.config.js).
  plugins: [
    {
      name: 'node-sqlite-virtual',
      enforce: 'pre',
      resolveId(id) {
        if (id === 'node:sqlite' || id === 'sqlite') {
          return '\0virtual:node-sqlite';
        }
        return null;
      },
      load(id) {
        if (id === '\0virtual:node-sqlite') {
          return [
            "const sqlite = process.getBuiltinModule('node:sqlite');",
            'export const DatabaseSync = sqlite.DatabaseSync;',
            'export const StatementSync = sqlite.StatementSync;',
            'export default sqlite;',
          ].join('\n');
        }
        return null;
      },
    },
  ],
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
      // Rate limiting is off by default for the suite so the per-IP limiter's
      // process-wide state can't make unrelated tests flaky. The dedicated
      // rate-limit test re-enables it per case (the guard reads env at request
      // time, like the API-key guard).
      RATE_LIMIT_DISABLED: 'true',
    },
  },
});
