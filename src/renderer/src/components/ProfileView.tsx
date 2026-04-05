import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../store/useTouchGalStore';
import { useUIStore } from '../store/uiStore';
import { Clock, MessageSquare, Star, Package, Heart, Coins, Users, User, Loader2, Trash2 } from 'lucide-react';
import { CloudCollectionOverlay } from './CloudCollectionOverlay';
import type { TouchGalResource } from '../types';
import type { BrowseHistoryEntry } from '../types/electron';

const LoadingCircle: React.FC<{ label?: string; compact?: boolean }> = ({ label = '加载中...', compact = false }) => (
  <div className={`flex flex-col items-center justify-center text-center ${compact ? 'py-14' : 'h-full'} text-on-surface-variant`}>
    <div className="relative">
      <div className={`${compact ? 'h-12 w-12' : 'h-16 w-16'} rounded-full border-4 border-slate-200`} />
      <div
        className={`absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-primary border-r-primary ${
          compact ? 'h-12 w-12' : 'h-16 w-16'
        }`}
      />
    </div>
    <div className={`${compact ? 'mt-4 text-sm' : 'mt-5 text-base'} font-black tracking-wide text-slate-500`}>{label}</div>
  </div>
);

const formatRelativeTime = (dateStr: string): string => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return '刚刚';
  if (mins < 60) return `${mins} 分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} 天前`;
  return new Date(dateStr).toLocaleDateString('zh-CN');
};

const PROFILE_TAB_LABELS: Record<'history' | 'comments' | 'ratings' | 'collections', string> = {
  history: '历史',
  comments: '评论',
  ratings: '评分',
  collections: '收藏夹'
};

const PLAY_STATUS_LABELS: Record<string, string> = {
  finished: '已通关',
  playing: '游玩中',
  queued: '已入库'
};

