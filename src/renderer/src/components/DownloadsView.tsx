import React from 'react'
import { CheckCircle2, Download, FolderOpen, Pause, Play, RefreshCw, RotateCcw, Trash2 } from 'lucide-react'
import type { DownloadQueueTask } from '../types/electron'
import { formatBytes } from '../features/downloads/downloadHelpers'
import { useUIStore } from '../store/useTouchGalStore'

const formatPercent = (task: DownloadQueueTask) => {
  if (!task.totalBytes || task.totalBytes <= 0) return null
  return Math.min(100, Math.max(0, (task.progressBytes / task.totalBytes) * 100))
}

const STATUS_LABEL: Record<DownloadQueueTask['status'], string> = {
  queued: '排队中',
  downloading: '下载中',
  paused: '已暂停',
  verifying: '校验中',
  extracting: '解压中',
  done: '已完成',
  error: '失败'
}

export const DownloadsView: React.FC = () => {
  const { downloadPathOverride, pushToast } = useUIStore()
  const [defaultDirectory, setDefaultDirectory] = React.useState('')
  const [tasks, setTasks] = React.useState<DownloadQueueTask[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [actionTaskId, setActionTaskId] = React.useState<number | null>(null)

  const resolvedDirectory = downloadPathOverride || defaultDirectory
  const finishedTaskCount = tasks.filter((task) => task.status === 'done').length

  const loadQueue = React.useCallback(async () => {
    const [queue, fallbackDirectory] = await Promise.all([
      window.api.getDownloadQueue(),
      defaultDirectory ? Promise.resolve(defaultDirectory) : window.api.getDefaultDownloadDirectory()
    ])
    setTasks(queue)
    if (!defaultDirectory) setDefaultDirectory(fallbackDirectory)
    setIsLoading(false)
  }, [defaultDirectory])

  React.useEffect(() => {
    void loadQueue()
    const timer = window.setInterval(() => {
      void loadQueue()
    }, 1200)
    return () => window.clearInterval(timer)
  }, [loadQueue])

  const runAction = async (taskId: number, action: () => Promise<unknown>, message: string) => {
    setActionTaskId(taskId)
    try {
      await action()
      pushToast(message)
      await loadQueue()
    } catch (error) {
      pushToast(error instanceof Error ? error.message : '下载任务操作失败')
    } finally {
      setActionTaskId(null)
    }
  }

  const handleDeleteTask = async (task: DownloadQueueTask) => {
    const confirmed = task.status === 'done'
      ? window.confirm(`删除下载记录「${task.displayName}」？已下载文件会保留在磁盘。`)
      : window.confirm(`删除未完成任务「${task.displayName}」？磁盘上的未完成文件也会一起删除。`)

    if (!confirmed) return

    await runAction(
      task.id,
      () => window.api.deleteDownloadTask(task.id),
      task.status === 'done' ? '已删除下载记录' : '已删除下载任务和磁盘文件'
    )
  }

  const handleClearFinished = async () => {
    if (finishedTaskCount === 0) return
    const confirmed = window.confirm(`清除全部已完成任务？这只会移除列表中的 ${finishedTaskCount} 条完成记录，不会删除磁盘文件。`)
    if (!confirmed) return

    setActionTaskId(-1)
    try {
      await window.api.clearFinishedDownloadTasks()
      pushToast('已清除全部完成任务')
      await loadQueue()
    } catch (error) {
      pushToast(error instanceof Error ? error.message : '清除完成任务失败')
    } finally {
      setActionTaskId(null)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 md:p-8">
      <section className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex items-start justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-100 text-blue-700">
              <Download size={26} />
            </div>
            <div className="flex flex-col gap-2">
              <h1 className="text-3xl font-black tracking-tight text-slate-900">Downloads</h1>
              <p className="max-w-3xl text-sm font-medium leading-7 text-slate-500">
                这里显示 TouchGal 官方资源的逐文件下载进度。Cloudreve 直链支持分段续传，所以失败后的重试和已暂停任务的继续都会从已有文件继续。
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-black text-slate-700 transition-colors hover:bg-white"
              onClick={() => void loadQueue()}
              type="button"
            >
              <RotateCcw size={16} />
              刷新
            </button>
            <button
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
              disabled={finishedTaskCount === 0 || actionTaskId === -1}
              onClick={() => void handleClearFinished()}
              type="button"
            >
              <Trash2 size={16} />
              Clear All
            </button>
          </div>
        </div>

        <div className="mt-6 rounded-[1.6rem] border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-600">
          当前下载目录: <span className="font-mono text-[13px] text-slate-800">{resolvedDirectory || '读取中...'}</span>
        </div>
      </section>

      {isLoading ? (
        <div className="rounded-[2rem] border border-slate-200 bg-white p-10 text-center text-sm font-bold text-slate-500 shadow-sm">
          正在读取下载队列...
        </div>
      ) : tasks.length === 0 ? (
        <div className="rounded-[2rem] border border-dashed border-slate-300 bg-white p-12 text-center shadow-sm">
          <div className="text-lg font-black text-slate-900">还没有下载任务</div>
          <div className="mt-2 text-sm font-medium text-slate-500">回到首页卡片右侧的下载标签，就可以把 TouchGal 官方资源直接加入队列。</div>
        </div>
      ) : (
        <div className="space-y-4">
          {tasks.map((task) => {
            const percent = formatPercent(task)
            const isBusy = actionTaskId === task.id
            return (
              <article key={task.id} className="rounded-[1.8rem] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="truncate text-lg font-black text-slate-900">{task.displayName}</div>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-black ${
                          task.status === 'done'
                            ? 'bg-emerald-100 text-emerald-700'
                            : task.status === 'error'
                              ? 'bg-rose-100 text-rose-700'
                              : task.status === 'downloading'
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {STATUS_LABEL[task.status]}
                      </span>
                    </div>

                    <div className="mt-2 text-sm font-medium text-slate-500">
                      {formatBytes(task.progressBytes)} / {formatBytes(task.totalBytes)}
                      {percent != null ? ` · ${percent.toFixed(1)}%` : ''}
                    </div>

                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full rounded-full transition-all ${
                          task.status === 'error'
                            ? 'bg-rose-400'
                            : task.status === 'done'
                              ? 'bg-emerald-500'
                              : 'bg-blue-500'
                        }`}
                        style={{ width: `${percent ?? (task.status === 'done' ? 100 : 6)}%` }}
                      />
                    </div>

                    <div className="mt-3 break-all text-[13px] font-medium text-slate-500">{task.outputPath}</div>
                    {task.errorMessage && (
                      <div className="mt-2 rounded-2xl border border-rose-100 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-600">
                        {task.errorMessage}
                      </div>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    {task.status === 'downloading' && (
                      <button
                        className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-black text-slate-700 transition-colors hover:bg-white disabled:opacity-50"
                        disabled={isBusy}
                        onClick={() => void runAction(task.id, () => window.api.pauseDownloadTask(task.id), '已暂停下载')}
                        type="button"
                      >
                        <Pause size={16} />
                        暂停
                      </button>
                    )}
                    {(task.status === 'paused' || task.status === 'queued') && (
                      <button
                        className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-4 py-2 text-sm font-black text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                        disabled={isBusy}
                        onClick={() => void runAction(task.id, () => window.api.resumeDownloadTask(task.id), '已继续下载')}
                        type="button"
                      >
                        <Play size={16} />
                        继续
                      </button>
                    )}
                    {task.status === 'error' && (
                      <button
                        className="inline-flex items-center gap-2 rounded-2xl bg-rose-600 px-4 py-2 text-sm font-black text-white transition-colors hover:bg-rose-700 disabled:opacity-50"
                        disabled={isBusy}
                        onClick={() => void runAction(task.id, () => window.api.retryDownloadTask(task.id), '已重新加入下载队列')}
                        type="button"
                      >
                        <RefreshCw size={16} />
                        重试
                      </button>
                    )}
                    {task.status === 'done' && (
                      <button
                        className="inline-flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-black text-emerald-700 transition-colors hover:bg-emerald-100"
                        onClick={() => void runAction(task.id, () => window.api.revealDownloadTask(task.outputPath), '已打开文件所在位置')}
                        type="button"
                      >
                        <FolderOpen size={16} />
                        打开位置
                      </button>
                    )}
                    {task.status === 'done' && (
                      <span className="inline-flex items-center gap-2 rounded-2xl bg-emerald-100 px-4 py-2 text-sm font-black text-emerald-700">
                        <CheckCircle2 size={16} />
                        完成
                      </span>
                    )}
                    <button
                      className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
                      disabled={isBusy}
                      onClick={() => void handleDeleteTask(task)}
                      type="button"
                    >
                      <Trash2 size={16} />
                      删除
                    </button>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default DownloadsView
