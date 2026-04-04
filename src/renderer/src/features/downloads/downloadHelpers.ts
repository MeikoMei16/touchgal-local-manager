import type { TouchGalDownload } from '../../types'

export const getDownloadLinks = (download: TouchGalDownload) =>
  (download.content ?? download.url ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

export const isOfficialDownload = (download: TouchGalDownload) =>
  (download.user?.role ?? 0) > 2 || download.storage === 'touchgal' || download.storage === 's3'

export const isGalgameDownload = (download: TouchGalDownload) =>
  download.section !== 'patch'

export const getOfficialGalgameDownloads = (downloads: TouchGalDownload[]) =>
  downloads.filter((download) => isOfficialDownload(download) && isGalgameDownload(download) && getDownloadLinks(download).length > 0)

export const getDownloadDisplayName = (download: TouchGalDownload) => {
  const explicitName = download.name.trim()
  if (explicitName) return explicitName
  return 'TouchGal 官方资源'
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
