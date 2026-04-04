import React from 'react';
import { Check, Download, Globe, Heart, Loader2, MessageSquare, Star } from 'lucide-react';
import { TouchGalDetail } from '../../types';
import { RatingHistogram } from '../RatingHistogram';
import { useAuthStore } from '../../store/authStore';
import { useLocalCollectionStore } from '../../store/localCollectionStore';
import type { DetailTabType } from './DetailTabs';
import { TouchGalClient } from '../../data/TouchGalClient';

const RESOURCE_SECTION_LABELS: Record<string, string> = {
  galgame: 'PC游戏',
  patch: '补丁资源',
  emulator: '模拟器资源',
  android: '手机游戏',
};

const RESOURCE_TYPE_LABELS: Record<string, string> = {
  pc: 'PC游戏',
  patch: '补丁资源',
  emulator: '模拟器资源',
  chinese: '汉化资源',
  mobile: '手机游戏',
  app: '直装资源',
  raw: '生肉资源',
  tool: '游戏工具',
  other: '其它',
};

const RESOURCE_LANGUAGE_LABELS: Record<string, string> = {
  'zh-Hans': '简体中文',
  'zh-Hant': '繁體中文',
  ja: '日本語',
  other: '其它',
};

const RESOURCE_PLATFORM_LABELS: Record<string, string> = {
  android: 'Android',
  windows: 'Windows',
  ios: 'iOS',
  linux: 'Linux',
  other: '其它',
};

const mapResourceTypeLabel = (value: string) => RESOURCE_TYPE_LABELS[value] ?? value;
const mapResourceLanguageLabel = (value: string) => RESOURCE_LANGUAGE_LABELS[value] ?? value;
const mapResourcePlatformLabel = (value: string) => RESOURCE_PLATFORM_LABELS[value] ?? value;

interface DetailHeaderProps {
  autoOpenCollectionMenu?: boolean;
  resource: TouchGalDetail;
  onImageClick?: (url: string) => void;
  onNavigateTab?: (tab: DetailTabType) => void;
}

