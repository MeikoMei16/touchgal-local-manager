import axios from 'axios'
import fs from 'node:fs'
import path from 'node:path'
import { URL } from 'node:url'
import {
  getDb,
  getDownloadConcurrencySetting,
  linkLocalPath,
  upsertGame,
  setDownloadConcurrencySetting,
  type DownloadTaskRecord
} from './db'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { findSupportedExtractor, type SupportedExtractor } from './extractor'

const execFileAsync = promisify(execFile)

export interface DownloadTask {
  id: number
  gameId: number | null
  sourceUrl: string
  storageUrl: string
  remotePath: string | null
  displayName: string
  outputPath: string
  status: 'queued' | 'downloading' | 'paused' | 'verifying' | 'extracting' | 'done' | 'error'
  progressBytes: number
  totalBytes: number | null
  errorMessage: string | null
  extractedPath: string | null
  createdAt: string
  updatedAt: string
}

interface ResolvedDownloadTarget {
  sourceUrl: string
  storageUrl: string
  remotePath: string | null
  displayName: string
  outputPath: string
  totalBytes: number | null
}

interface QueueDownloadInput {
  gameId: number | null
  sourceUrl: string
  downloadRoot: string
  gameMetadata?: {
    id: number
    uniqueId: string
    name: string
    banner?: string | null
    averageRating?: number
    viewCount?: number
    downloadCount?: number
    alias?: string[]
  } | null
}

