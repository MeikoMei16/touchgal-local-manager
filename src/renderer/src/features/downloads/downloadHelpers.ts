import type { TouchGalDownload } from '../../types'

const SECTION_LABELS: Record<string, string> = {
  galgame: 'PC游戏',
  patch: '补丁资源',
  emulator: '模拟器资源',
  android: '手机游戏',
}

const TYPE_LABELS: Record<string, string> = {
  pc: 'PC游戏',
  patch: '补丁资源',
  emulator: '模拟器资源',
  chinese: '汉化资源',
  mobile: '手机游戏',
  app: '直装资源',
  raw: '生肉资源',
  row: '生肉资源',
  tool: '游戏工具',
  other: '其它',
}

const LANGUAGE_LABELS: Record<string, string> = {
  'zh-Hans': '简体中文',
  'zh-Hant': '繁體中文',
  ja: '日本語',
  other: '其它',
}

const PLATFORM_LABELS: Record<string, string> = {
  android: 'Android',
  windows: 'Windows',
  ios: 'iOS',
  linux: 'Linux',
  other: '其它',
}

export interface DownloadMetadataChip {
  key: string
  label: string
  tone: 'section' | 'type' | 'language' | 'platform' | 'code' | 'password'
}

export interface DownloadLinkItem {
  id: number | null
  url: string
  storage: string | null
  size: string | null
  code: string | null
  password: string | null
  hash: string | null
  sortOrder: number | null
  download: number | null
}

const splitDownloadContent = (value: string | null | undefined) =>
  (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

export const getDownloadLinkItems = (download: TouchGalDownload): DownloadLinkItem[] => {
  const rawLinks = Array.isArray(download.links) && download.links.length > 0
    ? download.links
    : [{
        id: null,
        url: download.url,
        content: download.content,
        storage: download.storage,
        size: download.size,
        code: download.code,
        password: download.password,
        hash: download.hash,
        sortOrder: null,
        download: download.downloadCount,
      }]

  return rawLinks.flatMap((link) => {
    const urls = splitDownloadContent(link.content ?? link.url)
    return urls.map((url) => ({
      id: link.id ?? null,
      url,
      storage: link.storage ?? download.storage ?? null,
      size: link.size ?? download.size ?? null,
      code: link.code ?? download.code ?? null,
      password: link.password ?? download.password ?? null,
      hash: link.hash ?? download.hash ?? null,
      sortOrder: link.sortOrder ?? null,
      download: link.download ?? null,
    }))
  })
}

export const getDownloadLinks = (download: TouchGalDownload) =>
  getDownloadLinkItems(download).map((link) => link.url)

export const recordDownloadLinkStat = (
  patchId: number | null | undefined,
  resourceId: number | null | undefined,
  linkId: number | null | undefined
) => {
  if (!patchId || patchId <= 0 || !resourceId || resourceId <= 0 || !linkId || linkId <= 0) return

  void window.api.recordResourceDownload({ patchId, resourceId, linkId }).catch(() => undefined)
}

export const isOfficialDownload = (download: TouchGalDownload) =>
  (download.user?.role ?? 0) > 2 ||
  download.storage === 'touchgal' ||
  download.storage === 's3' ||
  getDownloadLinkItems(download).some((link) => link.storage === 'touchgal' || link.storage === 's3')

export const isGalgameDownload = (download: TouchGalDownload) =>
  download.section !== 'patch'

export const getOfficialGalgameDownloads = (downloads: TouchGalDownload[]) =>
  downloads.filter((download) => isOfficialDownload(download) && isGalgameDownload(download) && getDownloadLinks(download).length > 0)

export const getDownloadDisplayName = (download: TouchGalDownload) => {
  const explicitName = download.name.trim()
  if (explicitName) return explicitName
  const section = download.section ? SECTION_LABELS[download.section] ?? download.section : null
  const type = download.type[0] ? TYPE_LABELS[download.type[0]] ?? download.type[0] : null
  const platform = download.platform[0] ? PLATFORM_LABELS[download.platform[0]] ?? download.platform[0] : null
  return [section, type, platform].filter(Boolean).join(' ') || 'TouchGal 官方资源'
}

export const getDownloadMetadataChips = (download: TouchGalDownload): DownloadMetadataChip[] => {
  const seen = new Set<string>()
  const chips: DownloadMetadataChip[] = []
  const firstLink = getDownloadLinkItems(download)[0] ?? null

  const pushChip = (key: string, label: string | null, tone: DownloadMetadataChip['tone']) => {
    if (!label || seen.has(label)) return
    seen.add(label)
    chips.push({ key, label, tone })
  }

  if (download.section) {
    pushChip(`section:${download.section}`, SECTION_LABELS[download.section] ?? download.section, 'section')
  }

  for (const type of download.type ?? []) {
    pushChip(`type:${type}`, TYPE_LABELS[type] ?? type, 'type')
  }

  for (const language of download.language ?? []) {
    pushChip(`language:${language}`, LANGUAGE_LABELS[language] ?? language, 'language')
  }

  for (const platform of download.platform ?? []) {
    pushChip(`platform:${platform}`, PLATFORM_LABELS[platform] ?? platform, 'platform')
  }

  const code = download.code ?? firstLink?.code ?? null
  if (code) {
    pushChip(`code:${code}`, `提取码 ${code}`, 'code')
  }

  const password = download.password ?? firstLink?.password ?? null
  if (password) {
    pushChip(`password:${password}`, `解压码 ${password}`, 'password')
  }

  return chips
}

export const formatBytes = (value: number | null | undefined) => {
  if (value == null || !Number.isFinite(value)) return '未知大小'
  if (value < 1024) return `${value} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let size = value
  let unitIndex = -1
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex += 1
  }
  const digits = size >= 10 ? 1 : 2
  return `${size.toFixed(digits).replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1')} ${units[unitIndex]}`
}
