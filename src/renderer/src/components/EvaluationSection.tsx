import React from 'react';
import { Star } from 'lucide-react';

interface Rating {
  id: number;
  overall: number;
  recommend: string;
  shortSummary: string;
  playStatus: string;
  userName: string;
  userAvatar: string | null;
}

interface EvaluationSectionProps {
  ratings: Rating[];
  isLoading: boolean;
}

export const EvaluationSection: React.FC<EvaluationSectionProps> = ({ ratings, isLoading }) => {
  const getRecommendStyle = (recommend: string) => {
    switch (recommend) {
      case 'strong_yes': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'yes': return 'bg-green-100 text-green-700 border-green-200';
      case 'no': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'strong_no': return 'bg-rose-100 text-rose-700 border-rose-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getRecommendLabel = (recommend: string) => {
    switch (recommend) {
      case 'strong_yes': return '强烈推荐';
      case 'yes': return '推荐';
      case 'no': return '不推荐';
      case 'strong_no': return '强烈不推荐';
      default: return '一般';
    }
  };

  const getPlayStatusStyle = () => {
    return 'bg-purple-100 text-purple-700 border-purple-200';
  };

  return (
    <section className="flex flex-col gap-6">
      <h2 className="text-xl font-black text-slate-800 border-l-4 border-primary pl-4 flex items-center gap-2">
        <Star size={22} className="text-primary" />
        <span>评价详细 ({ratings.length})</span>
      </h2>
      
      {isLoading && ratings.length === 0 ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : ratings.length === 0 ? (
        <div className="bg-slate-50 rounded-2xl p-8 text-center text-slate-400 font-bold border border-slate-100">
          暂无详细评价
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {ratings.map((rating) => (
            <div key={rating.id} className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-full bg-slate-100 overflow-hidden border border-slate-200 flex-shrink-0">
                    {rating.userAvatar ? (
                       <img src={rating.userAvatar} alt={rating.userName} className="w-full h-full object-cover" />
                    ) : (
                       <div className="w-full h-full flex items-center justify-center bg-primary/5 text-primary text-xs font-black">
                         {(rating.userName || 'Anonymous').substring(0, 1)}
                       </div>
                    )}
                  </div>
                  <div>
                    <div className="text-sm font-black text-slate-900">{rating.userName || 'Anonymous'}</div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">User / 访客</div>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-emerald-500 font-black text-xl">
                   <Star size={18} fill="currentColor" />
                   <span>{rating.overall}</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <span className={`px-3 py-1 rounded-full text-[10px] font-black border ${getRecommendStyle(rating.recommend)}`}>
                  {getRecommendLabel(rating.recommend)}
                </span>
                <span className={`px-3 py-1 rounded-full text-[10px] font-black border ${getPlayStatusStyle()}`}>
                  {rating.playStatus === 'completed' ? '全线通关' : rating.playStatus === 'playing' ? '正在通关' : '已入库'}
                </span>
              </div>

              <div className="text-slate-700 text-sm font-bold leading-relaxed line-clamp-3 italic">
                "{rating.shortSummary || '这个用户很懒，什么也没写'}"
              </div>

              <div className="mt-auto pt-3 border-t border-slate-50 flex items-center justify-between opacity-60">
                 <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1 text-[10px] font-black text-slate-400">
                      <div className="w-6 h-6 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-50 cursor-pointer">👍</div>
                      <span>0</span>
                    </div>
                 </div>
                 <div className="w-6 h-6 rounded-lg border border-slate-200 flex items-center justify-center text-amber-500 hover:bg-amber-50 cursor-pointer">⚠️</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};
