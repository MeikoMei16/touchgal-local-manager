import React, { useState } from 'react';
import { useUIStore, useAuthStore } from '../store/useTouchGalStore';
import { X, Globe, Star, Loader2, Download, MessageSquare, Share2, Heart, Info as InfoIcon, FileText } from 'lucide-react';
import { EvaluationSection } from './EvaluationSection';
import { CommentSection } from './CommentSection';
import { ScreenshotGallery } from './ScreenshotGallery';
import { BlurredSection } from './BlurredSection';
import { RatingHistogram } from './RatingHistogram';

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

const SessionLockedState: React.FC<{
  icon: React.ElementType;
  title: string;
  description: string;
  buttonClassName: string;
  onLogin: () => void;
}> = ({ icon: Icon, title, description, buttonClassName, onLogin }) => (
  <div className="bg-slate-50 rounded-[2rem] p-12 text-center flex flex-col items-center gap-4 border border-slate-100">
    <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center">
      <Icon size={32} />
    </div>
    <h3 className="text-lg font-black text-slate-800">{title}</h3>
    <p className="text-sm font-bold text-slate-400">{description}</p>
    <button
      onClick={onLogin}
      className={`mt-2 text-white px-8 py-3 rounded-2xl font-black text-sm shadow-lg transition-all active:scale-95 ${buttonClassName}`}
    >
      立即登录
    </button>
  </div>
);