const ProfileView: React.FC = () => {
  const { 
    user, 
    userProfile, 
    fetchUserProfile, 
    fetchUserActivity,
    userComments,
    userRatings,
    userCollections,
    isLoading 
  } = useAuthStore();
  const { selectResource } = useUIStore();

  const [activeTab, setActiveTab] = useState<'comments' | 'ratings' | 'collections' | 'history'>('history');
  const [selectedCloudCollection, setSelectedCloudCollection] = useState<any | null>(null);
  const [openingCloudCollectionId, setOpeningCloudCollectionId] = useState<number | null>(null);
  const [history, setHistory] = useState<BrowseHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [clearingHistory, setClearingHistory] = useState(false);

  useEffect(() => {
    if (user && !userProfile) {
      fetchUserProfile();
    }
  }, [user, userProfile, fetchUserProfile]);

  useEffect(() => {
    if (user && activeTab !== 'history') {
      fetchUserActivity(activeTab as 'comments' | 'ratings' | 'collections');
    }
  }, [user, activeTab, fetchUserActivity]);

  // Always load history (available without login)
  useEffect(() => {
    if (activeTab === 'history') {
      loadHistory();
    }
  }, [activeTab]);

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const entries = await window.api.getHistory(100);
      setHistory(entries);
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleClearHistory = async () => {
    if (!confirm('确定要清除所有浏览历史吗？')) return;
    setClearingHistory(true);
    try {
      await window.api.clearHistory();
      setHistory([]);
    } finally {
      setClearingHistory(false);
    }
  };

  const handleOpenHistoryEntry = async (entry: BrowseHistoryEntry) => {
    await selectResource(entry.unique_id);
  };

  const handleOpenCloudResource = async (resource: TouchGalResource) => {
    await selectResource(resource.uniqueId, resource);
  };

  const handleOpenCloudCollection = (folder: any) => {
    setOpeningCloudCollectionId(folder.id);
    setSelectedCloudCollection(folder);
  };

  const tabs = user
    ? (['history', 'comments', 'ratings', 'collections'] as const)
    : (['history'] as const);

  return (
    <div className="p-8 max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left: Profile Summary */}
        <div className="lg:col-span-1">
          <div className="bg-surface rounded-3xl p-8 shadow-sm border border-outline-variant flex flex-col items-center text-center sticky top-8">
            {user ? (
              <>
                <div className="relative group">
                  <img 
                    src={userProfile?.avatar || 'https://via.placeholder.com/150'} 
                    alt={userProfile?.name} 
                    className="w-40 h-40 rounded-full object-cover border-4 border-white shadow-xl mb-6 transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute bottom-6 right-2 bg-primary text-on-primary p-2 rounded-full shadow-lg border-2 border-white">
                    <Heart size={20} fill="currentColor" />
                  </div>
                </div>
                
                <h1 className="text-3xl font-black text-on-surface mb-2">{userProfile?.name || user.name}</h1>
                <p className="text-on-surface-variant text-sm mb-6 max-w-xs">{userProfile?.bio || '这个人很懒，还没有写简介。'}</p>
                
                <div className="flex gap-4 w-full mb-8">
                  <div className="flex-1 bg-surface-container-low rounded-2xl p-4 border border-outline-variant">
                    <div className="text-2xl font-bold text-on-surface">{userProfile?.follower || 0}</div>
                    <div className="text-xs text-on-surface-variant uppercase tracking-wider font-bold">粉丝</div>
                  </div>
                  <div className="flex-1 bg-surface-container-low rounded-2xl p-4 border border-outline-variant">
                    <div className="text-2xl font-bold text-on-surface">{userProfile?.following || 0}</div>
                    <div className="text-xs text-on-surface-variant uppercase tracking-wider font-bold">关注</div>
                  </div>
                </div>

                <div className="w-full space-y-3">
                  <div className="flex items-center justify-between p-4 bg-amber-50 rounded-2xl border border-amber-100 text-amber-700">
                    <div className="flex items-center gap-3">
                      <Coins size={20} />
                      <span className="font-bold">萌萌点</span>
                    </div>
                    <span className="text-lg font-black">{userProfile?.moemoepoint || 0}</span>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="w-40 h-40 rounded-full bg-surface-container-low border-4 border-white shadow-xl mb-6 flex items-center justify-center">
                  <Users size={56} className="text-outline opacity-40" />
                </div>
                <h1 className="text-2xl font-black text-on-surface mb-2">未登录</h1>
                <p className="text-on-surface-variant text-sm mb-6">登录后可查看评论、评分和云端收藏</p>
                <button
                  onClick={() => useAuthStore.getState().setIsLoginOpen(true)}
                  className="bg-primary hover:bg-primary/90 text-on-primary font-bold py-3 px-8 rounded-full shadow-lg transition-all transform hover:scale-105 active:scale-95 flex items-center gap-2"
                >
                  <User size={20} />
                  <span>立即登录</span>
                </button>

                {/* History summary for logged-out users */}
                <div className="mt-8 w-full p-4 bg-surface-container-low rounded-2xl border border-outline-variant text-left">
                  <div className="flex items-center gap-2 text-on-surface-variant mb-1">
                    <Clock size={14} />
                    <span className="text-xs font-bold uppercase tracking-wider">浏览历史</span>
                  </div>
                  <div className="text-2xl font-black text-on-surface">{history.length}</div>
                  <div className="text-xs text-on-surface-variant">条记录（本地）</div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Right: Stats & Activity */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Stats Grid — only when logged in */}
          {user && (
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-surface rounded-3xl p-6 shadow-sm border border-outline-variant">
                <div className="p-3 bg-primary-container text-primary rounded-2xl w-fit mb-4">
                  <MessageSquare size={24} />
                </div>
                <div className="text-3xl font-black text-on-surface">{userProfile?._count?.patch_comment || 0}</div>
                <div className="text-sm text-on-surface-variant font-bold">评论</div>
              </div>
              <div className="bg-surface rounded-3xl p-6 shadow-sm border border-outline-variant">
                <div className="p-3 bg-amber-50 text-amber-500 rounded-2xl w-fit mb-4">
                  <Star size={24} />
                </div>
                <div className="text-3xl font-black text-on-surface">{userProfile?._count?.patch_rating || 0}</div>
                <div className="text-sm text-on-surface-variant font-bold">评分</div>
              </div>
              <div className="bg-surface rounded-3xl p-6 shadow-sm border border-outline-variant">
                <div className="p-3 bg-emerald-50 text-emerald-500 rounded-2xl w-fit mb-4">
                  <Package size={24} />
                </div>
                <div className="text-3xl font-black text-on-surface">{userProfile?._count?.patch_favorite || userCollections.length || 0}</div>
                <div className="text-sm text-on-surface-variant font-bold">收藏夹</div>
              </div>
            </div>
          )}

          {/* Activity Tabs */}
          <div className="bg-surface rounded-3xl shadow-sm border border-outline-variant overflow-hidden">
            <div className="flex border-b border-surface-container">
              {tabs.map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab as any)}
                  className={`flex-1 py-5 text-sm font-bold uppercase tracking-wider transition-all duration-300 relative flex items-center justify-center gap-1.5 ${
                    activeTab === tab ? 'text-primary' : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  {tab === 'history' && <Clock size={14} />}
                  {PROFILE_TAB_LABELS[tab as keyof typeof PROFILE_TAB_LABELS] ?? tab}
                  {activeTab === tab && (
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-1 bg-primary rounded-full" />
                  )}
                </button>
              ))}
            </div>

            <div className="p-6">
              {/* History Tab */}
              {activeTab === 'history' && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-xs text-on-surface-variant font-bold uppercase tracking-wider">
                      {history.length} 条浏览记录（本地存储）
                    </p>
                    {history.length > 0 && (
                      <button
                        onClick={handleClearHistory}
                        disabled={clearingHistory}
                        className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700 font-bold transition-colors disabled:opacity-50"
                      >
                        {clearingHistory ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                        清除全部
                      </button>
                    )}
                  </div>

                  {historyLoading ? (
                    <LoadingCircle label="加载历史..." compact />
                  ) : history.length === 0 ? (
                    <div className="py-20 text-center">
                      <Clock size={40} className="mx-auto mb-3 text-outline opacity-30" />
                      <div className="text-outline font-bold">暂无浏览记录</div>
                      <div className="text-xs text-outline mt-1">点进游戏详情后会自动记录</div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {history.map(entry => (
                        <button
                          key={entry.unique_id}
                          onClick={() => handleOpenHistoryEntry(entry)}
                          className="group text-left rounded-2xl overflow-hidden border border-outline-variant hover:border-primary/30 hover:shadow-md transition-all duration-200 bg-surface-container-low"
                        >
                          {entry.banner_url ? (
                            <div className="aspect-video w-full overflow-hidden bg-surface-container">
                              <img
                                src={entry.banner_url}
                                alt={entry.name}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                              />
                            </div>
                          ) : (
                            <div className="aspect-video w-full bg-surface-container flex items-center justify-center">
                              <Package size={24} className="text-outline opacity-30" />
                            </div>
                          )}
                          <div className="p-2.5">
                            <div className="text-xs font-bold text-on-surface line-clamp-2 leading-tight mb-1 group-hover:text-primary transition-colors">
                              {entry.name}
                            </div>
                            <div className="text-[10px] text-on-surface-variant">
                              {formatRelativeTime(entry.viewed_at)}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {isLoading && activeTab !== 'history' && <LoadingCircle label="正在加载动态..." compact />}
              
              {!isLoading && activeTab === 'comments' && (
                <div className="space-y-4">
                  {userComments.length === 0 ? (
                    <div className="py-20 text-center text-outline font-bold">暂无评论</div>
                  ) : (
                    userComments.map(comment => (
                      <div key={comment.id} className="p-4 bg-surface-container-low rounded-2xl border border-outline-variant group hover:border-primary/20 transition-all">
                        <div className="text-xs font-bold text-primary mb-2 uppercase tracking-tight">{comment.patchName}</div>
                        <div className="text-on-surface font-medium mb-3">{comment.content}</div>
                        <div className="text-[10px] text-on-surface-variant font-bold">{new Date(comment.createdAt).toLocaleString()}</div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {!isLoading && activeTab === 'ratings' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {userRatings.length === 0 ? (
                    <div className="col-span-2 py-20 text-center text-outline font-bold">暂无评分记录</div>
                  ) : (
                    userRatings.map(rating => (
                      <div key={rating.id} className="p-4 bg-surface-container-low rounded-2xl border border-outline-variant hover:border-amber-200 transition-all">
                         <div className="flex justify-between items-start mb-3">
                            <div className="text-xs font-bold text-amber-600 uppercase tracking-tight truncate flex-1 mr-2">{rating.patchName}</div>
                            <div className="flex items-center gap-1 bg-amber-100 text-amber-700 px-2 py-0.5 rounded-lg text-xs font-black">
                               <Star size={12} fill="currentColor" />
                               {rating.overall}
                            </div>
                         </div>
                         <div className="text-on-surface-variant text-sm italic mb-2 line-clamp-2">"{rating.shortSummary}"</div>
                         <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                                 rating.playStatus === 'finished' ? 'bg-emerald-100 text-emerald-700' : 'bg-primary-container text-primary'
                            }`}>
                               {PLAY_STATUS_LABELS[rating.playStatus] ?? rating.playStatus}
                            </span>
                         </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {!isLoading && activeTab === 'collections' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {userCollections.length === 0 ? (
                    <div className="col-span-2 py-20 text-center text-outline font-bold">暂无云端收藏夹</div>
                  ) : (
                    userCollections.map(folder => (
                      <button
                        key={folder.id}
                        className={`flex w-full items-center justify-between p-5 rounded-2xl border transition-all group cursor-pointer text-left ${
                          selectedCloudCollection?.id === folder.id
                            ? 'border-emerald-300 bg-white shadow-lg shadow-emerald-100/70'
                            : 'border-outline-variant bg-surface-container-low hover:border-emerald-200'
                        }`}
                        onClick={() => handleOpenCloudCollection(folder)}
                        type="button"
                      >
                        <div className="flex items-center gap-4">
                           <div className="p-3 bg-white rounded-xl shadow-sm group-hover:bg-emerald-50 transition-colors">
                              <Package size={24} className="text-emerald-500" />
                           </div>
                           <div>
                              <h4 className="font-bold text-on-surface group-hover:text-emerald-600 transition-colors uppercase tracking-tight">{folder.name}</h4>
                              <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider">{folder.is_public ? '公开收藏夹' : '私密收藏夹'}</p>
                           </div>
                        </div>
                        <div className="flex items-center gap-3">
                           {openingCloudCollectionId === folder.id && (
                             <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-[11px] font-black text-emerald-700">
                               <Loader2 size={12} className="animate-spin" />
                               打开中
                             </div>
                           )}
                           <div className="bg-white px-3 py-1 rounded-full text-xs font-black text-on-surface-variant shadow-sm">
                              {folder._count?.patch || 0}
                           </div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      {selectedCloudCollection && (
        <CloudCollectionOverlay
          allFolders={userCollections}
          folder={selectedCloudCollection}
          onClose={() => {
            setSelectedCloudCollection(null);
            setOpeningCloudCollectionId(null);
          }}
          onCollectionMutated={async () => {
            await fetchUserActivity('collections');
          }}
          onOpenResource={handleOpenCloudResource}
        />
      )}
    </div>
  );
};

export default ProfileView;
