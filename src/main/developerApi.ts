import fs from 'node:fs'
import path from 'node:path'
import axios from 'axios'

const TOUCHGAL_DEVELOPER_API_BASE = 'https://developer.touchgal.com/api/v1'
const DEVELOPER_REQUEST_WINDOW_MS = 60_000
const DEVELOPER_REQUEST_SAFE_LIMIT = 50
const DEVELOPER_SEARCH_CACHE_TTL_MS = 5 * 60_000
const DEVELOPER_STATUS_CACHE_TTL_MS = 60_000
const API_KEY_ENV_NAMES = [
  'TOUCHGAL_DEVELOPER_API_KEY',
  'TOUCHGAL_API_KEY',
  'TGAL_API_KEY',
]

interface DeveloperApiResponse<T> {
  success?: boolean
  data?: T
  error?: unknown
  message?: string
}

interface DeveloperSearchItem {
  name?: string
  uniqueId?: string
}

interface DeveloperSearchPayload {
  items?: DeveloperSearchItem[]
  pagination?: {
    page?: number
    limit?: number
    total?: number
    hasMore?: boolean
  }
}

interface DeveloperSearchOptions {
  hydrateDetails?: boolean
}

interface DeveloperNormalizedGame {
  id: number
  uniqueId: string
  name: string
  banner: string | null
  averageRating: number
  ratingCount: number
  ratingSummary: {
    average: number
    count: number
    histogram: Array<{ score: number; count: number }>
    recommend: {
      strong_no: number
      no: number
      neutral: number
      yes: number
      strong_yes: number
    }
  }
  tags: string[]
  viewCount: number
  downloadCount: number
  favoriteCount: number
  resourceCount: number
  commentCount: number
  releasedDate: string | null
  resourceUpdateTime: string | null
  created: string | null
  introduction: string | null
  company: string | null
  companyAliases: string[]
  pvUrl: string | null
  screenshots: string[]
  detail: null
  alias: string[]
  vndbId: string | null
  bangumiId: number | null
  steamId: string | null
  contentLimit: string | null
  platform: string[]
  language: string[]
  type: string[]
  touchgalUrl: string | null
  downloads: unknown[]
}

interface DeveloperSearchResult {
  list: DeveloperNormalizedGame[]
  total: number
  pagination: DeveloperSearchPayload['pagination'] | null
  source: 'developer-api'
}

interface DeveloperRatingRecommend {
  strongNo?: number
  strong_no?: number
  no?: number
  neutral?: number
  yes?: number
  strongYes?: number
  strong_yes?: number
}

interface DeveloperGameDetail {
  uniqueId?: string
  name?: string
  aliases?: string[]
  introduction?: string | null
  bannerUrl?: string | null
  type?: string[]
  platform?: string[]
  language?: string[]
  tags?: string[]
  publishTime?: string | null
  releaseDate?: string | null
  updatedAt?: string | null
  resourceUpdateTime?: string | null
  companies?: Array<{
    name?: string
    aliases?: string[]
  }>
  rating?: {
    average?: number
    count?: number
    recommend?: DeveloperRatingRecommend
  }
  touchgalUrl?: string | null
}

const sanitizeApiKey = (value: string | undefined) =>
  typeof value === 'string' ? value.replace(/[\r\n\t]/g, '').trim() : ''

