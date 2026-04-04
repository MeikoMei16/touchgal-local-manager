import React from 'react';
import { ChevronLeft, ChevronRight, Cloud, Loader2, Lock, Trash2, Unlock, X } from 'lucide-react';
import { TouchGalClient } from '../data/TouchGalClient';
import type { TouchGalResource } from '../types';

interface CloudCollectionOverlayProps {
  folder: any;
  onClose: () => void;
  onOpenResource: (resource: TouchGalResource) => Promise<void>;
  onCollectionMutated?: () => Promise<void> | void;
}

const PAGE_SIZE = 24;

export const CloudCollectionOverlay: React.FC<CloudCollectionOverlayProps> = ({
  folder,
  onClose,
  onOpenResource,
  onCollectionMutated
}) => {
  const [page, setPage] = React.useState(1);
  const [items, setItems] = React.useState<TouchGalResource[]>([]);
  const [total, setTotal] = React.useState(0);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [activeUniqueId, setActiveUniqueId] = React.useState<string | null>(null);
  const [removingUniqueId, setRemovingUniqueId] = React.useState<string | null>(null);

  const loadPage = React.useCallback(
    async (targetPage: number, { silent = false }: { silent?: boolean } = {}) => {
      if (!folder?.id) return;
      if (!silent) {
        setIsLoading(true);
      }
      setError(null);
      try {
        const response = await TouchGalClient.getFavoriteFolderPatches(folder.id, targetPage, PAGE_SIZE);
        setItems(Array.isArray(response?.patches) ? response.patches : []);
        setTotal(typeof response?.total === 'number' ? response.total : 0);
      } catch (fetchError) {
        setError(fetchError instanceof Error ? fetchError.message : 'Failed to load cloud collection');
        setItems([]);
        setTotal(0);
      } finally {
        if (!silent) {
          setIsLoading(false);
        }
      }
    },
    [folder?.id]
  );

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  React.useEffect(() => {
    setPage(1);
  }, [folder?.id]);

  React.useEffect(() => {
    void loadPage(page);
  }, [loadPage, page]);

  const patchCount = typeof total === 'number' && total >= 0 ? total : folder?._count?.patch || 0;
  const isPublic = Boolean(folder?.is_public);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const handleOpenResource = async (resource: TouchGalResource) => {
    setActiveUniqueId(resource.uniqueId);
    try {
      await onOpenResource(resource);
    } finally {
      setActiveUniqueId(null);
    }
  };

  const handleRemoveFromFolder = async (resource: TouchGalResource) => {
    if (!resource.id || !folder?.id) return;
    setRemovingUniqueId(resource.uniqueId);
    setError(null);
    try {
      const result = await TouchGalClient.togglePatchFavorite(resource.id, folder.id);
      if (result?.added === true) {
        throw new Error('Cloud favorite toggle returned add instead of remove');
      }

      const nextTotal = Math.max(0, total - 1);
      const nextPage = nextTotal > 0 ? Math.min(page, Math.max(1, Math.ceil(nextTotal / PAGE_SIZE))) : 1;

      if (nextPage !== page) {
        setPage(nextPage);
      } else {
        await loadPage(nextPage, { silent: true });
      }

      if (onCollectionMutated) {
        await onCollectionMutated();
      }
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : 'Failed to remove game from cloud collection');
    } finally {
      setRemovingUniqueId(null);
    }
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

        <div className="flex-1 overflow-y-auto p-5 md:p-8">
          <div className="mx-auto flex max-w-5xl flex-col gap-6">
            <section className="rounded-[2rem] border border-slate-200 bg-linear-to-r from-white via-slate-50 to-emerald-50 p-6 shadow-sm">
              <div className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-[11px] font-black uppercase tracking-[0.25em] text-slate-500 shadow-sm">
                <Cloud size={14} className="text-emerald-500" />
                Cloud Collection
              </div>

              <h3 className="mt-4 text-3xl font-black tracking-tight text-slate-900">{folder?.name || 'Untitled Collection'}</h3>
              <p className="mt-2 text-sm font-bold leading-6 text-slate-500">
                已接通云端收藏夹内容接口。这里展示当前文件夹里的游戏列表，并支持分页、打开详情和直接移出云收藏夹。
              </p>

              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <div className="rounded-[1.5rem] border border-white bg-white/90 p-4 shadow-sm">
                  <div className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Visibility</div>
                  <div className="mt-3 flex items-center gap-2 text-base font-black text-slate-900">
                    {isPublic ? <Unlock size={16} className="text-emerald-500" /> : <Lock size={16} className="text-slate-500" />}
                    <span>{isPublic ? 'Public' : 'Private'}</span>
                  </div>
                </div>
                <div className="rounded-[1.5rem] border border-white bg-white/90 p-4 shadow-sm">
                  <div className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Items</div>
                  <div className="mt-3 text-2xl font-black text-slate-900">{patchCount}</div>
                </div>
                <div className="rounded-[1.5rem] border border-white bg-white/90 p-4 shadow-sm">
                  <div className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Page</div>
                  <div className="mt-3 text-2xl font-black text-emerald-600">{page}</div>
                </div>
              </div>
            </section>

            <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h4 className="text-lg font-black text-slate-900">云端游戏列表</h4>
                  <p className="mt-1 text-sm font-bold text-slate-400">
                    {isLoading ? '正在获取收藏夹内容...' : `共 ${total} 项，当前第 ${page} / ${totalPages} 页`}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition-all hover:border-slate-300 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                    disabled={isLoading || page <= 1}
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                    type="button"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <button
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition-all hover:border-slate-300 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                    disabled={isLoading || page >= totalPages}
                    onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                    type="button"
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>

              {error && (
                <div className="mt-5 rounded-3xl border border-rose-100 bg-rose-50 px-5 py-4 text-sm font-bold text-rose-600">
                  {error}
                </div>
              )}

              {isLoading ? (
                <div className="mt-5 flex min-h-60 items-center justify-center">
                  <div className="relative">
                    <div className="h-14 w-14 rounded-full border-4 border-slate-200" />
                    <div className="absolute inset-0 h-14 w-14 animate-spin rounded-full border-4 border-transparent border-t-emerald-500 border-r-emerald-500" />
                  </div>
                </div>
              ) : items.length === 0 ? (
                <div className="mt-5 rounded-[1.75rem] border border-dashed border-slate-200 px-6 py-14 text-center">
                  <div className="text-lg font-black text-slate-800">收藏夹为空</div>
                  <div className="mt-2 text-sm font-bold text-slate-400">这个云端收藏夹目前没有可展示的游戏。</div>
                </div>
              ) : (
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  {items.map((item) => (
                    <article
                      key={item.uniqueId}
                      className="relative flex gap-4 rounded-[1.5rem] border border-slate-100 bg-slate-50 p-4 transition-all hover:border-emerald-200 hover:bg-white hover:shadow-md"
                    >
                      <button
                        className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition-all hover:border-rose-200 hover:bg-rose-50 hover:text-rose-500 disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={!!removingUniqueId || isLoading}
                        onClick={() => void handleRemoveFromFolder(item)}
                        type="button"
                      >
                        {removingUniqueId === item.uniqueId ? <Loader2 className="animate-spin" size={16} /> : <Trash2 size={16} />}
                      </button>

                      <button
                        className="h-24 w-28 shrink-0 overflow-hidden rounded-2xl bg-slate-200"
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

                      <div className="min-w-0 flex-1 pr-12">
                        <button
                          className="truncate text-left text-lg font-black text-slate-900 transition-colors hover:text-emerald-600"
                          onClick={() => void handleOpenResource(item)}
                          type="button"
                        >
                          {item.name}
                        </button>
                        <div className="mt-1 text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">{item.uniqueId}</div>
                        <div className="mt-3 flex flex-wrap gap-2 text-xs font-black">
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
                        <div className="mt-4 flex flex-wrap gap-3">
                          <button
                            className="rounded-2xl bg-emerald-500 px-4 py-2.5 text-sm font-black text-white transition-all hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
                            disabled={activeUniqueId === item.uniqueId || removingUniqueId === item.uniqueId}
                            onClick={() => void handleOpenResource(item)}
                            type="button"
                          >
                            {activeUniqueId === item.uniqueId ? '打开中...' : '打开详情'}
                          </button>
                          <button
                            className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-600 transition-all hover:border-rose-200 hover:bg-rose-50 hover:text-rose-500 disabled:cursor-not-allowed disabled:opacity-50"
                            disabled={!!removingUniqueId || activeUniqueId === item.uniqueId}
                            onClick={() => void handleRemoveFromFolder(item)}
                            type="button"
                          >
                            {removingUniqueId === item.uniqueId ? '移除中...' : '从云收藏夹移除'}
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
