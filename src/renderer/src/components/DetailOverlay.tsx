import React, { useState } from 'react';
import { useTouchGalStore } from '../store/useTouchGalStore';
import { X, Globe, Star, Loader2, Download, MessageSquare, Share2, Heart, Info as InfoIcon, FileText } from 'lucide-react';
import { EvaluationSection } from './EvaluationSection';
import { CommentSection } from './CommentSection';
import { ScreenshotGallery } from './ScreenshotGallery';
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

type TabType = 'info' | 'links' | 'board' | 'evaluation';

export const DetailOverlay: React.FC = () => {
  const { 
    selectedResource, clearSelected, user, addTagFilter, 
    isDetailLoading, patchComments, patchRatings, sessionError, setIsLoginOpen
  } = useTouchGalStore();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('info');
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (selectedResource && scrollRef.current) {
      scrollRef.current.focus();
    }
  }, [selectedResource]);

  if (!selectedResource) return null;

  const { ratingSummary } = selectedResource;
  const isLoggedIn = !!user;

  const handleTagClick = (tag: string) => {
    addTagFilter(tag);
    clearSelected();
  };

  const tabs = [
    { id: 'info', label: '游戏信息', icon: InfoIcon },
    { id: 'links', label: '资源链接', icon: Globe },
    { id: 'board', label: '讨论版', icon: MessageSquare },
    { id: 'evaluation', label: '游戏评价', icon: Star },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 z-[1000] flex justify-center backdrop-blur-md animate-in fade-in duration-300" onClick={clearSelected}>
      <div 
        className="bg-slate-50 w-full max-w-7xl h-full flex flex-col overflow-hidden animate-in slide-in-from-bottom-[100px] ease-out-expo duration-500 shadow-2xl relative" 
        onClick={(e) => e.stopPropagation()}
      >
        {isDetailLoading && (
          <div className="absolute inset-0 bg-white/60 backdrop-blur-xs z-[100] flex flex-col items-center justify-center gap-4 animate-in fade-in duration-300">
            <Loader2 className="animate-spin text-primary" size={48} />
            <span className="text-primary font-black animate-pulse">正在获取详细信息...</span>
          </div>
        )}

        {sessionError === 'SESSION_EXPIRED' && (
          <div className="absolute top-0 left-0 right-0 bg-rose-500 text-white py-2 px-4 z-[200] flex items-center justify-center gap-4 animate-in slide-in-from-top duration-300 shadow-lg">
             <span className="font-bold text-sm">您的登录已失效，部分高级信息（评论、评分）可能无法加载。</span>
             <button 
               onClick={() => setIsLoginOpen(true)}
               className="bg-white text-rose-500 px-4 py-1 rounded-full text-xs font-black hover:bg-rose-50 transition-all uppercase"
             >
               立即登录
             </button>
          </div>
        )}
        
        {/* Close Button */}
        <div className="absolute top-4 right-4 z-50">
          <button 
            className="bg-white/80 backdrop-blur-md border border-slate-200 rounded-full w-10 h-10 flex items-center justify-center cursor-pointer shadow-md transition-all hover:scale-110 active:scale-95" 
            onClick={clearSelected}
          >
            <X size={20} className="text-slate-800" />
          </button>
        </div>
        
        <div 
          ref={scrollRef}
          tabIndex={0}
          className="flex-1 overflow-y-auto scroll-smooth outline-none focus:ring-0 p-4 md:p-8"
        >
          <div className="max-w-6xl mx-auto flex flex-col gap-6">
            
            {/* Header Card */}
            <div className="bg-white rounded-[2rem] overflow-hidden shadow-sm border border-slate-100 grid grid-cols-1 md:grid-cols-3">
              {/* Banner Area */}
              <div className="md:col-span-1 aspect-video md:aspect-auto relative bg-slate-100 overflow-hidden">
                {selectedResource.banner && (
                  <img 
                    src={selectedResource.banner} 
                    alt={selectedResource.name} 
                    className="w-full h-full object-cover transition-transform duration-700 hover:scale-105" 
                  />
                )}
                <div className="absolute top-4 left-4">
                  <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg ${selectedResource.contentLimit === 'nsfw' ? 'bg-rose-500 text-white' : 'bg-emerald-500 text-white'}`}>
                    {selectedResource.contentLimit || 'sfw'}
                  </div>
                </div>
              </div>

              {/* Info Area */}
              <div className="md:col-span-2 p-6 md:p-10 flex flex-col gap-6">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-4">
                    <h1 className="m-0 text-2xl md:text-3xl font-black text-slate-900 leading-tight tracking-tight">{selectedResource.name}</h1>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 bg-amber-50 text-amber-600 px-3 py-1 rounded-full text-sm font-black border border-amber-100">
                      <Star size={16} fill="currentColor" />
                      <span>{selectedResource.averageRating.toFixed(1)}</span>
                    </div>
                    <span className="text-slate-400 text-xs font-bold">查看评分分布</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                   {selectedResource.tags?.slice(0, 8).map((t: string) => (
                     <div key={t} className="px-3 py-1.5 bg-blue-50 text-blue-600 border border-blue-100 rounded-full font-bold text-xs">
                        {t}
                     </div>
                   ))}
                </div>

                <div className="flex flex-wrap gap-3 mt-2">
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

                <div className="mt-auto pt-6 border-t border-slate-50 flex items-center justify-between">
                   <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-slate-200 border-2 border-white shadow-sm overflow-hidden">
                         <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedResource.company || 'P'}`} alt="User" />
                      </div>
                      <div className="flex flex-col">
                         <span className="text-sm font-black text-slate-800">{selectedResource.company || 'Palentum'}</span>
                         <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">3 年前</span>
                      </div>
                   </div>
                   <div className="flex items-center gap-4 text-slate-400">
                      <div className="flex items-center gap-1 text-[11px] font-black">
                         <Globe size={14} />
                         <span>6.2w</span>
                      </div>
                      <div className="flex items-center gap-1 text-[11px] font-black">
                         <Download size={14} />
                         <span>1.0w</span>
                      </div>
                      <div className="flex items-center gap-1 text-[11px] font-black">
                         <Heart size={14} fill="currentColor" />
                         <span>687</span>
                      </div>
                   </div>
                </div>
              </div>
            </div>

            {/* Tab Navigation */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-1 flex">
               {tabs.map(tab => (
                 <button 
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as TabType)}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-black text-sm transition-all ${activeTab === tab.id ? 'bg-slate-50 text-blue-600 shadow-xs' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50/50'}`}
                 >
                    <tab.icon size={18} className={activeTab === tab.id ? 'animate-in zoom-in-50' : ''} />
                    <span>{tab.label}</span>
                 </button>
               ))}
            </div>

            {/* Tab Content */}
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
               {activeTab === 'info' && (
                 <div className="flex flex-col gap-6">
                    <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-100 flex flex-col gap-8">
                       <section className="flex flex-col gap-4">
                          <h2 className="text-2xl font-black text-slate-900 tracking-tight">游戏介绍</h2>
                          <div 
                            className="prose prose-slate max-w-none text-slate-600 leading-relaxed font-medium text-lg" 
                            dangerouslySetInnerHTML={{ __html: selectedResource.introduction || "No introduction available." }} 
                          />
                       </section>

                       <ScreenshotGallery 
                         screenshots={(selectedResource as any).detail?.screenshots || []} 
                         onImageClick={(url) => setSelectedImage(url)} 
                       />

                       {(selectedResource as any).pvUrl && (
                         <section className="flex flex-col gap-4">
                            <h2 className="text-2xl font-black text-slate-900 tracking-tight">PV鉴赏</h2>
                            <div className="rounded-3xl overflow-hidden bg-black aspect-video relative shadow-2xl border border-slate-800">
                               <video controls src={(selectedResource as any).pvUrl} poster={selectedResource.banner || ''} className="w-full h-full" />
                            </div>
                         </section>
                       )}

                       <section className="flex flex-col gap-6 pt-8 border-t border-slate-100">
                          <h2 className="text-2xl font-black text-slate-900 tracking-tight">游戏标签</h2>
                          <div className="flex flex-wrap gap-2">
                             {selectedResource.tags?.map((t: string) => (
                               <div 
                                 key={t} 
                                 className="px-4 py-2 bg-purple-50 border border-purple-100 rounded-full font-bold text-purple-600 text-sm cursor-pointer transition-all hover:bg-purple-100 active:scale-95"
                                 onClick={() => handleTagClick(t)}
                               >
                                 {t}
                               </div>
                             ))}
                          </div>
                       </section>

                       <section className="flex flex-col gap-4 pt-8 border-t border-slate-100">
                          <h2 className="text-2xl font-black text-slate-900 tracking-tight">所属会社</h2>
                          <div className="flex flex-wrap gap-2">
                             <div className="px-4 py-2 bg-purple-50 border border-purple-100 rounded-full font-bold text-purple-600 text-sm">
                                {selectedResource.company || 'Unknown'}
                             </div>
                          </div>
                       </section>

                       <section className="flex flex-col gap-6 pt-8 border-t border-slate-100">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4">
                             <div className="flex justify-between items-center py-2">
                                <div className="flex items-center gap-2 text-slate-400 font-bold text-sm italic">
                                   <FileText size={16} />
                                   <span>发布时间</span>
                                </div>
                                <span className="font-black text-slate-700">2023-01-13</span>
                             </div>
                             <div className="flex justify-between items-center py-2">
                                <div className="flex items-center gap-2 text-slate-400 font-bold text-sm italic">
                                   <Loader2 size={16} />
                                   <span>资源更新时间</span>
                                </div>
                                <span className="font-black text-slate-700">2026-03-29</span>
                             </div>
                             <div className="flex justify-between items-center py-2">
                                <div className="flex items-center gap-2 text-slate-400 font-bold text-sm italic">
                                   <Globe size={16} />
                                   <span>发售时间</span>
                                </div>
                                <span className="font-black text-slate-700">{selectedResource.releasedDate || 'N/A'}</span>
                             </div>
                             <div className="flex justify-between items-center py-2">
                                <div className="flex items-center gap-2 text-slate-400 font-bold text-sm italic">
                                   <Globe size={16} />
                                   <span>VNDB ID</span>
                                </div>
                                <span className="font-black text-blue-500 cursor-pointer hover:underline">{selectedResource.vndbId || 'N/A'}</span>
                             </div>
                          </div>
                       </section>

                       <section className="flex flex-col gap-4 pt-8 border-t border-slate-100">
                          <h2 className="text-2xl font-black text-slate-900 tracking-tight">游戏别名</h2>
                          <ul className="list-disc list-inside text-slate-500 font-medium space-y-1">
                             {selectedResource.alias?.map((a: string, i: number) => <li key={i}>{a}</li>)}
                          </ul>
                       </section>
                    </div>
                 </div>
               )}

               {activeTab === 'links' && (
                 <div className="bg-white rounded-[2rem] p-12 shadow-sm border border-slate-100 flex flex-col items-center justify-center text-center gap-4">
                    <Globe size={64} className="text-slate-200" />
                    <h2 className="text-xl font-black text-slate-800">资源链接</h2>
                    <p className="text-slate-500 font-medium">官方购买建议于官网进行，资源链接请查看讨论版。</p>
                    <button className="bg-slate-50 border border-slate-200 rounded-xl px-6 py-3 font-black text-slate-600 hover:bg-slate-100 transition-all">
                       访问官网
                    </button>
                 </div>
               )}

               {activeTab === 'board' && (
                 <div className="flex flex-col gap-6">
                    {sessionError === 'SESSION_EXPIRED' ? (
                      <div className="bg-slate-50 rounded-[2rem] p-12 text-center flex flex-col items-center gap-4 border border-slate-100 animate-in fade-in zoom-in-95 duration-500">
                        <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center text-rose-500">
                          <MessageSquare size={32} />
                        </div>
                        <div className="flex flex-col gap-1">
                          <h3 className="text-lg font-black text-slate-800">讨论内容暂不可见</h3>
                          <p className="text-sm font-bold text-slate-400">登录后即可查看和参与社区讨论</p>
                        </div>
                        <button 
                          onClick={() => setIsLoginOpen(true)}
                          className="mt-2 bg-rose-500 text-white px-8 py-3 rounded-2xl font-black text-sm shadow-lg shadow-rose-200 hover:bg-rose-600 transition-all active:scale-95"
                        >
                          立即登录
                        </button>
                      </div>
                    ) : (
                      <CommentSection comments={patchComments} isLoading={isDetailLoading} />
                    )}
                 </div>
               )}

               {activeTab === 'evaluation' && (
                 <div className="flex flex-col gap-6">
                    {sessionError === 'SESSION_EXPIRED' ? (
                      <div className="bg-slate-50 rounded-[2rem] p-12 text-center flex flex-col items-center gap-4 border border-slate-100 animate-in fade-in zoom-in-95 duration-500">
                        <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center text-amber-500">
                          <Star size={32} />
                        </div>
                        <div className="flex flex-col gap-1">
                          <h3 className="text-lg font-black text-slate-800">评分详情已隐藏</h3>
                          <p className="text-sm font-bold text-slate-400">登录后解锁详细的评分分布和用户评价</p>
                        </div>
                        <button 
                          onClick={() => setIsLoginOpen(true)}
                          className="mt-2 bg-amber-500 text-white px-8 py-3 rounded-2xl font-black text-sm shadow-lg shadow-amber-200 hover:bg-amber-600 transition-all active:scale-95"
                        >
                          立即登录
                        </button>
                      </div>
                    ) : (
                      <>
                        <BlurredSection isLoggedIn={isLoggedIn} title="评分详情">
                           {ratingSummary && (
                             <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-100 mb-6 flex flex-col gap-8">
                                <h2 className="text-2xl font-black text-slate-900 tracking-tight">评分统计</h2>
                                <div className="grid grid-cols-2 gap-4">
                                   <div className="bg-blue-50/50 border border-blue-100 p-8 rounded-3xl flex flex-col items-center shadow-xs">
                                     <div className="text-4xl font-black text-blue-700 leading-none mb-1">{ratingSummary.average.toFixed(1)}</div>
                                     <div className="text-xs font-bold text-blue-700/60 uppercase tracking-widest">综合评分</div>
                                   </div>
                                   <div className="bg-slate-50 border border-slate-200 p-8 rounded-3xl flex flex-col items-center shadow-xs">
                                     <div className="text-4xl font-black text-slate-700 leading-none mb-1">{ratingSummary.count}</div>
                                     <div className="text-xs font-bold text-slate-700/60 uppercase tracking-widest">评价人数</div>
                                   </div>
                                </div>
                                <div className="text-xs text-slate-400 italic text-center">登录获取更多详细倾向分析</div>
                             </div>
                           )}
                        </BlurredSection>
                        <EvaluationSection ratings={patchRatings} isLoading={isDetailLoading} />
                      </>
                    )}
                 </div>
               )}
            </div>

          </div>
        </div>
      </div>

      {selectedImage && <ImageViewer url={selectedImage} onDismiss={() => setSelectedImage(null)} />}
    </div>
  );
};
