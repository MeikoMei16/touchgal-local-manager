import { app, BrowserWindow, ipcMain, shell } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import axios from 'axios'
import { initDb, getDb, upsertGame } from './db'
import { cleanFolderName, discoverExecutables } from './utils'
import { downloadManager } from './downloader'

const API_CLIENT = axios.create({
  baseURL: 'https://www.touchgal.top/api',
  headers: {
    'Content-Type': 'application/json',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    Referer: 'https://www.touchgal.top/',
    Origin: 'https://www.touchgal.top',
    'Cookie': 'kun-patch-setting-store|state|data|kunNsfwEnable=all'
  },
  timeout: 30000,
})

interface RawCount {
  favorite_folder?: number
  resource?: number
  comment?: number
}

interface RawResource {
  id?: number
  uniqueId?: string
  unique_id?: string
  name?: string
  banner?: string | null
  platform?: string[] | string | null
  language?: string[] | string | null
  releasedDate?: string | null
  released?: string | null
  averageRating?: number | null
  rating_stat?: { avg_overall?: number | null } | null
  tags?: string[] | null
  tag?: Array<{ name?: string; tag?: { name?: string } }> | null
  alias?: string[] | null
  company?: string | Array<{ name?: string }> | null
  vndbId?: string | null
  vndb_id?: string | null
  bangumiId?: number | null
  bangumi_id?: number | null
  steamId?: string | number | null
  steam_id?: string | number | null
  introduction?: string | null
  _count?: RawCount | null
  contentLimit?: string | null
  ratingSummary?: {
    average: number
    count: number
    histogram: { score: number; count: number }[]
    recommend: {
      strong_no: number; no: number; neutral: number; yes: number; strong_yes: number
    }
  } | null
  fullScreenshotUrls?: string[] | null
  pvVideoUrl?: string | null
}

interface RawDownload {
  id?: number
  name?: string
  size?: string | null
  content?: string | null
  url?: string | null
  storage?: string | null
  code?: string | null
  password?: string | null
  platform?: string | string[] | null
}

const asArray = (value: string[] | string | null | undefined): string[] => {
  if (Array.isArray(value)) return value.filter(Boolean)
  if (typeof value === 'string' && value.trim()) return [value]
  return []
}

const extractTags = (resource: RawResource): string[] => {
  if (Array.isArray(resource.tags) && resource.tags.length > 0) {
    return resource.tags.filter(Boolean)
  }
  if (!Array.isArray(resource.tag)) return []
  return resource.tag
    .map((item) => item?.tag?.name ?? item?.name)
    .filter((tag): tag is string => Boolean(tag))
}

const normalizeResource = (resource: RawResource) => {
  const counts = resource._count ?? {}
  const platforms = asArray(resource.platform)
  const languages = asArray(resource.language)
  const company =
    typeof resource.company === 'string'
      ? resource.company
      : Array.isArray(resource.company)
        ? resource.company.map((item) => item?.name).filter(Boolean).join(', ')
        : null

  return {
    id: resource.id ?? 0,
    uniqueId: resource.uniqueId ?? resource.unique_id ?? '',
    name: resource.name ?? 'Unknown title',
    banner: resource.banner ?? null,
    platform: platforms.join(', '),
    language: languages.join(', '),
    releasedDate: resource.releasedDate ?? resource.released ?? null,
    averageRating: resource.averageRating ?? resource.rating_stat?.avg_overall ?? 0,
    tags: extractTags(resource),
    alias: resource.alias ?? [],
    favoriteCount: counts.favorite_folder ?? 0,
    resourceCount: counts.resource ?? 0,
    commentCount: counts.comment ?? 0,
    introduction: resource.introduction ?? null,
    company,
    vndbId: resource.vndbId ?? resource.vndb_id ?? null,
    bangumiId: resource.bangumiId ?? resource.bangumi_id ?? null,
    steamId: resource.steamId != null ? String(resource.steamId) : resource.steam_id != null ? String(resource.steam_id) : null,
    contentLimit: resource.contentLimit ?? null,
    ratingSummary: resource.ratingSummary ?? {
      average: 0,
      count: 0,
      histogram: Array.from({ length: 10 }, (_, i) => ({ score: i + 1, count: 0 })),
      recommend: { strong_no: 0, no: 0, neutral: 0, yes: 0, strong_yes: 0 }
    },
    screenshots: resource.fullScreenshotUrls ?? [],
    pvUrl: resource.pvVideoUrl ?? null,
  }
}

const normalizeDownloads = (downloads: RawDownload[]) =>
  downloads.map((download) => ({
    id: download.id ?? 0,
    name: download.name ?? 'Unnamed resource',
    size: download.size ?? null,
    url: download.url ?? download.content ?? null,
    storage: download.storage ?? null,
    code: download.code ?? null,
    password: download.password ?? null,
    platform: asArray(download.platform),
  }))

