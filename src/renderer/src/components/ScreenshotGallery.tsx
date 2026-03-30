import React, { useState, useRef } from 'react';
import { ChevronLeft, ChevronRight, Maximize2 } from 'lucide-react';

interface ScreenshotGalleryProps {
  screenshots: string[];
  onImageClick: (url: string) => void;
  variant?: 'gallery' | 'grid' | 'stack';
}

export const ScreenshotGallery: React.FC<ScreenshotGalleryProps> = ({ screenshots, onImageClick, variant = 'grid' }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);

  if (!screenshots || screenshots.length === 0) return null;

  const handleScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setShowLeftArrow(scrollLeft > 10);
      setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = scrollRef.current.clientWidth * 0.8;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  if (variant === 'grid') {
    return (
      <section className="flex flex-col gap-4">
        <h2 className="text-2xl font-black text-slate-900 tracking-tight">游戏截图</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {screenshots.map((url, idx) => (
            <div 
              key={idx}
              onClick={() => onImageClick(url)}
              className="aspect-video rounded-xl overflow-hidden bg-white border border-slate-200 cursor-zoom-in group relative shadow-sm hover:shadow-lg transition-all active:scale-[0.98]"
            >
              <img 
                src={url} 
                alt={`Screenshot ${idx + 1}`}
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                 <div className="bg-white/30 backdrop-blur-md rounded-full p-3 text-white scale-90 group-hover:scale-100 transition-transform duration-300">
                    <Maximize2 size={24} />
                 </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (variant === 'stack') {
    return (
      <section className="flex flex-col gap-6">
        <h2 className="text-2xl font-black text-slate-900 tracking-tight">游戏截图 ({screenshots.length})</h2>
        <div className="flex flex-col gap-4">
          {screenshots.map((url, idx) => (
            <div 
              key={idx}
              onClick={() => onImageClick(url)}
              className="w-full aspect-video rounded-3xl overflow-hidden bg-slate-100 border border-slate-200 cursor-zoom-in group relative shadow-md hover:shadow-xl transition-all active:scale-[0.99]"
            >
              <img 
                src={url} 
                alt={`Screenshot ${idx + 1}`}
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                 <div className="bg-white/20 backdrop-blur-md rounded-full p-4 text-white scale-90 group-hover:scale-100 transition-transform duration-300">
                    <Maximize2 size={32} />
                 </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-4 relative group">
      <h2 className="text-xl font-black text-slate-800 border-l-4 border-primary pl-4 flex items-center justify-between">
        <span>游戏截图 ({screenshots.length})</span>
        <div className="flex gap-2">
            <button 
              onClick={() => scroll('left')}
              disabled={!showLeftArrow}
              className="p-1.5 rounded-full bg-white border border-slate-200 shadow-sm hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              <ChevronLeft size={18} />
            </button>
            <button 
              onClick={() => scroll('right')}
              disabled={!showRightArrow}
              className="p-1.5 rounded-full bg-white border border-slate-200 shadow-sm hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              <ChevronRight size={18} />
            </button>
        </div>
      </h2>

      <div 
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex gap-4 overflow-x-auto scrollbar-none pb-4 scroll-smooth snap-x"
      >
        {screenshots.map((url, idx) => (
          <div 
            key={idx}
            onClick={() => onImageClick(url)}
            className="flex-shrink-0 w-[300px] md:w-[450px] aspect-video rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 cursor-zoom-in group/item relative snap-start shadow-sm hover:shadow-md transition-all active:scale-[0.98]"
          >
            <img 
              src={url} 
              alt={`Screenshot ${idx + 1}`}
              className="w-full h-full object-cover transition-transform duration-500 group-hover/item:scale-105"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover/item:opacity-100 transition-opacity flex items-center justify-center">
               <div className="bg-white/20 backdrop-blur-md rounded-full p-3 text-white">
                  <Maximize2 size={24} />
               </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
