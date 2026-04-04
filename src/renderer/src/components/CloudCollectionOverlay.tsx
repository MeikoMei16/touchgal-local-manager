import React from 'react';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Cloud,
  Loader2,
  Lock,
  MoveRight,
  Trash2,
  Unlock,
  X
} from 'lucide-react';
import { TouchGalClient } from '../data/TouchGalClient';
import type { TouchGalResource } from '../types';
import QuickDownloadPopoverButton from './QuickDownloadPopoverButton';

interface CloudCollectionOverlayProps {
  folder: any;
  allFolders?: any[];
  onClose: () => void;
  onOpenResource: (resource: TouchGalResource) => Promise<void>;
  onCollectionMutated?: () => Promise<void> | void;
}

const PAGE_SIZE = 24;

export const CloudCollectionOverlay: React.FC<CloudCollectionOverlayProps> = ({
  folder,
  allFolders = [],
  onClose,
  onOpenResource,
  onCollectionMutated
}) => {
  const [page, setPage] = React.useState(1);
  const [items, setItems] = React.useState<TouchGalResource[]>([]);
  const [total, setTotal] = React.useState(0);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [actionKey, setActionKey] = React.useState<string | null>(null);
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [bulkTargetId, setBulkTargetId] = React.useState<string>('');
  const [moveTargetById, setMoveTargetById] = React.useState<Record<string, string>>({});
  const scrollRef = React.useRef<HTMLDivElement>(null);

  const otherFolders = React.useMemo(
    () => allFolders.filter((candidate) => candidate?.id && candidate.id !== folder?.id),
    [allFolders, folder?.id]
  );

  const selectedSet = React.useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedItems = React.useMemo(
    () => items.filter((item) => selectedSet.has(item.uniqueId)),
    [items, selectedSet]
  );
  const allVisibleSelected = items.length > 0 && items.every((item) => selectedSet.has(item.uniqueId));
  const hasSelected = selectedIds.length > 0;

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

  React.useEffect(() => {
    setPage(1);
    setSelectedIds([]);
    setBulkTargetId('');
    setMoveTargetById({});
  }, [folder?.id]);

  React.useEffect(() => {
    void loadPage(page);
  }, [loadPage, page]);

  React.useEffect(() => {
    setSelectedIds((current) => current.filter((id) => items.some((item) => item.uniqueId === id)));
  }, [items]);

  const patchCount = typeof total === 'number' && total >= 0 ? total : folder?._count?.patch || 0;
  const isPublic = Boolean(folder?.is_public);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const handleOpenResource = async (resource: TouchGalResource) => {
    setActionKey(`open:${resource.uniqueId}`);
    try {
      await onOpenResource(resource);
    } finally {
      setActionKey((current) => (current === `open:${resource.uniqueId}` ? null : current));
    }
  };

  const ensureAddedToFolder = async (patchId: number, folderId: number) => {
    const first = await TouchGalClient.togglePatchFavorite(patchId, folderId);
    if (first?.added === true) return;

    const second = await TouchGalClient.togglePatchFavorite(patchId, folderId);
    if (second?.added === true) return;

    throw new Error('Failed to ensure game exists in target cloud collection');
  };

  const ensureRemovedFromCurrentFolder = async (patchId: number) => {
    const result = await TouchGalClient.togglePatchFavorite(patchId, folder.id);
    if (result?.added === false) return;

    if (result?.added === true) {
      await TouchGalClient.togglePatchFavorite(patchId, folder.id);
    }
    throw new Error('Failed to remove game from current cloud collection');
  };

  const refreshAfterMutation = async (removedCount: number) => {
    const nextTotal = Math.max(0, total - removedCount);
    const nextPage = nextTotal > 0 ? Math.min(page, Math.max(1, Math.ceil(nextTotal / PAGE_SIZE))) : 1;

    if (nextPage !== page) {
      setPage(nextPage);
    } else {
      await loadPage(nextPage, { silent: true });
    }

    if (onCollectionMutated) {
      await onCollectionMutated();
    }
  };

  const handleRemoveResource = async (resource: TouchGalResource) => {
    if (!resource.id || !folder?.id) return;
    setActionKey(`remove:${resource.uniqueId}`);
    setError(null);
    try {
      await ensureRemovedFromCurrentFolder(resource.id);
      await refreshAfterMutation(1);
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : 'Failed to remove game from cloud collection');
    } finally {
      setActionKey(null);
    }
  };

  const handleMoveResource = async (resource: TouchGalResource, targetFolderId: number) => {
    if (!resource.id || !targetFolderId) return;
    setActionKey(`move:${resource.uniqueId}:${targetFolderId}`);
    setError(null);
    try {
      await ensureAddedToFolder(resource.id, targetFolderId);
      await ensureRemovedFromCurrentFolder(resource.id);
      await refreshAfterMutation(1);
    } catch (moveError) {
      setError(moveError instanceof Error ? moveError.message : 'Failed to move game to another cloud collection');
    } finally {
      setActionKey(null);
    }
  };

  const handleBulkRemove = async () => {
    if (!hasSelected) return;
    setActionKey('bulk-remove');
    setError(null);
    try {
      for (const item of selectedItems) {
        if (!item.id) continue;
        await ensureRemovedFromCurrentFolder(item.id);
      }
      setSelectedIds([]);
      await refreshAfterMutation(selectedItems.length);
    } catch (bulkError) {
      setError(bulkError instanceof Error ? bulkError.message : 'Failed to bulk remove cloud collection items');
    } finally {
      setActionKey(null);
    }
  };

  const handleBulkMove = async () => {
    const targetFolderId = Number(bulkTargetId);
    if (!targetFolderId || !hasSelected) return;
    setActionKey(`bulk-move:${targetFolderId}`);
    setError(null);
    try {
      for (const item of selectedItems) {
        if (!item.id) continue;
        await ensureAddedToFolder(item.id, targetFolderId);
        await ensureRemovedFromCurrentFolder(item.id);
      }
      setSelectedIds([]);
      setBulkTargetId('');
      await refreshAfterMutation(selectedItems.length);
    } catch (bulkError) {
      setError(bulkError instanceof Error ? bulkError.message : 'Failed to bulk move cloud collection items');
    } finally {
      setActionKey(null);
    }
  };

  const toggleSelection = (uniqueId: string) => {
    setSelectedIds((current) =>
      current.includes(uniqueId) ? current.filter((id) => id !== uniqueId) : [...current, uniqueId]
    );
  };

  const toggleSelectAllVisible = () => {
    if (allVisibleSelected) {
      const visibleIds = new Set(items.map((item) => item.uniqueId));
      setSelectedIds((current) => current.filter((id) => !visibleIds.has(id)));
      return;
    }

    const merged = new Set(selectedIds);
    items.forEach((item) => merged.add(item.uniqueId));
    setSelectedIds(Array.from(merged));
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
            <section className="rounded-[2rem] border border-slate-200 bg-linear-to-r from-white via-slate-50 to-emerald-50 p-6 shadow-sm">
              <div className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-[11px] font-black uppercase tracking-[0.25em] text-slate-500 shadow-sm">
                <Cloud size={14} className="text-emerald-500" />
                Cloud Collection
              </div>

              <h3 className="mt-4 text-3xl font-black tracking-tight text-slate-900">{folder?.name || 'Untitled Collection'}</h3>
              <p className="mt-2 text-sm font-bold leading-6 text-slate-500">
                现在这层支持多选、批量移动到其它云收藏夹、批量移除，以及单卡片的快速转移操作。
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
                  <div className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Selected</div>
                  <div className="mt-3 text-2xl font-black text-emerald-600">{selectedIds.length}</div>
                </div>
              </div>
            </section>

            <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-4">
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

                {isLoading && (
                  <div className="rounded-[1.35rem] border border-emerald-100 bg-linear-to-r from-emerald-50 via-white to-slate-50 px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-emerald-600 shadow-sm">
                        <Loader2 size={18} className="animate-spin" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-black text-slate-900">正在连接云端收藏夹</div>
                        <div className="mt-1 text-xs font-bold text-slate-500">
                          正在读取「{folder?.name || '未命名收藏夹'}」中的游戏列表，网络较慢时会稍等一下。
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex flex-col gap-3 rounded-[1.5rem] border border-slate-100 bg-slate-50 p-4 xl:flex-row xl:items-center xl:justify-between">
                  <div className="flex flex-wrap gap-3">
                    <button
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-600 transition-all hover:border-emerald-300 hover:text-slate-900"
                      onClick={toggleSelectAllVisible}
                      type="button"
                    >
                      {allVisibleSelected ? '取消全选本页' : '全选本页'}
                    </button>
                    <button
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-600 transition-all hover:border-slate-300 hover:text-slate-900"
                      onClick={() => setSelectedIds([])}
                      type="button"
                    >
                      清空选择
                    </button>
                  </div>

                  <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
                    <select
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 outline-none"
                      onChange={(event) => setBulkTargetId(event.target.value)}
                      value={bulkTargetId}
                    >
                      <option value="">选择目标云收藏夹</option>
                      {otherFolders.map((candidate) => (
                        <option key={candidate.id} value={candidate.id}>
                          {candidate.name}
                        </option>
                      ))}
                    </select>
                    <div className="flex flex-wrap gap-3">
                      <button
                        className="rounded-2xl bg-emerald-500 px-4 py-2.5 text-sm font-black text-white transition-all hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={!hasSelected || !bulkTargetId || !!actionKey}
                        onClick={() => void handleBulkMove()}
                        type="button"
                      >
                        批量移动到其它收藏夹
                      </button>
                      <button
                        className="rounded-2xl bg-rose-500 px-4 py-2.5 text-sm font-black text-white transition-all hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={!hasSelected || !!actionKey}
                        onClick={() => void handleBulkRemove()}
                        type="button"
                      >
                        批量移除
                      </button>
                    </div>
                  </div>
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
                  {items.map((item) => {
                    const isSelected = selectedSet.has(item.uniqueId);
                    const moveTargetId = moveTargetById[item.uniqueId] ?? '';
                    const removeKey = `remove:${item.uniqueId}`;
                    const moveKey = moveTargetId ? `move:${item.uniqueId}:${moveTargetId}` : '';

                    return (
                      <article
                        key={item.uniqueId}
                        className={`relative overflow-hidden rounded-[1.75rem] border p-4 transition-all ${
                          isSelected
                            ? 'border-emerald-300 bg-linear-to-br from-white via-emerald-50/60 to-slate-50 shadow-lg shadow-emerald-100/50'
                            : 'border-slate-200 bg-linear-to-br from-white via-slate-50 to-slate-100/80 hover:border-emerald-200 hover:shadow-lg hover:shadow-slate-200/60'
                        }`}
                      >
                        <button
                          className={`absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full border transition-all ${
                            isSelected
                              ? 'border-emerald-500 bg-emerald-500 text-white'
                              : 'border-slate-200 bg-white text-slate-500 hover:border-emerald-300 hover:text-emerald-600'
                          }`}
                          onClick={() => toggleSelection(item.uniqueId)}
                          type="button"
                        >
                          <Check size={16} />
                        </button>

                        <div className="flex flex-col gap-3.5">
                          <button
                            className="relative block overflow-hidden rounded-[1.35rem] border border-slate-200/80 bg-radial-[at_top] from-white via-slate-100 to-slate-200"
                            onClick={() => void handleOpenResource(item)}
                            type="button"
                          >
                            <div className="flex aspect-[16/8.5] w-full items-center justify-center p-2.5">
                              {item.banner ? (
                                <img
                                  alt={item.name}
                                  className="max-h-full max-w-full object-contain transition-transform duration-500 hover:scale-[1.02]"
                                  src={item.banner}
                                />
                              ) : (
                                <div className="flex h-full items-center justify-center rounded-[1rem] border border-dashed border-slate-300 text-xs font-black uppercase tracking-[0.2em] text-slate-400">
                                  No Cover
                                </div>
                              )}
                            </div>
                            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-linear-to-t from-black/10 via-black/0 to-transparent" />
                          </button>

                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0 flex-1">
                              <button
                                className="line-clamp-2 text-left text-[1.45rem] leading-7 font-black tracking-tight text-slate-900 transition-colors hover:text-emerald-600"
                                onClick={() => void handleOpenResource(item)}
                                type="button"
                              >
                                {item.name}
                              </button>
                              <div className="mt-1.5 text-[12px] font-black uppercase tracking-[0.24em] text-slate-400">{item.uniqueId}</div>
                              <div className="mt-3 flex flex-wrap gap-2 text-xs font-black">
                                <span className="rounded-full bg-amber-50 px-3 py-1.5 text-amber-600">
                                  {item.averageRating ? item.averageRating.toFixed(1) : '暂无评分'}
                                </span>
                                <span className="rounded-full bg-slate-200 px-3 py-1.5 text-slate-600">
                                  {item.viewCount.toLocaleString()} 浏览
                                </span>
                                <span className="rounded-full bg-slate-200 px-3 py-1.5 text-slate-600">
                                  {item.downloadCount.toLocaleString()} 下载
                                </span>
                              </div>
                            </div>
                            <div className="shrink-0 pt-1">
                              <QuickDownloadPopoverButton
                                resourceId={item.id}
                                resourceName={item.name}
                                uniqueId={item.uniqueId}
                                buttonClassName="inline-flex h-11 w-11 items-center justify-center rounded-full border border-sky-200 bg-sky-50 text-sky-700 transition-all hover:bg-sky-100"
                                iconOnly
                              />
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 flex flex-col gap-3 rounded-[1.35rem] border border-slate-200/80 bg-white/80 p-3.5 shadow-sm">
                          <div className="flex flex-col gap-3">
                            <select
                              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 outline-none"
                              onChange={(event) =>
                                setMoveTargetById((current) => ({
                                  ...current,
                                  [item.uniqueId]: event.target.value
                                }))
                              }
                              value={moveTargetId}
                            >
                              <option value="">选择目标收藏夹</option>
                              {otherFolders.map((candidate) => (
                                <option key={candidate.id} value={candidate.id}>
                                  {candidate.name}
                                </option>
                              ))}
                            </select>
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                              <button
                                className="rounded-2xl border border-emerald-200 bg-white px-4 py-2.5 text-sm font-black text-emerald-700 transition-all hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50"
                                disabled={!moveTargetId || !!actionKey}
                                onClick={() => void handleMoveResource(item, Number(moveTargetId))}
                                type="button"
                              >
                                <span className="inline-flex items-center gap-2">
                                  <MoveRight size={15} />
                                  {actionKey === moveKey ? '移动中...' : '移动到其它收藏夹'}
                                </span>
                              </button>
                              <button
                                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-600 transition-all hover:border-rose-200 hover:bg-rose-50 hover:text-rose-500 disabled:cursor-not-allowed disabled:opacity-50"
                                disabled={!!actionKey}
                                onClick={() => void handleRemoveResource(item)}
                                type="button"
                              >
                                {actionKey === removeKey ? <Loader2 className="animate-spin" size={15} /> : <Trash2 size={15} />}
                                <span>{actionKey === removeKey ? '删除中...' : '从当前收藏夹删除'}</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};
