import { app, BrowserWindow, dialog, ipcMain, shell, safeStorage, session } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import axios from 'axios'
import type { AxiosError, AxiosRequestConfig, AxiosResponse } from 'axios'
import log from 'electron-log'
import {
  addItemToLocalCollection,
  addLibraryRoot,
  getArchiveExtractionDepthSetting,
  clearBrowseHistory,
  createLocalCollection,
  deleteLocalCollection,
  deleteLocalPathsByIds,
  getDownloadConcurrencySetting,
  getBrowseHistory,
  getCachedDetail,
  getDb,
  getLinkedLocalGameById,
  initDb,
  listLibraryRoots,
  listLinkedLocalGames,
  listLocalCollections,
  markLocalGameOpened,
  markLibraryRootsScanned,
  recordBrowseHistory,
  removeLibraryRoot,
  removeItemFromLocalCollection,
  resetDatabase,
  setArchiveExtractionDepthSetting,
  saveGameDetail,
  upsertGame
} from './db'
import {
  buildTouchGalBaseHeaders,
  defaultHttpConfigState,
  resolveHttpProfile,
  TOUCHGAL_API_BASE,
  TOUCHGAL_ORIGIN
} from './httpProfile'
import { cleanFolderName, discoverExecutables } from './utils'
import { downloadManager } from './downloader'
import { getExtractorStatus } from './extractor'
import {
  fetchDeveloperApiStatus,
  fetchDeveloperGameDetail,
  fetchDeveloperGameSearch,
  isTouchGalDeveloperApiConfigured
} from './developerApi'

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
const CLOUDFLARE_CLEARANCE_COOKIE_NAME = 'cf_clearance'
const TOUCHGAL_CHALLENGE_TIMEOUT_MS = 120000
const TOUCHGAL_ACCESS_PROBE_PATH =
  '/api/galgame?page=1&limit=1&selectedType=all&selectedLanguage=all&selectedPlatform=all&sortField=resource_update_time&sortOrder=desc&yearString=%5B%22all%22%5D&monthString=%5B%22all%22%5D&minRatingCount=0'
let currentToken = ''
let authCookies: Record<string, string> = {}
let win: BrowserWindow | null = null
let activeNsfwCookieMode: unknown

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

const mergeCookieStrings = (...cookieStrings: Array<string | null | undefined>) => {
  const cookies = new Map<string, string>()

  for (const cookieString of cookieStrings) {
    if (!cookieString) continue
    for (const entry of cookieString.split(';')) {
      const parsed = parseCookiePair(entry.trim())
      if (!parsed) continue
      cookies.set(parsed.name, parsed.value)
    }
  }

  return Array.from(cookies.entries())
    .map(([name, value]) => `${name}=${value}`)
    .join('; ')
}

const getStoredCookieHeader = () =>
  currentToken
    ? mergeCookieStrings(serializeAuthCookies(), buildAuthCookie(currentToken))
    : serializeAuthCookies()

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

const buildRequestCookie = (nsfwMode?: unknown, extraCookie?: string) => {
  if (nsfwMode !== undefined) {
    activeNsfwCookieMode = nsfwMode
  }

  return mergeCookieStrings(
    extraCookie,
    getStoredCookieHeader(),
    activeNsfwCookieMode !== undefined ? buildNsfwCookie(activeNsfwCookieMode) : undefined
  )
}

const syncTouchGalSessionCookies = async () => {
  if (!app.isReady()) return

  try {
    const cookies = await session.defaultSession.cookies.get({ url: TOUCHGAL_ORIGIN })
    let didChange = false

    for (const cookie of cookies) {
      if (!cookie.name || authCookies[cookie.name] === cookie.value) continue
      authCookies[cookie.name] = cookie.value
      didChange = true

      if (cookie.name === 'kun-galgame-patch-moe-token') {
        currentToken = normalizeTokenInput(cookie.value)
      }
    }

    if (didChange) {
      persistAuthCookies()
    }
  } catch (error) {
    log.warn('[API] Failed to sync TouchGal browser cookies:', error)
  }
}

const hasTouchGalClearanceCookie = async () => {
  await syncTouchGalSessionCookies()
  if (authCookies[CLOUDFLARE_CLEARANCE_COOKIE_NAME]) return true

  try {
    const cookies = await session.defaultSession.cookies.get({
      url: TOUCHGAL_ORIGIN,
      name: CLOUDFLARE_CLEARANCE_COOKIE_NAME
    })
    return cookies.length > 0
  } catch {
    return false
  }
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

const clearAppCacheData = () => {
  const userDataPath = app.getPath('userData')
  const targets = [
    'Cache',
    'Code Cache',
    'GPUCache',
    'blob_storage',
    'Local Storage',
    'Session Storage',
    'shared_proto_db',
    'DawnGraphiteCache',
    'DawnWebGPUCache',
    'Shared Dictionary',
    'SharedStorage',
    'Cookies',
    'Cookies-journal',
    'DIPS',
    'Network Persistent State',
    'Preferences',
    'TransportSecurity',
    'Trust Tokens',
    'Trust Tokens-journal',
    'VideoDecodeStats',
    'session_token.dat',
    'session_cookies.txt',
  ]

  const deletedPaths: string[] = []
  clearToken()

  for (const relativeTarget of targets) {
    const targetPath = join(userDataPath, relativeTarget)
    try {
      if (!fs.existsSync(targetPath)) continue
      fs.rmSync(targetPath, { recursive: true, force: true })
      deletedPaths.push(targetPath)
    } catch (error) {
      log.warn('[Maintenance] Failed to remove cache target:', targetPath, error)
    }
  }

  return { success: true, deletedPaths }
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

interface TouchGalAxiosRequestConfig extends AxiosRequestConfig {
  __touchGalChallengeRetried?: boolean
  __touchGalSkipChallengeVerification?: boolean
}

const getHeaderValue = (headers: AxiosResponse['headers'] | undefined, key: string) => {
  if (!headers) return ''
  const value = headers[key] ?? headers[key.toLowerCase()]
  if (Array.isArray(value)) return value.join(',')
  return typeof value === 'string' ? value : String(value ?? '')
}

const looksLikeCloudflareChallengeHtml = (data: unknown) =>
  typeof data === 'string' &&
  (/cf-mitigated/i.test(data) ||
    /Just a moment/i.test(data) ||
    /cdn-cgi\/challenge/i.test(data) ||
    /Enable JavaScript and cookies to continue/i.test(data))

const isCloudflareChallengeResponse = (response: AxiosResponse | undefined) => {
  if (!response) return false

  const contentType = getHeaderValue(response.headers, 'content-type').toLowerCase()
  const cfMitigated = getHeaderValue(response.headers, 'cf-mitigated').toLowerCase()

  return (
    response.status === 403 &&
    (cfMitigated === 'challenge' ||
      (contentType.includes('text/html') && looksLikeCloudflareChallengeHtml(response.data)))
  )
}

const SESSION_EXPIRED_PATTERNS = [
  'SESSION_EXPIRED',
  '登录失效',
  '登陆失效',
  '请先登录',
  '请先登陆',
  '未登录',
  '未登陆',
  'Login required',
]

const stringifyErrorPayload = (payload: unknown): string => {
  if (typeof payload === 'string') return payload
  if (!payload || typeof payload !== 'object') return ''

  const record = payload as Record<string, unknown>
  return [
    record.message,
    record.error,
    Array.isArray(record.errors) ? record.errors.map((item) => stringifyErrorPayload(item)).join(' ') : '',
  ]
    .filter((value): value is string => typeof value === 'string' && value.length > 0)
    .join(' ')
}

const isSessionExpiredPayload = (payload: unknown) => {
  const message = stringifyErrorPayload(payload)
  return SESSION_EXPIRED_PATTERNS.some((pattern) => message.includes(pattern))
}

let cloudflareVerificationPromise: Promise<void> | null = null

const probeTouchGalAccess = async (verificationWindow: BrowserWindow) => {
  if (verificationWindow.isDestroyed()) return false

  try {
    const result = (await verificationWindow.webContents.executeJavaScript(
      `
        fetch(${JSON.stringify(TOUCHGAL_ACCESS_PROBE_PATH)}, { credentials: 'include' })
          .then(async (response) => ({
            ok: response.ok,
            status: response.status,
            contentType: response.headers.get('content-type') || '',
            body: (await response.text()).slice(0, 160)
          }))
          .catch((error) => ({
            ok: false,
            status: 0,
            contentType: '',
            body: String(error)
          }))
      `,
      true
    )) as { ok: boolean; status: number; contentType: string; body: string }

    return result.ok && result.contentType.toLowerCase().includes('application/json')
  } catch {
    return false
  }
}

const ensureTouchGalBrowserAccess = async () => {
  if (await hasTouchGalClearanceCookie()) return
  if (cloudflareVerificationPromise) return cloudflareVerificationPromise

  cloudflareVerificationPromise = new Promise<void>((resolve, reject) => {
    const verificationWindow = new BrowserWindow({
      width: 960,
      height: 720,
      minWidth: 720,
      minHeight: 520,
      title: 'TouchGal access verification',
      autoHideMenuBar: true,
      parent: win && !win.isDestroyed() ? win : undefined,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true
      }
    })

    verificationWindow.webContents.setWindowOpenHandler((details) => {
      shell.openExternal(details.url)
      return { action: 'deny' }
    })

    let isDone = false
    let interval: NodeJS.Timeout | null = null
    let timeout: NodeJS.Timeout | null = null

    const cleanup = () => {
      if (interval) clearInterval(interval)
      if (timeout) clearTimeout(timeout)
      interval = null
      timeout = null
    }

    const finish = (error?: Error) => {
      if (isDone) return
      isDone = true
      cleanup()

      if (!verificationWindow.isDestroyed()) {
        verificationWindow.close()
      }

      if (error) {
        reject(error)
      } else {
        resolve()
      }
    }

    const checkAccess = async () => {
      if (isDone || verificationWindow.isDestroyed()) return

      await syncTouchGalSessionCookies()
      if (authCookies[CLOUDFLARE_CLEARANCE_COOKIE_NAME]) {
        finish()
        return
      }

      if (await probeTouchGalAccess(verificationWindow)) {
        await syncTouchGalSessionCookies()
        finish()
      }
    }

    verificationWindow.webContents.on('did-finish-load', () => void checkAccess())
    verificationWindow.webContents.on('did-navigate', () => void checkAccess())
    verificationWindow.webContents.on('page-title-updated', () => void checkAccess())
    verificationWindow.on('closed', () => {
      finish(new Error('TouchGal access verification was closed before completion'))
    })

    interval = setInterval(() => void checkAccess(), 1500)
    timeout = setTimeout(
      () => finish(new Error('TouchGal access verification timed out')),
      TOUCHGAL_CHALLENGE_TIMEOUT_MS
    )

    void verificationWindow.loadURL(TOUCHGAL_ORIGIN).catch((error) => {
      finish(error instanceof Error ? error : new Error(String(error)))
    })
  }).finally(() => {
    cloudflareVerificationPromise = null
  })

  return cloudflareVerificationPromise
}

const API_CLIENT = axios.create({
  baseURL: TOUCHGAL_API_BASE,
  headers: buildTouchGalBaseHeaders(activeHttpProfile),
  timeout: 30000,
})

// JWT & Cookie Interceptors
API_CLIENT.interceptors.request.use(async (config) => {
  await syncTouchGalSessionCookies()

  config.headers = config.headers ?? {}
  const existingCookie = config.headers['Cookie'] as string | undefined
  const cookieHeader = buildRequestCookie(undefined, existingCookie)
  if (cookieHeader) {
    config.headers['Cookie'] = cookieHeader
  }

  if (currentToken) {
    // 1. Standard JWT Authorization Header
    config.headers['Authorization'] = `Bearer ${currentToken}`;
  }
  
  log.debug(`[API Request] ${config.method?.toUpperCase()} ${config.url}`, {
    params: config.params,
    headers: { ...config.headers, Authorization: 'Bearer [REDACTED]', Cookie: '[REDACTED]' }
  });
  return config;
})

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
}, async (error: AxiosError) => {
  if (error.response?.status === 401 && isSessionExpiredPayload(error.response.data)) {
    throw new Error('SESSION_EXPIRED')
  }

  if (isCloudflareChallengeResponse(error.response)) {
    const originalConfig = error.config as TouchGalAxiosRequestConfig | undefined

    if (originalConfig?.__touchGalSkipChallengeVerification) {
      throw new Error('TouchGal legacy API requires browser verification')
    }

    if (originalConfig && !originalConfig.__touchGalChallengeRetried) {
      originalConfig.__touchGalChallengeRetried = true
      log.warn('[API] TouchGal returned Cloudflare challenge; opening browser verification window')

      try {
        await ensureTouchGalBrowserAccess()
        await syncTouchGalSessionCookies()
        return API_CLIENT.request(originalConfig)
      } catch (verificationError) {
        log.error('[API] TouchGal browser verification failed:', verificationError)
        throw new Error('TouchGal 访问验证未完成。请在弹出的 TouchGal 窗口完成验证后重试。', {
          cause: verificationError
        })
      }
    }

    throw new Error('TouchGal 返回了 Cloudflare 验证页面，当前请求未获得 JSON 数据。')
  }

  throw error
})

