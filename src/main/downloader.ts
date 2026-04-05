import axios from 'axios'
import fs from 'node:fs'
import path from 'node:path'
import { URL } from 'node:url'
import { getDb, linkLocalPath, type DownloadTaskRecord } from './db'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

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
}

const CLOUDREVE_SHARE_PATH = /^\/s\/([^/?#]+)/
const DOWNLOADABLE_FILE_EXTENSION = /\.(zip|rar|7z|exe|part\d+\.rar)$/i
const MAX_CONCURRENT_DOWNLOADS = 3

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

const ensureDir = (directory: string) => {
  fs.mkdirSync(directory, { recursive: true })
}

const fileExists = (filePath: string) => {
  try {
    return fs.statSync(filePath).isFile()
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
  createdAt: record.created_at,
  updatedAt: record.updated_at,
})

// ── Passwords used by TouchGal distributions ─────────────────────────────
const TG_PASSWORDS = ['', '1.touchgal', '宅方社']

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

/**
 * Probe archive metadata with `bz l` to find the correct password and
 * expected file count.  Returns { password, expectedCount } or null on failure.
 */
const probeArchive = async (
  bzPath: string,
  archivePath: string
): Promise<{ password: string; expectedCount: number } | null> => {
  for (const pwd of TG_PASSWORDS) {
    try {
      const args = ['l']
      if (pwd) args.push(`-p:${pwd}`)
      args.push(archivePath)

      const { stdout } = await execFileAsync(bzPath, args, {
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

      // Parse "N files" from summary line
      const match = out.match(/(\d+)\s+files/i)
      if (match) {
        return { password: pwd, expectedCount: parseInt(match[1], 10) }
      }
    } catch {
      continue
    }
  }
  return null
}

/**
 * Extract archive to targetDir using Bandizip CLI.
 */
const extractArchive = async (
  bzPath: string,
  archivePath: string,
  targetDir: string,
  password: string
): Promise<boolean> => {
  try {
    const args = ['x', `-o:${targetDir}`, '-y', '-aos']
    if (password) args.push(`-p:${password}`)
    args.push(archivePath)

    await execFileAsync(bzPath, args, { timeout: 300_000 })
    return true
  } catch {
    return false
  }
}

/**
 * Detect Bandizip CLI path.  Checks common install locations and PATH.
 */
const findBandizipCli = (): string | null => {
  const candidates = [
    'C:\\Program Files\\Bandizip\\bz.exe',
    'C:\\Program Files (x86)\\Bandizip\\bz.exe',
    'bz',  // on PATH
  ]
  for (const c of candidates) {
    try {
      // A quick `bz` with no args exits non-zero but proves it exists
      require('child_process').execFileSync(c, [], { timeout: 3000, stdio: 'ignore' })
      return c
    } catch (e: any) {
      // execFileSync throws on non-zero exit, but if the file was found the
      // error code will be numeric rather than ENOENT
      if (e?.code !== 'ENOENT' && e?.code !== 'ENOTFOUND') return c
    }
  }
  return null
}


class DownloadManager {
  private static instance: DownloadManager
  private activeControllers = new Map<number, AbortController>()
  private progressSaveAtByTask = new Map<number, number>()

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
        created_at,
        updated_at
      FROM download_tasks
      ORDER BY created_at DESC, id DESC
    `).all().map((row) => toTask(row as DownloadTaskRecord))
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
    const persistedGameId = this.resolvePersistedGameId(input.gameId)

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
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'queued', ?, ?, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
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
    return this.getTask(taskId)
  }

  public async resumeTask(taskId: number) {
    const task = this.getTask(taskId)
    if (!task) throw new Error('Download task not found')
    this.resetTaskForQueue(taskId)
    void this.processQueue()
    return this.getTask(taskId)
  }

  public pauseTask(taskId: number) {
    const activeController = this.activeControllers.get(taskId)
    if (activeController) {
      activeController.abort()
      return this.getTask(taskId)
    }

    const db = getDb()
    db.prepare(`
      UPDATE download_tasks
      SET status = 'paused', updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND status = 'queued'
    `).run(taskId)

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
    return { success: true }
  }

  public clearFinishedTasks() {
    const db = getDb()
    db.prepare(`DELETE FROM download_tasks WHERE status = 'done'`).run()
    return { success: true }
  }

  public async processQueue() {
    const db = getDb()
    const availableSlots = Math.max(0, MAX_CONCURRENT_DOWNLOADS - this.activeControllers.size)
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
        created_at,
        updated_at
      FROM download_tasks
      WHERE id = ?
    `).get(taskId) as DownloadTaskRecord | undefined

    return row ? toTask(row) : null
  }

  private resolvePersistedGameId(gameId: number | null) {
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
        return
      }

      db.prepare(`
        UPDATE download_tasks
        SET status = 'error', progress_bytes = ?, total_bytes = ?, error_message = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(progressBytes, totalBytes, error instanceof Error ? error.message : String(error), task.id)
      throw error
    })

    if (signal.aborted) return

    db.prepare(`
      UPDATE download_tasks
      SET status = 'done', progress_bytes = ?, total_bytes = ?, error_message = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(progressBytes, totalBytes, task.id)

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

    const bzPath = findBandizipCli()
    if (!bzPath) return  // Bandizip not installed — skip silently

    const db = getDb()

    db.prepare(`
      UPDATE download_tasks
      SET status = 'extracting', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(task.id)

    try {
      const probe = await probeArchive(bzPath, task.outputPath)
      if (!probe) {
        // Password probe failed — revert to done, leave archive in place
        db.prepare(`
          UPDATE download_tasks
          SET status = 'done', error_message = 'Extraction skipped: no matching password', updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(task.id)
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

      const extractDir = path.join(path.dirname(task.outputPath), folderName)

      // Clean up any previous partial extraction
      if (fs.existsSync(extractDir)) {
        fs.rmSync(extractDir, { recursive: true, force: true })
      }
      fs.mkdirSync(extractDir, { recursive: true })

      const success = await extractArchive(bzPath, task.outputPath, extractDir, probe.password)
      if (!success) {
        fs.rmSync(extractDir, { recursive: true, force: true })
        db.prepare(`
          UPDATE download_tasks
          SET status = 'done', error_message = 'Extraction failed', updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(task.id)
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
    } catch (err) {
      db.prepare(`
        UPDATE download_tasks
        SET status = 'done', error_message = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(`Extraction error: ${err instanceof Error ? err.message : String(err)}`, task.id)
    }
  }
}

export const downloadManager = DownloadManager.getInstance()