const normalizeFeedResponse = (payload: { galgames?: RawResource[]; total?: number }) => ({
  list: (payload.galgames ?? []).map(normalizeResource),
  total: payload.total ?? 0,
})

const buildSearchBody = (keyword: string, page: number, limit: number) => ({
  queryString: JSON.stringify([{ type: 'keyword', name: keyword }]),
  limit,
  page,
  selectedType: 'all',
  selectedLanguage: 'all',
  selectedPlatform: 'all',
  sortField: 'created',
  sortOrder: 'desc',
  selectedYears: ['all'],
  selectedMonths: ['all'],
  searchOption: {
    searchInIntroduction: true,
    searchInAlias: true,
    searchInTag: true,
  },
})

const ensureValidResponse = <T>(payload: T | string | unknown[]): T => {
  if (typeof payload === 'string') {
    console.error('[API] Error payload (string):', payload)
    throw new Error(payload)
  }
  if (Array.isArray(payload)) {
    const first = payload[0]
    if (first && typeof first === 'object' && 'code' in first && 'path' in first) {
      console.error('[API] Validation errors (Zod):', JSON.stringify(payload, null, 2))
      throw new Error(String((first as Record<string, unknown>).message || 'TouchGal returned a validation error'))
    }
  }
  return payload as T
}

const scanForGalgameFolders = async (rootPaths: string[]) => {
  const results: Array<{ path: string; folderName: string; tg_id: string | null }> = []
  const scanTasks = rootPaths.map(async (rootPath) => {
    try {
      if (!fs.existsSync(rootPath)) return
      const dirs = await fs.promises.readdir(rootPath, { withFileTypes: true })
      const dirTasks = dirs.map(async (dir) => {
        if (!dir.isDirectory()) return
        const fullPath = path.join(rootPath, dir.name)
        const tgIdPath = path.join(fullPath, '.tg_id')
        let tg_id: string | null = null
        try {
          if (fs.existsSync(tgIdPath)) {
            tg_id = (await fs.promises.readFile(tgIdPath, 'utf8')).trim()
          }
        } catch { /* ignore */ }
        results.push({ path: fullPath, folderName: dir.name, tg_id })
      })
      await Promise.all(dirTasks)
    } catch { /* ignore */ }
  })
  await Promise.all(scanTasks)
  return results
}

let win: BrowserWindow | null = null

function createWindow(): void {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.cjs'),
      sandbox: false,
    },
  })

  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
    win.webContents.openDevTools()
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  initDb()
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

// IPC Handlers

ipcMain.handle('scan-local-library', async (_event, paths: string[]) => {
  const folders = await scanForGalgameFolders(paths)
  const db = getDb()
  
  const insertPath = db.prepare(`
    INSERT INTO local_paths (path, game_id)
    VALUES (?, (SELECT id FROM games WHERE unique_id = ?))
    ON CONFLICT DO NOTHING
  `)

  const transaction = db.transaction((items) => {
    for (const item of items) {
      insertPath.run(item.path, item.tg_id)
    }
  })

  transaction(folders)
  return folders
})

ipcMain.handle('tag-folder', (_event, folderPath: string, id: string) => {
  const tgIdPath = path.join(folderPath, '.tg_id')
  try {
    fs.writeFileSync(tgIdPath, id, 'utf8')
    return { success: true }
  } catch (error) {
    return { success: false, error }
  }
})

ipcMain.handle('tg-fetch-resources', async (_event, page: number, limit: number, query: Record<string, unknown>) => {
  const response = await API_CLIENT.get('/galgame', {
    params: {
      page,
      limit,
      selectedType: query.selectedType ?? 'all',
      selectedLanguage: query.selectedLanguage ?? 'all',
      selectedPlatform: query.selectedPlatform ?? 'all',
      sortField: query.sortField ?? 'resource_update_time',
      sortOrder: query.sortOrder ?? 'desc',
      yearString: query.yearString ?? ['all'],
      monthString: query.monthString ?? ['all'],
      minRatingCount: query.minRatingCount ?? 0,
      ...query,
    },
  })
  const normalized = normalizeFeedResponse(ensureValidResponse(response.data))
  
  // Delta Sync: Upsert to local DB
  normalized.list.forEach(upsertGame)
  
  return normalized
})

ipcMain.handle('tg-search-resources', async (_event, keyword: string, page: number, limit: number, options?: Record<string, unknown>) => {
  const body = { ...buildSearchBody(keyword, page, limit), ...options }
  const response = await API_CLIENT.post('/search', body)
  const normalized = normalizeFeedResponse(ensureValidResponse(response.data))

  // Delta Sync: Upsert to local DB
  normalized.list.forEach(upsertGame)

  return normalized
})