interface RawCount {
  favorite_folder?: number
  patch_resource?: number
  patch_comment?: number
  resource_count?: number
  comment_count?: number
  resource?: number
  comment?: number
  patch?: number
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
  links?: Array<{
    id?: number
    storage?: string | null
    size?: string | null
    code?: string | null
    password?: string | null
    hash?: string | null
    url?: string | null
    content?: string | null
    sortOrder?: number | null
    download?: number | null
  }> | null
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

const asStringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : []

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
  const favoriteCount = raw.favoriteCount ?? raw.favorite_count ?? counts.favorite_folder ?? 0
  const resourceCount =
    raw.resourceCount ??
    raw.resource_count ??
    counts.patch_resource ??
    counts.resource_count ??
    counts.resource ??
    counts.patch ??
    0
  const commentCount =
    raw.commentCount ??
    raw.comment_count ??
    counts.patch_comment ??
    counts.comment_count ??
    counts.comment ??
    0

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
    resourceCount,
    commentCount,
    releasedDate,
    resourceUpdateTime: raw.resourceUpdateTime ?? raw.resource_update_time ?? null,
    created: raw.created ?? null,
    company,
    pvUrl: raw.pvVideoUrl ?? raw.pv_video_url ?? raw.pvUrl ?? raw.pv_url ?? null,
    screenshots,
    detail, // Critical for screenshots
    alias: asStringArray(raw.alias),
    vndbId: raw.vndbId ?? raw.vndb_id ?? null,
    bangumiId: raw.bangumiId ?? raw.bangumi_id ?? null,
    steamId: raw.steamId != null ? String(raw.steamId) : raw.steam_id != null ? String(raw.steam_id) : null,
    contentLimit: raw.contentLimit ?? raw.content_limit ?? null,
    platform: asArray(raw.platform),
    language: asArray(raw.language),
    type: asArray(raw.type),
    touchgalUrl: raw.touchgalUrl ?? raw.touchgal_url ?? null,
  }
}

const normalizeDownloadType = (value: unknown) => {
  if (typeof value !== 'string') return null
  if (value === 'row') return 'raw'
  return value
}

const normalizeDownloadLinks = (download: RawDownload) => {
  const rawLinks = Array.isArray(download.links) && download.links.length > 0
    ? download.links
    : [{
        id: undefined,
        storage: download.storage,
        size: download.size,
        code: download.code,
        password: download.password,
        hash: download.hash,
        content: download.content ?? download.url ?? null,
        url: download.url ?? download.content ?? null,
        sortOrder: null,
        download: download.download ?? null
      }]

  return rawLinks
    .map((link) => {
      const content = link.content ?? link.url ?? null
      const url = link.url ?? link.content ?? null
      return {
        id: link.id ?? null,
        storage: link.storage ?? download.storage ?? null,
        size: link.size ?? download.size ?? null,
        code: link.code ?? download.code ?? null,
        password: link.password ?? download.password ?? null,
        hash: link.hash ?? download.hash ?? null,
        content,
        url,
        sortOrder: link.sortOrder ?? null,
        download: link.download ?? null
      }
    })
    .filter((link) => Boolean(link.content || link.url))
}

const normalizeDownloads = (downloads: RawDownload[]) =>
  downloads.map((download) => {
    const links = normalizeDownloadLinks(download)
    const firstLink = links[0] ?? null

    return {
      id: download.id ?? 0,
      name: download.name ?? '',
      section: download.section ?? null,
      size: firstLink?.size ?? download.size ?? null,
      url: firstLink?.url ?? firstLink?.content ?? download.url ?? download.content ?? null,
      content: firstLink?.content ?? firstLink?.url ?? download.content ?? download.url ?? null,
      storage: firstLink?.storage ?? download.storage ?? null,
      type: asArray(download.type)
        .map(normalizeDownloadType)
        .filter((value): value is string => Boolean(value)),
      language: asArray(download.language),
      code: firstLink?.code ?? download.code ?? null,
      password: firstLink?.password ?? download.password ?? null,
      note: download.note ?? null,
      hash: firstLink?.hash ?? download.hash ?? null,
      platform: asArray(download.platform),
      likeCount: download.likeCount ?? 0,
      downloadCount:
        links.reduce((sum, link) => sum + (typeof link.download === 'number' ? link.download : 0), 0) ||
        (download.download ?? 0),
      created: download.created ?? null,
      links,
      userId: download.userId ?? download.user?.id ?? null,
      user: download.user
        ? {
            id: download.user.id ?? 0,
            name: download.user.name ?? 'Unknown',
            avatar: download.user.avatar ?? null,
            role: download.user.role ?? 0,
            patchCount: download.user.patchCount ?? 0
          }
        : null
    }
  })

const normalizeFeedResponse = (payload: { galgames?: RawResource[]; resources?: RawResource[]; list?: RawResource[]; total?: number }) => {
  const sourceList = payload.galgames ?? payload.resources ?? payload.list ?? []
  const list = sourceList.map(normalizeResource)
  log.info(`[API] Normalized ${list.length} games. Total: ${payload.total}`)
  return {
    list,
    total: payload.total ?? 0,
  }
}

