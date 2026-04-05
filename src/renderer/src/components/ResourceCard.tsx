import React from 'react';
import { TouchGalDownload, TouchGalResource } from '../types';
import { Check, Lock, Star, Download, Eye, HardDrive, Heart, Languages, Loader2, MessageSquare, Plus, X } from 'lucide-react';
import { useUIStore, useAuthStore } from '../store/useTouchGalStore';
import { useLocalCollectionStore } from '../store/localCollectionStore';
import { TouchGalClient } from '../data/TouchGalClient';
import { getDownloadDisplayName, getDownloadMetadataChips, getOfficialGalgameDownloads } from '../features/downloads/downloadHelpers';

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
  const setDetailOpenIntent = useUIStore((state) => state.setDetailOpenIntent);
  const downloadPathOverride = useUIStore((state) => state.downloadPathOverride);
  const pushToast = useUIStore((state) => state.pushToast);
  const { user, setIsLoginOpen } = useAuthStore();
  const {
    collections,
    hasLoaded,
    isLoading: isCollectionLoading,
    fetchCollections,
    addToCollection,
    removeFromCollection,
    createCollectionAndAdd
  } = useLocalCollectionStore();
  const isClickable = resource.uniqueId && resource.uniqueId.length === 8;
  const isDetailLoadingForCard = isDetailLoading && selectedResource?.uniqueId === resource.uniqueId;
  const visibleTags = Array.isArray(resource.tags) ? resource.tags.filter(Boolean).slice(0, 3) : [];
  const [isCollectMenuOpen, setIsCollectMenuOpen] = React.useState(false);
  const [newCollectionName, setNewCollectionName] = React.useState('');
  const [quickError, setQuickError] = React.useState<string | null>(null);
  const [downloadQuickError, setDownloadQuickError] = React.useState<string | null>(null);
  const [activeLocalCollectionId, setActiveLocalCollectionId] = React.useState<number | null>(null);
  const [isCreatingLocalCollection, setIsCreatingLocalCollection] = React.useState(false);
  const [cloudFolders, setCloudFolders] = React.useState<any[]>([]);
  const [isCloudFoldersLoading, setIsCloudFoldersLoading] = React.useState(false);
  const [activeCloudFolderId, setActiveCloudFolderId] = React.useState<number | null>(null);
  const [isDownloadMenuOpen, setIsDownloadMenuOpen] = React.useState(false);
  const [isDownloadMenuLoading, setIsDownloadMenuLoading] = React.useState(false);
  const [officialDownloads, setOfficialDownloads] = React.useState<TouchGalDownload[]>([]);
  const [activeDownloadIndex, setActiveDownloadIndex] = React.useState<number | null>(null);
  const [collectMenuSide, setCollectMenuSide] = React.useState<'left' | 'right'>('right');
  const cardRef = React.useRef<HTMLDivElement>(null);

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

  const openCardWithIntent = (intent: 'default' | 'links' | 'favorite') => {
    if (!isClickable) return;
    setDetailOpenIntent(intent);
    onClick(resource);
  };

  const resourcePayload = React.useMemo(
    () => ({
      id: resource.id ?? 0,
      uniqueId: resource.uniqueId,
      name: resource.name,
      banner: resource.banner,
      averageRating: resource.averageRating ?? 0,
      viewCount: resource.viewCount || (resource as any).view || 0,
      downloadCount: resource.downloadCount || (resource as any).download || 0,
      alias: resource.alias
    }),
    [resource]
  );

  const containingCollections = React.useMemo(
    () => collections.filter((collection) => collection.items.some((item) => item.uniqueId === resource.uniqueId)),
    [collections, resource.uniqueId]
  );
  const isFavoritedLocally = containingCollections.length > 0;

  React.useEffect(() => {
    if (!hasLoaded) return;
    void fetchCollections();
  }, [fetchCollections, hasLoaded]);

  React.useEffect(() => {
    if (!isCollectMenuOpen && !isDownloadMenuOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!cardRef.current?.contains(event.target as Node)) {
        setIsCollectMenuOpen(false);
        setIsDownloadMenuOpen(false);
      }
    };

    window.addEventListener('mousedown', handlePointerDown);
    return () => window.removeEventListener('mousedown', handlePointerDown);
  }, [isCollectMenuOpen, isDownloadMenuOpen]);

  React.useEffect(() => {
    if (!isCollectMenuOpen && !isDownloadMenuOpen) return;

    const updateCollectMenuSide = () => {
      const rect = cardRef.current?.getBoundingClientRect();
      if (!rect) return;
      const cardCenter = rect.left + rect.width / 2;
      setCollectMenuSide(cardCenter <= window.innerWidth / 2 ? 'right' : 'left');
    };

    updateCollectMenuSide();
    window.addEventListener('resize', updateCollectMenuSide);
    return () => window.removeEventListener('resize', updateCollectMenuSide);
  }, [isCollectMenuOpen, isDownloadMenuOpen]);

  React.useEffect(() => {
    if (!isCollectMenuOpen || hasLoaded) return;
    void fetchCollections();
  }, [fetchCollections, hasLoaded, isCollectMenuOpen]);

  React.useEffect(() => {
    if (!isCollectMenuOpen || !user || !resource.id) return;

    let cancelled = false;

    const loadCloudFolders = async () => {
      setIsCloudFoldersLoading(true);
      setQuickError(null);
      try {
        const uid = user.uid || user.id;
        if (!uid) return;
        const folders = await TouchGalClient.getFavoriteFolders(Number(uid), resource.id);
        if (!cancelled) {
          setCloudFolders(Array.isArray(folders) ? folders : []);
        }
      } catch (error) {
        if (!cancelled) {
          setQuickError(error instanceof Error ? error.message : 'Failed to load cloud collections');
          setCloudFolders([]);
        }
      } finally {
        if (!cancelled) {
          setIsCloudFoldersLoading(false);
        }
      }
    };

    void loadCloudFolders();

    return () => {
      cancelled = true;
    };
  }, [isCollectMenuOpen, resource.id, user]);

  React.useEffect(() => {
    if (!isDownloadMenuOpen || !isClickable) return;

    let cancelled = false;

    const loadOfficialDownloads = async () => {
      setIsDownloadMenuLoading(true);
      setDownloadQuickError(null);
      try {
        const detail = await TouchGalClient.getPatchDetail(resource.uniqueId);
        if (cancelled) return;
        setOfficialDownloads(getOfficialGalgameDownloads(detail.downloads ?? []));
      } catch (error) {
        if (cancelled) return;
        setDownloadQuickError(error instanceof Error ? error.message : 'Failed to load official downloads');
        setOfficialDownloads([]);
      } finally {
        if (!cancelled) {
          setIsDownloadMenuLoading(false);
        }
      }
    };

    void loadOfficialDownloads();

    return () => {
      cancelled = true;
    };
  }, [isClickable, isDownloadMenuOpen, resource.uniqueId]);

  const handleToggleLocalCollection = async (collectionId: number, isSelected: boolean) => {
    setQuickError(null);
    setActiveLocalCollectionId(collectionId);
    try {
      if (isSelected) {
        await removeFromCollection(collectionId, resource.uniqueId);
      } else {
        await addToCollection(collectionId, resourcePayload);
      }
    } catch (error) {
      setQuickError(error instanceof Error ? error.message : 'Failed to update local collection');
    } finally {
      setActiveLocalCollectionId(null);
    }
  };

  const handleCreateAndAddLocalCollection = async () => {
    const trimmedName = newCollectionName.trim();
    if (!trimmedName) return;

    setQuickError(null);
    setIsCreatingLocalCollection(true);
    try {
      await createCollectionAndAdd(trimmedName, resourcePayload);
      setNewCollectionName('');
    } catch (error) {
      setQuickError(error instanceof Error ? error.message : 'Failed to create local collection');
    } finally {
      setIsCreatingLocalCollection(false);
    }
  };

  const handleToggleCloudFolder = async (folderId: number) => {
    if (!user || !resource.id) return;

    setQuickError(null);
    setActiveCloudFolderId(folderId);
    try {
      await TouchGalClient.togglePatchFavorite(resource.id, folderId);
      const uid = user.uid || user.id;
      if (uid) {
        const folders = await TouchGalClient.getFavoriteFolders(Number(uid), resource.id);
        setCloudFolders(Array.isArray(folders) ? folders : []);
      }
    } catch (error) {
      setQuickError(error instanceof Error ? error.message : 'Failed to update cloud collection');
    } finally {
      setActiveCloudFolderId(null);
    }
  };

  const handleQueueOfficialDownload = async (download: TouchGalDownload, index: number) => {
    setDownloadQuickError(null);
    setActiveDownloadIndex(index);
    try {
      const fallbackDirectory = await window.api.getDefaultDownloadDirectory();
      const targetDirectory = downloadPathOverride || fallbackDirectory;
      const links = (download.content ?? download.url ?? '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);

      let added = 0;
      let reused = 0;
      for (const link of links) {
        const result = await window.api.queueDownload(resource.id ?? null, link, targetDirectory, {
          id: resource.id ?? 0,
          uniqueId: resource.uniqueId,
          name: resource.name,
          banner: resource.banner ?? null,
          averageRating: resource.averageRating ?? 0,
          viewCount: resource.viewCount ?? 0,
          downloadCount: resource.downloadCount ?? 0,
          alias: resource.alias ?? [],
        });
        added += result.added;
        reused += result.reused;
      }

      const headline = getDownloadDisplayName(download);
      pushToast(
        added > 0
          ? `已加入下载队列: ${headline}（新增 ${added} 个文件${reused > 0 ? `，复用 ${reused} 个已存在任务` : ''}）`
          : `下载任务已存在: ${headline}`
      );
      setIsDownloadMenuOpen(false);
    } catch (error) {
      setDownloadQuickError(error instanceof Error ? error.message : 'Failed to queue download');
    } finally {
      setActiveDownloadIndex(null);
    }
  };

  return (
    <div 
      ref={cardRef}
      className={`group relative flex h-full w-full cursor-pointer flex-col overflow-visible rounded-[28px] border border-slate-200/90 bg-white shadow-[0_12px_32px_-24px_rgba(15,23,42,0.45)] transition-all duration-300 ease-out hover:not-disabled:z-30 hover:not-disabled:-translate-y-1.5 hover:not-disabled:border-primary/40 hover:not-disabled:shadow-[0_24px_48px_-24px_rgba(0,100,147,0.28)] ${(isCollectMenuOpen || isDownloadMenuOpen) ? 'z-40' : ''} ${!isClickable ? 'cursor-not-allowed grayscale opacity-60' : ''} ${isDetailLoadingForCard ? 'border-primary/60 ring-2 ring-primary/20 shadow-[0_24px_48px_-24px_rgba(0,100,147,0.28)]' : ''}`} 
      onClick={() => openCardWithIntent('default')}
    >
      <div className="relative flex h-full flex-col overflow-hidden rounded-[28px] bg-white">
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

        <div className="flex flex-1 flex-col gap-3 bg-white p-4 pr-16">
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
          <div className={`flex flex-col gap-2 transition-transform duration-300 ease-out ${(isCollectMenuOpen || isDownloadMenuOpen) ? 'translate-x-0' : 'translate-x-9 group-hover:translate-x-0'}`}>
            <button
              className={`pointer-events-auto flex h-28 w-12 items-center justify-center rounded-l-[22px] border text-sm font-bold tracking-[0.2em] shadow-[0_10px_24px_-18px_rgba(15,23,42,0.5)] transition-colors duration-200 ${
                isCollectMenuOpen || isFavoritedLocally
                  ? 'border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100'
                  : 'border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
              onClick={(e) => {
                e.stopPropagation();
                setIsDownloadMenuOpen(false);
                setIsCollectMenuOpen((current) => !current);
              }}
            >
              <span className="[writing-mode:vertical-rl]">收藏</span>
            </button>
            <button
              className="pointer-events-auto flex h-32 w-12 items-center justify-center rounded-l-[22px] bg-primary text-sm font-black tracking-[0.2em] text-on-primary shadow-[0_14px_28px_-18px_rgba(0,100,147,0.7)] transition-colors duration-200 hover:bg-primary/90"
              onClick={(e) => {
                e.stopPropagation();
                setIsCollectMenuOpen(false);
                setIsDownloadMenuOpen((current) => !current);
              }}
            >
              <span className="[writing-mode:vertical-rl]">下载</span>
            </button>
          </div>
        </div>
      </div>

      {isCollectMenuOpen && (
        <div
          className={`absolute top-4 z-50 flex max-h-[calc(100%-2rem)] w-[380px] max-w-[min(380px,calc(100vw-2rem))] flex-col overflow-hidden rounded-[28px] border border-slate-200/90 bg-white/98 shadow-[0_30px_60px_-28px_rgba(15,23,42,0.42)] ring-1 ring-white/80 backdrop-blur-xl ${
            collectMenuSide === 'right' ? 'left-[calc(100%+1rem)]' : 'right-[calc(100%+1rem)]'
          }`}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="border-b border-slate-100 bg-linear-to-r from-slate-50 via-white to-rose-50/60 px-4 py-4">
            <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
                <div className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">Quick Collect</div>
                <div className="mt-1 line-clamp-2 text-sm font-black leading-5 text-slate-900">{resource.name}</div>
                <div className="mt-2 flex items-center gap-2 text-[11px] font-bold text-slate-400">
                  <span className="rounded-full bg-white px-2.5 py-1 shadow-sm">首页快捷收藏</span>
                  <span>不离开当前列表</span>
                </div>
              </div>
              <button
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 shadow-sm transition-all hover:scale-105 hover:text-slate-700"
                onClick={() => setIsCollectMenuOpen(false)}
                type="button"
              >
                <X size={15} />
              </button>
            </div>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
            <section className="space-y-2.5">
              <div className="flex items-center justify-between gap-3">
                <div className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">本地收藏</div>
                <div className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-black text-slate-500">
                  {containingCollections.length} 个已加入
                </div>
              </div>
              {collections.length === 0 && !isCollectionLoading ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-xs font-bold text-slate-400">
                  还没有本地收藏夹，下面可以直接创建并加入。
                </div>
              ) : (
                collections.slice(0, 5).map((collection) => {
                  const isSelected = collection.items.some((item) => item.uniqueId === resource.uniqueId);
                  const isBusy = activeLocalCollectionId === collection.id;
                  return (
                    <button
                      key={collection.id}
                      className={`flex w-full items-center justify-between rounded-2xl border px-3.5 py-3 text-left transition-all ${
                        isSelected
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                      disabled={activeLocalCollectionId !== null || isCreatingLocalCollection}
                      onClick={() => void handleToggleLocalCollection(collection.id, isSelected)}
                      type="button"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-black text-slate-900">{collection.name}</div>
                        <div className="mt-1 text-[11px] font-bold text-slate-400">
                          {isSelected ? '再次点击可从本地收藏夹移除' : `${collection.itemCount} 项内容`}
                        </div>
                      </div>
                      <div
                        className={`ml-3 inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-black ${
                          isSelected ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {isBusy ? <Loader2 size={12} className="animate-spin" /> : isSelected ? <Check size={12} /> : <Plus size={12} />}
                        <span>{isBusy ? '处理中' : isSelected ? '已加入' : '加入'}</span>
                      </div>
                    </button>
                  );
                })
              )}
              <div className="flex gap-2 pt-1">
                <input
                  className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm font-bold text-slate-800 outline-none transition-all focus:border-primary/30 focus:bg-white"
                  onChange={(event) => setNewCollectionName(event.target.value)}
                  placeholder="新建本地收藏夹"
                  value={newCollectionName}
                />
                <button
                  className="rounded-2xl bg-slate-900 px-3.5 py-2.5 text-sm font-black text-white transition-all hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={isCreatingLocalCollection || !newCollectionName.trim()}
                  onClick={() => void handleCreateAndAddLocalCollection()}
                  type="button"
                >
                  {isCreatingLocalCollection ? '创建中' : '新建'}
                </button>
              </div>
            </section>

            <section className="space-y-2.5 border-t border-slate-100 pt-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">云端收藏</div>
                {!user && (
                  <button
                    className="text-xs font-black text-primary transition-colors hover:text-primary/80"
                    onClick={() => setIsLoginOpen(true)}
                    type="button"
                  >
                    登录
                  </button>
                )}
              </div>
              {!user ? (
                <button
                  className="flex w-full items-center justify-between rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-3.5 py-3 text-left text-xs font-bold text-slate-500 transition-all hover:border-slate-300 hover:bg-white"
                  onClick={() => setIsLoginOpen(true)}
                  type="button"
                >
                  <span>登录后可直接把游戏加入云端收藏夹</span>
                  <Lock size={13} />
                </button>
              ) : isCloudFoldersLoading ? (
                <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-xs font-bold text-slate-500">
                  <Loader2 size={13} className="animate-spin" />
                  正在读取云端收藏夹...
                </div>
              ) : cloudFolders.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-3.5 py-3 text-xs font-bold text-slate-400">
                  暂无云端收藏夹。
                </div>
              ) : (
                cloudFolders.slice(0, 4).map((folder) => {
                  const isBusy = activeCloudFolderId === folder.id;
                  return (
                    <button
                      key={folder.id}
                      className={`flex w-full items-center justify-between rounded-2xl border px-3.5 py-3 text-left transition-all ${
                        folder.isAdd
                          ? 'border-blue-200 bg-blue-50 text-blue-700'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                      disabled={activeCloudFolderId !== null}
                      onClick={() => void handleToggleCloudFolder(folder.id)}
                      type="button"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-black text-slate-900">{folder.name}</div>
                        <div className="mt-1 text-[11px] font-bold text-slate-400">
                          {folder.isAdd ? '再次点击可从云端收藏夹移除' : `${folder._count?.patch || 0} 项内容`}
                        </div>
                      </div>
                      <div
                        className={`ml-3 inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-black ${
                          folder.isAdd ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {isBusy ? <Loader2 size={12} className="animate-spin" /> : folder.isAdd ? <Check size={12} /> : <Plus size={12} />}
                        <span>{isBusy ? '处理中' : folder.isAdd ? '已加入' : '加入'}</span>
                      </div>
                    </button>
                  );
                })
              )}
            </section>

            {quickError && (
              <div className="rounded-2xl border border-rose-100 bg-rose-50 px-3.5 py-3 text-xs font-bold text-rose-600">
                {quickError}
              </div>
            )}
          </div>
        </div>
      )}

      {isDownloadMenuOpen && (
        <div
          className={`absolute top-4 z-50 flex max-h-[calc(100%-2rem)] w-[380px] max-w-[min(380px,calc(100vw-2rem))] flex-col overflow-hidden rounded-[28px] border border-slate-200/90 bg-white/98 shadow-[0_30px_60px_-28px_rgba(15,23,42,0.42)] ring-1 ring-white/80 backdrop-blur-xl ${
            collectMenuSide === 'right' ? 'left-[calc(100%+1rem)]' : 'right-[calc(100%+1rem)]'
          }`}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="border-b border-slate-100 bg-linear-to-r from-sky-50 via-white to-blue-50/70 px-4 py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">Quick Download</div>
                <div className="mt-1 line-clamp-2 text-sm font-black leading-5 text-slate-900">{resource.name}</div>
                <div className="mt-2 flex items-center gap-2 text-[11px] font-bold text-slate-400">
                  <span className="rounded-full bg-white px-2.5 py-1 shadow-sm">仅 TouchGal 官方</span>
                  <span>仅游戏本体资源</span>
                </div>
              </div>
              <button
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 shadow-sm transition-all hover:scale-105 hover:text-slate-700"
                onClick={() => setIsDownloadMenuOpen(false)}
                type="button"
              >
                <X size={15} />
              </button>
            </div>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
            <section className="space-y-2.5">
              <div className="flex items-center justify-between gap-3">
                <div className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">官方下载入口</div>
                <div className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-black text-slate-500">
                  {officialDownloads.length} 条
                </div>
              </div>

              {isDownloadMenuLoading ? (
                <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-xs font-bold text-slate-500">
                  <Loader2 size={13} className="animate-spin" />
                  正在读取 TouchGal 官方资源...
                </div>
              ) : officialDownloads.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-3.5 py-3 text-xs font-bold text-slate-400">
                  当前游戏没有可直接加入队列的 TouchGal 官方本体资源。
                </div>
              ) : (
                officialDownloads.map((download, index) => {
                  const isBusy = activeDownloadIndex === index;
                  const metadataChips = getDownloadMetadataChips(download);
                  return (
                    <button
                      key={`${download.id}-${download.content ?? download.url ?? index}`}
                      className="flex w-full items-start justify-between rounded-[1.5rem] border border-slate-200 bg-white px-4 py-4 text-left transition-all hover:border-sky-300 hover:bg-sky-50"
                      disabled={activeDownloadIndex !== null}
                      onClick={() => void handleQueueOfficialDownload(download, index)}
                      type="button"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap gap-2">
                          {metadataChips.map((chip) => (
                            <span
                              key={chip.key}
                              className={
                                chip.tone === 'section'
                                  ? 'rounded-full bg-sky-100 px-3 py-1 text-[11px] font-black text-sky-700'
                                  : chip.tone === 'type'
                                    ? 'rounded-full bg-blue-100 px-3 py-1 text-[11px] font-black text-blue-700'
                                    : chip.tone === 'language'
                                      ? 'inline-flex items-center gap-1 rounded-full bg-violet-100 px-3 py-1 text-[11px] font-black text-violet-700'
                                      : chip.tone === 'platform'
                                        ? 'rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-black text-emerald-700'
                                        : chip.tone === 'code'
                                          ? 'rounded-full bg-sky-100 px-3 py-1 text-[11px] font-black text-sky-700'
                                          : 'rounded-full bg-amber-100 px-3 py-1 text-[11px] font-black text-amber-700'
                              }
                            >
                              {chip.tone === 'language' && <Languages size={11} />}
                              {chip.label}
                            </span>
                          ))}
                        </div>
                        <div className="mt-3 text-base font-black leading-6 text-slate-900">{getDownloadDisplayName(download)}</div>
                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] font-bold text-slate-500">
                          <span className="inline-flex items-center gap-1.5">
                            <HardDrive size={13} />
                            TouchGal 官方
                          </span>
                          <span>{download.size || '未知大小'}</span>
                          <span>直接加入下载页</span>
                        </div>
                      </div>
                      <div className="ml-4 inline-flex shrink-0 items-center gap-1 rounded-full bg-sky-100 px-3 py-1.5 text-[11px] font-black text-sky-700">
                        {isBusy ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                        <span>{isBusy ? '处理中' : '加入'}</span>
                      </div>
                    </button>
                  );
                })
              )}
            </section>

            {downloadQuickError && (
              <div className="rounded-2xl border border-rose-100 bg-rose-50 px-3.5 py-3 text-xs font-bold text-rose-600">
                {downloadQuickError}
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
};
