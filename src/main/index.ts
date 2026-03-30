import { app, BrowserWindow, ipcMain, shell, safeStorage } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import axios from 'axios'
import log from 'electron-log'
import { initDb, getDb } from './db'
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

// Persistence Helpers: JWT Token with Encryption
const tokenPath = join(app.getPath('userData'), 'session_token.dat')
let currentToken = ''

const sanitizeToken = (token: string) => token.replace(/[\r\n\t]/g, '').trim()

const normalizeTokenInput = (rawToken: string) => {
  const sanitized = sanitizeToken(rawToken)
  if (!sanitized) return ''

  const cookieMatch = sanitized.match(/kun-galgame-patch-moe-token=([^;\s]+)/)
  if (cookieMatch) return cookieMatch[1]

  const bearerMatch = sanitized.match(/^Bearer\s+([^\s;]+)/i)
  if (bearerMatch) return bearerMatch[1]

  const firstSegment = sanitized.split(/[;\s]/)[0]
  const tokenSafeSegment = firstSegment.replace(/[^A-Za-z0-9._-]/g, '')
  return tokenSafeSegment
}

const buildAuthCookie = (token: string) => `kun-galgame-patch-moe-token=${token}`

const normalizeNsfwCookieValue = (value: unknown) => {
  if (value === 'nsfw') return 'nsfw'
  if (value === 'all') return 'all'
  return 'sfw'
}

const buildNsfwCookie = (nsfwMode: unknown) =>
  `kun-patch-setting-store|state|data|kunNsfwEnable=${normalizeNsfwCookieValue(nsfwMode)}`

const buildRequestCookie = (nsfwMode?: unknown) => {
  const cookies: string[] = []
  if (currentToken) cookies.push(buildAuthCookie(currentToken))
  cookies.push(buildNsfwCookie(nsfwMode))
  return cookies.join('; ')
}

const saveToken = (token: string) => {
  try {
    const sanitizedToken = normalizeTokenInput(token)
    if (safeStorage.isEncryptionAvailable()) {
      const encrypted = safeStorage.encryptString(sanitizedToken)
      fs.writeFileSync(tokenPath, encrypted)
    } else {
      // Fallback to plain text if encryption is not available (not recommended)
      fs.writeFileSync(tokenPath, sanitizedToken, 'utf8')
      log.warn('Encryption not available, saving token as plain text')
    }
  } catch (e) {
    log.error('Failed to save token:', e)
  }
}

const loadToken = () => {
  try {
    if (fs.existsSync(tokenPath)) {
      const buffer = fs.readFileSync(tokenPath)
      if (safeStorage.isEncryptionAvailable()) {
        currentToken = normalizeTokenInput(safeStorage.decryptString(buffer))
        log.info('Loaded encrypted token from disk')
      } else {
        currentToken = normalizeTokenInput(buffer.toString('utf8'))
        log.info('Loaded plain text token from disk (fallback)')
      }
    } else {
      // Compatibility: Check for old cookie file
      const oldCookiePath = join(app.getPath('userData'), 'session_cookies.txt')
      if (fs.existsSync(oldCookiePath)) {
        const oldCookies = fs.readFileSync(oldCookiePath, 'utf8')
        // Try to extract token from old cookie string
        const match = oldCookies.match(/kun-galgame-patch-moe-token=([^;]+)/)
        if (match) {
          currentToken = normalizeTokenInput(match[1])
          saveToken(currentToken)
          log.info('Migrated old cookie to encrypted token')
          fs.unlinkSync(oldCookiePath) // Clean up old file
        }
      }
    }
  } catch (e) {
    log.warn('Failed to load or migrate token:', e)
  }
}

// Initial load (will be finalized if encryption becomes available later)
loadToken()

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

// JWT & Cookie Interceptors
API_CLIENT.interceptors.request.use((config) => {
  if (currentToken) {
    // 1. Standard JWT Authorization Header
    config.headers['Authorization'] = `Bearer ${currentToken}`;
    
    // 2. Compatibility Cookie Header (for backend middleware)
    const existingCookie = config.headers['Cookie'] as string | undefined;
    const authCookie = buildAuthCookie(currentToken);
    
    if (existingCookie) {
      if (!existingCookie.includes('kun-galgame-patch-moe-token')) {
        config.headers['Cookie'] = `${authCookie}; ${existingCookie}`;
      }
    } else {
      config.headers['Cookie'] = authCookie;
    }
  }
  
  log.debug(`[API Request] ${config.method?.toUpperCase()} ${config.url}`, {
    params: config.params,
    headers: { ...config.headers, Authorization: 'Bearer [REDACTED]', Cookie: '[REDACTED]' }
  });
  return config;
});

