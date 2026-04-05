import React from 'react'
import { createPortal } from 'react-dom'
import { Download, HardDrive, Languages, Loader2, X } from 'lucide-react'
import type { TouchGalDownload } from '../types'
import { TouchGalClient } from '../data/TouchGalClient'
import { getDownloadDisplayName, getDownloadMetadataChips, getOfficialGalgameDownloads } from '../features/downloads/downloadHelpers'
import { useUIStore } from '../store/useTouchGalStore'

interface QuickDownloadPopoverButtonProps {
  resourceId: number | null | undefined
  uniqueId: string
  resourceName: string
  buttonClassName?: string
  panelClassName?: string
  iconOnly?: boolean
}

export const QuickDownloadPopoverButton: React.FC<QuickDownloadPopoverButtonProps> = ({
  resourceId,
  uniqueId,
  resourceName,
  buttonClassName,
  panelClassName,
  iconOnly = false
}) => {
  const downloadPathOverride = useUIStore((state) => state.downloadPathOverride)
  const pushToast = useUIStore((state) => state.pushToast)
  const [isOpen, setIsOpen] = React.useState(false)
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [officialDownloads, setOfficialDownloads] = React.useState<TouchGalDownload[]>([])
  const [activeDownloadIndex, setActiveDownloadIndex] = React.useState<number | null>(null)
  const rootRef = React.useRef<HTMLDivElement>(null)
  const panelRef = React.useRef<HTMLDivElement>(null)
  const [panelPosition, setPanelPosition] = React.useState<{ top: number; left: number } | null>(null)

  const updatePanelPosition = React.useCallback(() => {
    const trigger = rootRef.current
    if (!trigger) return
    const rect = trigger.getBoundingClientRect()
    const panelWidth = Math.min(460, window.innerWidth - 24)
    const margin = 12
    const desiredLeft = rect.right - panelWidth
    const left = Math.min(
      Math.max(margin, desiredLeft),
      Math.max(margin, window.innerWidth - panelWidth - margin)
    )
    const top = Math.min(rect.bottom + 12, window.innerHeight - 24)
    setPanelPosition({ top, left })
  }, [])

  React.useEffect(() => {
    if (!isOpen) return

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (!rootRef.current?.contains(target) && !panelRef.current?.contains(target)) {
        setIsOpen(false)
      }
    }

    updatePanelPosition()
    window.addEventListener('mousedown', handlePointerDown)
    window.addEventListener('resize', updatePanelPosition)
    window.addEventListener('scroll', updatePanelPosition, true)
    return () => {
      window.removeEventListener('mousedown', handlePointerDown)
      window.removeEventListener('resize', updatePanelPosition)
      window.removeEventListener('scroll', updatePanelPosition, true)
    }
  }, [isOpen, updatePanelPosition])

  React.useEffect(() => {
    if (!isOpen) return

    let cancelled = false
    const loadOfficialDownloads = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const detail = await TouchGalClient.getPatchDetail(uniqueId)
        if (cancelled) return
        setOfficialDownloads(getOfficialGalgameDownloads(detail.downloads ?? []))
      } catch (loadError) {
        if (cancelled) return
        setError(loadError instanceof Error ? loadError.message : 'Failed to load official downloads')
        setOfficialDownloads([])
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    void loadOfficialDownloads()
    return () => {
      cancelled = true
    }
  }, [isOpen, uniqueId])

  const handleQueueOfficialDownload = async (download: TouchGalDownload, index: number) => {
    setError(null)
    setActiveDownloadIndex(index)
    try {
      const fallbackDirectory = await window.api.getDefaultDownloadDirectory()
      const targetDirectory = downloadPathOverride || fallbackDirectory
      const links = (download.content ?? download.url ?? '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean)

      let added = 0
      let reused = 0
      for (const link of links) {
        const result = await window.api.queueDownload(resourceId ?? null, link, targetDirectory, {
          id: resourceId ?? 0,
          uniqueId,
          name: resourceName,
        })
        added += result.added
        reused += result.reused
      }

      const headline = getDownloadDisplayName(download)
      pushToast(
        added > 0
          ? `已加入下载队列: ${headline}（新增 ${added} 个文件${reused > 0 ? `，复用 ${reused} 个已存在任务` : ''}）`
          : `下载任务已存在: ${headline}`
      )
      setIsOpen(false)
    } catch (queueError) {
      setError(queueError instanceof Error ? queueError.message : 'Failed to queue download')
    } finally {
      setActiveDownloadIndex(null)
    }
  }

  return (
    <div className="relative" ref={rootRef}>
      <button
        aria-label="快速下载"
        className={buttonClassName ?? 'inline-flex items-center gap-2 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-2.5 text-sm font-black text-sky-700 transition-all hover:bg-sky-100'}
        onClick={() => setIsOpen((current) => !current)}
        type="button"
      >
        <Download size={16} />
        {!iconOnly && '下载'}
      </button>

      {isOpen && panelPosition && createPortal(
        <div
          ref={panelRef}
          className={
            panelClassName ??
            'fixed z-[1600] flex w-[460px] max-w-[min(460px,calc(100vw-2rem))] flex-col overflow-hidden rounded-[30px] border border-slate-200/90 bg-white/98 shadow-[0_30px_60px_-28px_rgba(15,23,42,0.42)] ring-1 ring-white/80 backdrop-blur-xl'
          }
          style={{ top: panelPosition.top, left: panelPosition.left }}
        >
          <div className="border-b border-slate-100 bg-linear-to-r from-sky-50 via-white to-blue-50/70 px-5 py-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">Quick Download</div>
                <div className="mt-1 line-clamp-2 text-base font-black leading-6 text-slate-900">{resourceName}</div>
                <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[11px] font-bold text-slate-400">
                  <span className="rounded-full bg-white px-3 py-1 shadow-sm">仅 TouchGal 官方</span>
                  <span>仅游戏本体资源</span>
                </div>
              </div>
              <button
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 shadow-sm transition-all hover:scale-105 hover:text-slate-700"
                onClick={() => setIsOpen(false)}
                type="button"
              >
                <X size={15} />
              </button>
            </div>
          </div>

          <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
            <section className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">官方下载入口</div>
                <div className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-black text-slate-500">
                  {officialDownloads.length} 条
                </div>
              </div>

              {isLoading ? (
                <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-xs font-bold text-slate-500">
                  <Loader2 size={13} className="animate-spin" />
                  正在读取 TouchGal 官方资源...
                </div>
              ) : officialDownloads.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-3.5 py-3 text-xs font-bold text-slate-400">
                  当前游戏没有可直接加入队列的 TouchGal 官方本体资源。
                </div>
              ) : (
                officialDownloads.map((download, index) => {
                  const isBusy = activeDownloadIndex === index
                  const metadataChips = getDownloadMetadataChips(download)
                  return (
                    <button
                      key={`${download.id}-${download.content ?? download.url ?? index}`}
                      className="flex w-full items-start justify-between rounded-[1.65rem] border border-slate-200 bg-white px-5 py-4.5 text-left transition-all hover:border-sky-300 hover:bg-sky-50"
                      disabled={activeDownloadIndex !== null}
                      onClick={() => void handleQueueOfficialDownload(download, index)}
                      type="button"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap gap-2">
                          {metadataChips.map((chip) => (
                            <span
                              key={chip.key}
                              className={
                                chip.tone === 'section'
                                  ? 'rounded-full bg-sky-100 px-3 py-1 text-[11px] font-black text-sky-700'
                                  : chip.tone === 'type'
                                    ? 'rounded-full bg-blue-100 px-3 py-1 text-[11px] font-black text-blue-700'
                                    : chip.tone === 'language'
                                      ? 'inline-flex items-center gap-1 rounded-full bg-violet-100 px-3 py-1 text-[11px] font-black text-violet-700'
                                      : chip.tone === 'platform'
                                        ? 'rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-black text-emerald-700'
                                        : chip.tone === 'code'
                                          ? 'rounded-full bg-sky-100 px-3 py-1 text-[11px] font-black text-sky-700'
                                          : 'rounded-full bg-amber-100 px-3 py-1 text-[11px] font-black text-amber-700'
                              }
                            >
                              {chip.tone === 'language' && <Languages size={11} />}
                              {chip.label}
                            </span>
                          ))}
                        </div>
                        <div className="mt-3 text-[1.05rem] font-black leading-7 text-slate-900">
                          {getDownloadDisplayName(download)}
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] font-bold text-slate-500">
                          <span className="inline-flex items-center gap-1.5">
                            <HardDrive size={13} />
                            TouchGal 官方
                          </span>
                          <span>{download.size || '未知大小'}</span>
                          <span>直接加入下载页</span>
                        </div>
                      </div>
                      <div className="ml-5 inline-flex shrink-0 items-center gap-1.5 rounded-full bg-sky-100 px-3.5 py-2 text-[11px] font-black text-sky-700">
                        {isBusy ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                        <span>{isBusy ? '处理中' : '加入'}</span>
                      </div>
                    </button>
                  )
                })
              )}
            </section>

            {error && (
              <div className="rounded-2xl border border-rose-100 bg-rose-50 px-3.5 py-3 text-xs font-bold text-rose-600">
                {error}
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

export default QuickDownloadPopoverButton