export const DetailOverlay: React.FC = () => {
  const {
    selectedResource, clearSelected, addTagFilter,
    isDetailLoading, patchComments, patchRatings
  } = useUIStore();
  const { user, sessionError, setIsLoginOpen } = useAuthStore();
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
  const screenshots = selectedResource.screenshots ?? [];
  const pvUrl = selectedResource.pvUrl;
  const companyName = selectedResource.company || 'Unknown';
  const aliases = selectedResource.alias ?? [];
  const metadataRows = [
    { icon: FileText, label: '发售时间', value: selectedResource.releasedDate || 'N/A' },
    { icon: Globe, label: 'VNDB ID', value: selectedResource.vndbId || 'N/A' },
    { icon: Globe, label: 'Bangumi ID', value: selectedResource.bangumiId || 'N/A' },
    { icon: Globe, label: 'Steam ID', value: selectedResource.steamId || 'N/A' }
  ];

  const handleTagClick = (tag: string) => {
    addTagFilter(tag);
    clearSelected();
  };

  const tabs = [
    { id: 'info',       label: '游戏信息', icon: InfoIcon      },
    { id: 'links',      label: '资源链接', icon: Globe         },
    { id: 'board',      label: '讨论版',   icon: MessageSquare },
    { id: 'evaluation', label: '游戏评价', icon: Star          },
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
              {/* Banner */}
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

              {/* Info */}
              <div className="md:col-span-2 p-6 md:p-10 flex flex-col gap-5">
                <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
                  <div className="flex min-w-0 flex-col gap-5">
                    <div className="flex flex-col gap-2">
                      <h1 className="m-0 text-2xl md:text-3xl font-black text-slate-900 leading-tight tracking-tight">{selectedResource.name}</h1>
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-1.5 bg-amber-50 text-amber-600 px-3 py-1 rounded-full text-sm font-black border border-amber-100">
                          <Star size={16} fill="currentColor" />
                          <span>{selectedResource.averageRating?.toFixed(1) ?? '–'}</span>
                        </div>
                        {ratingSummary && (
                          <span className="text-slate-400 text-xs font-bold">
                            {ratingSummary.count.toLocaleString()} 人评价
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-3">
                      {selectedResource.tags?.slice(0, 8).map((t: string) => (
                        <div key={t} className="px-4 py-2 bg-blue-50 text-blue-600 border border-blue-100 rounded-full font-bold text-sm">
                          {t}
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
                    <div className="xl:justify-self-end xl:w-[320px] xl:pt-1">
                      <RatingHistogram ratingSummary={ratingSummary} compact />
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t border-slate-100 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-full bg-slate-200 border-2 border-white shadow-sm overflow-hidden">
                      <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedResource.company || 'P'}`} alt="User" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-base font-black text-slate-800">{selectedResource.company || 'Palentum'}</span>
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-tight">{selectedResource.releasedDate || '未知发售'}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-slate-400">
                    <div className="flex items-center gap-1.5 text-[12px] font-black">
                      <Globe size={16} />
                      <span>{selectedResource.viewCount?.toLocaleString() ?? '–'}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[12px] font-black">
                      <Download size={16} />
                      <span>{selectedResource.downloadCount?.toLocaleString() ?? '–'}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[12px] font-black">
                      <Heart size={16} fill="currentColor" />
                      <span>{selectedResource.favoriteCount?.toLocaleString() ?? '–'}</span>
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
                  <tab.icon size={18} />
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
                        dangerouslySetInnerHTML={{ __html: selectedResource.introduction || 'No introduction available.' }}
                      />
                    </section>

                    <ScreenshotGallery
                      screenshots={screenshots}
                      onImageClick={(url) => setSelectedImage(url)}
                    />

                    {pvUrl && (
                      <section className="flex flex-col gap-4">
                        <h2 className="text-2xl font-black text-slate-900 tracking-tight">PV鉴赏</h2>
                        <div className="rounded-3xl overflow-hidden bg-black aspect-video relative shadow-2xl border border-slate-800">
                          <video controls src={pvUrl} poster={selectedResource.banner || ''} className="w-full h-full" />
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
                          {companyName}
                        </div>
                      </div>
                    </section>

                    <section className="flex flex-col gap-6 pt-8 border-t border-slate-100">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4">
                        {metadataRows.map(({ icon: Icon, label, value }) => (
                          <div key={label} className="flex justify-between items-center py-2 border-b border-slate-50">
                            <div className="flex items-center gap-2 text-slate-400 font-bold text-sm italic">
                              <Icon size={16} />
                              <span>{label}</span>
                            </div>
                            <span className="font-black text-slate-700">{value}</span>
                          </div>
                        ))}
                      </div>
                    </section>

                    {aliases.length > 0 && (
                      <section className="flex flex-col gap-4 pt-8 border-t border-slate-100">
                        <h2 className="text-2xl font-black text-slate-900 tracking-tight">游戏别名</h2>
                        <ul className="list-disc list-inside text-slate-500 font-medium space-y-1">
                          {aliases.map((a: string, i: number) => <li key={i}>{a}</li>)}
                        </ul>
                      </section>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'links' && (
                <div className="bg-white rounded-[2rem] p-12 shadow-sm border border-slate-100 flex flex-col items-center justify-center text-center gap-4">
                  <Globe size={64} className="text-slate-200" />
                  <h2 className="text-xl font-black text-slate-800">资源链接</h2>
                  <p className="text-slate-500 font-medium">官方购买建议于官网进行，资源链接请查看讨论版。</p>
                </div>
              )}

              {activeTab === 'board' && (
                <div className="flex flex-col gap-6">
                  {sessionError === 'SESSION_EXPIRED' ? (
                    <SessionLockedState
                      icon={MessageSquare}
                      title="讨论内容暂不可见"
                      description="登录后即可查看和参与社区讨论"
                      buttonClassName="bg-rose-500 shadow-rose-200 hover:bg-rose-600"
                      onLogin={() => setIsLoginOpen(true)}
                    />
                  ) : (
                    <CommentSection comments={patchComments} isLoading={isDetailLoading} />
                  )}
                </div>
              )}

              {activeTab === 'evaluation' && (
                <div className="flex flex-col gap-6">
                  {sessionError === 'SESSION_EXPIRED' ? (
                    <SessionLockedState
                      icon={Star}
                      title="评分详情已隐藏"
                      description="登录后解锁详细的评分分布和用户评价"
                      buttonClassName="bg-amber-500 shadow-amber-200 hover:bg-amber-600"
                      onLogin={() => setIsLoginOpen(true)}
                    />
                  ) : (
                    <BlurredSection isLoggedIn={isLoggedIn} title="用户评价">
                      <EvaluationSection ratings={patchRatings} isLoading={isDetailLoading} />
                    </BlurredSection>
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
