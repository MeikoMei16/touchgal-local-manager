import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'node:path'
import { existsSync, mkdirSync } from 'node:fs'

let db: Database.Database

export interface LocalCollectionGamePayload {
  id: number
  uniqueId: string
  name: string
  banner?: string | null
  averageRating?: number
  viewCount?: number
  downloadCount?: number
  alias?: string[]
}

export interface LocalCollectionItemRecord {
  gameId: number
  resourceId: number
  uniqueId: string
  name: string
  banner: string | null
  averageRating: number
  viewCount: number
  downloadCount: number
}

export interface LocalCollectionRecord {
  id: number
  name: string
  itemCount: number
  items: LocalCollectionItemRecord[]
}

export interface DownloadTaskRecord {
  id: number
  game_id: number | null
  source_url: string
  storage_url: string
  remote_path: string | null
  display_name: string
  output_path: string
  status: 'queued' | 'downloading' | 'paused' | 'verifying' | 'extracting' | 'done' | 'error'
  progress_bytes: number
  total_bytes: number | null
  error_message: string | null
  extracted_path?: string | null
  created_at: string
  updated_at: string
}

export interface LibraryRootRecord {
  id: number
  path: string
  created_at: string
  last_scanned_at: string | null
}

export interface LinkedLocalGameRecord {
  id: number
  path: string
  exe_path: string | null
  size_bytes: number | null
  linked_at: string
  source: 'scan' | 'download' | 'manual'
  status: 'discovered' | 'linked' | 'verified' | 'broken'
  last_verified_at: string | null
  game_id: number | null
  unique_id: string | null
  name: string | null
  banner_url: string | null
  avg_rating: number | null
  view_count: number | null
  download_count: number | null
}

