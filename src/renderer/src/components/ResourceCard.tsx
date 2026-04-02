import React from 'react';
import { TouchGalResource } from '../types';
import { Star, Download, Eye, Heart } from 'lucide-react';

interface ResourceCardProps {
  resource: TouchGalResource;
  onClick: (uniqueId: string) => void;
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
  const isClickable = resource.uniqueId && resource.uniqueId.length === 8;

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
      className={`group w-full bg-white rounded-[24px] overflow-hidden cursor-pointer transition-all duration-400 ease-[cubic-bezier(0.16,1,0.3,1)] border border-slate-200 flex flex-col h-full relative hover:not-disabled:-translate-y-1.5 hover:not-disabled:shadow-2xl hover:not-disabled:border-primary ${!isClickable ? 'opacity-60 cursor-not-allowed grayscale' : ''}`} 
      onClick={() => isClickable && onClick(resource.uniqueId)}
    >
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
        
        <div className="text-[11px] text-slate-400 font-bold mb-2 uppercase tracking-wider">{formatDateYMD(resource.created)}</div>

        <div className="flex flex-nowrap justify-between gap-1.5 mb-4 w-full">
          <div className="flex items-center justify-center gap-1 text-[11px] font-bold text-slate-500 bg-slate-50 px-2 py-1 rounded-lg transition-all flex-1 min-w-fit whitespace-nowrap group-hover:bg-slate-100 group-hover:text-slate-700" title="浏览数">
             <Eye size={12} />
             <span>{formatStat(resource.viewCount || (resource as any).view || 0)}</span>
          </div>
          <div className="flex items-center justify-center gap-1 text-[11px] font-bold text-slate-500 bg-slate-50 px-2 py-1 rounded-lg transition-all flex-1 min-w-fit whitespace-nowrap group-hover:bg-slate-100 group-hover:text-slate-700" title="下载数">
             <Download size={12} />
             <span>{formatStat(resource.downloadCount || (resource as any).download || 0)}</span>
          </div>
          <div className="flex items-center justify-center gap-1 text-[11px] font-bold text-slate-500 bg-slate-50 px-2 py-1 rounded-lg transition-all flex-1 min-w-fit whitespace-nowrap group-hover:bg-slate-100 group-hover:text-slate-700" title="收藏数">
             <Heart size={12} fill={resource.favoriteCount > 0 ? "currentColor" : "none"} className={resource.favoriteCount > 0 ? "text-pink-500 animate-in zoom-in-125" : ""} />
             <span>{formatStat(resource.favoriteCount)}</span>
          </div>
        </div>

        <div className="mt-auto pt-2">
           <button 
             className="w-full p-2.5 bg-slate-100 text-primary border-none rounded-2xl font-bold text-sm cursor-pointer transition-all duration-200 hover:bg-primary hover:text-white shadow-xs group-hover:shadow-md active:scale-95" 
             onClick={(e) => { e.stopPropagation(); }}
           >
             <span>立即收藏</span>
           </button>
        </div>
      </div>
    </div>
  );
};