const parseEnvFile = (content: string) => {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))

  for (const envName of API_KEY_ENV_NAMES) {
    const match = lines.find((line) => line.startsWith(`${envName}=`))
    if (!match) continue
    return sanitizeApiKey(match.slice(envName.length + 1).replace(/^['"]|['"]$/g, ''))
  }

  const bareToken = lines.find((line) => line.startsWith('tgal_'))
  if (bareToken) return sanitizeApiKey(bareToken)

  return ''
}

export const getTouchGalDeveloperApiKey = () => {
  for (const envName of API_KEY_ENV_NAMES) {
    const fromEnv = sanitizeApiKey(process.env[envName])
    if (fromEnv) return fromEnv
  }

  const envPath = path.join(process.cwd(), '.env')
  try {
    if (!fs.existsSync(envPath)) return ''
    return parseEnvFile(fs.readFileSync(envPath, 'utf8'))
  } catch {
    return ''
  }
}

export const isTouchGalDeveloperApiConfigured = () => Boolean(getTouchGalDeveloperApiKey())

const createDeveloperApiClient = () => {
  const apiKey = getTouchGalDeveloperApiKey()
  if (!apiKey) {
    throw new Error('TouchGal developer API key is not configured')
  }

  return axios.create({
    baseURL: TOUCHGAL_DEVELOPER_API_BASE,
    timeout: 30000,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
  })
}

const getDeveloperErrorMessage = (payload: unknown): string | null => {
  if (typeof payload === 'string' && payload.trim()) return payload.trim()
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null

  const record = payload as Record<string, unknown>
  for (const key of ['message', 'error', 'code']) {
    const value = record[key]
    const message = getDeveloperErrorMessage(value)
    if (message) return message
  }

  if (Array.isArray(record.errors)) {
    for (const value of record.errors) {
      const message = getDeveloperErrorMessage(value)
      if (message) return message
    }
  }

  return null
}

const toDeveloperApiError = (error: unknown) => {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status ? `HTTP ${error.response.status}: ` : ''
    const payloadMessage = getDeveloperErrorMessage(error.response?.data)
    return new Error(
      `${status}${payloadMessage || error.message || 'TouchGal developer API request failed'}`,
      { cause: error }
    )
  }

  return error instanceof Error
    ? error
    : new Error(String(error || 'TouchGal developer API request failed'))
}

const requestDeveloperApi = async <T>(request: () => Promise<T>) => {
  try {
    return await scheduleDeveloperRequest(request)
  } catch (error) {
    throw toDeveloperApiError(error)
  }
}

const unwrapDeveloperResponse = <T>(payload: DeveloperApiResponse<T>): T => {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Empty response from TouchGal developer API')
  }

  if (payload.success === false) {
    throw new Error(getDeveloperErrorMessage(payload) || 'TouchGal developer API request failed')
  }

  if (payload.data == null) {
    throw new Error('TouchGal developer API response is missing data')
  }

  return payload.data
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const developerRequestTimestamps: number[] = []
let developerRequestQueue = Promise.resolve()

const acquireDeveloperRequestSlot = async () => {
  while (true) {
    const now = Date.now()
    while (
      developerRequestTimestamps.length > 0 &&
      now - developerRequestTimestamps[0] >= DEVELOPER_REQUEST_WINDOW_MS
    ) {
      developerRequestTimestamps.shift()
    }

    if (developerRequestTimestamps.length < DEVELOPER_REQUEST_SAFE_LIMIT) {
      developerRequestTimestamps.push(now)
      return
    }

    const waitMs = Math.max(
      250,
      DEVELOPER_REQUEST_WINDOW_MS - (now - developerRequestTimestamps[0]) + 50
    )
    await delay(waitMs)
  }
}

const scheduleDeveloperRequest = async <T>(request: () => Promise<T>): Promise<T> => {
  const slot = developerRequestQueue.then(acquireDeveloperRequestSlot, acquireDeveloperRequestSlot)
  developerRequestQueue = slot.then(
    () => undefined,
    () => undefined
  )
  await slot
  return request()
}

const emptyRatingSummary = {
  average: 0,
  count: 0,
  histogram: [],
  recommend: {
    strong_no: 0,
    no: 0,
    neutral: 0,
    yes: 0,
    strong_yes: 0,
  },
}

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

const sanitizeHref = (value: string) => {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null
  } catch {
    return null
  }
}

const uniqueSanitizedUrls = (values: Array<string | null | undefined>) => {
  const seen = new Set<string>()
  const urls: string[] = []

  for (const value of values) {
    if (!value) continue
    const safeUrl = sanitizeHref(value.trim())
    if (!safeUrl || seen.has(safeUrl)) continue
    seen.add(safeUrl)
    urls.push(safeUrl)
  }

  return urls
}

