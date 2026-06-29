/**
 * Infrastructure: SQLite Note Repository
 *
 * Real, file-backed implementation of INoteRepository using Node's built-in
 * `node:sqlite` module (no external dependency). Data survives process restarts
 * (the demo's default storage).
 *
 * The repository is the ONLY place that knows about SQL or table columns:
 *   - It maps domain `Note` entities → rows on write.
 *   - It maps rows → domain `Note` entities on read (via `Note.reconstitute`).
 * Nothing SQL-shaped (rows, statements, the Database handle) ever leaves this
 * module, so the domain/application layers stay storage-agnostic.
 */

import fs from 'fs';
import path from 'path';
import { DatabaseSync } from 'node:sqlite';

import { Note } from '@/domain/entities/Note';
import {
  INoteRepository,
  NoteCountCriteria,
  NoteFilterCriteria,
  NoteListCriteria,
  NotePage,
  NotePinnedCriteria,
  NoteSearchCriteria,
  NoteSearchPage,
  NoteSortField,
  SearchCursor,
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
  deleted_at: number | null; // epoch milliseconds; null when active (not archived)
  color: string | null; // `#RRGGBB` hex string; null when no colour set
  is_pinned: number; // 0/1 boolean flag; 1 when the note is pinned
  due_at: number | null; // epoch milliseconds; null when no reminder set
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
export function openNotesDatabase(dbPath: string = resolveDbPath()): DatabaseSync {
  // node:sqlite won't create missing parent directories — do it ourselves.
  if (dbPath !== ':memory:') {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }

  const db = new DatabaseSync(dbPath);
  // node:sqlite has no `.pragma()` helper — run the PRAGMA statements directly.
  // WAL improves read/write concurrency; foreign_keys is good hygiene.
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');
  return db;
}

export class SqliteNoteRepository implements INoteRepository {
  private readonly db: DatabaseSync;

  constructor(db: DatabaseSync = openNotesDatabase()) {
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
        updated_at INTEGER NOT NULL,
        deleted_at INTEGER,
        color      TEXT,
        is_pinned  INTEGER NOT NULL DEFAULT 0,
        due_at     INTEGER
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

    // In-place migrations: databases created before a column existed are
    // upgraded here (CREATE TABLE IF NOT EXISTS won't add columns to a table
    // that already exists). Each is additive and nullable, so existing rows
    // keep their data untouched.
    this.ensureColumn('deleted_at', 'INTEGER');
    this.ensureColumn('color', 'TEXT');
    // NOT NULL is allowed on ALTER because a DEFAULT backfills existing rows.
    this.ensureColumn('is_pinned', 'INTEGER NOT NULL DEFAULT 0');
    this.ensureColumn('due_at', 'INTEGER');
  }

  /** Add a nullable `column` of the given SQL `type` to `notes` if it's missing. */
  private ensureColumn(column: string, type: string): void {
    const columns = this.db.prepare('PRAGMA table_info(notes)').all() as {
      name: string;
    }[];
    if (!columns.some((existing) => existing.name === column)) {
      this.db.exec(`ALTER TABLE notes ADD COLUMN ${column} ${type}`);
    }
  }

  /**
   * Run `fn` inside a single SQLite transaction. node:sqlite has no
   * `db.transaction()` helper (unlike better-sqlite3), so we drive
   * BEGIN/COMMIT/ROLLBACK by hand and roll back on any thrown error.
   */
  private transaction(fn: () => void): void {
    this.db.exec('BEGIN');
    try {
      fn();
      this.db.exec('COMMIT');
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }
  }

  async save(note: Note): Promise<void> {
    // Upsert the note then fully rewrite its tags, atomically. We never
    // overwrite created_at so the original creation time is preserved.
    this.transaction(() => {
      this.db
        .prepare(
          `INSERT INTO notes (id, title, content, created_at, updated_at, deleted_at, color, is_pinned, due_at)
           VALUES (@id, @title, @content, @createdAt, @updatedAt, @deletedAt, @color, @isPinned, @dueAt)
           ON CONFLICT(id) DO UPDATE SET
             title      = excluded.title,
             content    = excluded.content,
             updated_at = excluded.updated_at,
             deleted_at = excluded.deleted_at,
             color      = excluded.color,
             is_pinned  = excluded.is_pinned,
             due_at     = excluded.due_at`
        )
        .run({
          id: note.id,
          title: note.title,
          content: note.content,
          createdAt: note.createdAt.getTime(),
          updatedAt: note.updatedAt.getTime(),
          deletedAt: note.deletedAt ? note.deletedAt.getTime() : null,
          color: note.color,
          isPinned: note.isPinned ? 1 : 0,
          dueAt: note.dueAt ? note.dueAt.getTime() : null,
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
      .all() as unknown as NoteRow[];
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

  async search(criteria: NoteSearchCriteria): Promise<NoteSearchPage> {
    const { query, limit, cursor } = criteria;

    // Case-insensitive substring match on title or content. LIKE is
    // case-insensitive for ASCII in SQLite; escape user wildcards so a literal
    // `%`/`_` doesn't act as a pattern.
    const pattern = `%${escapeLike(query)}%`;
    const params: Record<string, string | number> = { pattern };

    // Keyset cursor: only rows strictly after the cursor in the
    // (created_at DESC, id ASC) ordering — an older note, or the same instant
    // with a higher id. This keeps paging stable with no skipped/duplicated rows.
    let cursorClause = '';
    if (cursor) {
      cursorClause =
        'AND (created_at < @cursorCreatedAt OR (created_at = @cursorCreatedAt AND id > @cursorId))';
      params.cursorCreatedAt = cursor.createdAt;
      params.cursorId = cursor.id;
    }

    // Over-fetch one row to learn whether a further page exists without a
    // separate COUNT. `id ASC` is the stable tiebreaker for equal timestamps.
    // Archived (soft-deleted) notes are excluded — search is a read endpoint and
    // must never surface notes carrying a deleted_at tombstone.
    const rows = this.db
      .prepare(
        `SELECT * FROM notes
         WHERE (title LIKE @pattern ESCAPE '\\' OR content LIKE @pattern ESCAPE '\\')
         AND deleted_at IS NULL
         ${cursorClause}
         ORDER BY created_at DESC, id ASC
         LIMIT @limitPlusOne`
      )
      .all({ ...params, limitPlusOne: limit + 1 }) as unknown as NoteRow[];

    const hasMore = rows.length > limit;
    const pageRows = hasMore ? rows.slice(0, limit) : rows;
    const notes = pageRows.map((row) => this.toEntity(row));

    const lastRow = pageRows[pageRows.length - 1];
    const nextCursor: SearchCursor | null =
      hasMore && lastRow ? { createdAt: lastRow.created_at, id: lastRow.id } : null;

    return { notes, nextCursor };
  }

  async listPinned(criteria: NotePinnedCriteria): Promise<NoteSearchPage> {
    const { limit, cursor } = criteria;
    const params: Record<string, string | number> = {};

    // Same keyset model as search: only rows strictly after the cursor in the
    // (created_at DESC, id ASC) ordering, so paging never skips/duplicates.
    let cursorClause = '';
    if (cursor) {
      cursorClause =
        'AND (created_at < @cursorCreatedAt OR (created_at = @cursorCreatedAt AND id > @cursorId))';
      params.cursorCreatedAt = cursor.createdAt;
      params.cursorId = cursor.id;
    }

    // Over-fetch one row to detect a further page. Archived (soft-deleted) notes
    // are excluded — this is a read path and must honour the archive invariant.
    const rows = this.db
      .prepare(
        `SELECT * FROM notes
         WHERE is_pinned = 1
         AND deleted_at IS NULL
         ${cursorClause}
         ORDER BY created_at DESC, id ASC
         LIMIT @limitPlusOne`
      )
      .all({ ...params, limitPlusOne: limit + 1 }) as unknown as NoteRow[];

    const hasMore = rows.length > limit;
    const pageRows = hasMore ? rows.slice(0, limit) : rows;
    const notes = pageRows.map((row) => this.toEntity(row));

    const lastRow = pageRows[pageRows.length - 1];
    const nextCursor: SearchCursor | null =
      hasMore && lastRow ? { createdAt: lastRow.created_at, id: lastRow.id } : null;

    return { notes, nextCursor };
  }

  async findDue(now: Date): Promise<Note[]> {
    // Overdue notes: a reminder strictly in the past relative to `now` (epoch
    // ms, inherently UTC). Archived notes are never overdue, so deleted_at IS
    // NULL is applied first — mirroring Note.isOverdue's archived-wins rule.
    // Ordered most-overdue first, with id ASC as a stable tiebreaker.
    const rows = this.db
      .prepare(
        `SELECT * FROM notes
         WHERE deleted_at IS NULL
         AND due_at IS NOT NULL
         AND due_at < @now
         ORDER BY due_at ASC, id ASC`
      )
      .all({ now: now.getTime() }) as unknown as NoteRow[];

    return rows.map((row) => this.toEntity(row));
  }

  async list(criteria: NoteListCriteria): Promise<NotePage> {
    const { page, limit, sortField, sortDirection } = criteria;
    const offset = (page - 1) * limit;
    const orderExpr = ORDER_EXPR[sortField];
    const direction = sortDirection === 'desc' ? 'DESC' : 'ASC';

    const { joinClause, whereClause, filterParams } = buildFilterSql(criteria);

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
      .all({ ...filterParams, limit, offset }) as unknown as NoteRow[];

    return { notes: rows.map((row) => this.toEntity(row)), total };
  }

  async count(criteria: NoteCountCriteria): Promise<number> {
    const { joinClause, whereClause, filterParams } = buildFilterSql(criteria);

    const { total } = this.db
      .prepare(`SELECT COUNT(*) AS total FROM notes n ${joinClause} ${whereClause}`)
      .get(filterParams) as { total: number };

    return total;
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
      new Date(row.updated_at),
      row.deleted_at !== null ? new Date(row.deleted_at) : null,
      row.color,
      row.is_pinned === 1,
      row.due_at !== null ? new Date(row.due_at) : null
    );
  }
}

/**
 * Build the JOIN/WHERE fragments (and bound parameters) shared by `list` and
 * `count`. An optional tag filter joins the tag table; the (already-normalized)
 * tag is matched exactly against the stored canonical form. Archived notes are
 * excluded (deleted_at IS NULL) unless the caller opts in. Optional created-at
 * bounds (inclusive) narrow the range; all filters compose via AND.
 */
function buildFilterSql(criteria: NoteFilterCriteria): {
  joinClause: string;
  whereClause: string;
  filterParams: Record<string, string | number>;
} {
  const { tag, includeArchived, createdAfter, createdBefore } = criteria;
  const joinClause = tag ? 'JOIN note_tags t ON t.note_id = n.id' : '';
  const conditions: string[] = [];
  const filterParams: Record<string, string | number> = {};
  if (tag) {
    conditions.push('t.tag = @tag');
    filterParams.tag = tag;
  }
  if (!includeArchived) {
    conditions.push('n.deleted_at IS NULL');
  }
  if (createdAfter) {
    conditions.push('n.created_at >= @createdAfter');
    filterParams.createdAfter = createdAfter.getTime();
  }
  if (createdBefore) {
    conditions.push('n.created_at <= @createdBefore');
    filterParams.createdBefore = createdBefore.getTime();
  }
  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  return { joinClause, whereClause, filterParams };
}

/** Escape LIKE special characters (`\`, `%`, `_`) for use with ESCAPE '\'. */
function escapeLike(input: string): string {
  return input.replace(/[\\%_]/g, (char) => `\\${char}`);
}