ipcMain.handle('tg-get-patch-detail', async (_event, uniqueId: string) => {
  if (!uniqueId || uniqueId.length !== 8) {
    throw new Error('Invalid resource ID (must be 8 characters)')
  }
  const [detailResponse, introResponse] = await Promise.all([
    API_CLIENT.get('/patch', { params: { uniqueId } }),
    API_CLIENT.get('/patch/introduction', { params: { uniqueId } }),
  ])
  const detail = normalizeResource(ensureValidResponse<RawResource>(detailResponse.data))
  
  // Delta Sync: Upsert detail to local DB
  upsertGame(detail)
  
  const downloadsResponse = await API_CLIENT.get('/patch/resource', {
    params: { patchId: detail.id },
  })
  const downloads = normalizeDownloads(ensureValidResponse<RawDownload[]>(downloadsResponse.data))
  return { ...detail, ...ensureValidResponse(introResponse.data), downloads }
})

ipcMain.handle('tg-get-patch-introduction', async (_event, uniqueId: string) => {
  const response = await API_CLIENT.get('/patch/introduction', { params: { uniqueId } })
  const payload = ensureValidResponse<{
    introduction?: string | null
    released?: string | null
    alias?: string[]
    tag?: Array<{ name?: string }>
    company?: Array<{ name?: string }>
    vndbId?: string | null
    bangumiId?: number | null
    steamId?: string | number | null
  }>(response.data)
  return {
    introduction: payload.introduction ?? null,
    releasedDate: payload.released ?? null,
    alias: payload.alias ?? [],
    tags: (payload.tag ?? []).map((item) => item?.name).filter((tag): tag is string => Boolean(tag)),
    company: (payload.company ?? []).map((item) => item?.name).filter(Boolean).join(', ') || null,
    vndbId: payload.vndbId ?? null,
    bangumiId: payload.bangumiId ?? null,
    steamId: payload.steamId != null ? String(payload.steamId) : null,
  }
})

ipcMain.handle('tg-match-folder', async (_event, folderName: string) => {
  const cleaned = cleanFolderName(folderName)
  const db = getDb()
  
  // Search in FTS5 (matches both main title and aliases)
  const results = db.prepare(`
    SELECT g.* FROM games g
    JOIN games_fts f ON g.id = f.rowid
    WHERE f.name MATCH ?
    LIMIT 10
  `).all(cleaned + '*')

  return results
})

ipcMain.handle('tg-link-folder', async (_event, folderPath: string, uniqueId: string) => {
  const db = getDb()
  try {
    const game = db.prepare('SELECT id FROM games WHERE unique_id = ?').get(uniqueId) as { id: number } | undefined
    if (!game) return { success: false, error: 'Game metadata not found in local DB' }

    db.prepare(`
      INSERT INTO local_paths (path, game_id)
      VALUES (?, ?)
      ON CONFLICT(path) DO UPDATE SET game_id = excluded.game_id
    `).run(folderPath, game.id)

    return { success: true }
  } catch (error) {
    return { success: false, error: String(error) }
  }
})

ipcMain.handle('tg-get-executables', async (_event, folderPath: string) => {
  return await discoverExecutables(folderPath)
})

ipcMain.handle('tg-launch-game', async (_event, folderPath: string, exeName: string) => {
  const fullPath = path.join(folderPath, exeName)
  try {
    const child = spawn(fullPath, [], {
      cwd: folderPath,
      detached: true,
      stdio: 'ignore'
    })
    child.unref() // Allow the parent to exit independently
    return { success: true, pid: child.pid }
  } catch (error) {
    return { success: false, error: String(error) }
  }
})

// Phase 3: Download Orchestration
ipcMain.handle('tg-parse-links', (_event, content: string) => {
  return downloadManager.parseLink(content)
})

ipcMain.handle('tg-add-to-queue', (_event, gameId: number, storageUrl: string) => {
  try {
    const id = downloadManager.addTask(gameId, storageUrl)
    return { success: true, id }
  } catch (error) {
    return { success: false, error: String(error) }
  }
})

ipcMain.handle('tg-get-download-queue', () => {
  return downloadManager.getQueue()
})

ipcMain.handle('tg-fetch-captcha', async () => {
  const response = await API_CLIENT.get('/auth/captcha')
  return ensureValidResponse(response.data)
})

ipcMain.handle('tg-login', async (_event, username: string, password: string, captcha: string) => {
  const response = await API_CLIENT.post('/auth/login', { name: username, password, captcha })
  return ensureValidResponse(response.data)
})