const upsertNormalizedGames = (games: Array<{
  id: number
  uniqueId: string
  name: string
  banner?: string | null
  averageRating?: number
  ratingCount?: number
  ratingSummary?: unknown
  viewCount?: number
  downloadCount?: number
  favoriteCount?: number
  resourceCount?: number
  commentCount?: number
  alias?: string[]
  tags?: string[]
  company?: string | null
  companyAliases?: string[]
  platform?: string[]
  language?: string[]
  type?: string[]
  created?: string | null
  releasedDate?: string | null
  resourceUpdateTime?: string | null
  touchgalUrl?: string | null
}>) => {
  for (const game of games) {
    if (!game.uniqueId || !game.name) continue
    upsertGame({
      id: game.id,
      uniqueId: game.uniqueId,
      name: game.name,
      banner: game.banner ?? null,
      averageRating: game.averageRating ?? 0,
      ratingCount: game.ratingCount ?? 0,
      ratingSummary: game.ratingSummary ?? null,
      viewCount: game.viewCount ?? 0,
      downloadCount: game.downloadCount ?? 0,
      favoriteCount: game.favoriteCount ?? 0,
      resourceCount: game.resourceCount ?? 0,
      commentCount: game.commentCount ?? 0,
      alias: Array.isArray(game.alias) ? game.alias : [],
      tags: Array.isArray(game.tags) ? game.tags : [],
      company: game.company ?? null,
      companyAliases: Array.isArray(game.companyAliases) ? game.companyAliases : [],
      platform: Array.isArray(game.platform) ? game.platform : [],
      language: Array.isArray(game.language) ? game.language : [],
      type: Array.isArray(game.type) ? game.type : [],
      created: game.created ?? null,
      releasedDate: game.releasedDate ?? null,
      resourceUpdateTime: game.resourceUpdateTime ?? null,
      touchgalUrl: game.touchgalUrl ?? null
    })
  }
}

const parseCachedGameDetail = (value: unknown) => {
  if (typeof value !== 'string' || !value.trim()) return {}
  try {
    return JSON.parse(value) as Record<string, unknown>
  } catch {
    return {}
  }
}

const getCachedRemotePatchId = (detail: Record<string, unknown>) => {
  for (const value of [detail.remotePatchId, detail.patchId, detail.id]) {
    const remotePatchId = typeof value === 'number' ? value : Number(value)
    if (Number.isInteger(remotePatchId) && remotePatchId > 0) return remotePatchId
  }
  return 0
}

const getCachedNumber = (detail: Record<string, unknown>, key: string, fallback = 0) => {
  const value = detail[key]
  const numberValue = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(numberValue) ? numberValue : fallback
}

const getCachedString = (detail: Record<string, unknown>, key: string) =>
  typeof detail[key] === 'string' ? detail[key] as string : null

const extractCompanyAliases = (companies: unknown): string[] => {
  if (!Array.isArray(companies)) return []
  return companies.flatMap((company: any) => {
    const aliases = Array.isArray(company?.aliases)
      ? company.aliases
      : Array.isArray(company?.alias)
        ? company.alias
        : []
    return aliases.filter((alias: unknown): alias is string =>
      typeof alias === 'string' && alias.trim().length > 0
    )
  })
}

const matchesSuggestionQuery = (value: unknown, terms: string[]) => {
  if (typeof value !== 'string' || !value.trim()) return false
  const normalized = value.toLocaleLowerCase()
  return terms.some((term) => normalized.includes(term))
}

const buildCachedTagSuggestions = (keyword: string) => {
  const terms = buildSearchTerms(keyword)
    .map((term) => term.toLocaleLowerCase())
    .filter(Boolean)
  if (terms.length === 0) return []

  const suggestions = new Map<string, { id: number; type: 'tag' | 'company'; mode: 'include'; name: string; count: number }>()
  const rows = getDb().prepare(`
    SELECT detail_json AS detailJson
    FROM games
    WHERE detail_json IS NOT NULL AND detail_json != ''
    ORDER BY local_updated_at DESC
    LIMIT 1000
  `).all() as Array<{ detailJson: string | null }>

  const addSuggestion = (type: 'tag' | 'company', name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return
    const key = `${type}:${trimmed}`
    const existing = suggestions.get(key)
    if (existing) {
      existing.count += 1
      return
    }
    suggestions.set(key, {
      id: 0,
      type,
      mode: 'include',
      name: trimmed,
      count: 1,
    })
  }

  for (const row of rows) {
    const detail = parseCachedGameDetail(row.detailJson)
    const tags = asStringArray(detail.tags)
    const company = getCachedString(detail, 'company')
    const companyNames = typeof company === 'string'
      ? company.split(',').map((value) => value.trim()).filter(Boolean)
      : []
    const companyAliases = asStringArray(detail.companyAliases)

    for (const tag of tags) {
      if (matchesSuggestionQuery(tag, terms)) addSuggestion('tag', tag)
    }

    const companyMatched = [
      ...companyNames,
      ...companyAliases,
    ].some((value) => matchesSuggestionQuery(value, terms))
    if (companyMatched) {
      for (const companyName of companyNames) addSuggestion('company', companyName)
    }
  }

  return Array.from(suggestions.values())
    .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name))
    .slice(0, 100)
}

