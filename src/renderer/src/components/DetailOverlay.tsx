import React, { useState } from 'react';
import { useTouchGalStore } from '../store/useTouchGalStore';
import { X, Globe, Bookmark, Star } from 'lucide-react';
import { BlurredSection } from './BlurredSection';

const ImageViewer: React.FC<{ url: string; onDismiss: () => void }> = ({ url, onDismiss }) => (
  <div className="fixed inset-0 bg-black/95 z-[2000] flex items-center justify-center animate-in fade-in duration-200" onClick={onDismiss}>
    <div className="max-w-[95%] max-h-[95%] relative group" onClick={e => e.stopPropagation()}>
      <img src={url} alt="Screenshot Full" className="max-w-full max-h-full object-contain rounded-xl shadow-2xl border border-white/10" />
      <button 
        className="absolute -top-12 right-0 bg-white/10 hover:bg-white/20 text-white border-none rounded-full w-10 h-10 flex items-center justify-center cursor-pointer transition-all backdrop-blur-md" 
        onClick={onDismiss}
      >
        <X size={24} />
      </button>
    </div>
  </div>
);

export const DetailOverlay: React.FC = () => {
  const { selectedResource, clearSelected, user, addTagFilter } = useTouchGalStore();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  if (!selectedResource) return null;

  const { ratingSummary } = selectedResource;
  const isLoggedIn = !!user;

  const handleTagClick = (tag: string) => {
    addTagFilter(tag);
    clearSelected();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[1000] flex justify-center backdrop-blur-md animate-in fade-in duration-300" onClick={clearSelected}>
      <div className="bg-white w-full max-w-4xl h-full flex flex-col overflow-hidden animate-in slide-in-from-bottom-[100px] ease-out-expo duration-500 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="absolute h-16 flex items-center px-5 z-20 top-0 left-0 pointer-events-none">
          <button 
            className="bg-white/80 backdrop-blur-md border border-slate-200 rounded-full w-11 h-11 flex items-center justify-center cursor-pointer pointer-events-auto shadow-md transition-all hover:scale-110 active:scale-95" 
            onClick={clearSelected}
          >
            <X size={24} className="text-slate-800" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto scroll-smooth">
          {/* Top Info Section */}
          <div className="w-full aspect-[21/9] relative bg-slate-100 overflow-hidden group">
             {selectedResource.banner && (
               <img 
                 src={selectedResource.banner} 
                 alt={selectedResource.name} 
                 className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" 
               />
             )}
             <div className="absolute top-4 right-4 animate-in fade-in zoom-in-50 delay-200">
                <div className="bg-black/60 backdrop-blur-md text-white px-4 py-1.5 rounded-full font-black text-lg border border-white/20 shadow-xl flex items-center gap-2">
                  <Star size={18} fill="currentColor" stroke="none" className="text-amber-400" />
                  <span>{selectedResource.averageRating.toFixed(1)}</span>
                </div>
             </div>
          </div> 

          <div className="p-8 flex flex-col gap-8 max-w-3xl mx-auto">
            <h1 className="m-0 text-3xl font-black text-slate-900 leading-tight tracking-tight">{selectedResource.name}</h1>
            
            <button className="w-full bg-primary text-on-primary border-none rounded-2xl p-5 text-lg font-black flex items-center justify-center gap-3 cursor-pointer transition-all hover:bg-primary/95 hover:shadow-xl active:scale-[0.98] shadow-lg shadow-primary/20">
              <Bookmark size={22} fill="currentColor" />
              <span>Collect / 收藏到...</span>
            </button>

            {/* Screenshots */}
            {selectedResource.screenshots && selectedResource.screenshots.length > 0 && (
              <section className="flex flex-col gap-4">
                <h2 className="text-xl font-black text-slate-800 border-l-4 border-primary pl-4">Screenshots / 游戏截图</h2>
                <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide snap-x">
                  {selectedResource.screenshots.map((url, i) => (
                    <div 
                      key={i} 
                      className="flex-none w-[320px] aspect-video rounded-2xl overflow-hidden bg-slate-100 cursor-pointer border border-slate-200 transition-all hover:border-primary hover:shadow-lg snap-center" 
                      onClick={() => setSelectedImage(url)}
                    >
                      <img src={url} alt={`Screenshot ${i}`} className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* PV Player */}
            {selectedResource.pvUrl && (
              <section className="flex flex-col gap-4">
                <h2 className="text-xl font-black text-slate-800 border-l-4 border-primary pl-4">Promotion Video / PV鉴赏</h2>
                <div className="rounded-2xl overflow-hidden bg-black aspect-video relative shadow-2xl border border-slate-800">
                   <video controls src={selectedResource.pvUrl} poster={selectedResource.banner || ''} className="w-full h-full" />
                </div>
              </section>
            )}

            {/* Official Website */}
             <button className="bg-white border-2 border-slate-200 rounded-2xl p-4 font-black text-slate-800 flex items-center justify-center gap-3 cursor-pointer transition-all hover:border-primary hover:text-primary active:scale-95 shadow-xs">
                <Globe size={20} />
                <span>Official Website / 官网链接</span>
             </button>

            {/* Introduction */}
            <section className="flex flex-col gap-4">
              <h2 className="text-xl font-black text-slate-800 border-l-4 border-primary pl-4">游戏介绍</h2>
              <div 
                className="prose prose-slate max-w-none text-slate-600 leading-relaxed font-medium text-lg" 
                dangerouslySetInnerHTML={{ __html: selectedResource.introduction || "No introduction available." }} 
              />
            </section>

            {/* Login Required Info */}
            <BlurredSection isLoggedIn={isLoggedIn} title="详细发布信息">
              <section className="flex flex-col gap-4">
                <h2 className="text-xl font-black text-slate-800 border-l-4 border-primary pl-4">登录后信息</h2>
                <div className="grid grid-cols-1 divide-y divide-slate-100 bg-slate-50 rounded-2xl p-4 border border-slate-100">
                    <div className="flex justify-between items-center py-3 text-base">
                      <span className="text-slate-500 font-bold">发布者</span>
                      <span className="text-slate-900 font-black">Palentum</span>
                    </div>
                    <div className="flex justify-between items-center py-3 text-base">
                      <span className="text-slate-500 font-bold">云端收藏</span>
                      <span className="text-slate-900 font-black">未收藏</span>
                    </div>
                    <div className="flex justify-between items-center py-3 text-base">
                      <span className="text-slate-500 font-bold">内容限制</span>
                      <span className="text-slate-900 font-black uppercase">{selectedResource.contentLimit || 'sfw'}</span>
                    </div>
                </div>
              </section>
            </BlurredSection>

            {/* Rating Stats - The big blue boxes */}
            <BlurredSection isLoggedIn={isLoggedIn} title="评分详情">
              {ratingSummary && (
                <section className="flex flex-col gap-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-blue-50/50 border border-blue-100 p-8 rounded-3xl flex flex-col items-center shadow-xs transition-transform hover:scale-[1.02]">
                      <div className="text-4xl font-black text-blue-700 leading-none mb-1">{ratingSummary.average.toFixed(1)}</div>
                      <div className="text-xs font-bold text-blue-700/60 uppercase tracking-widest">综合评分</div>
                    </div>
                    <div className="bg-slate-50 border border-slate-200 p-8 rounded-3xl flex flex-col items-center shadow-xs transition-transform hover:scale-[1.02]">
                      <div className="text-4xl font-black text-slate-700 leading-none mb-1">{ratingSummary.count}</div>
                      <div className="text-xs font-bold text-slate-700/60 uppercase tracking-widest">评价人数</div>
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <div className="px-4 py-2 border border-slate-200 rounded-full font-bold text-slate-600 text-sm bg-white shadow-xs">收藏 {selectedResource.favoriteCount || 0}</div>
                    <div className="px-4 py-2 border border-slate-200 rounded-full font-bold text-slate-600 text-sm bg-white shadow-xs">满分 10 分</div>
                  </div>

                  {/* Recommend Bar */}
                  <div className="flex flex-col gap-4">
                    <h3 className="text-lg font-black text-slate-800">推荐倾向</h3>
                    <div className="h-4 w-full rounded-full overflow-hidden flex bg-slate-100 shadow-inner border border-slate-200">
                      {Object.entries(ratingSummary.recommend).map(([key, val]) => {
                        const colors = { strong_yes: '#10b981', yes: '#34d399', neutral: '#94a3b8', no: '#facc15', strong_no: '#ef4444' };
                        const color = (colors as any)[key] || '#cbd5e1';
                        const percentage = (val / (ratingSummary.count || 1)) * 100;
                        return val > 0 ? (
                          <div key={key} className="h-full transition-all duration-500" style={{ width: `${percentage}%`, backgroundColor: color }} />
                        ) : null;
                      })}
                    </div>
                    <div className="flex flex-wrap gap-2">
                       {Object.entries(ratingSummary.recommend).map(([key, val]) => {
                          const colors = { strong_yes: '#10b981', yes: '#22c55e', neutral: '#64748b', no: '#f59e0b', strong_no: '#ef4444' };
                          const dotColor = (colors as any)[key] || '#94a3b8';
                          const labels = { strong_yes: '强推', yes: '推荐', neutral: '一般', no: '不推', strong_no: '强力不推' };
                          if (val === 0) return null;
                          return (
                            <div key={key} className="flex items-center gap-2 px-3 py-1.5 border border-slate-200 rounded-full font-bold text-slate-600 text-xs bg-white shadow-xs">
                              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: dotColor }} />
                              <span>{(labels as any)[key]} {val}</span>
                            </div>
                          );
                       })}
                    </div>
                  </div>

                  {/* Histogram */}
                  <div className="flex flex-col gap-4">
                    <h3 className="text-lg font-black text-slate-800">分数分布</h3>
                    <div className="flex items-end justify-between h-[160px] px-2 bg-slate-50 rounded-3xl pt-8 pb-4 border border-slate-100">
                      {ratingSummary.histogram.map((h) => {
                        const max = Math.max(...ratingSummary.histogram.map(i => i.count), 1);
                        const height = (h.count / max) * 100;
                        return (
                          <div key={h.score} className="flex-1 flex flex-col items-center gap-2 h-full group">
                            <span className="text-[10px] font-black text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">{h.count || 0}</span>
                            <div className="w-[40%] bg-slate-200 rounded-full flex items-end grow overflow-hidden">
                               <div 
                                 className="w-full bg-blue-400 rounded-full min-h-[4px] transition-all duration-700 delay-300 shadow-[0_0_12px_-2px_rgba(96,165,250,0.5)]" 
                                 style={{ height: `${height}%` }} 
                               />
                            </div>
                            <span className="text-xs font-black text-slate-800">{h.score}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </section>
              )}
            </BlurredSection>

            {/* Extra Metadata */}
            <section className="flex flex-col gap-6 pt-8 border-t border-slate-100">
               <div className="grid grid-cols-1 gap-3">
                 <div className="flex justify-between items-start">
                    <span className="text-sm font-bold text-slate-500">Company / 所属会社</span>
                    <span className="text-base font-black text-slate-900 text-right">{selectedResource.company || 'Unknown'}</span>
                 </div>
                 <div className="flex justify-between items-start">
                    <span className="text-sm font-bold text-slate-500">Released / 发售时间</span>
                    <span className="text-base font-black text-slate-900 text-right">{selectedResource.releasedDate || 'N/A'}</span>
                 </div>
                 <div className="flex justify-between items-start">
                    <span className="text-sm font-bold text-slate-500">VNDB ID</span>
                    <span className="text-base font-black text-primary text-right cursor-pointer hover:underline">{selectedResource.vndbId || 'N/A'}</span>
                 </div>
                 <div className="flex justify-between items-start">
                    <span className="text-sm font-bold text-slate-500">Bangumi</span>
                    <span className="text-base font-black text-primary text-right cursor-pointer hover:underline">{selectedResource.bangumiId || 'N/A'}</span>
                 </div>
                 <div className="flex justify-between items-start">
                    <span className="text-sm font-bold text-slate-500">DLsite / Steam Code</span>
                    <span className="text-base font-black text-slate-900 text-right">{selectedResource.steamId ? `STEAM:${selectedResource.steamId}` : 'N/A'}</span>
                 </div>
               </div>
               
               <div className="flex flex-col gap-3">
                  <h3 className="text-lg font-black text-primary border-l-4 border-primary pl-4">Aliases / 别名</h3>
                  <div className="flex flex-col gap-1.5 pl-5">
                     {selectedResource.alias?.map((a, i) => <div key={i} className="text-sm font-bold text-slate-600 italic">"{a}"</div>)}
                  </div>
               </div>

               <div className="flex flex-col gap-4">
                  <h3 className="text-lg font-black text-primary border-l-4 border-primary pl-4">Tags / 游戏标签 (点击过滤)</h3>
                  <div className="flex flex-wrap gap-2 pl-4">
                     {selectedResource.tags?.map(t => (
                       <div 
                         key={t} 
                         className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-[14px] font-bold text-slate-600 text-sm cursor-pointer transition-all hover:bg-primary-container hover:text-on-primary-container hover:border-primary/30 hover:scale-105"
                         onClick={() => handleTagClick(t)}
                       >
                         {t}
                       </div>
                     ))}
                  </div>
               </div>
            </section>
          </div>
        </div>
      </div>

      {selectedImage && <ImageViewer url={selectedImage} onDismiss={() => setSelectedImage(null)} />}
    </div>
  );
};
