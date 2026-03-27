import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import axios from 'axios'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Configure paths for Electron 41 / Vite 8
process.env.DIST = path.join(__dirname, '../dist')
process.env.VITE_PUBLIC = app.isPackaged 
  ? process.env.DIST 
  : path.join(process.env.DIST, '../public')

let win: InstanceType<typeof BrowserWindow> | null

const API_CLIENT = axios.create({
  baseURL: 'https://www.touchgal.top/api',
  headers: {
    'Content-Type': 'application/json',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    Referer: 'https://www.touchgal.top/',
    Origin: 'https://www.touchgal.top',
  },
  timeout: 15000,
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
}

interface RawDownload {
  id?: number
  name?: string
  size?: string | null
  content?: string | null
  url?: string | null
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
  }
}

const normalizeDownloads = (downloads: RawDownload[]) =>
  downloads.map((download) => ({
    id: download.id ?? 0,
    name: download.name ?? 'Unnamed resource',
    size: download.size ?? null,
    url: download.url ?? download.content ?? null,
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
    throw new Error(payload)
  }

  if (Array.isArray(payload)) {
    const firstError = payload[0]
    if (firstError && typeof firstError === 'object' && 'message' in firstError) {
      throw new Error(String(firstError.message))
    }

    throw new Error('TouchGal returned a validation error')
  }

  return payload as T
}

const scanForGalgameFolders = (rootPaths: string[]) => {
  const results: Array<{ path: string; folderName: string; tg_id: string | null }> = []

  rootPaths.forEach((rootPath) => {
    if (!fs.existsSync(rootPath)) return

    const dirs = fs.readdirSync(rootPath, { withFileTypes: true })
    dirs.forEach((dir) => {
      if (!dir.isDirectory()) return

      const fullPath = path.join(rootPath, dir.name)
      const tgIdPath = path.join(fullPath, '.tg_id')

      if (fs.existsSync(tgIdPath)) {
        const id = fs.readFileSync(tgIdPath, 'utf8').trim()
        results.push({
          path: fullPath,
          folderName: dir.name,
          tg_id: id,
        })
      } else {
        results.push({
          path: fullPath,
          folderName: dir.name,
          tg_id: null,
        })
      }
    })
  })

  return results
}

function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, 'electron-vite.svg'),
    width: 1200,
    height: 800,
    titleBarStyle: 'hiddenInset',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
    },
  })

  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', new Date().toLocaleString())
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL)
    win.webContents.openDevTools()
  } else {
    win.loadFile(path.join(process.env.DIST || '', 'index.html'))
  }
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

ipcMain.handle('scan-local-library', (_event: unknown, paths: string[]) => {
  return scanForGalgameFolders(paths)
})

ipcMain.handle('tag-folder', (_event: unknown, folderPath: string, id: string) => {
  const tgIdPath = path.join(folderPath, '.tg_id')
  try {
    fs.writeFileSync(tgIdPath, id, 'utf8')
    return { success: true }
  } catch (error) {
    return { success: false, error }
  }
})

ipcMain.handle('tg-fetch-resources', async (_event: unknown, page: number, limit: number, query: Record<string, unknown>) => {
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

  return normalizeFeedResponse(ensureValidResponse(response.data))
})

ipcMain.handle('tg-search-resources', async (_event: unknown, keyword: string, page: number, limit: number, options?: Record<string, any>) => {
  const body = {
    ...buildSearchBody(keyword, page, limit),
    ...options
  }
  const response = await API_CLIENT.post('/search', body)
  return normalizeFeedResponse(ensureValidResponse(response.data))
})

ipcMain.handle('tg-get-patch-detail', async (_event: unknown, uniqueId: string) => {
  console.log(`[IPC] Fetching detail for: ${uniqueId}`)
  try {
    const detailResponse = await API_CLIENT.get('/patch', { params: { uniqueId } })
    const detail = normalizeResource(ensureValidResponse<RawResource>(detailResponse.data))

    const downloadsResponse = await API_CLIENT.get('/patch/resource', {
      params: { patchId: detail.id },
    })

    const downloads = normalizeDownloads(ensureValidResponse<RawDownload[]>(downloadsResponse.data))

    return {
      ...detail,
      downloads,
    }
  } catch (error) {
    console.error(`[IPC] Error in tg-get-patch-detail for ${uniqueId}:`, error)
    throw error
  }
})

ipcMain.handle('tg-get-patch-introduction', async (_event: unknown, uniqueId: string) => {
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

ipcMain.handle('tg-fetch-captcha', async () => {
  const response = await API_CLIENT.get('/auth/captcha')
  return ensureValidResponse(response.data)
})

ipcMain.handle('tg-login', async (_event: unknown, username: string, password: string, captcha: string) => {
  const response = await API_CLIENT.post('/auth/login', {
    name: username,
    password,
    captcha,
  })

  return ensureValidResponse(response.data)
})

app.whenReady().then(createWindow)
