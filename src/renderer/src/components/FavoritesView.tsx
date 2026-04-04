import React from 'react';
import { FolderOpen, FolderPlus, Heart, Lock, Search, Trash2, User, X } from 'lucide-react';
import type { TouchGalResource } from '../types';
import { useAuthStore, useUIStore } from '../store/useTouchGalStore';
import { useLocalCollectionStore } from '../store/localCollectionStore';
import type { LocalCollection, LocalCollectionItem } from '../types/electron';
import { CloudCollectionOverlay } from './CloudCollectionOverlay';

const toFallbackResource = (item: LocalCollectionItem): TouchGalResource => ({
  id: item.resourceId,
  uniqueId: item.uniqueId,
  name: item.name,
  banner: item.banner,
  platform: '',
  language: '',
  created: null,
  releasedDate: null,
  averageRating: item.averageRating,
  tags: [],
  alias: [],
  favoriteCount: 0,
  resourceCount: 0,
  commentCount: 0,
  viewCount: item.viewCount,
  downloadCount: item.downloadCount,
  ratingSummary: null
});

const summarizeCollection = (collection: LocalCollection) => {
  const totalDownloads = collection.items.reduce((sum, item) => sum + item.downloadCount, 0);
  const ratedItems = collection.items.filter((item) => item.averageRating > 0);
  const averageRating =
    ratedItems.length > 0
      ? ratedItems.reduce((sum, item) => sum + item.averageRating, 0) / ratedItems.length
      : 0;

  return { totalDownloads, averageRating };
};

interface CollectionOverlayProps {
  actionError: string | null;
  collection: LocalCollection;
  onClose: () => void;
  onDeleteCollection: (collectionId: number) => Promise<void>;
  onOpenResource: (item: LocalCollectionItem) => Promise<void>;
  onRemoveItem: (collectionId: number, uniqueId: string) => Promise<void>;
}

