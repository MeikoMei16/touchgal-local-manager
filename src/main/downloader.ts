import { getDb } from './db'

export interface DownloadTask {
  id: number
  gameId: number
  storageUrl: string
  status: 'queued' | 'downloading' | 'paused' | 'verifying' | 'extracting' | 'done' | 'error'
  progressBytes: number
  totalBytes: number
}

class DownloadManager {
  private static instance: DownloadManager
  private currentTask: DownloadTask | null = null

  private constructor() {}

  public static getInstance(): DownloadManager {
    if (!DownloadManager.instance) {
      DownloadManager.instance = new DownloadManager()
    }
    return DownloadManager.instance
  }

  /**
   * Add a new task to the SQLite queue.
   */
  public addTask(gameId: number, storageUrl: string): number {
    const db = getDb()
    const result = db.prepare(`
      INSERT INTO download_tasks (game_id, storage_url, status)
      VALUES (?, ?, 'queued')
    `).run(gameId, storageUrl)
    
    return result.lastInsertRowid as number
  }

  /**
   * Get all tasks in the queue.
   */
  public getQueue(): DownloadTask[] {
    const db = getDb()
    return db.prepare('SELECT * FROM download_tasks ORDER BY created_at DESC').all() as DownloadTask[]
  }

  /**
   * Simple link parser for common cloud providers.
   */
  public parseLink(content: string): { provider: string; url: string; password?: string }[] {
    const results: { provider: string; url: string; password?: string }[] = []
    
    // Baidu Pan matching
    const baiduRegex = /(https?:\/\/pan\.baidu\.com\/s\/[a-zA-Z0-9_\-]+)\s*(?:提取码[:：]\s*([a-zA-Z0-9]{4}))?/g
    let match
    while ((match = baiduRegex.exec(content)) !== null) {
      results.push({ provider: 'baidu', url: match[1], password: match[2] })
    }

    // Mega matching
    const megaRegex = /(https?:\/\/mega\.nz\/file\/[a-zA-Z0-9_\-#]+)/g
    while ((match = megaRegex.exec(content)) !== null) {
      results.push({ provider: 'mega', url: match[1] })
    }

    // Direct HTTP matching
    const directRegex = /(https?:\/\/[^\s$.?#].[^\s]*\.(?:zip|rar|7z|exe))/gi
    while ((match = directRegex.exec(content)) !== null) {
        if (!match[0].includes('pan.baidu.com') && !match[0].includes('mega.nz')) {
            results.push({ provider: 'direct', url: match[0] })
        }
    }

    return results
  }

  /**
   * (Placeholder) Start processing the next item in the queue.
   */
  public async processQueue() {
    if (this.currentTask) return // Already busy

    const db = getDb()
    const nextTask = db.prepare(`
      SELECT * FROM download_tasks WHERE status = 'queued' ORDER BY created_at ASC LIMIT 1
    `).get() as DownloadTask | undefined

    if (nextTask) {
        // Logic for actually downloading would go here.
        // For now, we'll just track the state in the DB.
        console.log('[Downloader] Starting task:', nextTask.id)
        this.currentTask = nextTask
        // ... implementation of download logic ...
    }
  }
}

export const downloadManager = DownloadManager.getInstance()
