import { app, BrowserWindow, ipcMain, shell, safeStorage } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import axios from 'axios'
import log from 'electron-log'
import {
  addItemToLocalCollection,
  createLocalCollection,
  deleteLocalCollection,
  getDb,
  initDb,
  listLocalCollections,
  removeItemFromLocalCollection
} from './db'
import {
  buildTouchGalBaseHeaders,
  defaultHttpConfigState,
  resolveHttpProfile
} from './httpProfile'
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
const cookiePath = join(app.getPath('userData'), 'session_cookies.txt')
let currentToken = ''
let authCookies: Record<string, string> = {}

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

const parseCookiePair = (rawCookie: string) => {
  const [pair] = rawCookie.split(';')
  const separatorIndex = pair.indexOf('=')
  if (separatorIndex <= 0) return null

  const name = pair.slice(0, separatorIndex).trim()
  const value = pair.slice(separatorIndex + 1).trim()
  if (!name) return null

  return { name, value }
}

const serializeAuthCookies = () =>
  Object.entries(authCookies)
    .map(([name, value]) => `${name}=${value}`)
    .join('; ')

const persistAuthCookies = () => {
  try {
    const serialized = serializeAuthCookies()
    if (serialized) {
      fs.writeFileSync(cookiePath, serialized, 'utf8')
    } else if (fs.existsSync(cookiePath)) {
      fs.unlinkSync(cookiePath)
    }
  } catch (e) {
    log.warn('Failed to persist auth cookies:', e)
  }
}

const updateAuthCookiesFromSetCookie = (setCookies: string[]) => {
  let didChange = false

  for (const cookieStr of setCookies) {
    const parsed = parseCookiePair(cookieStr)
    if (!parsed) continue

    const expiresImmediately = /max-age=0/i.test(cookieStr) || /expires=thu,\s*01 jan 1970/i.test(cookieStr)
    if (expiresImmediately) {
      if (parsed.name in authCookies) {
        delete authCookies[parsed.name]
        didChange = true
      }
      continue
    }

    if (authCookies[parsed.name] !== parsed.value) {
      authCookies[parsed.name] = parsed.value
      didChange = true
    }
  }

  if (didChange) {
    persistAuthCookies()
  }
}

const normalizeNsfwCookieValue = (value: unknown) => {
  if (value === 'nsfw') return 'nsfw'
  if (value === 'all') return 'all'
  return 'sfw'
}

const buildNsfwCookie = (nsfwMode: unknown) =>
  `kun-patch-setting-store|state|data|kunNsfwEnable=${normalizeNsfwCookieValue(nsfwMode)}`

const buildRequestCookie = (nsfwMode?: unknown) => {
  const cookies: string[] = []
  const serializedAuthCookies = serializeAuthCookies()
  if (serializedAuthCookies) {
    cookies.push(serializedAuthCookies)
  } else if (currentToken) {
    cookies.push(buildAuthCookie(currentToken))
  }
  cookies.push(buildNsfwCookie(nsfwMode))
  return cookies.join('; ')
}

