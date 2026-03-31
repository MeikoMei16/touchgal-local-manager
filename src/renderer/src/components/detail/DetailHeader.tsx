import React from 'react';
import { Download, Globe, Heart, MessageSquare, Share2, Star } from 'lucide-react';
import { TouchGalDetail } from '../../types';
import { RatingHistogram } from '../RatingHistogram';

interface DetailHeaderProps {
  resource: TouchGalDetail;
  onImageClick?: (url: string) => void;
}

export const DetailHeader: React.FC<DetailHeaderProps> = ({ resource, onImageClick }) => {
  const { ratingSummary } = resource;

  return (
    <div className="bg-white rounded-[2rem] overflow-hidden shadow-sm border border-slate-100 grid grid-cols-1 md:grid-cols-3">
      <div
        className={`md:col-span-1 aspect-video md:aspect-auto relative bg-slate-100 overflow-hidden ${resource.banner ? 'cursor-zoom-in' : ''}`}
        onClick={() => {
          if (resource.banner) onImageClick?.(resource.banner)
        }}
      >
        {resource.banner && (
          <img
            src={resource.banner}
            alt={resource.name}
            className="w-full h-full object-cover transition-transform duration-700 hover:scale-105"
          />
        )}
        <div className="absolute top-4 left-4">
          <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg ${resource.contentLimit === 'nsfw' ? 'bg-rose-500 text-white' : 'bg-emerald-500 text-white'}`}>
            {resource.contentLimit || 'sfw'}
          </div>
        </div>
      </div>

      <div className="md:col-span-2 p-6 md:p-8 flex flex-col gap-4">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px] xl:items-start">
          <div className="flex min-w-0 flex-col gap-5">
            <div className="flex flex-col gap-2">
              <h1 className="m-0 text-2xl md:text-3xl font-black text-slate-900 leading-tight tracking-tight">{resource.name}</h1>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1.5 bg-amber-50 text-amber-600 px-3 py-1 rounded-full text-sm font-black border border-amber-100">
                  <Star size={16} fill="currentColor" />
                  <span>{resource.averageRating?.toFixed(1) ?? '–'}</span>
                </div>
                {ratingSummary && (
                  <span className="text-slate-400 text-xs font-bold">
                    {ratingSummary.count.toLocaleString()} 人评价
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              {resource.tags?.slice(0, 8).map((tag: string) => (
                <div key={tag} className="px-4 py-2 bg-blue-50 text-blue-600 border border-blue-100 rounded-full font-bold text-sm">
                  {tag}
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-black text-sm flex items-center gap-2 shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all active:scale-95">
                <Download size={18} />
                <span>下载</span>
              </button>
              <button className="bg-blue-50 text-blue-600 px-6 py-2.5 rounded-xl font-black text-sm flex items-center gap-2 border border-blue-100 hover:bg-blue-100 transition-all active:scale-95">
                <Star size={18} />
                <span>评分</span>
              </button>
              <div className="flex gap-2 ml-auto sm:ml-0">
                {[Heart, Share2, MessageSquare].map((Icon, i) => (
                  <button key={i} className="w-10 h-10 rounded-xl border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-all text-slate-600 active:scale-95">
                    <Icon size={20} />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {ratingSummary && (
            <div className="xl:justify-self-end xl:w-[280px] xl:pt-0.5">
              <RatingHistogram ratingSummary={ratingSummary} compact />
            </div>
          )}
        </div>

        <div className="pt-3 border-t border-slate-100 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-slate-200 border-2 border-white shadow-sm overflow-hidden">
              <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${resource.company || 'P'}`} alt="User" />
            </div>
            <div className="flex flex-col">
              <span className="text-base font-black text-slate-800">{resource.company || 'Palentum'}</span>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-tight">{resource.releasedDate || '未知发售'}</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-slate-400">
            <div className="flex items-center gap-1.5 text-[12px] font-black">
              <Globe size={16} />
              <span>{resource.viewCount?.toLocaleString() ?? '–'}</span>
            </div>
            <div className="flex items-center gap-1.5 text-[12px] font-black">
              <Download size={16} />
              <span>{resource.downloadCount?.toLocaleString() ?? '–'}</span>
            </div>
            <div className="flex items-center gap-1.5 text-[12px] font-black">
              <Heart size={16} fill="currentColor" />
              <span>{resource.favoriteCount?.toLocaleString() ?? '–'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