const CollectionOverlay: React.FC<CollectionOverlayProps> = ({
  actionError,
  collection,
  onClose,
  onDeleteCollection,
  onOpenResource,
  onRemoveItem
}) => {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [activeUniqueId, setActiveUniqueId] = React.useState<string | null>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    scrollRef.current?.focus();
  }, []);

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const query = searchQuery.trim().toLowerCase();
  const filteredItems = query
    ? collection.items.filter((item) => {
        const haystacks = [item.name, item.uniqueId];
        return haystacks.some((value) => value.toLowerCase().includes(query));
      })
    : collection.items;
  const { totalDownloads, averageRating } = summarizeCollection(collection);

  const handleOpenResource = async (item: LocalCollectionItem) => {
    setActiveUniqueId(item.uniqueId);
    try {
      await onOpenResource(item);
    } finally {
      setActiveUniqueId(null);
    }
  };

  const handleRemoveItem = async (uniqueId: string) => {
    setActiveUniqueId(uniqueId);
    try {
      await onRemoveItem(collection.id, uniqueId);
    } finally {
      setActiveUniqueId(null);
    }
  };

  const handleDeleteCollection = async () => {
    await onDeleteCollection(collection.id);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[1100] flex justify-center bg-slate-950/55 backdrop-blur-md" onClick={onClose}>
      <div
        className="relative flex h-full w-full max-w-6xl flex-col overflow-hidden bg-slate-50 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="absolute right-4 top-4 z-20">
          <button
            className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white/90 text-slate-600 shadow-md transition-all hover:scale-105 hover:text-slate-900"
            onClick={onClose}
            type="button"
          >
            <X size={18} />
          </button>
        </div>

        <div
          ref={scrollRef}
          tabIndex={0}
          className="flex-1 overflow-y-auto p-5 outline-none md:p-8"
        >
          <div className="mx-auto flex max-w-5xl flex-col gap-6">
            <section className="rounded-[2rem] border border-slate-200 bg-linear-to-r from-white via-slate-50 to-rose-50 p-6 shadow-sm">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-[11px] font-black uppercase tracking-[0.25em] text-slate-500 shadow-sm">
                    <FolderOpen size={14} className="text-rose-500" />
                    Collection
                  </div>
                  <h3 className="mt-4 text-3xl font-black tracking-tight text-slate-900">{collection.name}</h3>
                  <p className="mt-2 max-w-2xl text-sm font-bold leading-6 text-slate-500">
                    这里是这个本地收藏夹的完整视图。可以搜索、打开详情、移除游戏，或者直接删除整个收藏夹。
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-3 lg:w-[360px]">
                  <div className="rounded-[1.5rem] border border-white bg-white/90 p-4 shadow-sm">
                    <div className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Games</div>
                    <div className="mt-3 text-2xl font-black text-slate-900">{collection.itemCount}</div>
                  </div>
                  <div className="rounded-[1.5rem] border border-white bg-white/90 p-4 shadow-sm">
                    <div className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Avg</div>
                    <div className="mt-3 text-2xl font-black text-amber-600">
                      {averageRating > 0 ? averageRating.toFixed(1) : '–'}
                    </div>
                  </div>
                  <div className="rounded-[1.5rem] border border-white bg-white/90 p-4 shadow-sm">
                    <div className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Downloads</div>
                    <div className="mt-3 text-2xl font-black text-slate-900">{totalDownloads.toLocaleString()}</div>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="relative lg:max-w-md lg:flex-1">
                  <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    className="w-full rounded-2xl border border-slate-200 bg-white px-11 py-3 text-sm font-bold text-slate-800 outline-none transition-all focus:border-blue-300"
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="搜索收藏夹里的游戏"
                    value={searchQuery}
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-600 transition-all hover:border-slate-300 hover:text-slate-900"
                    onClick={onClose}
                    type="button"
                  >
                    返回收藏页
                  </button>
                  <button
                    className="rounded-2xl bg-rose-500 px-4 py-3 text-sm font-black text-white transition-all hover:bg-rose-600"
                    onClick={() => void handleDeleteCollection()}
                    type="button"
                  >
                    删除收藏夹
                  </button>
                </div>
              </div>
            </section>

            {actionError && (
              <div className="rounded-3xl border border-rose-100 bg-rose-50 px-5 py-4 text-sm font-bold text-rose-600">
                {actionError}
              </div>
            )}

            <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h4 className="text-xl font-black tracking-tight text-slate-900">游戏列表</h4>
                  <p className="text-sm font-bold text-slate-400">
                    {filteredItems.length === collection.items.length
                      ? `共 ${collection.items.length} 项`
                      : `筛选结果 ${filteredItems.length} / ${collection.items.length}`}
                  </p>
                </div>
              </div>

              {filteredItems.length === 0 ? (
                <div className="mt-5 rounded-[1.75rem] border border-dashed border-slate-200 px-6 py-14 text-center">
                  <div className="text-lg font-black text-slate-800">没有匹配到结果</div>
                  <div className="mt-2 text-sm font-bold text-slate-400">换个关键词试试，或者清空搜索。</div>
                </div>
              ) : (
                <div className="mt-5 grid gap-4">
                  {filteredItems.map((item, index) => (
                    <article
                      key={`${collection.id}-${item.uniqueId}`}
                      className="grid gap-4 rounded-[1.75rem] border border-slate-100 bg-slate-50 p-4 transition-all hover:border-blue-200 hover:bg-white hover:shadow-md md:grid-cols-[28px_112px_minmax(0,1fr)_auto]"
                    >
                      <div className="hidden items-start justify-center pt-1 text-xs font-black text-slate-300 md:flex">
                        {String(index + 1).padStart(2, '0')}
                      </div>

                      <button
                        className="h-24 w-full overflow-hidden rounded-2xl bg-slate-200 md:w-28"
                        onClick={() => void handleOpenResource(item)}
                        type="button"
                      >
                        {item.banner ? (
                          <img alt={item.name} className="h-full w-full object-cover transition-transform duration-500 hover:scale-105" src={item.banner} />
                        ) : (
                          <div className="flex h-full items-center justify-center text-xs font-black uppercase tracking-[0.2em] text-slate-400">
                            No Cover
                          </div>
                        )}
                      </button>

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <button
                              className="truncate text-left text-lg font-black text-slate-900 transition-colors hover:text-blue-600"
                              onClick={() => void handleOpenResource(item)}
                              type="button"
                            >
                              {item.name}
                            </button>
                            <div className="mt-1 text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">
                              {item.uniqueId}
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2 text-xs font-black">
                            <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-600">
                              {item.averageRating ? item.averageRating.toFixed(1) : '暂无评分'}
                            </span>
                            <span className="rounded-full bg-slate-200 px-3 py-1 text-slate-600">
                              {item.viewCount.toLocaleString()} 浏览
                            </span>
                            <span className="rounded-full bg-slate-200 px-3 py-1 text-slate-600">
                              {item.downloadCount.toLocaleString()} 下载
                            </span>
                          </div>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-3">
                          <button
                            className="rounded-2xl bg-blue-600 px-4 py-2.5 text-sm font-black text-white transition-all hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                            disabled={activeUniqueId === item.uniqueId}
                            onClick={() => void handleOpenResource(item)}
                            type="button"
                          >
                            {activeUniqueId === item.uniqueId ? '打开中...' : '打开详情'}
                          </button>
                          <button
                            className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-600 transition-all hover:border-rose-200 hover:bg-rose-50 hover:text-rose-500 disabled:cursor-not-allowed disabled:opacity-50"
                            disabled={activeUniqueId === item.uniqueId}
                            onClick={() => void handleRemoveItem(item.uniqueId)}
                            type="button"
                          >
                            {activeUniqueId === item.uniqueId ? '处理中...' : '移出收藏夹'}
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

export const FavoritesView: React.FC = () => {
  const {
    collections,
    hasLoaded,
    isLoading: isLocalLoading,
    error: localError,
    fetchCollections,
    createCollection,
    deleteCollection,
    removeFromCollection
  } = useLocalCollectionStore();
  const { selectResource } = useUIStore();
  const { user, userCollections, isLoading: isAuthLoading, fetchUserActivity, setIsLoginOpen } = useAuthStore();
  const [newCollectionName, setNewCollectionName] = React.useState('');
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [selectedCollectionId, setSelectedCollectionId] = React.useState<number | null>(null);
  const [selectedCloudCollection, setSelectedCloudCollection] = React.useState<any | null>(null);

  React.useEffect(() => {
    if (!hasLoaded) {
      void fetchCollections();
    }
  }, [fetchCollections, hasLoaded]);

  React.useEffect(() => {
    if (user) {
      void fetchUserActivity('collections');
    }
  }, [fetchUserActivity, user]);

  React.useEffect(() => {
    if (selectedCollectionId == null) return;
    const stillExists = collections.some((collection) => collection.id === selectedCollectionId);
    if (!stillExists) {
      setSelectedCollectionId(null);
    }
  }, [collections, selectedCollectionId]);

  const selectedCollection = collections.find((collection) => collection.id === selectedCollectionId) ?? null;

  const handleCreateCollection = async () => {
    const trimmedName = newCollectionName.trim();
    if (!trimmedName) return;
    setActionError(null);
    try {
      await createCollection(trimmedName);
      setNewCollectionName('');
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Failed to create collection');
    }
  };

  const handleDeleteCollection = async (collectionId: number) => {
    setActionError(null);
    try {
      await deleteCollection(collectionId);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Failed to delete collection');
    }
  };

  const handleRemoveItem = async (collectionId: number, uniqueId: string) => {
    setActionError(null);
    try {
      await removeFromCollection(collectionId, uniqueId);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Failed to remove item');
    }
  };

  const handleOpenResource = async (item: LocalCollectionItem) => {
    await selectResource(item.uniqueId, toFallbackResource(item));
  };

  return (
    <>
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 p-2">
        <section className="grid gap-4 rounded-[2rem] border border-slate-200 bg-linear-to-r from-white via-slate-50 to-blue-50 p-6 shadow-sm lg:grid-cols-[minmax(0,1fr)_360px] lg:items-center">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-slate-500 shadow-sm">
              <Heart size={14} className="text-rose-500" />
              Favorites
            </div>
            <h3 className="text-3xl font-black tracking-tight text-slate-900">本地收藏与云端收藏并行管理</h3>
            <p className="max-w-2xl text-sm font-bold leading-6 text-slate-500">
              本地收藏夹始终可用，适合离线整理。云端收藏夹在登录后并列展示，保留同步能力。
            </p>
          </div>
          <div className="rounded-[1.75rem] border border-white/80 bg-white/90 p-4 shadow-lg shadow-slate-200/50">
            <div className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">新建本地收藏夹</div>
            <div className="mt-3 flex gap-3">
              <input
                className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-800 outline-none transition-all focus:border-blue-300 focus:bg-white"
                onChange={(event) => setNewCollectionName(event.target.value)}
                placeholder="例如：想补完、周末玩、白月光"
                value={newCollectionName}
              />
              <button
                className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white transition-all hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!newCollectionName.trim() || isLocalLoading}
                onClick={() => void handleCreateCollection()}
                type="button"
              >
                <FolderPlus size={16} />
                创建
              </button>
            </div>
          </div>
        </section>

        {(localError || actionError) && (
          <div className="rounded-3xl border border-rose-100 bg-rose-50 px-5 py-4 text-sm font-bold text-rose-600">
            {actionError || localError}
          </div>
        )}

        <section className="grid gap-8 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.8fr)]">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xl font-black tracking-tight text-slate-900">本地收藏</h4>
                <p className="text-sm font-bold text-slate-400">完全离线可用，直接落到本地数据库。</p>
              </div>
              <div className="rounded-full bg-slate-100 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-slate-500">
                {collections.length} 个收藏夹
              </div>
            </div>

            {collections.length === 0 && !isLocalLoading && (
              <div className="rounded-[2rem] border border-dashed border-slate-200 bg-white px-8 py-16 text-center shadow-sm">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-slate-100 text-slate-400">
                  <Heart size={28} />
                </div>
                <div className="mt-5 text-lg font-black text-slate-800">还没有本地收藏夹</div>
                <div className="mt-2 text-sm font-bold text-slate-400">先创建一个收藏夹，再从详情页点心形按钮把游戏加进来。</div>
              </div>
            )}

            {collections.map((collection) => {
              const { totalDownloads, averageRating } = summarizeCollection(collection);
              const previewItems = collection.items.slice(0, 3);
              return (
                <article
                  key={collection.id}
                  className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm transition-all hover:border-blue-200 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-4">
                    <button
                      className="min-w-0 flex-1 text-left"
                      onClick={() => setSelectedCollectionId(collection.id)}
                      type="button"
                    >
                      <div className="text-lg font-black text-slate-900 transition-colors hover:text-blue-600">{collection.name}</div>
                      <div className="mt-1 text-xs font-black uppercase tracking-[0.2em] text-slate-400">
                        {collection.itemCount} 项收藏
                      </div>
                    </button>
                    <button
                      className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-500 transition-all hover:border-rose-200 hover:bg-rose-50 hover:text-rose-500"
                      onClick={() => void handleDeleteCollection(collection.id)}
                      type="button"
                    >
                      <Trash2 size={14} />
                      删除
                    </button>
                  </div>

                  <button
                    className="mt-4 grid w-full gap-4 rounded-[1.75rem] border border-slate-100 bg-slate-50 p-4 text-left transition-all hover:border-blue-200 hover:bg-white"
                    onClick={() => setSelectedCollectionId(collection.id)}
                    type="button"
                  >
                    <div className="grid grid-cols-3 gap-3">
                      <div className="rounded-2xl bg-white p-3 shadow-sm">
                        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Games</div>
                        <div className="mt-2 text-xl font-black text-slate-900">{collection.itemCount}</div>
                      </div>
                      <div className="rounded-2xl bg-white p-3 shadow-sm">
                        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Avg</div>
                        <div className="mt-2 text-xl font-black text-amber-600">
                          {averageRating > 0 ? averageRating.toFixed(1) : '–'}
                        </div>
                      </div>
                      <div className="rounded-2xl bg-white p-3 shadow-sm">
                        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Downloads</div>
                        <div className="mt-2 text-xl font-black text-slate-900">{totalDownloads.toLocaleString()}</div>
                      </div>
                    </div>

                    {previewItems.length > 0 ? (
                      <div className="grid gap-3 md:grid-cols-3">
                        {previewItems.map((item) => (
                          <div key={item.uniqueId} className="rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
                            <div className="h-24 overflow-hidden rounded-xl bg-slate-200">
                              {item.banner ? (
                                <img alt={item.name} className="h-full w-full object-cover" src={item.banner} />
                              ) : null}
                            </div>
                            <div className="mt-3 truncate text-sm font-black text-slate-900">{item.name}</div>
                            <div className="mt-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{item.uniqueId}</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-3xl border border-dashed border-slate-200 px-5 py-8 text-sm font-bold text-slate-400">
                        这个收藏夹还是空的。去游戏详情页点心形按钮即可加入。
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <div className="text-sm font-bold text-slate-400">
                        {previewItems.length > 0 ? '点击查看完整收藏夹视图' : '点击打开收藏夹管理窗口'}
                      </div>
                      <div className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-white">
                        <FolderOpen size={14} />
                        打开
                      </div>
                    </div>
                  </button>
                </article>
              );
            })}
          </div>

          <aside className="space-y-4">
            <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h4 className="text-xl font-black tracking-tight text-slate-900">云端收藏</h4>
                  <p className="text-sm font-bold text-slate-400">登录后读取你的 TouchGal 收藏夹。</p>
                </div>
                <div className="rounded-full bg-slate-100 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-slate-500">
                  {user ? `${userCollections.length} 个` : '未登录'}
                </div>
              </div>

              {!user && (
                <div className="mt-5 rounded-[1.75rem] border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-white text-slate-400 shadow-sm">
                    <Lock size={24} />
                  </div>
                  <div className="mt-4 text-base font-black text-slate-800">登录后显示云端收藏夹</div>
                  <div className="mt-2 text-sm font-bold text-slate-400">本地收藏不受登录状态影响，云端区作为并列补充。</div>
                  <button
                    className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-black text-white transition-all hover:bg-slate-700"
                    onClick={() => setIsLoginOpen(true)}
                    type="button"
                  >
                    <User size={16} />
                    登录 TouchGal
                  </button>
                </div>
              )}

              {user && isAuthLoading && userCollections.length === 0 && (
                <div className="mt-5 rounded-3xl bg-slate-50 px-5 py-8 text-center text-sm font-bold text-slate-400">
                  正在读取云端收藏夹...
                </div>
              )}

              {user && !isAuthLoading && userCollections.length === 0 && (
                <div className="mt-5 rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-center text-sm font-bold text-slate-400">
                  没有读取到云端收藏夹。
                </div>
              )}

              {user && userCollections.length > 0 && (
                <div className="mt-5 space-y-3">
                  {userCollections.map((folder: any) => (
                    <button
                      key={folder.id}
                      className="w-full rounded-[1.5rem] border border-slate-100 bg-slate-50 p-4 text-left transition-all hover:border-emerald-200 hover:bg-white"
                      onClick={() => setSelectedCloudCollection(folder)}
                      type="button"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-base font-black text-slate-900">{folder.name}</div>
                          <div className="mt-1 text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">
                            {folder.is_public ? 'Public' : 'Private'}
                          </div>
                        </div>
                        <div className="rounded-full bg-white px-3 py-1 text-xs font-black text-slate-500 shadow-sm">
                          {folder._count?.patch || 0} 项
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </aside>
        </section>
      </div>

      {selectedCollection && (
        <CollectionOverlay
          actionError={actionError}
          collection={selectedCollection}
          onClose={() => setSelectedCollectionId(null)}
          onDeleteCollection={handleDeleteCollection}
          onOpenResource={handleOpenResource}
          onRemoveItem={handleRemoveItem}
        />
      )}
      {selectedCloudCollection && (
        <CloudCollectionOverlay
          folder={selectedCloudCollection}
          onClose={() => setSelectedCloudCollection(null)}
          onOpenResource={async (resource) => {
            await selectResource(resource.uniqueId, resource);
          }}
        />
      )}
    </>
  );
};
