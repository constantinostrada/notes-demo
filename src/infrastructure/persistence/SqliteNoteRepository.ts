/**
 * Infrastructure: SQLite Note Repository
 *
 * Real, file-backed implementation of INoteRepository using better-sqlite3.
 * Data survives process restarts (the demo's default storage).
 *
 * The repository is the ONLY place that knows about SQL or table columns:
 *   - It maps domain `Note` entities → rows on write.
 *   - It maps rows → domain `Note` entities on read (via `Note.reconstitute`).
 * Nothing SQL-shaped (rows, statements, the Database handle) ever leaves this
 * module, so the domain/application layers stay storage-agnostic.
 */

import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

import { Note } from '@/domain/entities/Note';
import {
  INoteRepository,
  NoteListCriteria,
  NotePage,
  NoteSortField,
} from '@/domain/repositories/INoteRepository';

/**
 * Whitelisted ORDER BY expressions per sort field. Mapping through this constant
 * (never interpolating caller input) keeps the dynamic ORDER BY injection-safe.
 * Titles sort case-insensitively via COLLATE NOCASE.
 */
const ORDER_EXPR: Record<NoteSortField, string> = {
  createdAt: 'n.created_at',
  updatedAt: 'n.updated_at',
  title: 'n.title COLLATE NOCASE',
};

/** Internal shape of a `notes` table row. Never exported / never leaked. */
interface NoteRow {
  id: string;
  title: string;
  content: string;
  created_at: number; // epoch milliseconds
  updated_at: number; // epoch milliseconds
}

/** Default location of the SQLite database file: `<project>/data/notes.db`. */
export const DEFAULT_DB_PATH = path.join(process.cwd(), 'data', 'notes.db');

/**
 * Resolve where the database lives. Override with the `SQLITE_DB_PATH` env var
 * (e.g. `:memory:` for tests). Storage config belongs in infrastructure.
 */
export function resolveDbPath(): string {
  return process.env.SQLITE_DB_PATH || DEFAULT_DB_PATH;
}

/**
 * Open (and if needed create) the notes database, ensuring its parent
 * directory exists and applying sensible pragmas. Returns a ready connection.
 */
export function openNotesDatabase(dbPath: string = resolveDbPath()): Database.Database {
  // better-sqlite3 won't create missing parent directories — do it ourselves.
  if (dbPath !== ':memory:') {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }

  const db = new Database(dbPath);
  // WAL improves read/write concurrency; foreign_keys is good hygiene.
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
}

export class SqliteNoteRepository implements INoteRepository {
  private readonly db: Database.Database;

  constructor(db: Database.Database = openNotesDatabase()) {
    this.db = db;
    this.initSchema();
  }

