import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'node:path'
import { existsSync, mkdirSync } from 'node:fs'

let db: Database.Database

export const initDb = () => {
  const userDataPath = app.getPath('userData')
  const dbPath = join(userDataPath, 'touchgal.db')

  if (!existsSync(userDataPath)) {
    mkdirSync(userDataPath, { recursive: true })
  }

  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  // Create tables based on architecture.md
  db.exec(`
    -- Core catalog
    CREATE TABLE IF NOT EXISTS games (
        id INTEGER PRIMARY KEY,
        unique_id TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        banner_url TEXT,
        avg_rating REAL,
        view_count INTEGER DEFAULT 0,
        download_count INTEGER DEFAULT 0,
        cloud_updated_at DATETIME,
        local_updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- FTS5 for full-text search
    CREATE VIRTUAL TABLE IF NOT EXISTS games_fts USING fts5(
        name, 
        content='games', 
        content_rowid='id'
    );

    -- Relations
    CREATE TABLE IF NOT EXISTS companies (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        parent_brand_id INTEGER REFERENCES companies(id),
        primary_language TEXT,
        official_website TEXT
    );

    CREATE TABLE IF NOT EXISTS tags (
        id INTEGER PRIMARY KEY, 
        name TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS game_tags (
        game_id INTEGER REFERENCES games(id),
        tag_id INTEGER REFERENCES tags(id),
        PRIMARY KEY(game_id, tag_id)
    );

    CREATE TABLE IF NOT EXISTS game_series (
        game_id INTEGER REFERENCES games(id),
        series_id INTEGER REFERENCES series(id),
        order_in_series INTEGER
    );

    -- External IDs
    CREATE TABLE IF NOT EXISTS external_ids (
        game_id INTEGER REFERENCES games(id),
        vndb_id TEXT, 
        bangumi_id INTEGER, 
        steam_id TEXT, 
        dlsite_code TEXT
    );

    -- Local installation
    CREATE TABLE IF NOT EXISTS local_paths (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        game_id INTEGER REFERENCES games(id),
        path TEXT NOT NULL,
        exe_path TEXT,
        size_bytes INTEGER,
        linked_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Media cache
    CREATE TABLE IF NOT EXISTS media_cache (
        game_id INTEGER PRIMARY KEY REFERENCES games(id),
        banner_local_path TEXT,
        screenshots_json TEXT,
        cached_at DATETIME
    );

    -- Download queue
    CREATE TABLE IF NOT EXISTS download_tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        game_id INTEGER REFERENCES games(id),
        storage_url TEXT NOT NULL,
        status TEXT CHECK(status IN ('queued','downloading','paused','verifying','extracting','done','error')),
        progress_bytes INTEGER DEFAULT 0,
        total_bytes INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Play tracking
    CREATE TABLE IF NOT EXISTS play_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        game_id INTEGER REFERENCES games(id),
        started_at DATETIME NOT NULL,
        ended_at DATETIME,
        duration_minutes INTEGER
    );

    CREATE TABLE IF NOT EXISTS personal_metadata (
        game_id INTEGER PRIMARY KEY REFERENCES games(id),
        completion_status TEXT CHECK(completion_status IN ('not_started','playing','completed','dropped','perfectionist')),
        personal_rating REAL CHECK(personal_rating BETWEEN 0 AND 10),
        notes TEXT,
        last_played_at DATETIME
    );

    -- Collections
    CREATE TABLE IF NOT EXISTS collections (
        id INTEGER PRIMARY KEY AUTOINCREMENT, 
        name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS collection_items (
        collection_id INTEGER REFERENCES collections(id),
        game_id INTEGER REFERENCES games(id),
        PRIMARY KEY(collection_id, game_id)
    );

    -- Triggers for FTS5 sync
    CREATE TRIGGER IF NOT EXISTS games_ai AFTER INSERT ON games BEGIN
        INSERT INTO games_fts(rowid, name) VALUES (new.id, new.name);
    END;
    CREATE TRIGGER IF NOT EXISTS games_ad AFTER DELETE ON games BEGIN
        INSERT INTO games_fts(games_fts, rowid, name) VALUES('delete', old.id, old.name);
    END;
    CREATE TRIGGER IF NOT EXISTS games_au AFTER UPDATE ON games BEGIN
        INSERT INTO games_fts(games_fts, rowid, name) VALUES('delete', old.id, old.name);
        INSERT INTO games_fts(rowid, name) VALUES (new.id, new.name);
    END;
  `)

  console.log('[DB] Database initialized at', dbPath)
}

export const getDb = () => {
  if (!db) initDb()
  return db
}

// Phase 1: Delta Sync Helpers
export const upsertGame = (game: {
  id: number
  uniqueId: string
  name: string
  banner?: string | null
  averageRating?: number
  favoriteCount?: number
  resourceCount?: number
  viewCount?: number
  downloadCount?: number
  alias?: string[]
}) => {
  const db = getDb()
  const insertStmt = db.prepare(`
    INSERT INTO games (id, unique_id, name, banner_url, avg_rating, view_count, download_count)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(unique_id) DO UPDATE SET
      name = excluded.name,
      banner_url = excluded.banner_url,
      avg_rating = excluded.avg_rating,
      view_count = excluded.view_count,
      download_count = excluded.download_count,
      local_updated_at = CURRENT_TIMESTAMP
  `)

  insertStmt.run(
    game.id,
    game.uniqueId,
    game.name,
    game.banner ?? null,
    game.averageRating ?? 0,
    game.viewCount ?? 0,
    game.downloadCount ?? 0
  )

  // Sync Aliases
  if (game.alias && game.alias.length > 0) {
    const insertAlias = db.prepare(`
        INSERT INTO games_fts(rowid, name) VALUES (?, ?)
    `)

    // We also use FTS5 for aliases to improve search coverage
    for (const altName of game.alias) {
      if (altName) {
        try {
            insertAlias.run(game.id, altName)
        } catch { /* ignore if rowid exists in FTS, or handle mapping */ }
      }
    }
  }
}
