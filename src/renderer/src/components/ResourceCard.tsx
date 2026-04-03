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
      className={`group w-full bg-white rounded-[24px] overflow-hidden cursor-pointer transition-all duration-400 ease-[cubic-bezier(0.16,1,0.3,1)] border border-slate-200 flex flex-col h-full relative hover:not-disabled:-translate-y-1.5 hover:not-disabled:shadow-2xl hover:not-disabled:border-primary ${!isClickable ? 'opacity-60 cursor-not-allowed grayscale' : ''} ${isDetailLoadingForCard ? 'ring-2 ring-primary/30 border-primary shadow-xl shadow-primary/10' : ''}`} 
      onClick={() => isClickable && onClick(resource)}
    >
      {isDetailLoadingForCard && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-white/78 backdrop-blur-[2px]">
          <Loader2 className="animate-spin text-primary" size={28} />
          <span className="text-sm font-black text-primary">正在加载详情...</span>
        </div>
      )}

      <div className="relative aspect-[1.618/1] overflow-hidden bg-slate-100">
        {resource.banner ? (
          <img 
            src={resource.banner} 
            alt={resource.name} 
            loading="lazy" 
            className="w-full h-full object-cover transition-transform duration-600 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full bg-slate-200 animate-pulse" />
        )}
        <div className="absolute top-0 inset-x-0 p-3 bg-linear-to-b from-black/30 to-transparent flex justify-end">
          <div className="bg-white/90 text-amber-700 px-2.5 py-0.5 rounded-xl flex items-center gap-1 font-extrabold text-[13px] backdrop-blur-md shadow-sm">
            <Star size={12} fill="currentColor" stroke="none" />
            <span>{(resource.averageRating || 0).toFixed(1)}</span>
          </div>
        </div>
      </div>

      <div className="p-4 flex-1 flex flex-col gap-1.5">
        <h3 className="m-0 text-base font-bold leading-relaxed text-slate-900 h-11 line-clamp-2 tracking-tight group-hover:text-primary transition-colors" title={resource.name}>{resource.name}</h3>
        
        <div className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">{formatDateYMD(resource.created)}</div>

        {visibleTags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {visibleTags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-primary-container/70 px-3 py-1 text-[11px] font-black text-on-primary-container"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="flex items-center justify-center gap-1 text-[11px] font-bold text-slate-500 bg-slate-50 px-2 py-1.5 rounded-xl transition-all min-w-fit whitespace-nowrap group-hover:bg-slate-100 group-hover:text-slate-700" title="浏览数">
             <Eye size={12} />
             <span>{formatStat(resource.viewCount || (resource as any).view || 0)}</span>
          </div>
          <div className="flex items-center justify-center gap-1 text-[11px] font-bold text-slate-500 bg-slate-50 px-2 py-1.5 rounded-xl transition-all min-w-fit whitespace-nowrap group-hover:bg-slate-100 group-hover:text-slate-700" title="下载数">
             <Download size={12} />
             <span>{formatStat(resource.downloadCount || (resource as any).download || 0)}</span>
          </div>
          <div className="flex items-center justify-center gap-1 text-[11px] font-bold text-slate-500 bg-slate-50 px-2 py-1.5 rounded-xl transition-all min-w-fit whitespace-nowrap group-hover:bg-slate-100 group-hover:text-slate-700" title="收藏数">
             <Heart size={12} fill={resource.favoriteCount > 0 ? "currentColor" : "none"} className={resource.favoriteCount > 0 ? "text-pink-500 animate-in zoom-in-125" : ""} />
             <span>{formatStat(resource.favoriteCount)}</span>
          </div>
          <div className="flex items-center justify-center gap-1 text-[11px] font-bold text-slate-500 bg-slate-50 px-2 py-1.5 rounded-xl transition-all min-w-fit whitespace-nowrap group-hover:bg-slate-100 group-hover:text-slate-700" title="评论数">
             <MessageSquare size={12} />
             <span>{formatStat(resource.commentCount || (resource as any).comments || 0)}</span>
          </div>
        </div>

        <div className="mt-auto grid grid-cols-[0.92fr,1.08fr] gap-2 pt-4">
           <button 
             className="w-full px-3 py-2.5 bg-slate-100 text-slate-700 border-none rounded-2xl font-bold text-sm cursor-pointer transition-all duration-200 hover:bg-slate-200 shadow-xs active:scale-95" 
             onClick={(e) => { e.stopPropagation(); }}
           >
             <span>收藏</span>
           </button>
           <button
             className="w-full px-3 py-2.5 bg-primary text-on-primary border-none rounded-2xl font-black text-sm cursor-pointer transition-all duration-200 hover:bg-primary/90 shadow-lg shadow-primary/20 active:scale-95"
             onClick={(e) => {
               e.stopPropagation();
               if (isClickable) onClick(resource);
             }}
           >
             <span>下载</span>
           </button>
        </div>
      </div>
    </div>
  );
};