const CLOUDREVE_SHARE_PATH = /^\/s\/([^/?#]+)/
const DOWNLOADABLE_FILE_EXTENSION = /\.(zip|rar|7z|exe|part\d+\.rar)$/i
const decodeUrlPathSegment = (value: string) => {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

const normalizeSlashPath = (value: string) => {
  if (!value || value === '/') return '/'
  return value.startsWith('/') ? value : `/${value}`
}

const isPathInsideRoot = (targetPath: string, rootPath: string) => {
  const relative = path.relative(rootPath, targetPath)
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))
}

const ensureDir = (directory: string) => {
  fs.mkdirSync(directory, { recursive: true })
}

const pathExists = (targetPath: string) => {
  try {
    fs.accessSync(targetPath)
    return true
  } catch {
    return false
  }
}

const fileExists = (filePath: string) => {
  try {
    return fs.statSync(filePath).isFile()
  } catch {
    return false
  }
}

const directoryExists = (directoryPath: string) => {
  try {
    return fs.statSync(directoryPath).isDirectory()
  } catch {
    return false
  }
}

const getFileSize = (filePath: string) => {
  try {
    return fs.statSync(filePath).size
  } catch {
    return 0
  }
}

const inferFilenameFromUrl = (rawUrl: string) => {
  try {
    const parsed = new URL(rawUrl)
    const pathname = parsed.pathname.split('/').filter(Boolean).pop() ?? 'download.bin'
    return decodeUrlPathSegment(pathname)
  } catch {
    return 'download.bin'
  }
}

const toTask = (record: DownloadTaskRecord): DownloadTask => ({
  id: record.id,
  gameId: record.game_id ?? null,
  sourceUrl: record.source_url,
  storageUrl: record.storage_url,
  remotePath: record.remote_path ?? null,
  displayName: record.display_name,
  outputPath: record.output_path,
  status: record.status,
  progressBytes: record.progress_bytes,
  totalBytes: record.total_bytes ?? null,
  errorMessage: record.error_message ?? null,
  extractedPath: record.extracted_path ?? null,
  createdAt: record.created_at,
  updatedAt: record.updated_at,
})

// ── Passwords used by TouchGal distributions ─────────────────────────────
const TG_PASSWORDS = ['', 'touchgal']

// Archive extensions that trigger extraction (skip .exe — may be installer)
const ARCHIVE_EXTENSIONS = new Set(['.zip', '.rar', '.7z', '.001'])

// Strip multi-part suffixes to get a clean game folder name
// e.g. "GameName.part2.rar" → skipped; "GameName.part1.rar" → "GameName"
// e.g. "GameName.7z.001"   → "GameName"
const stripArchiveSuffix = (filename: string) =>
  filename.replace(/(\.part0*1)?(\.zip|\.rar|\.7z|\.00\d+)+$/i, '')
         .replace(/(\.part\d+)?(\.zip|\.rar|\.7z|\.00\d+)+$/i, '')

// Only the "first" file of a multi-part set should trigger extraction
const isFirstPartOrSingle = (filename: string): boolean => {
  const lower = filename.toLowerCase()
  // .part2.rar, .part3.rar, ... → skip
  if (/\.part(?!0*1\.)[0-9]+\./i.test(lower)) return false
  // .002, .003, ... → skip (but .001 is fine)
  if (/\.0[0-9]{2}$/.test(lower) && !lower.endsWith('.001')) return false
  return true
}

const sanitizeForFolder = (name: string): string =>
  name.replace(/[<>:"|?*\\/]/g, '_').trim()

const getAvailableDirectoryPath = (basePath: string) => {
  if (!pathExists(basePath)) return basePath

  let suffix = 2
  while (pathExists(`${basePath} (${suffix})`)) {
    suffix += 1
  }

  return `${basePath} (${suffix})`
}

const countFilesRecursive = (dir: string): number => {
  let count = 0
  const recurse = (d: string) => {
    try {
      for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
        if (entry.isFile()) count++
        else if (entry.isDirectory()) recurse(path.join(d, entry.name))
      }
    } catch { /* ignore */ }
  }
  recurse(dir)
  return count
}

const pruneEmptyParents = (startDirectory: string, rootDirectory: string) => {
  let current = startDirectory
  while (isPathInsideRoot(current, rootDirectory) && current !== rootDirectory) {
    if (!directoryExists(current)) {
      current = path.dirname(current)
      continue
    }

    const entries = fs.readdirSync(current)
    if (entries.length > 0) return
    fs.rmdirSync(current)
    current = path.dirname(current)
  }
}

const parseExpectedFileCount = (output: string): number | null => {
  const match = output.match(/(\d+)\s+files?/i)
  if (!match) return null
  return parseInt(match[1], 10)
}

const probeBandizipArchive = async (
  extractorPath: string,
  archivePath: string
): Promise<{ password: string; expectedCount: number } | null> => {
  for (const pwd of TG_PASSWORDS) {
    try {
      const args = ['l']
      if (pwd) args.push(`-p:${pwd}`)
      args.push(archivePath)

      const { stdout } = await execFileAsync(extractorPath, args, {
        timeout: 15_000,
        encoding: 'buffer',
      })

      // Bandizip stdout may be GBK-encoded on Windows
      let out: string
      try {
        out = new TextDecoder('gbk').decode(stdout)
      } catch {
        out = stdout.toString('utf8')
      }

      if (out.includes('Invalid Password') || out.includes('Wrong password')) continue

      const expectedCount = parseExpectedFileCount(out)
      if (expectedCount != null) {
        return { password: pwd, expectedCount }
      }
    } catch {
      continue
    }
  }
  return null
}

const probeSevenZipArchive = async (
  extractorPath: string,
  archivePath: string
): Promise<{ password: string; expectedCount: number } | null> => {
  for (const pwd of TG_PASSWORDS) {
    try {
      const testArgs = ['t', '-y']
      if (pwd) testArgs.push(`-p${pwd}`)
      testArgs.push(archivePath)

      await execFileAsync(extractorPath, testArgs, { timeout: 15_000, encoding: 'utf8' })

      const listArgs = ['l']
      if (pwd) listArgs.push(`-p${pwd}`)
      listArgs.push(archivePath)

      const { stdout } = await execFileAsync(extractorPath, listArgs, {
        timeout: 15_000,
        encoding: 'utf8',
      })

      const expectedCount = parseExpectedFileCount(stdout)
      if (expectedCount != null) {
        return { password: pwd, expectedCount }
      }
    } catch {
      continue
    }
  }

  return null
}

const probeArchive = async (
  extractor: SupportedExtractor,
  archivePath: string
): Promise<{ password: string; expectedCount: number } | null> => {
  if (extractor.kind === 'bandizip') {
    return probeBandizipArchive(extractor.path, archivePath)
  }
  return probeSevenZipArchive(extractor.path, archivePath)
}

const extractBandizipArchive = async (
  extractorPath: string,
  archivePath: string,
  targetDir: string,
  password: string
): Promise<boolean> => {
  try {
    const args = ['x', `-o:${targetDir}`, '-y', '-aos']
    if (password) args.push(`-p:${password}`)
    args.push(archivePath)

    await execFileAsync(extractorPath, args, { timeout: 300_000 })
    return true
  } catch {
    return false
  }
}

const extractSevenZipArchive = async (
  extractorPath: string,
  archivePath: string,
  targetDir: string,
  password: string
): Promise<boolean> => {
  try {
    const args = ['x', archivePath, `-o${targetDir}`, '-y', '-aos']
    if (password) args.push(`-p${password}`)

    await execFileAsync(extractorPath, args, { timeout: 300_000, encoding: 'utf8' })
    return true
  } catch {
    return false
  }
}

const extractArchive = async (
  extractor: SupportedExtractor,
  archivePath: string,
  targetDir: string,
  password: string
): Promise<boolean> => {
  if (extractor.kind === 'bandizip') {
    return extractBandizipArchive(extractor.path, archivePath, targetDir, password)
  }
  return extractSevenZipArchive(extractor.path, archivePath, targetDir, password)
}

class DownloadManager {
  private static instance: DownloadManager
  private activeControllers = new Map<number, AbortController>()
  private progressSaveAtByTask = new Map<number, number>()
  private queueListeners = new Set<(queue: DownloadTask[]) => void>()
  private maxConcurrentDownloads = getDownloadConcurrencySetting()

  private constructor() {
    const db = getDb()
    db.prepare(`
      UPDATE download_tasks
      SET status = 'paused', updated_at = CURRENT_TIMESTAMP, error_message = COALESCE(error_message, 'Download interrupted')
      WHERE status = 'downloading'
    `).run()
  }

  public static getInstance(): DownloadManager {
    if (!DownloadManager.instance) {
      DownloadManager.instance = new DownloadManager()
    }
    return DownloadManager.instance
  }

  public getDefaultDownloadDirectory() {
    const defaultDir = path.join(process.cwd(), 'download')
    ensureDir(defaultDir)
    return defaultDir
  }

  public getDefaultLibraryDirectory() {
    const defaultDir = path.join(process.cwd(), 'library')
    ensureDir(defaultDir)
    return defaultDir
  }

  public getQueue(): DownloadTask[] {
    const db = getDb()
    return db.prepare(`
      SELECT
        id,
        game_id,
        source_url,
        storage_url,
        remote_path,
        display_name,
        output_path,
        status,
        progress_bytes,
        total_bytes,
        error_message,
        extracted_path,
        created_at,
        updated_at
      FROM download_tasks
      ORDER BY created_at DESC, id DESC
    `).all().map((row) => toTask(row as DownloadTaskRecord))
  }

  public subscribeQueue(listener: (queue: DownloadTask[]) => void) {
    this.queueListeners.add(listener)
    return () => {
      this.queueListeners.delete(listener)
    }
  }

  public getMaxConcurrentDownloads() {
    return this.maxConcurrentDownloads
  }

  public setMaxConcurrentDownloads(value: number) {
    this.maxConcurrentDownloads = setDownloadConcurrencySetting(value)
    this.notifyQueueChanged()
    void this.processQueue()
    return this.maxConcurrentDownloads
  }

  public parseLink(content: string): { provider: string; url: string; password?: string }[] {
    const results: { provider: string; url: string; password?: string }[] = []

    const baiduRegex = /(https?:\/\/pan\.baidu\.com\/s\/[a-zA-Z0-9_\-]+)\s*(?:提取码[:：]\s*([a-zA-Z0-9]{4}))?/g
    let match
    while ((match = baiduRegex.exec(content)) !== null) {
      results.push({ provider: 'baidu', url: match[1], password: match[2] })
    }

    const megaRegex = /(https?:\/\/mega\.nz\/file\/[a-zA-Z0-9_\-#]+)/g
    while ((match = megaRegex.exec(content)) !== null) {
      results.push({ provider: 'mega', url: match[1] })
    }

    const directRegex = /(https?:\/\/[^\s$.?#].[^\s]*\.(?:zip|rar|7z|exe))/gi
    while ((match = directRegex.exec(content)) !== null) {
      if (!match[0].includes('pan.baidu.com') && !match[0].includes('mega.nz')) {
        results.push({ provider: 'direct', url: match[0] })
      }
    }

    return results
  }

  public async queueDownload(input: QueueDownloadInput) {
    const resolvedTargets = await this.resolveSource(input.sourceUrl, input.downloadRoot)
    const db = getDb()
    const insertedTasks: DownloadTask[] = []
    const existingTasks: DownloadTask[] = []
    const persistedGameId = this.resolvePersistedGameId(input.gameId, input.gameMetadata ?? null)

    const insertTask = db.prepare(`
      INSERT INTO download_tasks (
        game_id,
        source_url,
        storage_url,
        remote_path,
        display_name,
        output_path,
        status,
        progress_bytes,
        total_bytes,
        error_message,
        extracted_path,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'queued', ?, ?, NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `)

    const selectExistingTask = db.prepare(`
      SELECT
        id,
        game_id,
        source_url,
        storage_url,
        remote_path,
        display_name,
        output_path,
        status,
        progress_bytes,
        total_bytes,
        error_message,
        extracted_path,
        created_at,
        updated_at
      FROM download_tasks
      WHERE output_path = ?
      ORDER BY id DESC
      LIMIT 1
    `)

    for (const target of resolvedTargets) {
      ensureDir(path.dirname(target.outputPath))

      const existing = selectExistingTask.get(target.outputPath) as DownloadTaskRecord | undefined
      if (existing && existing.status !== 'error') {
        existingTasks.push(toTask(existing))
        continue
      }

      const existingBytes = fileExists(target.outputPath) ? getFileSize(target.outputPath) : 0
      const progressBytes = target.totalBytes != null && existingBytes >= target.totalBytes ? target.totalBytes : existingBytes

      const result = insertTask.run(
        persistedGameId,
        target.sourceUrl,
        target.storageUrl,
        target.remotePath,
        target.displayName,
        target.outputPath,
        progressBytes,
        target.totalBytes
      )

      const inserted = selectExistingTask.get(target.outputPath) as DownloadTaskRecord | undefined
      if (result.lastInsertRowid && inserted) {
        insertedTasks.push(toTask(inserted))
      }
    }

    void this.processQueue()
    this.notifyQueueChanged()

    return {
      added: insertedTasks.length,
      reused: existingTasks.length,
      tasks: [...insertedTasks, ...existingTasks],
    }
  }

  public async retryTask(taskId: number) {
    const task = this.getTask(taskId)
    if (!task) throw new Error('Download task not found')
    this.resetTaskForQueue(taskId)
    void this.processQueue()
    this.notifyQueueChanged()
    return this.getTask(taskId)
  }

  public async resumeTask(taskId: number) {
    const task = this.getTask(taskId)
    if (!task) throw new Error('Download task not found')
    this.resetTaskForQueue(taskId)
    void this.processQueue()
    this.notifyQueueChanged()
    return this.getTask(taskId)
  }

  public pauseTask(taskId: number) {
    const activeController = this.activeControllers.get(taskId)
    if (activeController) {
      activeController.abort()
      this.notifyQueueChanged()
      return this.getTask(taskId)
    }

    const db = getDb()
    db.prepare(`
      UPDATE download_tasks
      SET status = 'paused', updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND status = 'queued'
    `).run(taskId)
    this.notifyQueueChanged()

    return this.getTask(taskId)
  }

  public async deleteTask(taskId: number) {
    const task = this.getTask(taskId)
    if (!task) throw new Error('Download task not found')

    const db = getDb()
    const activeController = this.activeControllers.get(taskId)
    if (activeController) {
      activeController.abort()
    }

    if (task.status !== 'done' && task.outputPath && fileExists(task.outputPath)) {
      fs.rmSync(task.outputPath, { force: true })
    }

    db.prepare(`DELETE FROM download_tasks WHERE id = ?`).run(taskId)
    this.notifyQueueChanged()
    return { success: true }
  }

  public async deleteTasksAndFiles(taskIds: number[], downloadRoot: string) {
    const normalizedRoot = path.resolve(downloadRoot)
    ensureDir(normalizedRoot)
    const db = getDb()

    const deletedTaskIds: number[] = []
    const deletedFiles: string[] = []

    for (const taskId of taskIds) {
      const task = this.getTask(taskId)
      if (!task) continue

      const activeController = this.activeControllers.get(taskId)
      if (activeController) {
        activeController.abort()
      }

      if (task.outputPath) {
        const resolvedOutputPath = path.resolve(task.outputPath)
        if (isPathInsideRoot(resolvedOutputPath, normalizedRoot) && fileExists(resolvedOutputPath)) {
          fs.rmSync(resolvedOutputPath, { force: true })
          deletedFiles.push(resolvedOutputPath)
          pruneEmptyParents(path.dirname(resolvedOutputPath), normalizedRoot)
        }
      }

      db.prepare(`DELETE FROM download_tasks WHERE id = ?`).run(taskId)
      deletedTaskIds.push(taskId)
    }

    this.notifyQueueChanged()
    return {
      success: true,
      deletedTaskIds,
      deletedFiles,
    }
  }

  public clearFinishedTasks() {
    const db = getDb()
    db.prepare(`DELETE FROM download_tasks WHERE status = 'done'`).run()
    this.notifyQueueChanged()
    return { success: true }
  }

  public async processQueue() {
    const db = getDb()
    const availableSlots = Math.max(0, this.maxConcurrentDownloads - this.activeControllers.size)
    if (availableSlots === 0) return

    const nextTasks = db.prepare(`
      SELECT
        id,
        game_id,
        source_url,
        storage_url,
        remote_path,
        display_name,
        output_path,
        status,
        progress_bytes,
        total_bytes,
        error_message,
        extracted_path,
        created_at,
        updated_at
      FROM download_tasks
      WHERE status = 'queued'
      ORDER BY created_at ASC, id ASC
      LIMIT ?
    `).all(availableSlots) as DownloadTaskRecord[]

    if (nextTasks.length === 0) return

    for (const taskRecord of nextTasks) {
      const task = toTask(taskRecord)
      if (this.activeControllers.has(task.id)) continue

      const controller = new AbortController()
      this.activeControllers.set(task.id, controller)
      this.progressSaveAtByTask.set(task.id, 0)

      void this.downloadTask(task, controller.signal)
        .catch(() => undefined)
        .finally(() => {
          this.activeControllers.delete(task.id)
          this.progressSaveAtByTask.delete(task.id)
          void this.processQueue()
        })
    }
  }

  private getTask(taskId: number) {
    const db = getDb()
    const row = db.prepare(`
      SELECT
        id,
        game_id,
        source_url,
        storage_url,
        remote_path,
        display_name,
        output_path,
        status,
        progress_bytes,
        total_bytes,
        error_message,
        extracted_path,
        created_at,
        updated_at
      FROM download_tasks
      WHERE id = ?
    `).get(taskId) as DownloadTaskRecord | undefined

    return row ? toTask(row) : null
  }

  private resolvePersistedGameId(
    gameId: number | null,
    gameMetadata?: QueueDownloadInput['gameMetadata']
  ) {
    if (gameMetadata?.uniqueId && gameMetadata.name) {
      upsertGame({
        id: gameMetadata.id,
        uniqueId: gameMetadata.uniqueId,
        name: gameMetadata.name,
        banner: gameMetadata.banner ?? null,
        averageRating: gameMetadata.averageRating ?? 0,
        viewCount: gameMetadata.viewCount ?? 0,
        downloadCount: gameMetadata.downloadCount ?? 0,
        alias: gameMetadata.alias ?? [],
      })

      const db = getDb()
      const existingByUniqueId = db.prepare('SELECT id FROM games WHERE unique_id = ? LIMIT 1')
        .get(gameMetadata.uniqueId) as { id: number } | undefined
      if (existingByUniqueId?.id != null) {
        return existingByUniqueId.id
      }
    }

    if (gameId == null) return null
    const db = getDb()
    const existing = db.prepare('SELECT id FROM games WHERE id = ? LIMIT 1').get(gameId) as { id: number } | undefined
    return existing?.id ?? null
  }

  private resetTaskForQueue(taskId: number) {
    const db = getDb()
    db.prepare(`
      UPDATE download_tasks
      SET status = 'queued', error_message = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(taskId)
  }

  private notifyQueueChanged() {
    if (this.queueListeners.size === 0) return
    const queue = this.getQueue()
    for (const listener of this.queueListeners) {
      listener(queue)
    }
  }

  private async resolveSource(sourceUrl: string, downloadRoot: string): Promise<ResolvedDownloadTarget[]> {
    const parsed = new URL(sourceUrl)
    const shareMatch = parsed.pathname.match(CLOUDREVE_SHARE_PATH)
    if (shareMatch) {
      return this.resolveCloudreveShare(sourceUrl, downloadRoot, parsed.origin, shareMatch[1], normalizeSlashPath(parsed.searchParams.get('path') ?? '/'))
    }

    const fileName = inferFilenameFromUrl(sourceUrl)
    if (!DOWNLOADABLE_FILE_EXTENSION.test(fileName)) {
      throw new Error(`Unsupported direct download URL: ${sourceUrl}`)
    }

    return [
      {
        sourceUrl,
        storageUrl: sourceUrl,
        remotePath: null,
        displayName: fileName,
        outputPath: path.join(downloadRoot, fileName),
        totalBytes: null,
      },
    ]
  }

  private async resolveCloudreveShare(
    sourceUrl: string,
    downloadRoot: string,
    origin: string,
    shareKey: string,
    initialPath: string
  ): Promise<ResolvedDownloadTarget[]> {
    const infoResponse = await axios.get(`${origin}/api/v3/share/info/${shareKey}`)
    const infoPayload = infoResponse.data
    if (infoPayload?.code !== 0) {
      throw new Error(infoPayload?.msg || 'Failed to load Cloudreve share info')
    }

    const shareName = infoPayload.data?.source?.name || shareKey

    if (!infoPayload.data?.is_dir) {
      const downloadResponse = await axios.put(`${origin}/api/v3/share/download/${shareKey}`)
      if (downloadResponse.data?.code !== 0) {
        throw new Error(downloadResponse.data?.msg || 'Failed to resolve Cloudreve file download')
      }

      return [
        {
          sourceUrl,
          storageUrl: downloadResponse.data.data,
          remotePath: null,
          displayName: shareName,
          outputPath: path.join(downloadRoot, shareName),
          totalBytes: typeof infoPayload.data?.source?.size === 'number' ? infoPayload.data.source.size : null,
        },
      ]
    }

    const targets: ResolvedDownloadTarget[] = []
    const baseFolderName = shareName
    await this.walkCloudreveDirectory({
      origin,
      shareKey,
      sourceUrl,
      downloadRoot,
      initialPath,
      currentPath: initialPath,
      baseFolderName,
      targets,
    })
    return targets
  }

  private async walkCloudreveDirectory(input: {
    origin: string
    shareKey: string
    sourceUrl: string
    downloadRoot: string
    initialPath: string
    currentPath: string
    baseFolderName: string
    targets: ResolvedDownloadTarget[]
  }): Promise<void> {
    const listUrl = `${input.origin}/api/v3/share/list/${input.shareKey}/?path=${encodeURIComponent(input.currentPath)}`
    const listResponse = await axios.get(listUrl)
    if (listResponse.data?.code !== 0) {
      throw new Error(listResponse.data?.msg || 'Failed to list Cloudreve directory')
    }

    const objects = Array.isArray(listResponse.data?.data?.objects) ? listResponse.data.data.objects : []
    for (const entry of objects) {
      const parentPath = normalizeSlashPath(entry.path ?? input.currentPath)
      const remotePath = normalizeSlashPath(path.posix.join(parentPath, entry.name))
      if (entry.type === 'dir') {
        await this.walkCloudreveDirectory({
          ...input,
          currentPath: remotePath,
        })
        continue
      }

      if (entry.type !== 'file') continue

      const downloadUrl = `${input.origin}/api/v3/share/download/${input.shareKey}?path=${encodeURIComponent(remotePath)}`
      const downloadResponse = await axios.put(downloadUrl)
      if (downloadResponse.data?.code !== 0) {
        throw new Error(downloadResponse.data?.msg || 'Failed to resolve Cloudreve directory file')
      }

      const relativeFromRoot = path.posix.relative(normalizeSlashPath(input.initialPath), remotePath).replace(/^(\.\.\/)+/, '')
      input.targets.push({
        sourceUrl: input.sourceUrl,
        storageUrl: downloadResponse.data.data,
        remotePath,
        displayName: entry.name,
        outputPath: path.join(input.downloadRoot, input.baseFolderName, relativeFromRoot),
        totalBytes: typeof entry.size === 'number' ? entry.size : null,
      })
    }
  }

  private async refreshTaskStorageUrl(task: DownloadTask) {
    if (!task.sourceUrl || task.sourceUrl === task.storageUrl) {
      return task.storageUrl
    }

    const parsed = new URL(task.sourceUrl)
    const shareMatch = parsed.pathname.match(CLOUDREVE_SHARE_PATH)
    if (!shareMatch) {
      return task.sourceUrl
    }

    const origin = parsed.origin
    const shareKey = shareMatch[1]
    const apiUrl = task.remotePath
      ? `${origin}/api/v3/share/download/${shareKey}?path=${encodeURIComponent(task.remotePath)}`
      : `${origin}/api/v3/share/download/${shareKey}`
    const response = await axios.put(apiUrl)
    if (response.data?.code !== 0) {
      throw new Error(response.data?.msg || 'Failed to refresh Cloudreve download URL')
    }

    const refreshedUrl = response.data.data as string
    const db = getDb()
    db.prepare(`
      UPDATE download_tasks
      SET storage_url = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(refreshedUrl, task.id)
    return refreshedUrl
  }

  private async downloadTask(task: DownloadTask, signal: AbortSignal) {
    const db = getDb()
    ensureDir(path.dirname(task.outputPath))

    const refreshedUrl = await this.refreshTaskStorageUrl(task)
    let existingBytes = fileExists(task.outputPath) ? getFileSize(task.outputPath) : 0

    db.prepare(`
      UPDATE download_tasks
      SET status = 'downloading', error_message = NULL, progress_bytes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(existingBytes, task.id)
    this.notifyQueueChanged()

    const headers: Record<string, string> = {}
    if (existingBytes > 0) {
      headers.Range = `bytes=${existingBytes}-`
    }

    const response = await axios.get(refreshedUrl, {
      responseType: 'stream',
      signal,
      headers,
      validateStatus: (status) => (status >= 200 && status < 300) || status === 206,
    })

    const isPartial = response.status === 206 && existingBytes > 0
    const totalBytesHeader = Number(response.headers['content-length'] ?? 0)
    const totalBytes = isPartial
      ? existingBytes + totalBytesHeader
      : totalBytesHeader || task.totalBytes || null

    if (!isPartial && existingBytes > 0) {
      existingBytes = 0
    }

    const writer = fs.createWriteStream(task.outputPath, { flags: isPartial ? 'a' : 'w' })
    let progressBytes = existingBytes
    response.data.on('data', (chunk: Buffer) => {
      progressBytes += chunk.length
      const now = Date.now()
      const lastSaveAt = this.progressSaveAtByTask.get(task.id) ?? 0
      if (now - lastSaveAt >= 350) {
        this.progressSaveAtByTask.set(task.id, now)
        db.prepare(`
          UPDATE download_tasks
          SET progress_bytes = ?, total_bytes = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(progressBytes, totalBytes, task.id)
        this.notifyQueueChanged()
      }
    })

    await new Promise<void>((resolve, reject) => {
      response.data.on('error', reject)
      writer.on('error', reject)
      writer.on('finish', resolve)
      response.data.pipe(writer)
    }).catch((error) => {
      if ((error as Error).name === 'CanceledError' || signal.aborted) {
        db.prepare(`
          UPDATE download_tasks
          SET status = 'paused', progress_bytes = ?, total_bytes = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(progressBytes, totalBytes, task.id)
        this.notifyQueueChanged()
        return
      }

      db.prepare(`
        UPDATE download_tasks
        SET status = 'error', progress_bytes = ?, total_bytes = ?, error_message = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(progressBytes, totalBytes, error instanceof Error ? error.message : String(error), task.id)
      this.notifyQueueChanged()
      throw error
    })

    if (signal.aborted) return

    db.prepare(`
      UPDATE download_tasks
      SET status = 'done', progress_bytes = ?, total_bytes = ?, error_message = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(progressBytes, totalBytes, task.id)
    this.notifyQueueChanged()

    // Kick off post-download extraction pipeline (non-blocking)
    void this.extractAndLink(task).catch(() => undefined)
  }

  /**
   * Post-download pipeline:
   * 1. Detect if file is a known archive extension and first-part-or-single
   * 2. Probe password with bz l
   * 3. Extract to a temp folder in the same directory
   * 4. Rename folder to sanitised game name (+ append unique_id if available)
   * 5. Write .tg_id marker file
   * 6. Link extracted path in local_paths
   */
  private async extractAndLink(task: DownloadTask): Promise<void> {
    const filename = path.basename(task.outputPath)
    const ext = path.extname(filename).toLowerCase()

    if (!ARCHIVE_EXTENSIONS.has(ext) || !isFirstPartOrSingle(filename)) return

    const extractor = findSupportedExtractor()
    if (!extractor) return

    const db = getDb()

    db.prepare(`
      UPDATE download_tasks
      SET status = 'extracting', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(task.id)
    this.notifyQueueChanged()

    try {
      const probe = await probeArchive(extractor, task.outputPath)
      if (!probe) {
        // Password probe failed — revert to done, leave archive in place
        db.prepare(`
          UPDATE download_tasks
          SET status = 'done', error_message = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(`Extraction skipped: ${extractor.name} could not verify password`, task.id)
        this.notifyQueueChanged()
        return
      }

      // Determine output folder name
      let folderName = stripArchiveSuffix(filename)
      // Try to get canonical name from games table
      let uniqueId: string | null = null
      if (task.gameId) {
        const gameRow = db.prepare('SELECT unique_id, name FROM games WHERE id = ?')
          .get(task.gameId) as { unique_id: string; name: string } | undefined
        if (gameRow) {
          folderName = sanitizeForFolder(gameRow.name)
          uniqueId = gameRow.unique_id
        }
      }

      const extractDir = getAvailableDirectoryPath(path.join(this.getDefaultLibraryDirectory(), folderName))
      fs.mkdirSync(extractDir, { recursive: true })

      const success = await extractArchive(extractor, task.outputPath, extractDir, probe.password)
      if (!success) {
        fs.rmSync(extractDir, { recursive: true, force: true })
        db.prepare(`
          UPDATE download_tasks
          SET status = 'done', error_message = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(`Extraction failed via ${extractor.name}`, task.id)
        this.notifyQueueChanged()
        return
      }

      // Verify file count
      const actualCount = countFilesRecursive(extractDir)
      if (actualCount < probe.expectedCount) {
        fs.rmSync(extractDir, { recursive: true, force: true })
        db.prepare(`
          UPDATE download_tasks
          SET status = 'done', error_message = 'Extraction verification failed (' + actualCount + '/' + probe.expectedCount + ' files)', updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(task.id)
        this.notifyQueueChanged()
        return
      }

      // Write .tg_id marker
      if (uniqueId) {
        fs.writeFileSync(path.join(extractDir, '.tg_id'), uniqueId, 'utf8')
      }

      // Link in local_paths
      if (task.gameId) {
        linkLocalPath(extractDir, task.gameId, 'download')
      }

      db.prepare(`
        UPDATE download_tasks
        SET status = 'done', extracted_path = ?, error_message = NULL, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(extractDir, task.id)
      this.notifyQueueChanged()
    } catch (err) {
      db.prepare(`
        UPDATE download_tasks
        SET status = 'done', error_message = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(`Extraction error: ${err instanceof Error ? err.message : String(err)}`, task.id)
      this.notifyQueueChanged()
    }
  }
}

export const downloadManager = DownloadManager.getInstance()