const fetchCachedGameFeed = (page: number, limit: number, query?: any) => {
  const safePage = Math.max(1, Number(page) || 1)
  const safeLimit = clampApiLimit(limit)
  const offset = (safePage - 1) * safeLimit
  const db = getDb()
  const rows = db.prepare(`
    SELECT
      id,
      unique_id AS uniqueId,
      name,
      banner_url AS banner,
      avg_rating AS averageRating,
      view_count AS viewCount,
      download_count AS downloadCount,
      detail_json AS detailJson,
      local_updated_at AS resourceUpdateTime
    FROM games
    ORDER BY local_updated_at DESC, id DESC
  `).all()

  const list = rows.map((row: any) => {
      const detail = parseCachedGameDetail(row.detailJson)
      return {
        id: getCachedRemotePatchId(detail),
        uniqueId: row.uniqueId ?? '',
        name: row.name ?? 'Unknown title',
        banner: row.banner ?? null,
        averageRating: row.averageRating ?? 0,
        ratingCount: getCachedNumber(detail, 'ratingCount'),
        ratingSummary:
          detail.ratingSummary && typeof detail.ratingSummary === 'object'
            ? detail.ratingSummary
            : null,
        tags: asStringArray(detail.tags),
        viewCount: row.viewCount ?? 0,
        downloadCount: row.downloadCount ?? 0,
        favoriteCount: getCachedNumber(detail, 'favoriteCount'),
        resourceCount: getCachedNumber(detail, 'resourceCount'),
        commentCount: getCachedNumber(detail, 'commentCount'),
        releasedDate: getCachedString(detail, 'releasedDate'),
        resourceUpdateTime:
          typeof detail.resourceUpdateTime === 'string'
            ? detail.resourceUpdateTime
            : row.resourceUpdateTime ?? null,
        created: getCachedString(detail, 'created'),
        company: getCachedString(detail, 'company'),
        companyAliases: asStringArray(detail.companyAliases),
        pvUrl: null,
        screenshots: [],
        detail: null,
        alias: asStringArray(detail.alias),
        vndbId: getCachedString(detail, 'vndbId'),
        bangumiId: getCachedNumber(detail, 'bangumiId') || null,
        steamId: getCachedString(detail, 'steamId'),
        contentLimit: getCachedString(detail, 'contentLimit'),
        platform: asStringArray(detail.platform),
        language: asStringArray(detail.language),
        type: asStringArray(detail.type),
        touchgalUrl: getCachedString(detail, 'touchgalUrl'),
        downloads: [],
        source: 'local-cache'
      }
    })
  const filtered = applyQueryToDeveloperFallbackList(list, query)

  return {
    list: filtered.slice(offset, offset + safeLimit),
    total: filtered.length,
    source: 'local-cache'
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
    companyAliases: extractCompanyAliases(payload.company),
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

const clampApiLimit = (limit: number) => Math.min(Math.max(Number(limit) || 24, 1), 24)

const buildSearchBody = (keyword: string, page: number, limit: number) => ({
  queryString: JSON.stringify(
    buildSearchTerms(keyword).map((term) => ({ type: 'keyword', name: term }))
  ),
  limit: clampApiLimit(limit),
  page,
  selectedType: 'all',
  selectedLanguage: 'all',
  selectedPlatform: 'all',
  sortField: 'resource_update_time',
  sortOrder: 'desc',
  selectedYears: ['all'],
  selectedMonths: ['all'],
  minRatingCount: 0,
  searchOption: {
    searchInIntroduction: true,
    searchInAlias: true,
    searchInTag: true,
  },
})

const DEVELOPER_BROWSE_FALLBACK_KEYWORD = '恋'
const DEVELOPER_FALLBACK_MAX_SCAN_PAGES = 6

const getDeveloperBrowseFallbackKeyword = (query: any) => {
  const selectedTags = Array.isArray(query?.selectedTags)
    ? query.selectedTags
    : []
  const tagKeyword = selectedTags.find((tag: unknown) =>
    typeof tag === 'string' && tag.trim().length > 0
  )
  return typeof tagKeyword === 'string'
    ? tagKeyword.trim()
    : DEVELOPER_BROWSE_FALLBACK_KEYWORD
}

const getComparableTime = (value: unknown) => {
  if (typeof value !== 'string' || !value) return 0
  const time = new Date(value).getTime()
  return Number.isFinite(time) ? time : 0
}

const getDeveloperFallbackYear = (game: any) => {
  const date = game.releasedDate ?? game.created
  if (typeof date !== 'string' || !date) return null
  const year = new Date(date).getFullYear()
  return Number.isInteger(year) ? year : null
}

const matchesYearConstraints = (
  year: number | null,
  constraints: Array<{ op: string; val: number }>
) => {
  if (constraints.length === 0) return true
  if (year == null) return false

  return constraints.every((constraint) => {
    if (constraint.op === '=') return year === constraint.val
    if (constraint.op === '>=') return year >= constraint.val
    if (constraint.op === '<=') return year <= constraint.val
    if (constraint.op === '>') return year > constraint.val
    if (constraint.op === '<') return year < constraint.val
    return true
  })
}

const normalizeSearchText = (value: unknown) =>
  typeof value === 'string'
    ? value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').toLocaleLowerCase()
    : ''

const developerGameMatchesSearchOptions = (
  game: any,
  keyword: string,
  options?: Record<string, any>
) => {
  const terms = buildSearchTerms(keyword).map((term) => term.toLocaleLowerCase())
  if (terms.length === 0) return true

  const searchOption = options?.searchOption ?? {}
  const fields = [
    game.name,
    ...(searchOption.searchInAlias !== false && Array.isArray(game.alias) ? game.alias : []),
    ...(searchOption.searchInTag !== false && Array.isArray(game.tags) ? game.tags : []),
    searchOption.searchInIntroduction !== false ? game.introduction : '',
  ].map(normalizeSearchText).filter(Boolean)

  return terms.every((term) => fields.some((field) => field.includes(term)))
}

const developerResourceValuesInclude = (values: unknown, selectedValue: unknown) => {
  if (typeof selectedValue !== 'string' || selectedValue === 'all') return true
  const normalizedValues = Array.isArray(values)
    ? values.filter((value): value is string => typeof value === 'string' && value.length > 0)
    : typeof values === 'string' && values.length > 0
      ? [values]
      : []
  if (selectedValue === 'raw') return normalizedValues.some((value) => value === 'raw' || value === 'row')
  if (selectedValue === 'row') return normalizedValues.some((value) => value === 'row' || value === 'raw')
  return normalizedValues.includes(selectedValue)
}

const getDeveloperCompanyValues = (game: any) => {
  const values = new Set<string>()
  const company = game?.company
  const companyAliases = game?.companyAliases

  if (typeof company === 'string') {
    for (const value of company.split(',')) {
      const trimmed = value.trim()
      if (trimmed) values.add(trimmed)
    }
  }

  if (Array.isArray(companyAliases)) {
    for (const alias of companyAliases) {
      if (typeof alias !== 'string') continue
      const trimmed = alias.trim()
      if (trimmed) values.add(trimmed)
    }
  }

  return values
}

const applyQueryToDeveloperFallbackList = (list: any[], query: any) => {
  const selectedType = query?.selectedType ?? 'all'
  const selectedLanguage = query?.selectedLanguage ?? 'all'
  const selectedPlatform = query?.selectedPlatform ?? 'all'
  const minRatingCount = Number(query?.minRatingCount ?? 0) || 0
  const minRatingScore = Number(query?.minRatingScore ?? 0) || 0
  const minCommentCount = Number(query?.minCommentCount ?? 0) || 0
  const yearConstraints: Array<{ op: string; val: number }> = Array.isArray(query?.yearConstraints)
    ? query.yearConstraints
    : []
  const selectedTags: string[] = Array.isArray(query?.selectedTags)
    ? query.selectedTags.filter((tag: unknown): tag is string => typeof tag === 'string' && tag.length > 0)
    : []
  const sortField = query?.sortField ?? 'resource_update_time'
  const sortOrder = query?.sortOrder === 'asc' ? 'asc' : 'desc'

  const filtered = list.filter((game) => {
    if (!developerResourceValuesInclude(game.type, selectedType)) return false

    if (!developerResourceValuesInclude(game.language, selectedLanguage)) return false

    if (selectedPlatform !== 'all') {
      const platforms = Array.isArray(game.platform) ? game.platform : []
      if (!platforms.includes(selectedPlatform)) return false
    }

    const ratingCount = Number(game.ratingCount ?? game.ratingSummary?.count ?? 0) || 0
    if (ratingCount < minRatingCount) return false

    const averageRating = Number(game.averageRating ?? 0) || 0
    if (averageRating < minRatingScore) return false

    const commentCount = Number(game.commentCount ?? 0) || 0
    if (commentCount < minCommentCount) return false

    if (!matchesYearConstraints(getDeveloperFallbackYear(game), yearConstraints)) return false

    if (selectedTags.length > 0) {
      const tags = Array.isArray(game.tags) ? game.tags : []
      const companies = getDeveloperCompanyValues(game)
      if (!selectedTags.every((tag) => tags.includes(tag) || companies.has(tag))) return false
    }

    return true
  })

  const getSortValue = (game: any) => {
    if (sortField === 'created') return getComparableTime(game.created ?? game.releasedDate)
    if (sortField === 'rating') return Number(game.averageRating ?? 0) || 0
    if (sortField === 'view') return Number(game.viewCount ?? 0) || 0
    if (sortField === 'download') return Number(game.downloadCount ?? 0) || 0
    if (sortField === 'favorite') return Number(game.favoriteCount ?? 0) || 0
    return getComparableTime(game.resourceUpdateTime ?? game.updatedAt ?? game.created)
  }

  return [...filtered].sort((left, right) => {
    const diff = getSortValue(left) - getSortValue(right)
    return sortOrder === 'asc' ? diff : -diff
  })
}

const buildDeveloperFallbackTotal = (
  start: number,
  pageListLength: number,
  filteredLength: number,
  scannedHasMore: boolean,
  pageSize: number
) => {
  const visibleTotal = start + pageListLength
  if (!scannedHasMore) return Math.max(filteredLength, visibleTotal)
  return pageListLength >= pageSize ? visibleTotal + 1 : Math.max(filteredLength, visibleTotal)
}

const fetchDeveloperFilteredFallback = async (input: {
  keyword: string
  page: number
  limit: number
  query: any
  source: string
  fallbackKeyword?: string
  itemPredicate?: (game: any) => boolean
}) => {
  const safePage = Math.max(1, Number(input.page) || 1)
  const pageSize = clampApiLimit(input.limit)
  const start = (safePage - 1) * pageSize
  const targetCount = start + pageSize
  const collectedById = new Map<string, any>()
  let lastResult: Awaited<ReturnType<typeof fetchDeveloperGameSearch>> | null = null
  let hasMore = true

  for (let currentPage = 1; currentPage <= DEVELOPER_FALLBACK_MAX_SCAN_PAGES; currentPage += 1) {
    lastResult = await fetchDeveloperGameSearch(input.keyword, currentPage, pageSize, {
      hydrateDetails: true,
    })

    for (const game of lastResult.list) {
      if (!game.uniqueId || collectedById.has(game.uniqueId)) continue
      collectedById.set(game.uniqueId, game)
    }

    const filtered = applyQueryToDeveloperFallbackList(
      Array.from(collectedById.values()).filter((game) =>
        input.itemPredicate ? input.itemPredicate(game) : true
      ),
      input.query
    )

    hasMore = Boolean(lastResult.pagination?.hasMore)
    if (filtered.length >= targetCount || !hasMore) {
      const list = filtered.slice(start, start + pageSize)
      upsertNormalizedGames(filtered)
      return {
        list,
        total: buildDeveloperFallbackTotal(start, list.length, filtered.length, hasMore, pageSize),
        pagination: lastResult.pagination ?? null,
        source: input.source,
        fallbackKeyword: input.fallbackKeyword,
        scannedPages: currentPage,
      }
    }
  }

  const filtered = applyQueryToDeveloperFallbackList(
    Array.from(collectedById.values()).filter((game) =>
      input.itemPredicate ? input.itemPredicate(game) : true
    ),
    input.query
  )
  const list = filtered.slice(start, start + pageSize)
  upsertNormalizedGames(filtered)

  return {
    list,
    total: buildDeveloperFallbackTotal(start, list.length, filtered.length, hasMore, pageSize),
    pagination: lastResult?.pagination ?? null,
    source: input.source,
    fallbackKeyword: input.fallbackKeyword,
    scannedPages: DEVELOPER_FALLBACK_MAX_SCAN_PAGES,
  }
}

const fetchDeveloperBrowseFallback = async (page: number, limit: number, query: any) => {
  const keyword = getDeveloperBrowseFallbackKeyword(query)
  return fetchDeveloperFilteredFallback({
    keyword,
    page,
    limit,
    query,
    source: 'developer-api-browse-fallback',
    fallbackKeyword: keyword,
  })
}

const isDefaultSearchOption = (value: unknown) => {
  if (!value || typeof value !== 'object') return true
  const option = value as Record<string, unknown>
  return option.searchInIntroduction !== false &&
    option.searchInAlias !== false &&
    option.searchInTag !== false
}

const shouldPreferLegacySearch = (options?: Record<string, any>) => {
  if (!options) return false

  const sortField = options.sortField ?? 'resource_update_time'
  const sortOrder = options.sortOrder ?? 'desc'
  const nsfwMode = options.nsfwMode ?? 'safe'
  const selectedType = options.selectedType ?? 'all'
  const selectedLanguage = options.selectedLanguage ?? 'all'
  const selectedPlatform = options.selectedPlatform ?? 'all'

  return !isDefaultSearchOption(options.searchOption) ||
    selectedType !== 'all' ||
    selectedLanguage !== 'all' ||
    selectedPlatform !== 'all' ||
    nsfwMode !== 'safe' ||
    sortField !== 'resource_update_time' ||
    sortOrder !== 'desc'
}

const ensureValidResponse = <T>(payload: T | string | unknown[]): T => {
  if (!payload) {
    throw new Error('Empty response from API')
  }

  if (typeof payload === 'string') {
    log.error('[API] Error payload (string):', payload)
    if (isSessionExpiredPayload(payload)) {
      throw new Error('SESSION_EXPIRED')
    }
    throw new Error(payload)
  }

  // Handle common error object patterns
  if (typeof payload === 'object' && !Array.isArray(payload)) {
    const obj = payload as any;
    if (obj.error || obj.message || obj.errors) {
       const msg = obj.message || obj.error || (Array.isArray(obj.errors) ? obj.errors[0]?.message : 'Unknown API Error');
       if (isSessionExpiredPayload(obj)) {
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

const getSafeErrorMessage = (error: unknown) => {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status ? `HTTP ${error.response.status}: ` : ''
    return `${status}${error.message}`
  }

  return error instanceof Error ? error.message : String(error)
}

const mergeDeveloperAndLegacyDetail = (developerDetail: any, legacyDetail: any | null) => {
  if (!legacyDetail) return developerDetail

  const developerRatingSummary = developerDetail.ratingSummary
  const legacyRatingSummary = legacyDetail.ratingSummary
  const developerHistogram = Array.isArray(developerRatingSummary?.histogram)
    ? developerRatingSummary.histogram
    : []
  const legacyHistogram = Array.isArray(legacyRatingSummary?.histogram)
    ? legacyRatingSummary.histogram
    : []
  const preferPositiveNumber = (primary: unknown, fallback: unknown) => {
    const primaryNumber = typeof primary === 'number' ? primary : Number(primary)
    if (Number.isFinite(primaryNumber) && primaryNumber > 0) return primaryNumber
    const fallbackNumber = typeof fallback === 'number' ? fallback : Number(fallback)
    if (Number.isFinite(fallbackNumber) && fallbackNumber > 0) return fallbackNumber
    return Number.isFinite(primaryNumber) ? primaryNumber : 0
  }
  const mergeRecommend = (
    developerRecommend: Record<string, unknown> | undefined,
    legacyRecommend: Record<string, unknown> | undefined
  ) => ({
    strong_no: preferPositiveNumber(developerRecommend?.strong_no, legacyRecommend?.strong_no),
    no: preferPositiveNumber(developerRecommend?.no, legacyRecommend?.no),
    neutral: preferPositiveNumber(developerRecommend?.neutral, legacyRecommend?.neutral),
    yes: preferPositiveNumber(developerRecommend?.yes, legacyRecommend?.yes),
    strong_yes: preferPositiveNumber(developerRecommend?.strong_yes, legacyRecommend?.strong_yes)
  })
  const ratingSummary =
    developerRatingSummary || legacyRatingSummary
      ? {
          ...(legacyRatingSummary ?? {}),
          ...(developerRatingSummary ?? {}),
          average: preferPositiveNumber(developerRatingSummary?.average, legacyRatingSummary?.average),
          count: preferPositiveNumber(developerRatingSummary?.count, legacyRatingSummary?.count),
          histogram: developerHistogram.length > 0 ? developerHistogram : legacyHistogram,
          recommend: mergeRecommend(developerRatingSummary?.recommend, legacyRatingSummary?.recommend)
        }
      : null

  return {
    ...legacyDetail,
    ...developerDetail,
    id: legacyDetail.id || developerDetail.id || 0,
    vndbId: developerDetail.vndbId ?? legacyDetail.vndbId ?? null,
    bangumiId: developerDetail.bangumiId ?? legacyDetail.bangumiId ?? null,
    steamId: developerDetail.steamId ?? legacyDetail.steamId ?? null,
    contentLimit: developerDetail.contentLimit ?? legacyDetail.contentLimit ?? null,
    ratingSummary,
    viewCount: legacyDetail.viewCount || developerDetail.viewCount || 0,
    downloadCount: legacyDetail.downloadCount || developerDetail.downloadCount || 0,
    favoriteCount: legacyDetail.favoriteCount || developerDetail.favoriteCount || 0,
    resourceCount: legacyDetail.resourceCount || developerDetail.resourceCount || 0,
    commentCount: legacyDetail.commentCount || developerDetail.commentCount || 0,
    screenshots:
      Array.isArray(legacyDetail.screenshots) && legacyDetail.screenshots.length > 0
        ? legacyDetail.screenshots
        : developerDetail.screenshots,
    pvUrl: legacyDetail.pvUrl || developerDetail.pvUrl || null,
    downloads:
      Array.isArray(legacyDetail.downloads) && legacyDetail.downloads.length > 0
        ? legacyDetail.downloads
        : developerDetail.downloads,
  }
}

const fetchLegacyPatchDetail = async (
  uniqueId: string,
  options: { skipChallengeVerification?: boolean } = {}
) => {
  const legacyRequestConfig: TouchGalAxiosRequestConfig = options.skipChallengeVerification
    ? { __touchGalSkipChallengeVerification: true }
    : {}

  const [detailResponse, introResponse] = await Promise.all([
    API_CLIENT.get('/patch', { ...legacyRequestConfig, params: { uniqueId } }),
    API_CLIENT.get('/patch/introduction', { ...legacyRequestConfig, params: { uniqueId } }),
  ])

  const detail = normalizeResource(ensureValidResponse(detailResponse.data))
  const intro = normalizeIntroduction(ensureValidResponse(introResponse.data))

  let downloads: any[] = []
  try {
    if (detail.id) {
      const dlResponse = await API_CLIENT.get('/patch/resource', {
        ...legacyRequestConfig,
        params: { patchId: detail.id }
      })
      downloads = normalizeDownloads(ensureValidResponse(dlResponse.data))
    }
  } catch {
    log.warn('Failed to fetch downloads for', uniqueId)
  }

  return { ...detail, ...intro, downloads }
}

const fetchLegacyPatchDetailWhenAccessible = async (uniqueId: string) => {
  if (!(await hasTouchGalClearanceCookie())) {
    log.info(`[API] Skipping legacy detail hydration for ${uniqueId}; TouchGal clearance cookie is not available`)
    return null
  }

  return fetchLegacyPatchDetail(uniqueId, { skipChallengeVerification: true })
}

const cacheFetchedGameDetail = (uniqueId: string, detail: any) => {
  if (!detail || typeof detail !== 'object') return
  const normalizedDetail = {
    ...detail,
    uniqueId: detail.uniqueId ?? uniqueId
  }
  if (!normalizedDetail.uniqueId || !normalizedDetail.name) return

  upsertNormalizedGames([normalizedDetail])
  saveGameDetail(normalizedDetail.uniqueId, normalizedDetail)
}

const getUsableCachedGameDetail = (uniqueId: string) => {
  const cached = getCachedDetail(uniqueId)
  if (!cached || typeof cached !== 'object') return null
  const detail = cached as Record<string, unknown>
  return typeof detail.name === 'string' && detail.name.trim()
    ? { ...detail, uniqueId: detail.uniqueId ?? uniqueId }
    : null
}

interface ScannedLibraryFolder {
  rootPath: string
  path: string
  folderName: string
  tg_id: string | null
  matchState: 'linked' | 'orphaned' | 'unresolved'
  executableNames: string[]
  depth: number
}

const MAX_LIBRARY_SCAN_DEPTH = 3

const isPathInsideRoot = (targetPath: string, rootPath: string) => {
  const relative = path.relative(rootPath, targetPath)
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))
}

const scanForGalgameFolders = async (rootPaths: string[]) => {
  const db = getDb()
  const results: ScannedLibraryFolder[] = []
  const knownIds = new Set(
    (
      db.prepare('SELECT unique_id FROM games').all() as Array<{ unique_id: string }>
    ).map((row) => row.unique_id)
  )

  const walkDirectory = async (rootPath: string, currentPath: string, depth: number): Promise<void> => {
    if (depth > MAX_LIBRARY_SCAN_DEPTH) return

    let entries: fs.Dirent[]
    try {
      entries = await fs.promises.readdir(currentPath, { withFileTypes: true })
    } catch {
      return
    }

    const directories = entries.filter((entry) => entry.isDirectory())
    const tgIdPath = path.join(currentPath, '.tg_id')
    let tg_id: string | null = null

    try {
      if (fs.existsSync(tgIdPath)) {
        tg_id = (await fs.promises.readFile(tgIdPath, 'utf8')).trim() || null
      }
    } catch {
      tg_id = null
    }

    const executableNames = await discoverExecutables(currentPath)
    const isCandidate = depth > 0 && (Boolean(tg_id) || executableNames.length > 0)

    if (isCandidate) {
      const matchState =
        tg_id != null
          ? (knownIds.has(tg_id) ? 'linked' : 'orphaned')
          : 'unresolved'

      results.push({
        rootPath,
        path: currentPath,
        folderName: path.basename(currentPath),
        tg_id,
        matchState,
        executableNames,
        depth,
      })
    }

    await Promise.all(
      directories.map((dir) => walkDirectory(rootPath, path.join(currentPath, dir.name), depth + 1))
    )
  }

  await Promise.all(
    rootPaths.map(async (rootPath) => {
      try {
        if (!fs.existsSync(rootPath)) return
        await walkDirectory(rootPath, rootPath, 0)
      } catch {
        return
      }
    })
  )

  results.sort((a, b) => a.path.localeCompare(b.path))
  return results
}

const childWindows = new Set<BrowserWindow>()

const loadRendererTarget = (targetWindow: BrowserWindow, query?: Record<string, string>) => {
  const search = query ? new URLSearchParams(query).toString() : ''

  if (process.env['ELECTRON_RENDERER_URL']) {
    const url = new URL(process.env['ELECTRON_RENDERER_URL'])
    if (search) {
      url.search = search
    }
    targetWindow.loadURL(url.toString())
    return
  }

  targetWindow.loadFile(join(__dirname, '../renderer/index.html'), search ? { search: `?${search}` } : undefined)
}

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

  loadRendererTarget(win)

  if (process.env['ELECTRON_RENDERER_URL']) {
    win.webContents.openDevTools()
  }
}

const createLocalGameWindow = (localGameId: number) => {
  const linkedGame = getLinkedLocalGameById(localGameId)
  if (!linkedGame) {
    throw new Error('Local game not found')
  }

  const child = new BrowserWindow({
    width: 1280,
    height: 900,
    minWidth: 980,
    minHeight: 720,
    autoHideMenuBar: true,
    title: linkedGame.name ?? `Local Game ${linkedGame.id}`,
    parent: win ?? undefined,
    webPreferences: {
      preload: join(__dirname, '../preload/index.cjs'),
      sandbox: false,
    },
  })

  child.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  childWindows.add(child)
  child.on('closed', () => {
    childWindows.delete(child)
  })

  loadRendererTarget(child, {
    window: 'local-game',
    localGameId: String(localGameId),
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    child.webContents.openDevTools({ mode: 'detach' })
  }

  return { success: true }
}

app.whenReady().then(() => {
  initDb()
  addLibraryRoot(downloadManager.getDefaultLibraryDirectory())
  downloadManager.subscribeQueue((queue) => {
    if (!win || win.isDestroyed()) return
    win.webContents.send('download-queue-updated', queue)
  })
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
    INSERT INTO local_paths (path, game_id, exe_path, source, status, last_verified_at)
    VALUES (?, (SELECT id FROM games WHERE unique_id = ?), ?, 'scan', ?, CURRENT_TIMESTAMP)
    ON CONFLICT(path) DO UPDATE SET
      game_id = COALESCE(excluded.game_id, local_paths.game_id),
      exe_path = COALESCE(excluded.exe_path, local_paths.exe_path),
      source = 'scan',
      status = excluded.status,
      last_verified_at = CURRENT_TIMESTAMP
  `)

  const transaction = db.transaction((items: ScannedLibraryFolder[]) => {
    for (const item of items) {
      const status = item.matchState === 'linked' ? 'linked' : 'discovered'
      insertPath.run(item.path, item.tg_id, item.executableNames[0] ?? null, status)
    }
  })

  transaction(folders)
  markLibraryRootsScanned(paths)
  return folders
})

handleWithLog('tg-library-list-roots', () => {
  return listLibraryRoots()
})

handleWithLog('tg-library-add-root', (_event, rootPath: string) => {
  return addLibraryRoot(rootPath)
})

handleWithLog('tg-library-remove-root', (_event, rootId: number) => {
  return removeLibraryRoot(rootId)
})

handleWithLog('tg-library-pick-root', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory'],
  })

  if (result.canceled || result.filePaths.length === 0) {
    return null
  }

  return result.filePaths[0]
})

handleWithLog('tg-library-rescan', async (_event, rootPaths?: string[]) => {
  const paths = Array.isArray(rootPaths) && rootPaths.length > 0
    ? rootPaths
    : listLibraryRoots().map((root) => root.path)

  const folders = await scanForGalgameFolders(paths)
  const db = getDb()
  const seenPaths = new Set(folders.map((folder) => folder.path))

  const insertPath = db.prepare(`
    INSERT INTO local_paths (path, game_id, exe_path, source, status, last_verified_at)
    VALUES (?, (SELECT id FROM games WHERE unique_id = ?), ?, 'scan', ?, CURRENT_TIMESTAMP)
    ON CONFLICT(path) DO UPDATE SET
      game_id = COALESCE(excluded.game_id, local_paths.game_id),
      exe_path = COALESCE(excluded.exe_path, local_paths.exe_path),
      source = 'scan',
      status = excluded.status,
      last_verified_at = CURRENT_TIMESTAMP
  `)
  const markBroken = db.prepare(`
    UPDATE local_paths
    SET status = 'broken', last_verified_at = CURRENT_TIMESTAMP
    WHERE source = 'scan' AND path = ?
  `)
  const existingScanRows = db.prepare(`
    SELECT path
    FROM local_paths
    WHERE source = 'scan'
  `).all() as Array<{ path: string }>

  const transaction = db.transaction((items: ScannedLibraryFolder[]) => {
    for (const item of items) {
      const status =
        item.matchState === 'linked'
          ? 'linked'
          : item.matchState === 'orphaned'
            ? 'verified'
            : 'discovered'

      insertPath.run(item.path, item.tg_id, item.executableNames[0] ?? null, status)
    }

    for (const row of existingScanRows) {
      if (seenPaths.has(row.path)) continue
      if (!paths.some((rootPath) => isPathInsideRoot(row.path, rootPath))) continue
      markBroken.run(row.path)
    }
  })

  transaction(folders)
  markLibraryRootsScanned(paths)

  return {
    roots: listLibraryRoots(),
    folders,
    linkedGames: listLinkedLocalGames()
  }
})

handleWithLog('tg-library-list-linked-games', () => {
  return listLinkedLocalGames()
})

handleWithLog('tg-library-get-linked-game', (_event, localGameId: number) => {
  return getLinkedLocalGameById(localGameId)
})

handleWithLog('tg-library-mark-opened', (_event, localGameId: number) => {
  return markLocalGameOpened(localGameId)
})

handleWithLog('tg-open-local-game-window', (_event, localGameId: number) => {
  return createLocalGameWindow(localGameId)
})

handleWithLog('tg-library-delete-games-and-files', async (_event, localPathIds: number[]) => {
  const selectedIds = Array.isArray(localPathIds)
    ? localPathIds.filter((value): value is number => Number.isInteger(value) && value > 0)
    : []

  if (selectedIds.length === 0) {
    return { success: true, deletedIds: [], deletedPaths: [], skippedPaths: [] }
  }

  const db = getDb()
  const rows = db.prepare(`
    SELECT id, path
    FROM local_paths
    WHERE id IN (${selectedIds.map(() => '?').join(',')})
  `).all(...selectedIds) as Array<{ id: number; path: string }>

  const rootPaths = listLibraryRoots().map((root) => path.resolve(root.path))
  const deletedIds: number[] = []
  const deletedPaths: string[] = []
  const skippedPaths: string[] = []

  for (const row of rows) {
    const resolvedPath = path.resolve(row.path)
    const insideKnownRoot = rootPaths.some((rootPath) => isPathInsideRoot(resolvedPath, rootPath))
    if (!insideKnownRoot) {
      skippedPaths.push(resolvedPath)
      continue
    }

    try {
      fs.rmSync(resolvedPath, { recursive: true, force: true })
      deletedIds.push(row.id)
      deletedPaths.push(resolvedPath)
    } catch {
      skippedPaths.push(resolvedPath)
    }
  }

  deleteLocalPathsByIds(deletedIds)

  return {
    success: true,
    deletedIds,
    deletedPaths,
    skippedPaths,
  }
})

handleWithLog('tg-maintenance-reset-database', () => {
  return resetDatabase()
})

handleWithLog('tg-maintenance-clear-cache', () => {
  return clearAppCacheData()
})

handleWithLog('tg-verify-touchgal-access', async () => {
  await ensureTouchGalBrowserAccess()
  await syncTouchGalSessionCookies()
  return {
    success: true,
    hasClearance: await hasTouchGalClearanceCookie()
  }
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
    limit: clampApiLimit(limit),
    selectedType: query.selectedType ?? 'all',
    selectedLanguage: query.selectedLanguage ?? 'all',
    selectedPlatform: query.selectedPlatform ?? 'all',
    sortField: query.sortField ?? 'resource_update_time',
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

    upsertNormalizedGames(normalized.list)

    return normalized
  } catch (err: any) {
    log.error('[API] GET /galgame error:', err.response?.data || err.message);
    if (isTouchGalDeveloperApiConfigured()) {
      try {
        const fallback = await fetchDeveloperBrowseFallback(page, limit, query)
        if (fallback.list.length > 0) {
          log.warn(`[Developer API] Legacy /galgame unavailable; returning ${fallback.list.length} keyword fallback games`)
          return fallback
        }
      } catch (fallbackError) {
        log.warn('[Developer API] Browse fallback failed after /galgame error:', getSafeErrorMessage(fallbackError))
      }
    }

    const cached = fetchCachedGameFeed(page, limit, query)
    if (cached.list.length > 0) {
      log.warn(`[API] GET /galgame and Developer API fallback failed; returning ${cached.list.length} cached games`)
      return cached
    }

    throw err;
  }
})

handleWithLog('tg-search-resources', async (_event, keyword: string, page: number, limit: number, options?: Record<string, any>) => {
  const normalizedKeyword = typeof keyword === 'string' ? keyword.trim() : ''
  if (!normalizedKeyword) {
    return { list: [], total: 0 }
  }

  const preferLegacySearch = shouldPreferLegacySearch(options)
  const fetchFromDeveloperApi = async (applyLocalOptions = false) => {
    if (applyLocalOptions) {
      return fetchDeveloperFilteredFallback({
        keyword: normalizedKeyword,
        page,
        limit,
        query: options,
        source: 'developer-api-search-fallback',
        itemPredicate: (game) => developerGameMatchesSearchOptions(game, normalizedKeyword, options),
      })
    }

    const developerResult = await fetchDeveloperGameSearch(normalizedKeyword, page, clampApiLimit(limit), {
      hydrateDetails: true,
    })
    const list = applyQueryToDeveloperFallbackList(developerResult.list, options)
    upsertNormalizedGames(list)
    return {
      ...developerResult,
      list,
    }
  }

  if (isTouchGalDeveloperApiConfigured() && !preferLegacySearch) {
    try {
      return await fetchFromDeveloperApi()
    } catch (error) {
      log.warn('[Developer API] GET /games/search failed, falling back to legacy /search:', getSafeErrorMessage(error))
    }
  }

  const searchOptions = { ...(options ?? {}) }
  delete searchOptions.nsfwMode
  const body = { ...buildSearchBody(normalizedKeyword, page, limit), ...searchOptions }
  const cookieString = buildRequestCookie(options?.nsfwMode);

  try {
    const response = await API_CLIENT.post('/search', body, {
      headers: cookieString ? { 'Cookie': cookieString } : undefined
    })
    const normalized = normalizeFeedResponse(ensureValidResponse(response.data))

    upsertNormalizedGames(normalized.list)

    return normalized
  } catch (error) {
    if (!isTouchGalDeveloperApiConfigured() || !preferLegacySearch) {
      throw error
    }

    log.warn('[API] Legacy /search failed for optioned search; returning Developer API keyword results:', getSafeErrorMessage(error))
    return fetchFromDeveloperApi(true)
  }
})

handleWithLog('tg-get-patch-detail', async (_event, uniqueId: string) => {
  if (!uniqueId || uniqueId.length !== 8) {
    throw new Error('Invalid resource ID (must be 8 characters)')
  }

  let developerDetail: any | null = null
  if (isTouchGalDeveloperApiConfigured()) {
    try {
      developerDetail = await fetchDeveloperGameDetail(uniqueId)
    } catch (error) {
      log.warn(`[Developer API] GET /games/${uniqueId} failed, falling back to legacy detail:`, getSafeErrorMessage(error))
    }
  }

  if (developerDetail) {
    try {
      const legacyDetail = await fetchLegacyPatchDetailWhenAccessible(uniqueId)
      const mergedDetail = mergeDeveloperAndLegacyDetail(developerDetail, legacyDetail)
      cacheFetchedGameDetail(uniqueId, mergedDetail)
      return mergedDetail
    } catch (error) {
      log.warn(`[API] Legacy detail fallback failed for ${uniqueId}; using developer API detail only:`, getSafeErrorMessage(error))
      cacheFetchedGameDetail(uniqueId, developerDetail)
      return developerDetail
    }
  }

  try {
    const legacyDetail = await fetchLegacyPatchDetail(uniqueId)
    cacheFetchedGameDetail(uniqueId, legacyDetail)
    return legacyDetail
  } catch (error) {
    log.error(`[API] Network IO failed for ${uniqueId}:`, error)
    const cachedDetail = getUsableCachedGameDetail(uniqueId)
    if (cachedDetail) {
      log.warn(`[API] Returning cached detail for ${uniqueId} after detail fetch failed`)
      return cachedDetail
    }
    throw error
  }
})

function normalizeComment(raw: any) {
  return {
    id: raw.id,
    content: raw.content ?? raw.text ?? raw.body ?? '',
    userName: raw.user?.name || raw.user_name || raw.author?.name || 'Anonymous',
    userAvatar: raw.user?.avatar || raw.user_avatar || raw.author?.avatar || null,
    createdAt: raw.created_at || raw.createdAt || raw.created || new Date().toISOString(),
    likeCount: raw.likeCount ?? 0,
    isLike: Boolean(raw.isLike),
    isSpoiler: Boolean(raw.isSpoiler),
    reply: Array.isArray(raw.reply) ? raw.reply.map(normalizeComment) : [],
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
    spoilerLevel: raw.spoilerLevel ?? raw.spoiler_level ?? 'none',
    likeCount: raw.likeCount ?? 0,
    isLike: Boolean(raw.isLike),
    createdAt: raw.created_at || raw.createdAt || raw.created || new Date().toISOString(),
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
  if (isTouchGalDeveloperApiConfigured()) {
    try {
      const detail = await fetchDeveloperGameDetail(uniqueId)
      return {
        introduction: detail.introduction,
        created: detail.created,
        releasedDate: detail.releasedDate,
        resourceUpdateTime: detail.resourceUpdateTime,
        alias: detail.alias,
        tags: detail.tags,
        company: detail.company,
        companyAliases: detail.companyAliases,
        vndbId: detail.vndbId,
        bangumiId: detail.bangumiId,
        steamId: detail.steamId,
        platform: detail.platform,
        language: detail.language,
        type: detail.type,
        touchgalUrl: detail.touchgalUrl,
      }
    } catch (error) {
      log.warn(`[Developer API] GET /games/${uniqueId} introduction failed, falling back to legacy introduction:`, getSafeErrorMessage(error))
    }
  }

  const response = await API_CLIENT.get('/patch/introduction', { params: { uniqueId } })
  return normalizeIntroduction(ensureValidResponse(response.data))
})

handleWithLog('tg-match-folder', async (_event, folderName: string) => {
  const cleaned = cleanFolderName(folderName)
  const db = getDb()

  // Search titles through FTS5 first; aliases are stored in detail_json and checked below.
  const results = db.prepare(`
    SELECT g.* FROM games g
    JOIN games_fts f ON g.id = f.rowid
    WHERE f.name MATCH ?
    LIMIT 10
  `).all(cleaned + '*')

  if (results.length > 0 || !cleaned) {
    return results
  }

  const normalizedCleaned = cleaned.toLocaleLowerCase()
  const aliasMatches = (db.prepare(`
    SELECT g.* FROM games g
    WHERE g.detail_json IS NOT NULL
    ORDER BY g.local_updated_at DESC
  `).all() as Array<any>)
    .filter((row) => {
      try {
        const detail = JSON.parse(row.detail_json) as { alias?: unknown }
        const aliases = Array.isArray(detail.alias) ? detail.alias : []
        return aliases.some((alias) =>
          typeof alias === 'string' &&
          cleanFolderName(alias).toLocaleLowerCase().startsWith(normalizedCleaned)
        )
      } catch {
        return false
      }
    })
    .slice(0, 10)

  if (aliasMatches.length > 0 || !isTouchGalDeveloperApiConfigured()) {
    return aliasMatches
  }

  try {
    const developerMatches = await fetchDeveloperGameSearch(cleaned, 1, 10, { hydrateDetails: true })
    const rows = developerMatches.list
      .map((game) => {
        const gameId = upsertGame({
          id: game.id,
          uniqueId: game.uniqueId,
          name: game.name,
          banner: game.banner,
          averageRating: game.averageRating,
          viewCount: game.viewCount,
          downloadCount: game.downloadCount,
          alias: game.alias,
          tags: game.tags,
          company: game.company,
          companyAliases: game.companyAliases,
          platform: game.platform,
          language: game.language,
          type: game.type,
          releasedDate: game.releasedDate,
          resourceUpdateTime: game.resourceUpdateTime,
          touchgalUrl: game.touchgalUrl
        })
        return db.prepare('SELECT g.* FROM games g WHERE g.id = ?').get(gameId)
      })
      .filter(Boolean)

    return rows
  } catch (error) {
    log.warn(`[Developer API] Folder match fallback failed for "${cleaned}":`, getSafeErrorMessage(error))
    return results
  }
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

handleWithLog('tg-get-default-download-directory', () => {
  return downloadManager.getDefaultDownloadDirectory()
})

handleWithLog('tg-pick-download-directory', async () => {
  const result = win
    ? await dialog.showOpenDialog(win, {
        properties: ['openDirectory', 'createDirectory'],
        defaultPath: downloadManager.getDefaultDownloadDirectory()
      })
    : await dialog.showOpenDialog({
    properties: ['openDirectory', 'createDirectory'],
    defaultPath: downloadManager.getDefaultDownloadDirectory()
  })

  if (result.canceled || result.filePaths.length === 0) {
    return null
  }

  return result.filePaths[0]
})

handleWithLog(
  'tg-queue-download',
  async (
    _event,
    gameId: number | null,
    sourceUrl: string,
    downloadRoot?: string,
    gameMetadata?: {
      id: number
      uniqueId: string
      name: string
      banner?: string | null
      averageRating?: number
      viewCount?: number
      downloadCount?: number
      alias?: string[]
      tags?: string[]
      company?: string | null
      companyAliases?: string[]
      platform?: string[] | string
      language?: string[] | string
      type?: string[]
      created?: string | null
      releasedDate?: string | null
      resourceUpdateTime?: string | null
      touchgalUrl?: string | null
    } | null
  ) => {
  return downloadManager.queueDownload({
    gameId,
    sourceUrl,
    downloadRoot: downloadRoot && downloadRoot.trim() ? downloadRoot : downloadManager.getDefaultDownloadDirectory(),
    gameMetadata: gameMetadata ?? null,
  })
})

const isPositiveInteger = (value: unknown): value is number =>
  Number.isInteger(value) && Number(value) > 0

handleWithLog(
  'tg-record-resource-download',
  async (_event, input: { patchId?: number; resourceId?: number; linkId?: number }) => {
    if (
      !isPositiveInteger(input?.patchId) ||
      !isPositiveInteger(input?.resourceId) ||
      !isPositiveInteger(input?.linkId)
    ) {
      return { success: false, skipped: true }
    }

    const response = await API_CLIENT.put(
      '/patch/resource/download',
      {
        patchId: input.patchId,
        resourceId: input.resourceId,
        linkId: input.linkId
      },
      { __touchGalSkipChallengeVerification: true } as TouchGalAxiosRequestConfig
    )

    return ensureValidResponse(response.data)
  }
)

handleWithLog('tg-get-download-queue', () => {
  return downloadManager.getQueue()
})

handleWithLog('tg-get-download-concurrency', () => {
  return getDownloadConcurrencySetting()
})

handleWithLog('tg-set-download-concurrency', async (_event, value: number) => {
  return downloadManager.setMaxConcurrentDownloads(value)
})

handleWithLog('tg-resume-download-task', async (_event, taskId: number) => {
  return downloadManager.resumeTask(taskId)
})

handleWithLog('tg-retry-download-task', async (_event, taskId: number) => {
  return downloadManager.retryTask(taskId)
})

handleWithLog('tg-pause-download-task', async (_event, taskId: number) => {
  return downloadManager.pauseTask(taskId)
})

handleWithLog('tg-delete-download-task', async (_event, taskId: number) => {
  return downloadManager.deleteTask(taskId)
})

handleWithLog('tg-delete-download-tasks-and-files', async (_event, taskIds: number[], downloadRoot: string) => {
  return downloadManager.deleteTasksAndFiles(taskIds, downloadRoot)
})

handleWithLog('tg-clear-finished-download-tasks', async () => {
  return downloadManager.clearFinishedTasks()
})

handleWithLog('tg-reveal-download-task', async (_event, outputPath: string) => {
  if (!outputPath) return { success: false }
  shell.showItemInFolder(outputPath)
  return { success: true }
})

handleWithLog('tg-reveal-path', async (_event, targetPath: string) => {
  if (!targetPath) return { success: false }
  shell.showItemInFolder(targetPath)
  return { success: true }
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
  const query = buildSearchTerms(keyword).slice(0, 10)
  if (query.length === 0) return []

  try {
    const response = await API_CLIENT.post('/search/tag', { query })
    return ensureValidResponse(response.data)
  } catch (error) {
    const cachedSuggestions = buildCachedTagSuggestions(keyword)
    if (cachedSuggestions.length > 0) {
      log.warn(`[API] Legacy /search/tag failed; returning ${cachedSuggestions.length} cached tag/company suggestions:`, getSafeErrorMessage(error))
      return cachedSuggestions
    }
    throw error
  }
})

handleWithLog('tg-get-user-status', async (_event, id: number) => {
  const response = await API_CLIENT.get('/user/status/info', { params: { id } })
  return ensureValidResponse(response.data)
})

handleWithLog('tg-get-user-status-self', async () => {
  try {
    const response = await API_CLIENT.get('/user/status')
    return ensureValidResponse(response.data)
  } catch (error) {
    if (!isTouchGalDeveloperApiConfigured()) {
      throw error
    }
    log.warn('[API] Legacy /user/status failed; treating TouchGal user session as unavailable:', getSafeErrorMessage(error))
    return null
  }
})

handleWithLog('tg-get-developer-api-status', async () => {
  if (!isTouchGalDeveloperApiConfigured()) {
    return {
      configured: false,
      isDeveloperApiCredential: true,
      applicationStatus: 'missing',
      dailyLimit: null,
      minuteLimit: null,
    }
  }

  return fetchDeveloperApiStatus()
})

handleWithLog('tg-get-user-comments', async (_event, uid: number, page: number, limit: number) => {
  const response = await API_CLIENT.get('/user/profile/comment', { params: { uid, page, limit } })
  const data = ensureValidResponse(response.data) as any;
  return {
    comments: data.comments || data.list || [],
    total: data.total ?? 0
  }
})

handleWithLog('tg-get-user-ratings', async (_event, uid: number, page: number, limit: number) => {
  const response = await API_CLIENT.get('/user/profile/rating', { params: { uid, page, limit } })
  const data = ensureValidResponse(response.data) as any;
  return {
    ratings: data.ratings || data.list || [],
    total: data.total ?? 0
  }
})

handleWithLog('tg-get-user-resources', async (_event, uid: number, page: number, limit: number) => {
  const response = await API_CLIENT.get('/user/profile/resource', { params: { uid, page, limit } })
  return ensureValidResponse(response.data)
})

handleWithLog('tg-get-favorite-folders', async (_event, uid: number, patchId?: number) => {
  const response = await API_CLIENT.get('/user/profile/favorite/folder', {
    params: patchId ? { uid, patchId } : { uid }
  })
  const data = ensureValidResponse(response.data) as any;
  // Support both old array format and new object format { folders, total }
  if (Array.isArray(data)) return data;
  return data.folders || [];
})

handleWithLog(
  'tg-create-favorite-folder',
  async (_event, input: { name: string; description?: string; isPublic?: boolean }) => {
    const response = await API_CLIENT.post('/user/profile/favorite/folder', {
      name: input.name,
      description: input.description ?? '',
      isPublic: Boolean(input.isPublic)
    })
    return ensureValidResponse(response.data)
  }
)

handleWithLog('tg-delete-favorite-folder', async (_event, folderId: number) => {
  const response = await API_CLIENT.delete('/user/profile/favorite/folder', {
    params: { folderId }
  })
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
    type: patch.type ?? [],
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

handleWithLog('tg-toggle-patch-favorite', async (_event, patchId: number, folderId: number) => {
  const response = await API_CLIENT.put('/patch/favorite', { patchId, folderId })
  return ensureValidResponse(response.data)
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
  tags?: string[]
  company?: string | null
  companyAliases?: string[]
  platform?: string[] | string
  language?: string[] | string
  type?: string[]
  created?: string | null
  releasedDate?: string | null
  resourceUpdateTime?: string | null
  touchgalUrl?: string | null
}) => {
  addItemToLocalCollection(collectionId, game)
  return listLocalCollections()
})

handleWithLog('tg-local-collections-remove-item', async (_event, collectionId: number, uniqueId: string) => {
  removeItemFromLocalCollection(collectionId, uniqueId)
  return listLocalCollections()
})

handleWithLog('tg-record-history', (_event, entry: {
  uniqueId: string
  gameId?: number | null
  name: string
  bannerUrl?: string | null
}) => {
  recordBrowseHistory(entry)
  // Trim to 500 most recent entries
  const db = getDb()
  db.prepare(`
    DELETE FROM browse_history WHERE id NOT IN (
      SELECT id FROM browse_history ORDER BY viewed_at DESC LIMIT 500
    )
  `).run()
  return { success: true }
})

handleWithLog('tg-get-history', (_event, limit = 50) => {
  return getBrowseHistory(limit)
})

handleWithLog('tg-clear-history', () => {
  return clearBrowseHistory()
})

handleWithLog('tg-check-extractor', () => {
  return getExtractorStatus()
})

handleWithLog('tg-get-archive-extraction-depth', () => {
  return getArchiveExtractionDepthSetting()
})

handleWithLog('tg-set-archive-extraction-depth', (_event, value: number) => {
  return setArchiveExtractionDepthSetting(value)
})