const extractMarkdownImageUrls = (markdown: string | null | undefined) => {
  if (!markdown) return []

  return uniqueSanitizedUrls(
    Array.from(
      markdown.matchAll(/!\[[^\]]*]\(\s*<?([^)\s>]+)>?(?:\s+["'][^"']*["'])?\s*\)/g),
      (match) => match[1]
    )
  )
}

const isVideoUrl = (value: string) =>
  /(youtube\.com|youtu\.be|bilibili\.com|player\.bilibili\.com|\.mp4(?:\?|$)|\.webm(?:\?|$)|\.ogg(?:\?|$)|\.mov(?:\?|$)|\.m3u8(?:\?|$)|\.flv(?:\?|$))/i.test(value)

const extractPvUrlFromMarkdown = (markdown: string | null | undefined) => {
  if (!markdown) return null

  const candidates = uniqueSanitizedUrls([
    ...Array.from(markdown.matchAll(/!?\[[^\]]+]\(\s*<?([^)\s>]+)>?(?:\s+["'][^"']*["'])?\s*\)/g), (match) => match[1]),
    ...Array.from(markdown.matchAll(/https?:\/\/[^\s"'<>）)]+/gi), (match) => match[0]),
  ])

  return candidates.find(isVideoUrl) ?? null
}

const stripMarkdownMedia = (markdown: string) =>
  markdown
    .replace(/^\s*!\[[^\]]*]\(\s*<?[^)\s>]+>?(?:\s+["'][^"']*["'])?\s*\)\s*$/gm, '')
    .replace(/^\s*(?:#{1,6}\s*)?(?:游戏截图|PV鉴赏|支持正版)\s*$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

const renderInlineMarkdown = (value: string) => {
  const escaped = escapeHtml(value)
    .replace(/!\[([^\]]*)]\((https?:\/\/[^)\s]+)\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')

  return escaped.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, (_match, label: string, href: string) => {
    const safeHref = sanitizeHref(href)
    if (!safeHref) return label
    return `<a href="${escapeHtml(safeHref)}" target="_blank" rel="noreferrer">${label}</a>`
  })
}

const markdownToBasicHtml = (markdown: string | null | undefined) => {
  if (!markdown || !markdown.trim()) return null

  const strippedMarkdown = stripMarkdownMedia(markdown)
  if (!strippedMarkdown) return null

  const blocks: string[] = []
  let paragraph: string[] = []
  let listItems: string[] = []

  const flushParagraph = () => {
    if (paragraph.length === 0) return
    blocks.push(`<p>${renderInlineMarkdown(paragraph.join(' '))}</p>`)
    paragraph = []
  }

  const flushList = () => {
    if (listItems.length === 0) return
    blocks.push(`<ul>${listItems.map((item) => `<li>${renderInlineMarkdown(item)}</li>`).join('')}</ul>`)
    listItems = []
  }

  for (const rawLine of strippedMarkdown.replace(/\r\n/g, '\n').split('\n')) {
    const line = rawLine.trim()
    if (!line) {
      flushParagraph()
      flushList()
      continue
    }

    const heading = line.match(/^(#{1,4})\s+(.+)$/)
    if (heading) {
      flushParagraph()
      flushList()
      const level = Math.min(heading[1].length + 1, 5)
      blocks.push(`<h${level}>${renderInlineMarkdown(heading[2])}</h${level}>`)
      continue
    }

    const list = line.match(/^[-*]\s+(.+)$/)
    if (list) {
      flushParagraph()
      listItems.push(list[1])
      continue
    }

    flushList()
    paragraph.push(line)
  }

  flushParagraph()
  flushList()

  return blocks.join('\n')
}

const normalizeDeveloperSearchItem = (item: DeveloperSearchItem): DeveloperNormalizedGame => ({
  id: 0,
  uniqueId: item.uniqueId ?? '',
  name: item.name ?? 'Unknown title',
  banner: null,
  averageRating: 0,
  ratingCount: 0,
  ratingSummary: emptyRatingSummary,
  tags: [],
  viewCount: 0,
  downloadCount: 0,
  favoriteCount: 0,
  resourceCount: 0,
  commentCount: 0,
  releasedDate: null,
  resourceUpdateTime: null,
  created: null,
  introduction: null,
  company: null,
  companyAliases: [],
  pvUrl: null,
  screenshots: [],
  detail: null,
  alias: [],
  vndbId: null,
  bangumiId: null,
  steamId: null,
  contentLimit: null,
  platform: [],
  language: [],
  type: [],
  touchgalUrl: null,
  downloads: [],
})

const normalizeDeveloperRecommend = (recommend?: DeveloperRatingRecommend) => ({
  strong_no: recommend?.strongNo ?? recommend?.strong_no ?? 0,
  no: recommend?.no ?? 0,
  neutral: recommend?.neutral ?? 0,
  yes: recommend?.yes ?? 0,
  strong_yes: recommend?.strongYes ?? recommend?.strong_yes ?? 0,
})

const normalizeDeveloperCompanies = (companies: DeveloperGameDetail['companies']) => {
  const names = new Set<string>()
  const aliases = new Set<string>()

  for (const company of Array.isArray(companies) ? companies : []) {
    if (typeof company?.name === 'string' && company.name.trim()) {
      names.add(company.name.trim())
    }
    for (const alias of Array.isArray(company?.aliases) ? company.aliases : []) {
      if (typeof alias === 'string' && alias.trim()) {
        aliases.add(alias.trim())
      }
    }
  }

  return {
    company: names.size > 0 ? Array.from(names).join(', ') : null,
    companyAliases: Array.from(aliases),
  }
}

export const normalizeDeveloperGameDetail = (raw: DeveloperGameDetail): DeveloperNormalizedGame => {
  const average = raw.rating?.average ?? 0
  const count = raw.rating?.count ?? 0
  const introductionMarkdown = raw.introduction ?? null
  const companies = normalizeDeveloperCompanies(raw.companies)

  return {
    id: 0,
    uniqueId: raw.uniqueId ?? '',
    name: raw.name ?? 'Unknown title',
    banner: raw.bannerUrl ?? null,
    averageRating: average,
    ratingCount: count,
    ratingSummary: {
      average,
      count,
      histogram: [],
      recommend: normalizeDeveloperRecommend(raw.rating?.recommend),
    },
    tags: Array.isArray(raw.tags) ? raw.tags.filter(Boolean) : [],
    viewCount: 0,
    downloadCount: 0,
    favoriteCount: 0,
    resourceCount: 0,
    commentCount: 0,
    releasedDate: raw.releaseDate ?? null,
    resourceUpdateTime: raw.resourceUpdateTime ?? raw.updatedAt ?? null,
    created: raw.publishTime ?? null,
    introduction: markdownToBasicHtml(introductionMarkdown),
    company: companies.company,
    companyAliases: companies.companyAliases,
    pvUrl: extractPvUrlFromMarkdown(introductionMarkdown),
    screenshots: extractMarkdownImageUrls(introductionMarkdown),
    detail: null,
    alias: Array.isArray(raw.aliases) ? raw.aliases.filter(Boolean) : [],
    vndbId: null,
    bangumiId: null,
    steamId: null,
    contentLimit: null,
    platform: Array.isArray(raw.platform) ? raw.platform : [],
    language: Array.isArray(raw.language) ? raw.language : [],
    type: Array.isArray(raw.type) ? raw.type : [],
    touchgalUrl: raw.touchgalUrl ?? null,
    downloads: [],
  }
}

const detailCache = new Map<string, Promise<ReturnType<typeof normalizeDeveloperGameDetail>>>()
const searchCache = new Map<string, { expiresAt: number; value: DeveloperSearchResult }>()
let statusCache: { expiresAt: number; value: Record<string, unknown> } | null = null

const runLimited = async <T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>
) => {
  const results: R[] = []
  let nextIndex = 0

  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex
      nextIndex += 1
      results[currentIndex] = await worker(items[currentIndex])
    }
  })

  await Promise.all(runners)
  return results
}