API_CLIENT.interceptors.response.use((response) => {
  const setCookies = response.headers['set-cookie'] as string[] | undefined;
  if (setCookies) {
    // Extract the specific token from Set-Cookie headers
    for (const cookieStr of setCookies) {
      const match = cookieStr.match(/kun-galgame-patch-moe-token=([^;]+)/);
      if (match) {
        const newToken = normalizeTokenInput(match[1]);
        if (newToken !== currentToken) {
          currentToken = newToken;
          saveToken(currentToken);
          log.info('[API] JWT Token updated and encrypted');
        }
        break; 
      }
    }
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

  // Explicit mapping to avoid passthrough pollution
  const viewCount = raw.view ?? raw.view_count ?? raw.visit ?? raw.views ?? 0
  const downloadCount = raw.download ?? raw.download_count ?? raw.downloads ?? 0
  const favoriteCount = counts.favorite_folder ?? raw.favorite_count ?? 0
  const commentCount = counts.comment ?? raw.comment_count ?? 0

  // Standardize naming
  const uniqueId = raw.uniqueId ?? raw.unique_id ?? ''
  const name = raw.name ?? 'Unknown title'
  const banner = raw.banner ?? raw.banner_url ?? raw.bannerUrl ?? null
  
  // Rating Logic Optimization
  const averageRating = raw.averageRating ?? raw.ratingSummary?.average ?? raw.rating_stat?.avg_overall ?? 0
  
  // Histogram / Rating Summary Extraction
  let ratingSummary = raw.ratingSummary ?? null
  if (!ratingSummary && raw.rating_stat) {
    const stat = raw.rating_stat
    ratingSummary = {
      average: stat.avg_overall ?? 0,
      count: stat.count ?? 0,
      histogram: [
        { score: 1,  count: stat.o1  ?? 0 },
        { score: 2,  count: stat.o2  ?? 0 },
        { score: 3,  count: stat.o3  ?? 0 },
        { score: 4,  count: stat.o4  ?? 0 },
        { score: 5,  count: stat.o5  ?? 0 },
        { score: 6,  count: stat.o6  ?? 0 },
        { score: 7,  count: stat.o7  ?? 0 },
        { score: 8,  count: stat.o8  ?? 0 },
        { score: 9,  count: stat.o9  ?? 0 },
        { score: 10, count: stat.o10 ?? 0 }
      ],
      recommend: {
        strong_no:  stat.rec_strong_no  ?? 0,
        no:         stat.rec_no         ?? 0,
        neutral:    stat.rec_neutral    ?? 0,
        yes:        stat.rec_yes        ?? 0,
        strong_yes: stat.rec_strong_yes ?? 0
      }
    }
  }

  const ratingCount = raw.ratingCount ?? ratingSummary?.count ?? raw.rating_stat?.count ?? 0

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

  // Preserve detail structure if present (e.g. from /patch)
  const detail = raw.detail ?? null

  return {
    id: raw.id ?? raw.patchId ?? raw.patch_id ?? raw.galgameId ?? raw.galgame_id ?? 0,
    uniqueId,
    name,
    banner,
    averageRating,
    ratingCount,
    ratingSummary,
    tags: extractTags(raw),
    viewCount,
    downloadCount,
    favoriteCount,
    commentCount,
    releasedDate,
    company,
    pvUrl: raw.pvVideoUrl ?? raw.pv_video_url ?? raw.pvUrl ?? raw.pv_url ?? null,
    detail, // Critical for screenshots
    alias: raw.alias ?? [],
    vndbId: raw.vndbId ?? raw.vndb_id ?? null,
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
  if (!payload) {
    throw new Error('Empty response from API')
  }

  if (typeof payload === 'string') {
    log.error('[API] Error payload (string):', payload)
    if (payload.includes('登录失效')) {
      throw new Error('SESSION_EXPIRED')
    }
    throw new Error(payload)
  }

  // Handle common error object patterns
  if (typeof payload === 'object' && !Array.isArray(payload)) {
    const obj = payload as any;
    if (obj.error || obj.message || obj.errors) {
       const msg = obj.message || obj.error || (Array.isArray(obj.errors) ? obj.errors[0]?.message : 'Unknown API Error');
       if (String(msg).includes('登录失效') || String(msg).includes('Login required') || String(msg).includes('未登录')) {
         throw new Error('SESSION_EXPIRED');
       }
       // If it's a controlled error object but not a login error, we might still want to return it 
       // but only if it's NOT an actual failure (e.g. some status message).
       // However, usually these are errors.
       if (obj.error || (obj.errors && obj.errors.length > 0)) {
         throw new Error(String(msg));
       }
    }
  }

  if (Array.isArray(payload)) {
    const first = payload[0]
    if (first && typeof first === 'object' && 'code' in first && 'path' in first) {
      log.error('[API] Validation errors (Zod):', JSON.stringify(payload, null, 2))
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
  log.info('[IPC] tg-fetch-resources request:', { page, limit, query });

  if (query.selectedTags && query.selectedTags.length > 0) {
    log.warn('[API] selectedTags received by tg-fetch-resources; ignoring upstream tag filtering and relying on local advanced pipeline');
  }

  // Use the standard /galgame (GET) endpoint only.
  // Tag filtering is intentionally NOT delegated upstream because /galgame tagString is unreliable
  // and /search has retrieval semantics that do not match strict local filtering.
  // Advanced Year Logic Translation (Intersection of all constraints)
  let yearArray: string[] = ['all'];
  if (query.yearConstraints && query.yearConstraints.length > 0) {
    const currentYear = new Date().getFullYear();
    const startYear = 1995;
    const endYear = currentYear + 2;

    // Generate full range
    let years = Array.from({ length: endYear - startYear + 1 }, (_, i) => startYear + i);

    // Apply every constraint
    for (const c of query.yearConstraints as Array<{ op: string, val: number }>) {
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
    sortField: query.sortField ?? 'created',
    sortOrder: query.sortOrder ?? 'desc',
    yearString: (yearArray && yearArray.length > 0) ? JSON.stringify(yearArray) : (query.yearString ?? '["all"]'),
    monthString: query.monthString ?? '["all"]',
    tagString: '["all"]',
    minRatingCount: query.minRatingCount ?? 0
  };

  const cookieString = buildRequestCookie(query.nsfwMode);

  log.info('[API] GET /galgame params:', apiParams);
  try {
    const response = await API_CLIENT.get('/galgame', {
      params: apiParams,
      headers: cookieString ? { 'Cookie': cookieString } : undefined
    })
    log.info('[API] GET /galgame success, items:', response.data?.galgames?.length);
    const normalized = normalizeFeedResponse(ensureValidResponse(response.data))

    // TODO: Background Delta Sync (Isolated from primary Network IO flow)
    // normalized.list.forEach(upsertGame)

    return normalized
  } catch (err: any) {
    log.error('[API] GET /galgame error:', err.response?.data || err.message);
    throw err;
  }
})

handleWithLog('tg-search-resources', async (_event, keyword: string, page: number, limit: number, options?: Record<string, any>) => {
  const body = { ...buildSearchBody(keyword, page, limit), ...options }
  const cookieString = buildRequestCookie(options?.nsfwMode);

  const response = await API_CLIENT.post('/search', body, {
    headers: cookieString ? { 'Cookie': cookieString } : undefined
  })
  const normalized = normalizeFeedResponse(ensureValidResponse(response.data))

  // TODO: Background Delta Sync (Isolated from primary Network IO flow)
  // normalized.list.forEach(upsertGame)

  return normalized
})

handleWithLog('tg-get-patch-detail', async (_event, uniqueId: string) => {
  if (!uniqueId || uniqueId.length !== 8) {
    throw new Error('Invalid resource ID (must be 8 characters)')
  }

  // COMPLETELY DEPEND ON NETWORK IO - No DB fallback
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

    // Merge detail, intro, and downloads. intro overrides detail fields.
    return { ...detail, ...intro, downloads }
  } catch (error) {
    log.error(`[API] Network IO failed for ${uniqueId}:`, error)
    throw error
  }
})

function normalizeComment(raw: any) {
  return {
    id: raw.id,
    content: raw.content ?? raw.text ?? raw.body ?? '',
    userName: raw.user?.name || raw.user_name || raw.author?.name || 'Anonymous',
    userAvatar: raw.user?.avatar || raw.user_avatar || raw.author?.avatar || null,
    createdAt: raw.created_at || raw.createdAt || new Date().toISOString(),
  }
}

function normalizeRating(raw: any) {
  return {
    id: raw.id,
    overall: raw.overall ?? raw.rating ?? raw.score ?? 0,
    recommend: raw.recommend || 'neutral',
    shortSummary: raw.shortSummary || raw.short_summary || raw.comment || '',
    playStatus: raw.playStatus || raw.play_status || 'other',
    userName: raw.user?.name || raw.user_name || raw.author?.name || 'Anonymous',
    userAvatar: raw.user?.avatar || raw.user_avatar || raw.author?.avatar || null,
  }
}

handleWithLog('tg-get-patch-comments', async (_event, patchId: number, page: number, limit: number) => {
  try {
    if (!patchId) return { total: 0, list: [] }
    const response = await API_CLIENT.get('/patch/comment', { params: { patchId, page, limit } })
    const data = ensureValidResponse(response.data)
    return {
      total: data.total || 0,
      list: (data.list || data.comments || []).map(normalizeComment)
    }
  } catch (error: any) {
    log.error(`[API] Failed to fetch comments for patch ${patchId}:`, error.message)
    if (error.message === 'SESSION_EXPIRED' || (error.response && error.response.status === 401)) {
      return { total: 0, list: [], requiresLogin: true }
    }
    // Return empty list instead of crashing renderer
    return { total: 0, list: [], error: error.message }
  }
})

handleWithLog('tg-get-patch-ratings', async (_event, patchId: number, page: number, limit: number) => {
  try {
    if (!patchId) return { total: 0, list: [] }
    const response = await API_CLIENT.get('/patch/rating', { params: { patchId, page, limit } })
    const data = ensureValidResponse(response.data)
    return {
      total: data.total || 0,
      list: (data.list || data.ratings || []).map(normalizeRating)
    }
  } catch (error: any) {
    log.error(`[API] Failed to fetch ratings for patch ${patchId}:`, error.message)
    if (error.message === 'SESSION_EXPIRED' || (error.response && error.response.status === 401)) {
      return { total: 0, list: [], requiresLogin: true }
    }
    return { total: 0, list: [], error: error.message }
  }
})

handleWithLog('tg-get-patch-introduction', async (_event, uniqueId: string) => {
  // COMPLETELY DEPEND ON NETWORK IO
  const response = await API_CLIENT.get('/patch/introduction', { params: { uniqueId } })
  return normalizeIntroduction(ensureValidResponse(response.data))
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
  log.info('[Captcha] Fetching new captcha...')
  const response = await API_CLIENT.get('/auth/captcha')
  const data = ensureValidResponse(response.data)
  log.info('[Captcha] API response data:', { ...data, images: data.images ? `[${data.images.length} images]` : undefined })
  
  // If it's a challenge type with multiple images
  if (data.images && Array.isArray(data.images)) {
    log.info(`[Captcha] Processing ${data.images.length} challenge images...`)
    const processedImages = await Promise.all(data.images.map(async (img: any) => {
      try {
        const imageSource = img.data || img.url;
        if (!imageSource) return img;

        // If it's already a base64 data URL, just use it
        if (typeof imageSource === 'string' && imageSource.startsWith('data:')) {
          return { ...img, url: imageSource };
        }

        const imgRes = await API_CLIENT.get(imageSource, { responseType: 'arraybuffer' });
        const contentType = imgRes.headers['content-type'] || 'image/png';
        const base64 = Buffer.from(imgRes.data).toString('base64');
        return { ...img, url: `data:${contentType};base64,${base64}` };
      } catch (e: any) {
        log.error(`[Captcha] Failed to fetch image:`, e.message);
        return img;
      }
    }));
    return { ...data, images: processedImages }
  }
  
  // If it's a legacy single-url captcha
  const url = data.url || (typeof data === 'string' ? data : null)
  if (url && typeof url === 'string' && url.startsWith('http')) {
    log.info(`[Captcha] Processing legacy captcha image: ${url}`)
    try {
      const imgRes = await API_CLIENT.get(url, { responseType: 'arraybuffer' })
      const contentType = imgRes.headers['content-type'] || 'image/png'
      const base64 = Buffer.from(imgRes.data).toString('base64')
      const dataUrl = `data:${contentType};base64,${base64}`
      return typeof data === 'string' ? dataUrl : { ...data, url: dataUrl }
    } catch (e: any) {
      log.error(`[Captcha] Failed to fetch legacy image ${url}:`, e.message)
    }
  }

  return data
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