export const DetailHeader: React.FC<DetailHeaderProps> = ({
  autoOpenCollectionMenu = false,
  resource,
  onImageClick,
  onNavigateTab
}) => {
  const { ratingSummary } = resource;
  const {
    collections,
    hasLoaded,
    isLoading: isCollectionLoading,
    fetchCollections,
    createCollectionAndAdd,
    addToCollection,
    removeFromCollection
  } = useLocalCollectionStore();
  const { user, fetchUserActivity, setIsLoginOpen } = useAuthStore();
  const [isCollectionMenuOpen, setIsCollectionMenuOpen] = React.useState(false);
  const [newCollectionName, setNewCollectionName] = React.useState('');
  const [collectionError, setCollectionError] = React.useState<string | null>(null);
  const [isSavingCollection, setIsSavingCollection] = React.useState(false);
  const [isCloudCollectionsLoading, setIsCloudCollectionsLoading] = React.useState(false);
  const [activeCloudFolderId, setActiveCloudFolderId] = React.useState<number | null>(null);
  const [cloudFolders, setCloudFolders] = React.useState<any[]>([]);
  const resourceTags = React.useMemo(() => {
    const seen = new Set<string>();
    const tags: string[] = [];

    for (const download of resource.downloads ?? []) {
      const values = [
        download.section ? (RESOURCE_SECTION_LABELS[download.section] ?? download.section) : null,
        ...(download.type ?? []).map(mapResourceTypeLabel),
        ...(download.language ?? []).map(mapResourceLanguageLabel),
        ...(download.platform ?? []).map(mapResourcePlatformLabel)
      ].filter((value): value is string => Boolean(value));

      for (const value of values) {
        if (seen.has(value)) continue;
        seen.add(value);
        tags.push(value);
      }
    }

    return tags;
  }, [resource.downloads]);
  const containingCollections = React.useMemo(
    () => collections.filter((collection) => collection.items.some((item) => item.uniqueId === resource.uniqueId)),
    [collections, resource.uniqueId]
  );
  const isFavoritedLocally = containingCollections.length > 0;

  React.useEffect(() => {
    if (!hasLoaded) {
      void fetchCollections();
    }
  }, [fetchCollections, hasLoaded]);

  React.useEffect(() => {
    if (!autoOpenCollectionMenu) return;
    setIsCollectionMenuOpen(true);
  }, [autoOpenCollectionMenu, resource.uniqueId]);

  React.useEffect(() => {
    if (!isCollectionMenuOpen || !user || !resource.id) return;

    let isMounted = true;

    const loadCloudFolders = async () => {
      setIsCloudCollectionsLoading(true);
      setCollectionError(null);
      try {
        const uid = user?.uid || user?.id;
        if (!uid) return;
        const folders = await TouchGalClient.getFavoriteFolders(Number(uid), resource.id);
        if (isMounted) {
          setCloudFolders(Array.isArray(folders) ? folders : []);
        }
      } catch (error) {
        if (isMounted) {
          setCollectionError(error instanceof Error ? error.message : 'Failed to load cloud collections');
          setCloudFolders([]);
        }
      } finally {
        if (isMounted) {
          setIsCloudCollectionsLoading(false);
        }
      }
    };

    void loadCloudFolders();

    return () => {
      isMounted = false;
    };
  }, [isCollectionMenuOpen, resource.id, user]);

  const resourcePayload = React.useMemo(() => ({
    id: resource.id,
    uniqueId: resource.uniqueId,
    name: resource.name,
    banner: resource.banner,
    averageRating: resource.averageRating,
    viewCount: resource.viewCount,
    downloadCount: resource.downloadCount,
    alias: resource.alias
  }), [resource.alias, resource.averageRating, resource.banner, resource.downloadCount, resource.id, resource.name, resource.uniqueId, resource.viewCount]);

  const handleCollectionToggle = async (collectionId: number, isSelected: boolean) => {
    setCollectionError(null);
    setIsSavingCollection(true);
    try {
      if (isSelected) {
        await removeFromCollection(collectionId, resource.uniqueId);
      } else {
        await addToCollection(collectionId, resourcePayload);
      }
    } catch (error) {
      setCollectionError(error instanceof Error ? error.message : 'Failed to update collection');
    } finally {
      setIsSavingCollection(false);
    }
  };

  const handleCreateAndAdd = async () => {
    const trimmedName = newCollectionName.trim();
    if (!trimmedName) return;

    setCollectionError(null);
    setIsSavingCollection(true);
    try {
      await createCollectionAndAdd(trimmedName, resourcePayload);
      setNewCollectionName('');
    } catch (error) {
      setCollectionError(error instanceof Error ? error.message : 'Failed to create collection');
    } finally {
      setIsSavingCollection(false);
    }
  };

  const handleAddToCloudCollection = async (folderId: number) => {
    if (!user || !resource.id) return;

    setCollectionError(null);
    setActiveCloudFolderId(folderId);
    try {
      await TouchGalClient.togglePatchFavorite(resource.id, folderId);

      const uid = user?.uid || user?.id;
      if (uid) {
        const folders = await TouchGalClient.getFavoriteFolders(Number(uid), resource.id);
        setCloudFolders(Array.isArray(folders) ? folders : []);
      }
      await fetchUserActivity('collections');
    } catch (error) {
      setCollectionError(error instanceof Error ? error.message : 'Failed to update cloud collection');
    } finally {
      setActiveCloudFolderId(null);
    }
  };

  const routeToTab = (tab: DetailTabType) => {
    onNavigateTab?.(tab);
  };

  return (
    <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 grid grid-cols-1 xl:grid-cols-[minmax(320px,360px)_minmax(0,1fr)]">
      <div
        className={`relative aspect-[16/10] overflow-hidden rounded-t-[2rem] bg-slate-100 sm:aspect-[5/3] xl:min-h-full xl:aspect-auto xl:rounded-l-[2rem] xl:rounded-tr-none ${resource.banner ? 'cursor-zoom-in' : ''}`}
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
      </div>

      <div className="p-6 md:p-8 flex flex-col gap-4">
        <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_280px] 2xl:items-start">
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
              {resourceTags.map((tag) => (
                <div key={tag} className="px-4 py-2 bg-blue-50 text-blue-600 border border-blue-100 rounded-full font-bold text-sm">
                  {tag}
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-black text-sm flex items-center gap-2 shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all active:scale-95"
                onClick={() => routeToTab('links')}
                type="button"
              >
                <Download size={18} />
                <span>下载</span>
              </button>
              <button
                className="bg-blue-50 text-blue-600 px-6 py-2.5 rounded-xl font-black text-sm flex items-center gap-2 border border-blue-100 hover:bg-blue-100 transition-all active:scale-95"
                onClick={() => routeToTab('evaluation')}
                type="button"
              >
                <Star size={18} />
                <span>评分</span>
              </button>
              <div className="flex gap-2 ml-auto sm:ml-0">
                <div className="relative">
                  <button
                    className={`w-10 h-10 rounded-xl border flex items-center justify-center transition-all active:scale-95 ${
                      isFavoritedLocally
                        ? 'border-rose-200 bg-rose-50 text-rose-500'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                    onClick={() => setIsCollectionMenuOpen((current) => !current)}
                    type="button"
                  >
                    <Heart size={20} fill={isFavoritedLocally ? 'currentColor' : 'none'} />
                  </button>
                  {isCollectionMenuOpen && (
                    <div className="absolute right-0 top-12 z-30 w-80 rounded-3xl border border-slate-200 bg-white p-4 shadow-2xl shadow-slate-200/60">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-black text-slate-900">收藏</div>
                          <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                            本地优先，云端并列
                          </div>
                        </div>
                        <button
                          className="text-xs font-black text-slate-400 hover:text-slate-700"
                          onClick={() => setIsCollectionMenuOpen(false)}
                          type="button"
                        >
                          关闭
                        </button>
                      </div>

                      <div className="mt-4 space-y-2">
                        <div className="text-[11px] font-black uppercase tracking-wide text-slate-400">本地收藏</div>
                        {collections.length === 0 && !isCollectionLoading && (
                          <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-3 text-sm font-bold text-slate-400">
                            还没有本地收藏夹，下面可以直接创建。
                          </div>
                        )}
                        {collections.map((collection) => {
                          const isSelected = collection.items.some((item) => item.uniqueId === resource.uniqueId);
                          return (
                            <button
                              key={collection.id}
                              className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition-all ${
                                isSelected
                                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                  : 'border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                              }`}
                              disabled={isSavingCollection}
                              onClick={() => void handleCollectionToggle(collection.id, isSelected)}
                              type="button"
                            >
                              <span className="font-black">{collection.name}</span>
                              <span className="text-xs font-black">{isSelected ? '已添加' : `${collection.itemCount} 项`}</span>
                            </button>
                          );
                        })}
                        <div className="flex gap-2 pt-2">
                          <input
                            className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-800 outline-none transition-all focus:border-blue-300 focus:bg-white"
                            onChange={(event) => setNewCollectionName(event.target.value)}
                            placeholder="新建本地收藏夹"
                            value={newCollectionName}
                          />
                          <button
                            className="rounded-2xl bg-blue-600 px-4 py-3 text-sm font-black text-white transition-all hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                            disabled={isSavingCollection || !newCollectionName.trim()}
                            onClick={() => void handleCreateAndAdd()}
                            type="button"
                          >
                            添加
                          </button>
                        </div>
                      </div>

                      <div className="mt-4 space-y-2 border-t border-slate-100 pt-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-[11px] font-black uppercase tracking-wide text-slate-400">云端收藏</div>
                          {!user && (
                            <button
                              className="text-xs font-black text-blue-600 hover:text-blue-700"
                              onClick={() => setIsLoginOpen(true)}
                              type="button"
                            >
                              登录
                            </button>
                          )}
                        </div>
                        {!user && (
                          <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-3 text-sm font-bold text-slate-400">
                            登录后可查看云端收藏夹。
                          </div>
                        )}
                        {user && isCloudCollectionsLoading && (
                          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-500">
                            正在读取云端收藏夹...
                          </div>
                        )}
                        {user && !isCloudCollectionsLoading && cloudFolders.length === 0 && (
                          <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-3 text-sm font-bold text-slate-400">
                            暂无云端收藏夹。
                          </div>
                        )}
                        {cloudFolders.map((folder: any) => (
                          <button
                            key={folder.id}
                            className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm transition-all ${
                              folder.isAdd
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                : 'border-slate-200 text-slate-600 hover:border-blue-200 hover:bg-blue-50 hover:text-slate-900'
                            }`}
                            disabled={activeCloudFolderId !== null}
                            onClick={() => void handleAddToCloudCollection(folder.id)}
                            type="button"
                          >
                            <div className="min-w-0">
                              <div className="truncate font-black text-slate-800">{folder.name}</div>
                              <div className="mt-1 text-[11px] font-bold text-slate-400">
                                {folder.isAdd ? '再次点击可从这个云端收藏夹移除' : '点击直接加入这个云端收藏夹'}
                              </div>
                            </div>
                            <div className="ml-3 flex shrink-0 items-center gap-2">
                              <span className="text-[11px] font-black uppercase tracking-wide text-slate-400">
                                {folder._count?.patch || 0} 项
                              </span>
                              <span
                                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-black ${
                                  folder.isAdd
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : 'bg-slate-100 text-slate-500'
                                }`}
                              >
                                {activeCloudFolderId === folder.id ? (
                                  <>
                                    <Loader2 size={12} className="animate-spin" />
                                    处理中
                                  </>
                                ) : folder.isAdd ? (
                                  <>
                                    <Check size={12} />
                                    已加入
                                  </>
                                ) : (
                                  '加入'
                                )}
                              </span>
                            </div>
                          </button>
                        ))}
                      </div>

                      {collectionError && (
                        <div className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-600">
                          {collectionError}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <button
                  className="w-10 h-10 rounded-xl border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-all text-slate-600 active:scale-95"
                  onClick={() => routeToTab('board')}
                  type="button"
                >
                  <MessageSquare size={20} />
                </button>
              </div>
            </div>
          </div>

          {ratingSummary && (
            <div className="2xl:justify-self-end 2xl:w-[280px] 2xl:pt-0.5">
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