export const fetchDeveloperGameSearch = async (
  keyword: string,
  page: number,
  limit: number,
  options: DeveloperSearchOptions = {}
) => {
  const normalizedKeyword = keyword.trim()
  const cacheKey = JSON.stringify({
    keyword: normalizedKeyword.toLocaleLowerCase(),
    page,
    limit,
    hydrateDetails: Boolean(options.hydrateDetails),
  })
  const cached = searchCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) return cached.value

  const client = createDeveloperApiClient()
  const response = await requestDeveloperApi(() =>
    client.get<DeveloperApiResponse<DeveloperSearchPayload>>('/games/search', {
      params: {
        keyword: normalizedKeyword,
        page,
        limit,
      },
    })
  )
  const data = unwrapDeveloperResponse(response.data)
  const items = Array.isArray(data.items) ? data.items : []
  const list = items
    .map(normalizeDeveloperSearchItem)
    .filter((item) => item.uniqueId && item.name)

  if (options.hydrateDetails) {
    const hydrated = await runLimited(list, 4, async (item) => {
      try {
        return {
          ...item,
          ...(await fetchDeveloperGameDetail(item.uniqueId)),
          uniqueId: item.uniqueId,
        }
      } catch {
        return null
      }
    }).then((results) => results.filter((item): item is DeveloperNormalizedGame => Boolean(item)))

    if (list.length > 0 && hydrated.length === 0) {
      throw new Error('TouchGal developer API detail hydration failed for every search result')
    }

    const droppedHydrationCount = Math.max(0, list.length - hydrated.length)
    const rawTotal = data.pagination?.total ?? items.length
    const total = Math.max(hydrated.length, rawTotal - droppedHydrationCount)
    const pagination = data.pagination
      ? { ...data.pagination, total }
      : null

    const value = {
      list: hydrated,
      total,
      pagination,
      source: 'developer-api' as const,
    }
    searchCache.set(cacheKey, { expiresAt: Date.now() + DEVELOPER_SEARCH_CACHE_TTL_MS, value })
    return value
  }

  const value = {
    list,
    total: data.pagination?.total ?? items.length,
    pagination: data.pagination ?? null,
    source: 'developer-api' as const,
  }
  searchCache.set(cacheKey, { expiresAt: Date.now() + DEVELOPER_SEARCH_CACHE_TTL_MS, value })
  return value
}