export const initDb = () => {
  const userDataPath = app.getPath('userData')
  const dbPath = join(userDataPath, 'touchgal.db')

  if (!existsSync(userDataPath)) {
    mkdirSync(userDataPath, { recursive: true })
  }

  db = new Database(dbPath, { verbose: console.log })
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
        detail_json TEXT,
        cloud_updated_at DATETIME,
        last_detailed_at DATETIME,
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
        source_url TEXT,
        storage_url TEXT NOT NULL,
        remote_path TEXT,
        display_name TEXT,
        output_path TEXT,
        status TEXT CHECK(status IN ('queued','downloading','paused','verifying','extracting','done','error')),
        progress_bytes INTEGER DEFAULT 0,
        total_bytes INTEGER,
        error_message TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
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

    CREATE TABLE IF NOT EXISTS library_roots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        path TEXT NOT NULL UNIQUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_scanned_at DATETIME
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

  // Ensure columns exist for existing DBs
  try {
    db.exec(`ALTER TABLE games ADD COLUMN detail_json TEXT;`)
  } catch (e) { /* already exists */ }
  try {
    db.exec(`ALTER TABLE games ADD COLUMN last_detailed_at DATETIME;`)
  } catch (e) { /* already exists */ }
  try {
    db.exec(`ALTER TABLE download_tasks ADD COLUMN source_url TEXT;`)
  } catch (e) { /* already exists */ }
  try {
    db.exec(`ALTER TABLE download_tasks ADD COLUMN remote_path TEXT;`)
  } catch (e) { /* already exists */ }
  try {
    db.exec(`ALTER TABLE download_tasks ADD COLUMN display_name TEXT;`)
  } catch (e) { /* already exists */ }
  try {
    db.exec(`ALTER TABLE download_tasks ADD COLUMN output_path TEXT;`)
  } catch (e) { /* already exists */ }
  try {
    db.exec(`ALTER TABLE download_tasks ADD COLUMN error_message TEXT;`)
  } catch (e) { /* already exists */ }
  try {
    db.exec(`ALTER TABLE download_tasks ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP;`)
  } catch (e) { /* already exists */ }

  // local_paths schema migrations
  try {
    db.exec(`ALTER TABLE local_paths ADD COLUMN source TEXT CHECK(source IN ('scan','download','manual')) DEFAULT 'scan';`)
  } catch (e) { /* already exists */ }
  try {
    db.exec(`ALTER TABLE local_paths ADD COLUMN status TEXT CHECK(status IN ('discovered','linked','verified','broken')) DEFAULT 'discovered';`)
  } catch (e) { /* already exists */ }
  try {
    db.exec(`ALTER TABLE local_paths ADD COLUMN last_verified_at DATETIME;`)
  } catch (e) { /* already exists */ }
  try {
    db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS local_paths_path_uidx ON local_paths(path);`)
  } catch (e) { /* already exists */ }

  // download_tasks: track extracted path after decompression
  try {
    db.exec(`ALTER TABLE download_tasks ADD COLUMN extracted_path TEXT;`)
  } catch (e) { /* already exists */ }

  // Browse history
  db.exec(`
    CREATE TABLE IF NOT EXISTS browse_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      unique_id TEXT NOT NULL UNIQUE,
      game_id INTEGER,
      name TEXT NOT NULL,
      banner_url TEXT,
      viewed_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
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

export const saveGameDetail = (uniqueId: string, detail: any) => {
  const db = getDb()
  const stmt = db.prepare(`
    UPDATE games SET 
      detail_json = ?, 
      last_detailed_at = CURRENT_TIMESTAMP 
    WHERE unique_id = ?
  `)
  stmt.run(JSON.stringify(detail), uniqueId)
}

export const getCachedDetail = (uniqueId: string) => {
  const db = getDb()
  const row = db.prepare('SELECT detail_json FROM games WHERE unique_id = ?').get(uniqueId) as { detail_json: string | null } | undefined
  return row?.detail_json ? JSON.parse(row.detail_json) : null
}

export const listLocalCollections = (): LocalCollectionRecord[] => {
  const db = getDb()
  const collections = db.prepare(`
    SELECT c.id, c.name
    FROM collections c
    ORDER BY c.id DESC
  `).all() as Array<{ id: number; name: string }>

  const itemStmt = db.prepare(`
    SELECT
      g.id AS gameId,
      g.id AS resourceId,
      g.unique_id AS uniqueId,
      g.name AS name,
      g.banner_url AS banner,
      g.avg_rating AS averageRating,
      g.view_count AS viewCount,
      g.download_count AS downloadCount
    FROM collection_items ci
    JOIN games g ON g.id = ci.game_id
    WHERE ci.collection_id = ?
    ORDER BY ci.rowid DESC
  `)

  return collections.map((collection) => {
    const items = itemStmt.all(collection.id) as LocalCollectionItemRecord[]
    return {
      ...collection,
      itemCount: items.length,
      items
    }
  })
}

export const createLocalCollection = (name: string): LocalCollectionRecord => {
  const db = getDb()
  const normalizedName = name.trim()
  if (!normalizedName) {
    throw new Error('Collection name is required')
  }

  const result = db.prepare(`
    INSERT INTO collections (name)
    VALUES (?)
  `).run(normalizedName)

  const id = Number(result.lastInsertRowid)
  return {
    id,
    name: normalizedName,
    itemCount: 0,
    items: []
  }
}

export const deleteLocalCollection = (collectionId: number) => {
  const db = getDb()
  const transaction = db.transaction((id: number) => {
    db.prepare('DELETE FROM collection_items WHERE collection_id = ?').run(id)
    db.prepare('DELETE FROM collections WHERE id = ?').run(id)
  })

  transaction(collectionId)
  return { success: true }
}

export const addItemToLocalCollection = (collectionId: number, game: LocalCollectionGamePayload) => {
  const db = getDb()
  upsertGame(game)

  const existingGame = db.prepare('SELECT id FROM games WHERE unique_id = ?').get(game.uniqueId) as { id: number } | undefined
  if (!existingGame) {
    throw new Error('Game metadata not found after upsert')
  }

  db.prepare(`
    INSERT OR IGNORE INTO collection_items (collection_id, game_id)
    VALUES (?, ?)
  `).run(collectionId, existingGame.id)

  return { success: true }
}

export const removeItemFromLocalCollection = (collectionId: number, uniqueId: string) => {
  const db = getDb()
  db.prepare(`
    DELETE FROM collection_items
    WHERE collection_id = ?
      AND game_id = (SELECT id FROM games WHERE unique_id = ?)
  `).run(collectionId, uniqueId)

  return { success: true }
}

export interface BrowseHistoryRecord {
  id: number
  unique_id: string
  game_id: number | null
  name: string
  banner_url: string | null
  viewed_at: string
}

export const recordBrowseHistory = (entry: {
  uniqueId: string
  gameId?: number | null
  name: string
  bannerUrl?: string | null
}) => {
  const db = getDb()
  db.prepare(`
    INSERT INTO browse_history (unique_id, game_id, name, banner_url, viewed_at)
    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(unique_id) DO UPDATE SET
      game_id = excluded.game_id,
      name = excluded.name,
      banner_url = excluded.banner_url,
      viewed_at = CURRENT_TIMESTAMP
  `).run(entry.uniqueId, entry.gameId ?? null, entry.name, entry.bannerUrl ?? null)
}

export const getBrowseHistory = (limit = 50): BrowseHistoryRecord[] => {
  const db = getDb()
  return db.prepare(`
    SELECT id, unique_id, game_id, name, banner_url, viewed_at
    FROM browse_history
    ORDER BY viewed_at DESC
    LIMIT ?
  `).all(limit) as BrowseHistoryRecord[]
}

export const clearBrowseHistory = () => {
  const db = getDb()
  db.prepare('DELETE FROM browse_history').run()
  return { success: true }
}

export const linkLocalPath = (gamePath: string, gameId: number, source: 'scan' | 'download' | 'manual' = 'scan') => {
  const db = getDb()
  db.prepare(`
    INSERT INTO local_paths (path, game_id, source, status, linked_at)
    VALUES (?, ?, ?, 'linked', CURRENT_TIMESTAMP)
    ON CONFLICT(path) DO UPDATE SET
      game_id = excluded.game_id,
      source = excluded.source,
      status = 'linked'
  `).run(gamePath, gameId, source)
}

export const listLibraryRoots = (): LibraryRootRecord[] => {
  const db = getDb()
  return db.prepare(`
    SELECT id, path, created_at, last_scanned_at
    FROM library_roots
    ORDER BY created_at ASC, id ASC
  `).all() as LibraryRootRecord[]
}

export const addLibraryRoot = (rootPath: string) => {
  const db = getDb()
  const normalizedPath = rootPath.trim()
  if (!normalizedPath) {
    throw new Error('Library root path is required')
  }

  db.prepare(`
    INSERT INTO library_roots (path)
    VALUES (?)
    ON CONFLICT(path) DO NOTHING
  `).run(normalizedPath)

  return listLibraryRoots()
}

export const removeLibraryRoot = (rootId: number) => {
  const db = getDb()
  db.prepare('DELETE FROM library_roots WHERE id = ?').run(rootId)
  return listLibraryRoots()
}

export const markLibraryRootsScanned = (paths: string[]) => {
  const db = getDb()
  const updateStmt = db.prepare(`
    UPDATE library_roots
    SET last_scanned_at = CURRENT_TIMESTAMP
    WHERE path = ?
  `)

  const transaction = db.transaction((items: string[]) => {
    for (const item of items) {
      updateStmt.run(item)
    }
  })

  transaction(paths)
}

export const listLinkedLocalGames = (): LinkedLocalGameRecord[] => {
  const db = getDb()
  return db.prepare(`
    SELECT
      lp.id,
      lp.path,
      lp.exe_path,
      lp.size_bytes,
      lp.linked_at,
      lp.source,
      lp.status,
      lp.last_verified_at,
      lp.game_id,
      g.unique_id,
      g.name,
      g.banner_url,
      g.avg_rating,
      g.view_count,
      g.download_count
    FROM local_paths lp
    LEFT JOIN games g ON g.id = lp.game_id
    ORDER BY lp.linked_at DESC, lp.id DESC
  `).all() as LinkedLocalGameRecord[]
}

export const getLinkedLocalGameById = (id: number): LinkedLocalGameRecord | null => {
  const db = getDb()
  const row = db.prepare(`
    SELECT
      lp.id,
      lp.path,
      lp.exe_path,
      lp.size_bytes,
      lp.linked_at,
      lp.source,
      lp.status,
      lp.last_verified_at,
      lp.game_id,
      g.unique_id,
      g.name,
      g.banner_url,
      g.avg_rating,
      g.view_count,
      g.download_count
    FROM local_paths lp
    LEFT JOIN games g ON g.id = lp.game_id
    WHERE lp.id = ?
    LIMIT 1
  `).get(id) as LinkedLocalGameRecord | undefined

  return row ?? null
}

export const deleteLocalPathsByIds = (ids: number[]) => {
  if (ids.length === 0) return
  const db = getDb()
  const deleteStmt = db.prepare('DELETE FROM local_paths WHERE id = ?')
  const transaction = db.transaction((items: number[]) => {
    for (const id of items) {
      deleteStmt.run(id)
    }
  })
  transaction(ids)
}

const DEFAULT_DOWNLOAD_CONCURRENCY = 3
const MIN_DOWNLOAD_CONCURRENCY = 1
const MAX_DOWNLOAD_CONCURRENCY = 8

const clampDownloadConcurrency = (value: number) =>
  Math.min(MAX_DOWNLOAD_CONCURRENCY, Math.max(MIN_DOWNLOAD_CONCURRENCY, value))

export const getDownloadConcurrencySetting = () => {
  const db = getDb()
  const row = db.prepare(`
    SELECT value
    FROM app_settings
    WHERE key = 'download_concurrency'
    LIMIT 1
  `).get() as { value: string } | undefined

  if (!row) return DEFAULT_DOWNLOAD_CONCURRENCY
  const parsed = Number.parseInt(row.value, 10)
  if (!Number.isFinite(parsed)) return DEFAULT_DOWNLOAD_CONCURRENCY
  return clampDownloadConcurrency(parsed)
}

export const setDownloadConcurrencySetting = (value: number) => {
  const db = getDb()
  const normalized = clampDownloadConcurrency(Math.round(value))
  db.prepare(`
    INSERT INTO app_settings (key, value, updated_at)
    VALUES ('download_concurrency', ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET
      value = excluded.value,
      updated_at = CURRENT_TIMESTAMP
  `).run(String(normalized))
  return normalized
}
