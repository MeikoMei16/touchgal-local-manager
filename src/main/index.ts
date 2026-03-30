import { app, BrowserWindow, ipcMain, shell } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import axios from 'axios'
import log from 'electron-log'
import { initDb, getDb, upsertGame } from './db'
import { cleanFolderName, discoverExecutables } from './utils'
import { downloadManager } from './downloader'

// Configure logging
log.initialize({ spyRendererConsole: true })
const logPath = join(app.getPath('userData'), 'logs/main.log')
log.transports.file.resolvePathFn = () => logPath
log.transports.file.level = 'debug'
log.transports.console.level = 'debug'
Object.assign(console, log.functions)
log.info('Log initialized (Spying on Renderer) at:', logPath)

// Persistence Helpers
const cookiePath = join(app.getPath('userData'), 'session_cookies.txt')
let currentCookie = ''
try {
  if (fs.existsSync(cookiePath)) {
    currentCookie = fs.readFileSync(cookiePath, 'utf8')
    log.info('Loaded cookies from disk')
  }
} catch (e) {
  log.warn('Failed to load cookies')
}

const saveCookies = (cookies: string) => {
  try {
    fs.writeFileSync(cookiePath, cookies, 'utf8')
  } catch (e) {
    log.error('Failed to save cookies:', e)
  }
}

// Capture all uncaught errors
process.on('uncaughtException', (err) => {
  log.error('Uncaught Exception:', err)
})
process.on('unhandledRejection', (reason, promise) => {
  log.error('Unhandled Rejection at:', promise, 'reason:', reason)
})

log.info('App starting...')

const API_CLIENT = axios.create({
  baseURL: 'https://www.touchgal.top/api',
  headers: {
    'Content-Type': 'application/json',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    Referer: 'https://www.touchgal.top/',
    Origin: 'https://www.touchgal.top'
  },
  timeout: 30000,
})

// Cookie Interceptors
API_CLIENT.interceptors.request.use((config) => {
  if (currentCookie) {
    config.headers['Cookie'] = currentCookie;
  }
  log.debug(`[API Request] ${config.method?.toUpperCase()} ${config.url}`, { 
    params: config.params,
    headers: config.headers 
  });
  return config;
});

API_CLIENT.interceptors.response.use((response) => {
  const setCookies = response.headers['set-cookie'] as string[] | undefined;
  if (setCookies) {
    const newCookies = setCookies.map(c => c.split(';')[0]).join('; ');
    currentCookie = currentCookie ? `${currentCookie}; ${newCookies}` : newCookies;
    saveCookies(currentCookie);
    log.info('[API] Cookies updated and saved');
  }
  return response;
});

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
  download?: number
  view?: number
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

