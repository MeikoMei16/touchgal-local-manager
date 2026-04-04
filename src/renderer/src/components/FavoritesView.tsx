import React from 'react';
import { FolderPlus, Heart, Lock, Trash2, User } from 'lucide-react';
import type { TouchGalResource } from '../types';
import { useAuthStore, useUIStore } from '../store/useTouchGalStore';
import { useLocalCollectionStore } from '../store/localCollectionStore';
import type { LocalCollectionItem } from '../types/electron';

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

  return (
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
              <div className="mt-2 text-sm font-bold text-slate-400">先创建一个收藏夹，再从详情页把游戏加进来。</div>
            </div>
          )}

          {collections.map((collection) => (
            <article key={collection.id} className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-lg font-black text-slate-900">{collection.name}</div>
                  <div className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">{collection.itemCount} 项</div>
                </div>
                <button
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-500 transition-all hover:border-rose-200 hover:bg-rose-50 hover:text-rose-500"
                  onClick={() => void handleDeleteCollection(collection.id)}
                  type="button"
                >
                  <Trash2 size={14} />
                  删除
                </button>
              </div>

              {collection.items.length === 0 ? (
                <div className="mt-4 rounded-3xl border border-dashed border-slate-200 px-5 py-8 text-sm font-bold text-slate-400">
                  这个收藏夹还是空的。去游戏详情页点心形按钮即可加入。
                </div>
              ) : (
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {collection.items.map((item) => (
                    <div
                      key={`${collection.id}-${item.uniqueId}`}
                      className="group flex items-center gap-4 rounded-3xl border border-slate-100 bg-slate-50 p-3 transition-all hover:border-blue-200 hover:bg-white hover:shadow-md"
                    >
                      <button
                        className="flex min-w-0 flex-1 items-center gap-4 text-left"
                        onClick={() => void selectResource(item.uniqueId, toFallbackResource(item))}
                        type="button"
                      >
                        <div className="h-20 w-28 shrink-0 overflow-hidden rounded-2xl bg-slate-200">
                          {item.banner ? (
                            <img alt={item.name} className="h-full w-full object-cover" src={item.banner} />
                          ) : null}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-base font-black text-slate-900">{item.name}</div>
                          <div className="mt-1 text-xs font-black uppercase tracking-[0.15em] text-slate-400">{item.uniqueId}</div>
                          <div className="mt-3 flex flex-wrap gap-2 text-xs font-black text-slate-500">
                            <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-600">
                              {item.averageRating ? item.averageRating.toFixed(1) : '暂无评分'}
                            </span>
                            <span className="rounded-full bg-slate-200 px-3 py-1">
                              {item.downloadCount.toLocaleString()} 下载
                            </span>
                          </div>
                        </div>
                      </button>
                      <button
                        className="rounded-2xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-500 transition-all hover:border-rose-200 hover:bg-rose-50 hover:text-rose-500"
                        onClick={() => void handleRemoveItem(collection.id, item.uniqueId)}
                        type="button"
                      >
                        移除
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </article>
          ))}
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
                  <div key={folder.id} className="rounded-[1.5rem] border border-slate-100 bg-slate-50 p-4">
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
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>
      </section>
    </div>
  );
};