  /** Create the tables (and indexes) automatically if they don't exist yet. */
  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS notes (
        id         TEXT    PRIMARY KEY,
        title      TEXT    NOT NULL,
        content    TEXT    NOT NULL DEFAULT '',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_notes_created_at ON notes (created_at DESC);

      -- Tags are normalized into their own table (one row per note/tag pair).
      -- ON DELETE CASCADE keeps tags in lock-step with their note; the pragma
      -- 'foreign_keys = ON' (set in openNotesDatabase) makes that enforcement live.
      CREATE TABLE IF NOT EXISTS note_tags (
        note_id TEXT NOT NULL,
        tag     TEXT NOT NULL,
        PRIMARY KEY (note_id, tag),
        FOREIGN KEY (note_id) REFERENCES notes (id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_note_tags_tag ON note_tags (tag);
    `);
  }

  async save(note: Note): Promise<void> {
    // Upsert the note then fully rewrite its tags, atomically. We never
    // overwrite created_at so the original creation time is preserved.
    const persist = this.db.transaction(() => {
      this.db
        .prepare(
          `INSERT INTO notes (id, title, content, created_at, updated_at)
           VALUES (@id, @title, @content, @createdAt, @updatedAt)
           ON CONFLICT(id) DO UPDATE SET
             title      = excluded.title,
             content    = excluded.content,
             updated_at = excluded.updated_at`
        )
        .run({
          id: note.id,
          title: note.title,
          content: note.content,
          createdAt: note.createdAt.getTime(),
          updatedAt: note.updatedAt.getTime(),
        });

      // Replace-all keeps the tag set in sync on both create and update.
      this.db.prepare('DELETE FROM note_tags WHERE note_id = ?').run(note.id);
      const insertTag = this.db.prepare(
        'INSERT INTO note_tags (note_id, tag) VALUES (?, ?)'
      );
      for (const tag of note.tags) {
        insertTag.run(note.id, tag);
      }
    });

    persist();
  }

  async findById(id: string): Promise<Note | null> {
    const row = this.db.prepare('SELECT * FROM notes WHERE id = ?').get(id) as
      | NoteRow
      | undefined;
    return row ? this.toEntity(row) : null;
  }

  async findAll(): Promise<Note[]> {
    const rows = this.db
      .prepare('SELECT * FROM notes ORDER BY created_at DESC')
      .all() as NoteRow[];
    return rows.map((row) => this.toEntity(row));
  }

  async delete(id: string): Promise<boolean> {
    const info = this.db.prepare('DELETE FROM notes WHERE id = ?').run(id);
    return info.changes > 0;
  }

  async exists(id: string): Promise<boolean> {
    const row = this.db.prepare('SELECT 1 FROM notes WHERE id = ? LIMIT 1').get(id);
    return row !== undefined;
  }

  async search(query: string): Promise<Note[]> {
    // Case-insensitive substring match on title or content. LIKE is
    // case-insensitive for ASCII in SQLite; escape user wildcards so a literal
    // `%`/`_` doesn't act as a pattern.
    const pattern = `%${escapeLike(query)}%`;
    const rows = this.db
      .prepare(
        `SELECT * FROM notes
         WHERE title LIKE @pattern ESCAPE '\\' OR content LIKE @pattern ESCAPE '\\'
         ORDER BY created_at DESC`
      )
      .all({ pattern }) as NoteRow[];
    return rows.map((row) => this.toEntity(row));
  }

  async list(criteria: NoteListCriteria): Promise<NotePage> {
    const { tag, page, limit, sortField, sortDirection } = criteria;
    const offset = (page - 1) * limit;
    const orderExpr = ORDER_EXPR[sortField];
    const direction = sortDirection === 'desc' ? 'DESC' : 'ASC';

    // An optional tag filter joins the tag table; the (already-normalized) tag
    // is matched exactly against the stored canonical form.
    const joinClause = tag ? 'JOIN note_tags t ON t.note_id = n.id' : '';
    const whereClause = tag ? 'WHERE t.tag = @tag' : '';
    const filterParams = tag ? { tag } : {};

    const { total } = this.db
      .prepare(`SELECT COUNT(*) AS total FROM notes n ${joinClause} ${whereClause}`)
      .get(filterParams) as { total: number };

    // `orderExpr`/`direction` come from a fixed whitelist (never raw input);
    // `n.id` is a stable tiebreaker so equal keys page deterministically.
    const rows = this.db
      .prepare(
        `SELECT n.* FROM notes n ${joinClause} ${whereClause}
         ORDER BY ${orderExpr} ${direction}, n.id ASC
         LIMIT @limit OFFSET @offset`
      )
      .all({ ...filterParams, limit, offset }) as NoteRow[];

    return { notes: rows.map((row) => this.toEntity(row)), total };
  }

  /** Load a note's tags in stable (alphabetical) order. */
  private loadTags(noteId: string): string[] {
    const rows = this.db
      .prepare('SELECT tag FROM note_tags WHERE note_id = ? ORDER BY tag')
      .all(noteId) as { tag: string }[];
    return rows.map((row) => row.tag);
  }

  /** Map a persistence row back into a domain entity. */
  private toEntity(row: NoteRow): Note {
    return Note.reconstitute(
      row.id,
      row.title,
      row.content,
      this.loadTags(row.id),
      new Date(row.created_at),
      new Date(row.updated_at)
    );
  }
}

/** Escape LIKE special characters (`\`, `%`, `_`) for use with ESCAPE '\'. */
function escapeLike(input: string): string {
  return input.replace(/[\\%_]/g, (char) => `\\${char}`);
}