const normalizeResource = (resource: any) => {
  const raw = resource as any
  const counts = raw._count ?? {}
  
  // Highly Aggressive Stats Mapping for Home/List/Search
  const viewCount = raw.view ?? raw.view_count ?? raw.visit ?? raw.views ?? 0
  const downloadCount = raw.download ?? raw.download_count ?? raw.downloads ?? 0
  const favoriteCount = counts.favorite_folder ?? raw.favorite_count ?? 0
  const commentCount = counts.comment ?? raw.comment_count ?? 0
  const resourceCount = counts.resource ?? raw.resource_count ?? 0

  const company =
    typeof raw.company === 'string'
      ? raw.company
      : Array.isArray(raw.company)
        ? raw.company.map((item: any) => item?.name).filter(Boolean).join(', ')
        : null

  // Format date safely
  let releasedDate = raw.releasedDate ?? raw.released ?? null
  if (raw.created && !releasedDate) {
    releasedDate = new Date(raw.created).toLocaleDateString()
  }

  return {
    ...raw, // FULL PASSTHROUGH for rendering robustness
    id: raw.id ?? 0,
    uniqueId: raw.uniqueId ?? raw.unique_id ?? '',
    name: raw.name ?? 'Unknown title',
    banner: raw.banner ?? null,
    averageRating: raw.averageRating ?? raw.ratingSummary?.average ?? raw.rating_stat?.avg_overall ?? 0,
    tags: extractTags(raw),
    viewCount,
    downloadCount,
    favoriteCount,
    commentCount,
    resourceCount,
    releasedDate,
    company,
    pvUrl: raw.pvVideoUrl ?? raw.pv_video_url ?? raw.pvUrl ?? raw.pv_url ?? null,
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

const normalizeFeedResponse = (payload: { galgames?: RawResource[]; total?: number }) => {
  const list = (payload.galgames ?? []).map(normalizeResource)
  log.info(`[API] Normalized ${list.length} games. Total: ${payload.total}`)
  return {
    list,
    total: payload.total ?? 0,
  }
}

const normalizeIntroduction = (payload: any) => ({
  introduction: payload.introduction ?? null,
  releasedDate: payload.released ?? null,
  alias: payload.alias ?? [],
  tags: (payload.tag ?? []).map((item: any) => item?.tag?.name ?? item?.name).filter((tag: any): tag is string => Boolean(tag)),
  company:
    typeof payload.company === 'string'
      ? payload.company
      : Array.isArray(payload.company)
        ? payload.company.map((item: any) => item?.name).filter(Boolean).join(', ') || null
        : null,
  vndbId: payload.vndbId ?? null,
  bangumiId: payload.bangumiId ?? null,
  steamId: payload.steamId != null ? String(payload.steamId) : null,
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

// IPC Handlers with Logging
const handleWithLog = (channel: string, listener: (...args: any[]) => any) => {
  ipcMain.handle(channel, async (event, ...args) => {
    log.debug(`[IPC Request] ${channel}`, args)
    try {
      const result = await listener(event, ...args)
      log.debug(`[IPC Response] ${channel}`, { success: true })
      return result
    } catch (error) {
      log.error(`[IPC Error] ${channel}`, error)
      throw error
    }
  })
}

handleWithLog('scan-local-library', async (_event, paths: string[]) => {
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

handleWithLog('tag-folder', (_event, folderPath: string, id: string) => {
  const tgIdPath = path.join(folderPath, '.tg_id')
  try {
    fs.writeFileSync(tgIdPath, id, 'utf8')
    return { success: true }
  } catch (error) {
    return { success: false, error }
  }
})

handleWithLog('tg-fetch-resources', async (_event, page: number, limit: number, query: any) => {
  // Advanced Year Logic Translation (Intersection of all constraints)
  let yearArray: string[] = ['all'];
  if (query.yearConstraints && query.yearConstraints.length > 0) {
    const currentYear = new Date().getFullYear();
    const startYear = 1995;
    const endYear = currentYear + 2;
    
    // Generate full range
    let years = Array.from({ length: endYear - startYear + 1 }, (_, i) => startYear + i);
    
    // Apply every constraint
    for (const c of query.yearConstraints as Array<{op: string, val: number}>) {
      if (c.op === '=') years = years.filter(y => y === c.val);
      else if (c.op === '>=') years = years.filter(y => y >= c.val);
      else if (c.op === '<=') years = years.filter(y => y <= c.val);
      else if (c.op === '>') years = years.filter(y => y > c.val);
      else if (c.op === '<') years = years.filter(y => y < c.val);
    }
    
    yearArray = years.map(String);
    if (yearArray.length === 0) yearArray = ['none']; // Ensure it doesn't default back to 'all'
  }

  // --- API Request Handling ---
  const apiParams: any = {
    page,
    limit,
    selectedType: query.selectedType ?? 'all',
    selectedLanguage: query.selectedLanguage ?? 'all',
    selectedPlatform: query.selectedPlatform ?? 'all',
    sortField: query.sortField ?? 'resource_update_time',
    sortOrder: query.sortOrder ?? 'desc',
    yearString: (yearArray && yearArray.length > 0) ? JSON.stringify(yearArray) : (query.yearString ?? '["all"]'),
    monthString: query.monthString ?? '["all"]',
    tagString: query.selectedTags && query.selectedTags.length > 0 ? JSON.stringify(query.selectedTags) : '["all"]',
    minRatingCount: query.minRatingCount ?? 0
  };

  const nsfwValue = query.nsfwMode === 'nsfw' ? 'nsfw' : (query.nsfwMode === 'all' ? 'all' : 'sfw');
  const cookieString = `${currentCookie ? currentCookie + '; ' : ''}kun-patch-setting-store|state|data|kunNsfwEnable=${nsfwValue}`;
  
  const response = await API_CLIENT.get('/galgame', {
    params: apiParams,
    headers: { 'Cookie': cookieString }
  })
  const normalized = normalizeFeedResponse(ensureValidResponse(response.data))
  
  // Delta Sync: Upsert to local DB
  normalized.list.forEach(upsertGame)
  
  return normalized
})

handleWithLog('tg-search-resources', async (_event, keyword: string, page: number, limit: number, options?: Record<string, any>) => {
  const body = { ...buildSearchBody(keyword, page, limit), ...options }
  const nsfwValue = options?.nsfwMode === 'nsfw' ? 'nsfw' : (options?.nsfwMode === 'all' ? 'all' : 'sfw');
  const cookieString = `${currentCookie ? currentCookie + '; ' : ''}kun-patch-setting-store|state|data|kunNsfwEnable=${nsfwValue}`;

  const response = await API_CLIENT.post('/search', body, {
    headers: { 'Cookie': cookieString }
  })
  const normalized = normalizeFeedResponse(ensureValidResponse(response.data))

  // Delta Sync: Upsert to local DB
  normalized.list.forEach(upsertGame)

  return normalized
})

handleWithLog('tg-get-patch-detail', async (_event, uniqueId: string) => {
  if (!uniqueId || uniqueId.length !== 8) {
    throw new Error('Invalid resource ID (must be 8 characters)')
  }

  try {
    const [detailResponse, introResponse] = await Promise.all([
      API_CLIENT.get('/patch', { params: { uniqueId } }),
      API_CLIENT.get('/patch/introduction', { params: { uniqueId } }),
    ])
    
    const detail = normalizeResource(ensureValidResponse(detailResponse.data))
    const intro = normalizeIntroduction(ensureValidResponse(introResponse.data))
    
    let downloads: any[] = []
    try {
      const dlResponse = await API_CLIENT.get('/patch/download', { params: { uniqueId } })
      downloads = normalizeDownloads(ensureValidResponse(dlResponse.data))
    } catch (e) {
      log.warn('Failed to fetch downloads for', uniqueId)
    }

    const fullDetail = { ...detail, ...intro, downloads }
    
    // Save to cache
    getDb().prepare('UPDATE games SET detail_json = ?, last_detailed_at = CURRENT_TIMESTAMP WHERE unique_id = ?')
      .run(JSON.stringify(fullDetail), uniqueId)

    return fullDetail
  } catch (error) {
    log.warn(`[API] Failed to fetch detail for ${uniqueId}, checking cache...`)
    const cached = getDb().prepare('SELECT detail_json FROM games WHERE unique_id = ?').get(uniqueId) as { detail_json: string } | undefined
    if (cached?.detail_json) {
      log.info(`[Cache] Returning cached detail for ${uniqueId}`)
      return JSON.parse(cached.detail_json)
    }
    throw error
  }
})

function normalizeComment(raw: any) {
  return {
    id: raw.id,
    content: raw.content,
    userName: raw.user?.name || raw.user_name || 'Anonymous',
    userAvatar: raw.user?.avatar || raw.user_avatar || null,
    createdAt: raw.created_at || raw.createdAt || new Date().toISOString(),
  }
}

function normalizeRating(raw: any) {
  return {
    id: raw.id,
    overall: raw.overall || 0,
    recommend: raw.recommend || 'neutral',
    shortSummary: raw.shortSummary || raw.short_summary || '',
    playStatus: raw.playStatus || raw.play_status || 'other',
    userName: raw.user?.name || raw.user_name || 'Anonymous',
    userAvatar: raw.user?.avatar || raw.user_avatar || null,
  }
}

handleWithLog('tg-get-patch-comments', async (_event, patchId: number, page: number, limit: number) => {
  const response = await API_CLIENT.get('/patch/comment', { params: { patchId, page, limit } })
  const data = ensureValidResponse(response.data)
  return {
    total: data.total || 0,
    list: (data.list || data.comments || []).map(normalizeComment)
  }
})

handleWithLog('tg-get-patch-ratings', async (_event, patchId: number, page: number, limit: number) => {
  const response = await API_CLIENT.get('/patch/rating', { params: { patchId, page, limit } })
  const data = ensureValidResponse(response.data)
  return {
    total: data.total || 0,
    list: (data.list || data.ratings || []).map(normalizeRating)
  }
})

handleWithLog('tg-get-patch-introduction', async (_event, uniqueId: string) => {
  try {
    const response = await API_CLIENT.get('/patch/introduction', { params: { uniqueId } })
    return normalizeIntroduction(ensureValidResponse(response.data))
  } catch (error) {
    const cached = getDb().prepare('SELECT detail_json FROM games WHERE unique_id = ?').get(uniqueId) as { detail_json: string } | undefined
    if (cached?.detail_json) return JSON.parse(cached.detail_json)
    throw error
  }
})

handleWithLog('tg-match-folder', async (_event, folderName: string) => {
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

handleWithLog('tg-link-folder', async (_event, folderPath: string, uniqueId: string) => {
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

handleWithLog('tg-get-executables', async (_event, folderPath: string) => {
  return await discoverExecutables(folderPath)
})

handleWithLog('tg-launch-game', async (_event, folderPath: string, exeName: string) => {
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
handleWithLog('tg-parse-links', (_event, content: string) => {
  return downloadManager.parseLink(content)
})

handleWithLog('tg-add-to-queue', (_event, gameId: number, storageUrl: string) => {
  try {
    const id = downloadManager.addTask(gameId, storageUrl)
    return { success: true, id }
  } catch (error) {
    return { success: false, error: String(error) }
  }
})

handleWithLog('tg-get-download-queue', () => {
  return downloadManager.getQueue()
})

handleWithLog('tg-fetch-captcha', async () => {
  const response = await API_CLIENT.get('/auth/captcha')
  return ensureValidResponse(response.data)
})

handleWithLog('tg-verify-captcha', async (_event, sessionId: string, selectedIds: string[]) => {
  log.info(`[Captcha] Verifying session ${sessionId} with IDs:`, selectedIds)
  try {
    const response = await API_CLIENT.post('/auth/captcha', { sessionId, selectedIds })
    const data = ensureValidResponse(response.data)
    log.info(`[Captcha] Success, received code:`, data.code)
    return data
  } catch (error: any) {
    log.error(`[Captcha] Verification failed:`, error.response?.data || error.message)
    throw error
  }
})

handleWithLog('tg-login', async (_event, username: string, password: string, captcha: string) => {
  const response = await API_CLIENT.post('/auth/login', { name: username, password, captcha })
  return ensureValidResponse(response.data)
})

handleWithLog('tg-search-tags', async (_event, keyword: string) => {
  const response = await API_CLIENT.get('/tag', { params: { name: keyword, limit: 20 } })
  return ensureValidResponse(response.data)
})

handleWithLog('tg-get-user-status', async (_event, id: number) => {
  const response = await API_CLIENT.get('/user/status/info', { params: { id } })
  return ensureValidResponse(response.data)
})

handleWithLog('tg-get-user-status-self', async () => {
  const response = await API_CLIENT.get('/user/status')
  return ensureValidResponse(response.data)
})

handleWithLog('tg-get-user-comments', async (_event, uid: number, page: number, limit: number) => {
  const response = await API_CLIENT.get('/user/profile/comment', { params: { uid, page, limit } })
  return ensureValidResponse(response.data)
})

handleWithLog('tg-get-user-ratings', async (_event, uid: number, page: number, limit: number) => {
  const response = await API_CLIENT.get('/user/profile/rating', { params: { uid, page, limit } })
  return ensureValidResponse(response.data)
})

handleWithLog('tg-get-user-resources', async (_event, uid: number, page: number, limit: number) => {
  const response = await API_CLIENT.get('/user/profile/resource', { params: { uid, page, limit } })
  return ensureValidResponse(response.data)
})

handleWithLog('tg-get-favorite-folders', async (_event, uid: number) => {
  const response = await API_CLIENT.get('/user/profile/favorite/folder', { params: { uid } })
  return ensureValidResponse(response.data)
})
