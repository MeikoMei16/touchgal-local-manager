import React from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import type { DetailSecondaryClickAction } from '../../store/uiStoreTypes';

interface DetailImageViewerProps {
  images: string[];
  currentIndex: number;
  onDismiss: () => void;
  onSelectIndex: (index: number) => void;
  secondaryClickAction?: DetailSecondaryClickAction;
}

export const DetailImageViewer: React.FC<DetailImageViewerProps> = ({
  images,
  currentIndex,
  onDismiss,
  onSelectIndex,
  secondaryClickAction = 'back'
}) => {
  const safeIndex = Math.min(Math.max(currentIndex, 0), Math.max(images.length - 1, 0));
  const currentUrl = images[safeIndex] ?? '';
  const canGoPrev = safeIndex > 0;
  const canGoNext = safeIndex < images.length - 1;

  const goPrev = React.useCallback(() => {
    if (!canGoPrev) return;
    onSelectIndex(safeIndex - 1);
  }, [canGoPrev, onSelectIndex, safeIndex]);

  const goNext = React.useCallback(() => {
    if (!canGoNext) return;
    onSelectIndex(safeIndex + 1);
  }, [canGoNext, onSelectIndex, safeIndex]);

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onDismiss();
        return;
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        goPrev();
        return;
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        goNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goNext, goPrev, onDismiss]);

  if (!currentUrl) return null;

  return (
    <div
      className="fixed inset-0 bg-black/95 z-[2000] flex items-center justify-center animate-in fade-in duration-200"
      onClick={onDismiss}
      onContextMenu={(event) => {
        if (secondaryClickAction !== 'back') return;
        event.preventDefault();
        onDismiss();
      }}
    >
      <div className="relative flex h-full w-full items-center justify-center px-6 py-10" onClick={(e) => e.stopPropagation()}>
        {images.length > 1 && (
          <button
            type="button"
            aria-label="Previous screenshot"
            disabled={!canGoPrev}
            className="absolute left-4 md:left-8 z-10 flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white backdrop-blur-md transition-all hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-35"
            onClick={goPrev}
          >
            <ChevronLeft size={26} />
          </button>
        )}

        <div className="relative group flex max-h-full max-w-[95%] items-center justify-center">
          <img
            src={currentUrl}
            alt={`Screenshot ${safeIndex + 1}`}
            className="max-h-[90vh] max-w-full object-contain rounded-xl shadow-2xl border border-white/10"
          />
          <button
            type="button"
            className="absolute -top-12 right-0 bg-white/10 hover:bg-white/20 text-white border-none rounded-full w-10 h-10 flex items-center justify-center cursor-pointer transition-all backdrop-blur-md"
            onClick={onDismiss}
          >
            <X size={24} />
          </button>
          {images.length > 1 && (
            <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 rounded-full border border-white/10 bg-white/10 px-4 py-1.5 text-sm font-bold text-white backdrop-blur-md">
              {safeIndex + 1} / {images.length}
            </div>
          )}
        </div>

        {images.length > 1 && (
          <button
            type="button"
            aria-label="Next screenshot"
            disabled={!canGoNext}
            className="absolute right-4 md:right-8 z-10 flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white backdrop-blur-md transition-all hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-35"
            onClick={goNext}
          >
            <ChevronRight size={26} />
          </button>
        )}
      </div>
    </div>
  );
};
