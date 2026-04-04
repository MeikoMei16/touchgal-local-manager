import React from 'react';
import { TouchGalResource } from '../types';
import { Star, Download, Eye, Heart, Loader2, MessageSquare } from 'lucide-react';
import { useUIStore } from '../store/useTouchGalStore';

interface ResourceCardProps {
  resource: TouchGalResource;
  onClick: (resource: TouchGalResource) => void;
}

const formatDateYMD = (raw: string | null | undefined): string => {
  if (!raw) return '未知时间';
  const d = new Date(raw);
  if (isNaN(d.getTime())) return raw;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const ResourceCard: React.FC<ResourceCardProps> = ({ resource, onClick }) => {
  const selectedResource = useUIStore((state) => state.selectedResource);
  const isDetailLoading = useUIStore((state) => state.isDetailLoading);
  const isClickable = resource.uniqueId && resource.uniqueId.length === 8;
  const isDetailLoadingForCard = isDetailLoading && selectedResource?.uniqueId === resource.uniqueId;
  const visibleTags = Array.isArray(resource.tags) ? resource.tags.filter(Boolean).slice(0, 3) : [];

  // Format large numbers with defensive checks
  const formatStat = (num: number | undefined | null) => {
    if (num === undefined || num === null || isNaN(num)) return '0';
    if (num >= 1000000) return (num / 1000000).toFixed(1).replace('.0', '') + 'm';
    if (num >= 1000) {
      // For large numbers (>10k), remove decimals to save critical space
      const val = num / 1000;
      return (val >= 10 ? val.toFixed(0) : val.toFixed(1).replace('.0', '')) + 'k';
    }
    return num.toString();
  };

  return (
    <div 
      className={`group relative flex h-full w-full cursor-pointer flex-col overflow-hidden rounded-[28px] border border-slate-200/90 bg-white shadow-[0_12px_32px_-24px_rgba(15,23,42,0.45)] transition-all duration-300 ease-out hover:not-disabled:-translate-y-1.5 hover:not-disabled:border-primary/40 hover:not-disabled:shadow-[0_24px_48px_-24px_rgba(0,100,147,0.28)] ${!isClickable ? 'cursor-not-allowed grayscale opacity-60' : ''} ${isDetailLoadingForCard ? 'border-primary/60 ring-2 ring-primary/20 shadow-[0_24px_48px_-24px_rgba(0,100,147,0.28)]' : ''}`} 
      onClick={() => isClickable && onClick(resource)}
    >
      {isDetailLoadingForCard && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-white/80 backdrop-blur-[2px]">
          <Loader2 className="animate-spin text-primary" size={28} />
          <span className="text-sm font-black text-primary">正在加载详情...</span>
        </div>
      )}

      <div className="relative aspect-[1.52/1] overflow-hidden bg-slate-100">
        {resource.banner ? (
          <img 
            src={resource.banner} 
            alt={resource.name} 
            loading="lazy" 
            className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
          />
        ) : (
          <div className="h-full w-full animate-pulse bg-slate-200" />
        )}
        <div className="absolute inset-x-0 top-0 flex justify-end bg-linear-to-b from-black/35 via-black/10 to-transparent p-3.5">
          <div className="flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-100/90 px-3.5 py-1.5 text-[14px] font-extrabold text-amber-900 shadow-sm backdrop-blur-sm transition-all duration-200 group-hover:translate-x-2 group-hover:opacity-0">
            <Star size={15} strokeWidth={2.1} />
            <span>{(resource.averageRating || 0).toFixed(1)}</span>
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4 pr-16">
        <div className="flex flex-col gap-1.5">
          <h3 className="m-0 text-[1.05rem] font-bold leading-6 tracking-[-0.02em] text-slate-900 transition-colors group-hover:text-primary" title={resource.name}>
            <span className="line-clamp-3">{resource.name}</span>
          </h3>
        
          <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">{formatDateYMD(resource.created)}</div>
        </div>

        {visibleTags.length > 0 && (
          <div className="flex flex-wrap items-start gap-1.5">
            {visibleTags.map((tag) => (
              <span
                key={tag}
                className="max-w-full truncate rounded-full border border-primary/10 bg-primary-container/75 px-2.5 py-1 text-[11px] font-bold leading-none text-on-primary-container shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]"
                title={tag}
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        <div className="mt-auto grid grid-cols-4 items-center gap-2 pt-1 text-[13px] font-bold text-slate-500 transition-colors group-hover:text-slate-700">
          <div className="flex min-w-0 items-center gap-1.5 whitespace-nowrap" title="浏览数">
             <Eye size={14} />
             <span>{formatStat(resource.viewCount || (resource as any).view || 0)}</span>
          </div>
          <div className="flex min-w-0 items-center gap-1.5 whitespace-nowrap" title="下载数">
             <Download size={14} />
             <span>{formatStat(resource.downloadCount || (resource as any).download || 0)}</span>
          </div>
          <div className="flex min-w-0 items-center gap-1.5 whitespace-nowrap" title="收藏数">
             <Heart size={14} />
             <span>{formatStat(resource.favoriteCount)}</span>
          </div>
          <div className="flex min-w-0 items-center gap-1.5 whitespace-nowrap" title="评论数">
             <MessageSquare size={14} />
             <span>{formatStat(resource.commentCount || (resource as any).comments || 0)}</span>
          </div>
        </div>
      </div>

      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-0.5">
        <div className="flex translate-x-9 flex-col gap-2 transition-transform duration-300 ease-out group-hover:translate-x-0">
          <button
            className="pointer-events-auto flex h-28 w-12 items-center justify-center rounded-l-[22px] border border-slate-200 bg-slate-100 text-sm font-bold tracking-[0.2em] text-slate-700 shadow-[0_10px_24px_-18px_rgba(15,23,42,0.5)] transition-colors duration-200 hover:bg-slate-200"
            onClick={(e) => {
              e.stopPropagation();
            }}
          >
            <span className="[writing-mode:vertical-rl]">收藏</span>
          </button>
          <button
            className="pointer-events-auto flex h-32 w-12 items-center justify-center rounded-l-[22px] bg-primary text-sm font-black tracking-[0.2em] text-on-primary shadow-[0_14px_28px_-18px_rgba(0,100,147,0.7)] transition-colors duration-200 hover:bg-primary/90"
            onClick={(e) => {
              e.stopPropagation();
              if (isClickable) onClick(resource);
            }}
          >
            <span className="[writing-mode:vertical-rl]">下载</span>
          </button>
        </div>
      </div>
    </div>
  );
};