export const fetchDeveloperGameDetail = async (uniqueId: string) => {
  const cached = detailCache.get(uniqueId)
  if (cached) return cached

  const request = (async () => {
    const client = createDeveloperApiClient()
    const response = await requestDeveloperApi(() =>
      client.get<DeveloperApiResponse<DeveloperGameDetail>>(
        `/games/${encodeURIComponent(uniqueId)}`
      )
    )
    return normalizeDeveloperGameDetail(unwrapDeveloperResponse(response.data))
  })().catch((error) => {
    detailCache.delete(uniqueId)
    throw error
  })

  detailCache.set(uniqueId, request)
  return request
}

export const fetchDeveloperApiStatus = async () => {
  if (statusCache && statusCache.expiresAt > Date.now()) return statusCache.value

  const client = createDeveloperApiClient()
  const response = await requestDeveloperApi(() =>
    client.get<DeveloperApiResponse<Record<string, unknown>>>('/me')
  )
  const data = unwrapDeveloperResponse(response.data)
  const safeData = { ...data }
  delete safeData.tokenPrefix

  const value = {
    ...safeData,
    configured: true,
    isDeveloperApiCredential: true,
  }
  statusCache = { expiresAt: Date.now() + DEVELOPER_STATUS_CACHE_TTL_MS, value }
  return value
}
