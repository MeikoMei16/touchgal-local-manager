import React from 'react';
import { Maximize2 } from 'lucide-react';

interface DetailScreenshotStripProps {
  screenshots: string[];
  onImageClick: (url: string) => void;
}

export const DetailScreenshotStrip: React.FC<DetailScreenshotStripProps> = ({
  screenshots,
  onImageClick
}) => {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const dragStateRef = React.useRef<{ startX: number; scrollLeft: number; moved: boolean } | null>(null);
  const suppressClickRef = React.useRef(false);

  if (!screenshots || screenshots.length === 0) return null;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-end justify-between gap-3">
        <h2 className="text-2xl font-black text-slate-900 tracking-tight">游戏截图</h2>
        <span className="text-sm font-bold text-slate-400">{screenshots.length} 张</span>
      </div>

      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto pb-2 scroll-smooth snap-x snap-mandatory cursor-grab active:cursor-grabbing select-none"
        onPointerDown={(event) => {
          if (!scrollRef.current) return;
          suppressClickRef.current = false;
          dragStateRef.current = {
            startX: event.clientX,
            scrollLeft: scrollRef.current.scrollLeft,
            moved: false
          };
        }}
        onPointerMove={(event) => {
          if (!scrollRef.current || !dragStateRef.current) return;
          const deltaX = event.clientX - dragStateRef.current.startX;
          if (Math.abs(deltaX) > 6) {
            dragStateRef.current.moved = true;
            suppressClickRef.current = true;
          }
          scrollRef.current.scrollLeft = dragStateRef.current.scrollLeft - deltaX;
        }}
        onPointerUp={() => {
          dragStateRef.current = null;
          window.setTimeout(() => {
            suppressClickRef.current = false;
          }, 0);
        }}
        onPointerCancel={() => {
          dragStateRef.current = null;
          suppressClickRef.current = false;
        }}
        onPointerLeave={() => {
          dragStateRef.current = null;
        }}
      >
        {screenshots.map((url, idx) => (
          <button
            key={`${url}-${idx}`}
            type="button"
            onClick={() => {
              if (suppressClickRef.current) return;
              onImageClick(url);
            }}
            className="group relative block shrink-0 w-[340px] md:w-[440px] aspect-video overflow-hidden rounded-[1.5rem] border border-slate-200 bg-slate-100 shadow-sm transition-all hover:shadow-md active:scale-[0.98] snap-start cursor-zoom-in"
          >
            <img
              src={url}
              alt={`Screenshot ${idx + 1}`}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              loading="lazy"
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/10 opacity-0 transition-opacity group-hover:opacity-100">
              <div className="rounded-full bg-white/20 p-3 text-white backdrop-blur-md">
                <Maximize2 size={22} />
              </div>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
};