const saveToken = (token: string) => {
  try {
    const sanitizedToken = normalizeTokenInput(token)
    currentToken = sanitizedToken
    if (sanitizedToken) {
      authCookies['kun-galgame-patch-moe-token'] = sanitizedToken
      persistAuthCookies()
    }
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

const clearToken = () => {
  currentToken = ''
  authCookies = {}

  try {
    if (fs.existsSync(tokenPath)) {
      fs.unlinkSync(tokenPath)
    }
  } catch (e) {
    log.warn('Failed to remove persisted token:', e)
  }

  try {
    if (fs.existsSync(cookiePath)) {
      fs.unlinkSync(cookiePath)
    }
  } catch (e) {
    log.warn('Failed to remove persisted cookie file:', e)
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
    }

    if (fs.existsSync(cookiePath)) {
      const rawCookies = fs.readFileSync(cookiePath, 'utf8')
      authCookies = rawCookies
        .split(';')
        .map((entry) => parseCookiePair(entry.trim()))
        .filter((value): value is { name: string; value: string } => Boolean(value))
        .reduce<Record<string, string>>((accumulator, cookie) => {
          accumulator[cookie.name] = cookie.value
          return accumulator
        }, {})

      if (!currentToken && authCookies['kun-galgame-patch-moe-token']) {
        currentToken = normalizeTokenInput(authCookies['kun-galgame-patch-moe-token'])
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

const httpConfig = defaultHttpConfigState()
const activeHttpProfile = resolveHttpProfile(httpConfig)

log.info('Active HTTP profile:', {
  mode: httpConfig.mode,
  profileId: activeHttpProfile.id,
  label: activeHttpProfile.label
})

const API_CLIENT = axios.create({
  baseURL: 'https://www.touchgal.top/api',
  headers: buildTouchGalBaseHeaders(activeHttpProfile),
  timeout: 30000,
})

// JWT & Cookie Interceptors
API_CLIENT.interceptors.request.use((config) => {
  if (currentToken) {
    // 1. Standard JWT Authorization Header
    config.headers['Authorization'] = `Bearer ${currentToken}`;
    
    // 2. Compatibility Cookie Header (for backend middleware)
    const existingCookie = config.headers['Cookie'] as string | undefined;
    const authCookie = serializeAuthCookies() || buildAuthCookie(currentToken);
    
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
    updateAuthCookiesFromSetCookie(setCookies)

    // Extract the specific token from Set-Cookie headers
    for (const cookieStr of setCookies) {
      const match = cookieStr.match(/kun-galgame-patch-moe-token=([^;]+)/);
      if (match) {
        const newToken = normalizeTokenInput(match[1]);
        if (newToken !== currentToken) {
          saveToken(newToken);
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
  created?: string | null
}

interface RawDownload {
  id?: number
  name?: string
  section?: string | null
  size?: string | null
  content?: string | null
  url?: string | null
  storage?: string | null
  type?: string | string[] | null
  language?: string | string[] | null
  code?: string | null
  password?: string | null
  note?: string | null
  hash?: string | null
  platform?: string | string[] | null
  likeCount?: number | null
  download?: number | null
  created?: string | null
  userId?: number | null
  user?: {
    id?: number | null
    name?: string | null
    avatar?: string | null
    role?: number | null
    patchCount?: number | null
  } | null
}

const asArray = (value: string[] | string | null | undefined): string[] => {
  if (Array.isArray(value)) return value.filter(Boolean)
  if (typeof value === 'string' && value.trim()) return [value]
  return []
}

const uniqueUrls = (values: Array<string | null | undefined>) => {
  const seen = new Set<string>()
  const urls: string[] = []

  for (const value of values) {
    if (!value || typeof value !== 'string') continue
    const url = value.trim()
    if (!url || seen.has(url)) continue
    seen.add(url)
    urls.push(url)
  }

  return urls
}

const decodeHtmlEntities = (value: string) =>
  value
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')

const normalizeUrlCandidate = (value: string | null | undefined) => {
  if (!value || typeof value !== 'string') return null
  const decoded = decodeHtmlEntities(value).trim()
  if (!decoded) return null
  if (decoded.startsWith('//')) return `https:${decoded}`
  return decoded
}

const extractImageUrlsFromHtml = (html: string) => {
  const matches = Array.from(
    html.matchAll(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi),
    (match) => match[1]
  )
  return uniqueUrls(matches)
}

const extractPvUrlFromHtml = (html: string) => {
  const taggedCandidates = [
    ...Array.from(html.matchAll(/<source[^>]+src=["']([^"']+)["'][^>]*>/gi), (match) => match[1]),
    ...Array.from(html.matchAll(/<iframe[^>]+src=["']([^"']+)["'][^>]*>/gi), (match) => match[1]),
    ...Array.from(html.matchAll(/<video[^>]+src=["']([^"']+)["'][^>]*>/gi), (match) => match[1]),
    ...Array.from(html.matchAll(/data-src=["']([^"']+)["']/gi), (match) => match[1]),
    ...Array.from(html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>/gi), (match) => match[1])
  ]
    .map(normalizeUrlCandidate)
    .filter((value): value is string => Boolean(value))

  const taggedMatch = taggedCandidates.find((candidate) =>
    /(youtube\.com|youtu\.be|bilibili\.com|player\.bilibili\.com|\.mp4(?:\?|$)|\.webm(?:\?|$)|\.ogg(?:\?|$)|\.mov(?:\?|$)|\.m3u8(?:\?|$)|\.flv(?:\?|$))/i.test(candidate)
  )
  if (taggedMatch) return taggedMatch

  const plainUrlMatches = Array.from(
    html.matchAll(/https?:\/\/[^\s"'<>]+/gi),
    (match) => normalizeUrlCandidate(match[0])
  ).filter((value): value is string => Boolean(value))

  return plainUrlMatches.find((candidate) =>
    /(youtube\.com|youtu\.be|bilibili\.com|player\.bilibili\.com|\.mp4(?:\?|$)|\.webm(?:\?|$)|\.ogg(?:\?|$)|\.mov(?:\?|$)|\.m3u8(?:\?|$)|\.flv(?:\?|$))/i.test(candidate)
  ) ?? null
}

const stripEmbeddedMediaFromIntroduction = (html: string) =>
  html
    .replace(/<section[^>]*>\s*(?:<h\d[^>]*>)?\s*(?:游戏截图|PV鉴赏|支持正版)[\s\S]*?<\/section>/gi, '')
    .replace(/<h\d[^>]*>\s*游戏截图\s*<\/h\d>\s*<div[^>]*data-kun-img-container[^>]*>[\s\S]*?<\/div>/gi, '')
    .replace(/<h\d[^>]*>\s*PV鉴赏\s*<\/h\d>\s*<div[^>]*data-video-player[^>]*>[\s\S]*?<\/div>/gi, '')
    .replace(/<h\d[^>]*>\s*支持正版\s*<\/h\d>\s*<div[^>]*data-kun-link[^>]*>[\s\S]*?<\/div>/gi, '')
    .replace(/<(img|video|source|iframe)[^>]*>/gi, '')
    .replace(/<(\/video|\/iframe)>/gi, '')
    .replace(/<p[^>]*>\s*(?:游戏截图|PV鉴赏|支持正版)\s*<\/p>/gi, '')
    .replace(/<(h\d)[^>]*>\s*(?:游戏截图|PV鉴赏|支持正版)\s*<\/\1>/gi, '')
    .trim()

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

  const releasedDate = raw.releasedDate ?? raw.released ?? null

  // Preserve detail structure if present (e.g. from /patch)
  const detail = raw.detail ?? null
  const screenshots = uniqueUrls([
    ...(Array.isArray(raw.fullScreenshotUrls) ? raw.fullScreenshotUrls : []),
    ...(Array.isArray(raw.screenshots) ? raw.screenshots : [])
  ])

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
    created: raw.created ?? null,
    company,
    pvUrl: raw.pvVideoUrl ?? raw.pv_video_url ?? raw.pvUrl ?? raw.pv_url ?? null,
    screenshots,
    detail, // Critical for screenshots
    alias: raw.alias ?? [],
    vndbId: raw.vndbId ?? raw.vndb_id ?? null,
  }
}

const normalizeDownloadType = (value: unknown) => {
  if (typeof value !== 'string') return null
  if (value === 'row') return 'raw'
  return value
}

const normalizeDownloads = (downloads: RawDownload[]) =>
  downloads.map((download) => ({
    id: download.id ?? 0,
    name: download.name ?? '',
    section: download.section ?? null,
    size: download.size ?? null,
    url: download.url ?? download.content ?? null,
    content: download.content ?? download.url ?? null,
    storage: download.storage ?? null,
    type: asArray(download.type)
      .map(normalizeDownloadType)
      .filter((value): value is string => Boolean(value)),
    language: asArray(download.language),
    code: download.code ?? null,
    password: download.password ?? null,
    note: download.note ?? null,
    hash: download.hash ?? null,
    platform: asArray(download.platform),
    likeCount: download.likeCount ?? 0,
    downloadCount: download.download ?? 0,
    created: download.created ?? null,
    userId: download.userId ?? download.user?.id ?? null,
    user: download.user
      ? {
          id: download.user.id ?? 0,
          name: download.user.name ?? 'Unknown',
          avatar: download.user.avatar ?? null,
          role: download.user.role ?? 0,
          patchCount: download.user.patchCount ?? 0,
        }
      : null,
  }))

const normalizeFeedResponse = (payload: { galgames?: RawResource[]; total?: number }) => {
  const list = (payload.galgames ?? []).map(normalizeResource)
  log.info(`[API] Normalized ${list.length} games. Total: ${payload.total}`)
  return {
    list,
    total: payload.total ?? 0,
  }
}

const normalizeIntroduction = (payload: any) => {
  const introductionHtml = typeof payload.introduction === 'string' ? payload.introduction : ''
  const screenshots = uniqueUrls([
    ...(Array.isArray(payload.fullScreenshotUrls) ? payload.fullScreenshotUrls : []),
    ...extractImageUrlsFromHtml(introductionHtml)
  ])

  return {
    introduction: introductionHtml ? stripEmbeddedMediaFromIntroduction(introductionHtml) : null,
    created: payload.created ?? null,
    releasedDate: payload.released ?? null,
    resourceUpdateTime: payload.resourceUpdateTime ?? null,
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
    screenshots,
    pvUrl:
      normalizeUrlCandidate(payload.pvVideoUrl) ??
      normalizeUrlCandidate(payload.pv_video_url) ??
      normalizeUrlCandidate(payload.pvUrl) ??
      normalizeUrlCandidate(payload.pv_url) ??
      extractPvUrlFromHtml(introductionHtml) ??
      null,
  }
}

const buildSearchTerms = (keyword: string) => {
  const terms = keyword
    .split(/\s+/)
    .map((term) => term.trim())
    .filter(Boolean)

  const uniqueTerms = Array.from(new Set(terms))
  return uniqueTerms.length > 0 ? uniqueTerms : [keyword.trim()].filter(Boolean)
}

const buildSearchBody = (keyword: string, page: number, limit: number) => ({
  queryString: JSON.stringify(
    buildSearchTerms(keyword).map((term) => ({ type: 'keyword', name: term }))
  ),
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
      if (detail.id) {
        const dlResponse = await API_CLIENT.get('/patch/resource', { params: { patchId: detail.id } })
        downloads = normalizeDownloads(ensureValidResponse(dlResponse.data))
      }
    } catch {
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

handleWithLog('tg-logout', async () => {
  clearToken()
  return { success: true }
})

handleWithLog('tg-clear-persisted-auth', async () => {
  clearToken()
  return { success: true }
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

handleWithLog('tg-get-favorite-folder-patches', async (_event, folderId: number, page: number, limit: number) => {
  const response = await API_CLIENT.get('/user/profile/favorite/folder/patch', {
    params: { folderId, page, limit }
  })
  const data = ensureValidResponse(response.data) as { patches?: any[]; total?: number }

  const patches = (data.patches ?? []).map((patch) => ({
    id: patch.id ?? 0,
    uniqueId: patch.uniqueId ?? patch.unique_id ?? '',
    name: patch.name ?? '',
    banner: patch.banner ?? null,
    platform: patch.platform ?? [],
    language: patch.language ?? [],
    created: patch.created ?? null,
    releasedDate: patch.releasedDate ?? null,
    averageRating: typeof patch.averageRating === 'number' ? patch.averageRating : 0,
    tags: Array.isArray(patch.tags) ? patch.tags : [],
    alias: Array.isArray(patch.alias) ? patch.alias : [],
    favoriteCount: patch._count?.favorite_folder ?? patch.favoriteCount ?? 0,
    resourceCount: patch._count?.patch_resource ?? patch.resourceCount ?? 0,
    commentCount: patch._count?.patch_comment ?? patch.commentCount ?? 0,
    viewCount: patch.view ?? patch.viewCount ?? 0,
    downloadCount: patch.download ?? patch.downloadCount ?? 0,
    ratingSummary: null
  }))

  return {
    patches,
    total: data.total ?? patches.length
  }
})

handleWithLog('tg-local-collections-list', async () => {
  return listLocalCollections()
})

handleWithLog('tg-local-collections-create', async (_event, name: string) => {
  createLocalCollection(name)
  return listLocalCollections()
})

handleWithLog('tg-local-collections-delete', async (_event, collectionId: number) => {
  deleteLocalCollection(collectionId)
  return listLocalCollections()
})

handleWithLog('tg-local-collections-add-item', async (_event, collectionId: number, game: {
  id: number
  uniqueId: string
  name: string
  banner?: string | null
  averageRating?: number
  viewCount?: number
  downloadCount?: number
  alias?: string[]
}) => {
  addItemToLocalCollection(collectionId, game)
  return listLocalCollections()
})

handleWithLog('tg-local-collections-remove-item', async (_event, collectionId: number, uniqueId: string) => {
  removeItemFromLocalCollection(collectionId, uniqueId)
  return listLocalCollections()
})
