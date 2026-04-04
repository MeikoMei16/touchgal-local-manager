import React from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { useUIStore } from '../store/useTouchGalStore'

const AppToastViewport: React.FC = () => {
  const { toasts, dismissToast } = useUIStore()

  React.useEffect(() => {
    if (toasts.length === 0) return

    const timers = toasts.map((toast) =>
      window.setTimeout(() => {
        dismissToast(toast.id)
      }, 3200)
    )

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer))
    }
  }, [dismissToast, toasts])

  if (toasts.length === 0) return null

  return createPortal(
    <div className="pointer-events-none fixed right-6 top-6 z-[120] flex w-[min(26rem,calc(100vw-2rem))] flex-col gap-3">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="pointer-events-auto flex items-start justify-between gap-3 rounded-[1.6rem] border border-slate-200 bg-white px-4 py-3 shadow-[0_20px_40px_-24px_rgba(15,23,42,0.45)]"
        >
          <div className="text-sm font-bold leading-6 text-slate-700">{toast.message}</div>
          <button
            className="rounded-full p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            onClick={() => dismissToast(toast.id)}
            type="button"
          >
            <X size={15} />
          </button>
        </div>
      ))}
    </div>,
    document.body
  )
}

export default AppToastViewport
