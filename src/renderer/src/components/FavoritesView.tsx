import React from 'react';
import {
  Check,
  Copy,
  FolderCog,
  FolderOpen,
  FolderPlus,
  Heart,
  Lock,
  Search,
  Trash2,
  User,
  X
} from 'lucide-react';
import type { TouchGalResource } from '../types';
import { useAuthStore, useUIStore } from '../store/useTouchGalStore';
import { useLocalCollectionStore } from '../store/localCollectionStore';
import type { LocalCollection, LocalCollectionGameInput, LocalCollectionItem } from '../types/electron';
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

const toCollectionGameInput = (item: LocalCollectionItem): LocalCollectionGameInput => ({
  id: item.resourceId,
  uniqueId: item.uniqueId,
  name: item.name,
  banner: item.banner,
  averageRating: item.averageRating,
  viewCount: item.viewCount,
  downloadCount: item.downloadCount
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
  allCollections: LocalCollection[];
  collection: LocalCollection;
  onAddToCollection: (collectionId: number, game: LocalCollectionGameInput) => Promise<void>;
  onClose: () => void;
  onDeleteCollection: (collectionId: number) => Promise<void>;
  onOpenResource: (item: LocalCollectionItem) => Promise<void>;
  onRemoveItem: (collectionId: number, uniqueId: string) => Promise<void>;
}

const CollectionOverlay: React.FC<CollectionOverlayProps> = ({
  actionError,
  allCollections,
  collection,
  onAddToCollection,
  onClose,
  onDeleteCollection,
  onOpenResource,
  onRemoveItem
}) => {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [selectionMode, setSelectionMode] = React.useState(false);
  const [bulkTargetId, setBulkTargetId] = React.useState<string>('');
  const [activeActionKey, setActiveActionKey] = React.useState<string | null>(null);
  const [activeManageId, setActiveManageId] = React.useState<string | null>(null);
  const [manageTargetId, setManageTargetId] = React.useState<Record<string, string>>({});
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    scrollRef.current?.focus();
  }, []);

  React.useEffect(() => {
    setSelectedIds([]);
    setSelectionMode(false);
    setBulkTargetId('');
    setActiveManageId(null);
  }, [collection.id]);

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
  const selectedSet = React.useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedItems = collection.items.filter((item) => selectedSet.has(item.uniqueId));
  const otherCollections = allCollections.filter((candidate) => candidate.id !== collection.id);
  const hasSelected = selectedIds.length > 0;
  const allVisibleSelected = filteredItems.length > 0 && filteredItems.every((item) => selectedSet.has(item.uniqueId));

  React.useEffect(() => {
    setSelectedIds((current) => current.filter((uniqueId) => collection.items.some((item) => item.uniqueId === uniqueId)));
  }, [collection.items]);

  const handleOpenResource = async (item: LocalCollectionItem) => {
    setActiveActionKey(`open:${item.uniqueId}`);
    try {
      await onOpenResource(item);
    } finally {
      setActiveActionKey((current) => (current === `open:${item.uniqueId}` ? null : current));
    }
  };

  const handleRemoveItem = async (uniqueId: string) => {
    setActiveActionKey(`remove:${uniqueId}`);
    try {
      await onRemoveItem(collection.id, uniqueId);
      setSelectedIds((current) => current.filter((id) => id !== uniqueId));
    } finally {
      setActiveActionKey((current) => (current === `remove:${uniqueId}` ? null : current));
    }
  };

  const handleDeleteCollection = async () => {
    setActiveActionKey('delete-collection');
    try {
      await onDeleteCollection(collection.id);
      onClose();
    } finally {
      setActiveActionKey((current) => (current === 'delete-collection' ? null : current));
    }
  };

  const toggleItemSelection = (uniqueId: string) => {
    setSelectedIds((current) =>
      current.includes(uniqueId) ? current.filter((id) => id !== uniqueId) : [...current, uniqueId]
    );
  };

  const handleToggleSelectAllVisible = () => {
    if (allVisibleSelected) {
      const visibleIds = new Set(filteredItems.map((item) => item.uniqueId));
      setSelectedIds((current) => current.filter((id) => !visibleIds.has(id)));
      return;
    }

    const merged = new Set(selectedIds);
    filteredItems.forEach((item) => merged.add(item.uniqueId));
    setSelectedIds(Array.from(merged));
  };

  const runBatch = async (items: LocalCollectionItem[], runner: (item: LocalCollectionItem) => Promise<void>) => {
    for (const item of items) {
      await runner(item);
    }
  };

  const handleCopyItem = async (item: LocalCollectionItem, targetCollectionId: number) => {
    setActiveActionKey(`copy:${item.uniqueId}:${targetCollectionId}`);
    try {
      await onAddToCollection(targetCollectionId, toCollectionGameInput(item));
      setActiveManageId(null);
    } finally {
      setActiveActionKey((current) =>
        current === `copy:${item.uniqueId}:${targetCollectionId}` ? null : current
      );
    }
  };

  const handleMoveItem = async (item: LocalCollectionItem, targetCollectionId: number) => {
    setActiveActionKey(`move:${item.uniqueId}:${targetCollectionId}`);
    try {
      await onAddToCollection(targetCollectionId, toCollectionGameInput(item));
      await onRemoveItem(collection.id, item.uniqueId);
      setSelectedIds((current) => current.filter((id) => id !== item.uniqueId));
      setActiveManageId(null);
    } finally {
      setActiveActionKey((current) =>
        current === `move:${item.uniqueId}:${targetCollectionId}` ? null : current
      );
    }
  };

  const handleBulkRemove = async () => {
    if (!hasSelected) return;
    setActiveActionKey('bulk-remove');
    try {
      await runBatch(selectedItems, async (item) => {
        await onRemoveItem(collection.id, item.uniqueId);
      });
      setSelectedIds([]);
      setSelectionMode(false);
    } finally {
      setActiveActionKey((current) => (current === 'bulk-remove' ? null : current));
    }
  };

  const handleBulkCopy = async () => {
    const targetCollectionId = Number(bulkTargetId);
    if (!targetCollectionId || !hasSelected) return;
    setActiveActionKey(`bulk-copy:${targetCollectionId}`);
    try {
      await runBatch(selectedItems, async (item) => {
        await onAddToCollection(targetCollectionId, toCollectionGameInput(item));
      });
      setActiveManageId(null);
    } finally {
      setActiveActionKey((current) =>
        current === `bulk-copy:${targetCollectionId}` ? null : current
      );
    }
  };

  const handleBulkMove = async () => {
    const targetCollectionId = Number(bulkTargetId);
    if (!targetCollectionId || !hasSelected) return;
    setActiveActionKey(`bulk-move:${targetCollectionId}`);
    try {
      await runBatch(selectedItems, async (item) => {
        await onAddToCollection(targetCollectionId, toCollectionGameInput(item));
        await onRemoveItem(collection.id, item.uniqueId);
      });
      setSelectedIds([]);
      setSelectionMode(false);
      setBulkTargetId('');
    } finally {
      setActiveActionKey((current) =>
        current === `bulk-move:${targetCollectionId}` ? null : current
      );
    }
  };

  return (
    <div className="fixed inset-0 z-[1100] flex justify-center bg-slate-950/55 backdrop-blur-md" onClick={onClose}>
      <div
        className="relative flex h-full w-full max-w-7xl flex-col overflow-hidden bg-[#f7f4ee] shadow-2xl"
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
          className="flex-1 overflow-y-auto p-4 outline-none md:p-8"
        >
          <div className="mx-auto flex max-w-6xl flex-col gap-6">
            <section className="overflow-hidden rounded-[2.25rem] border border-[#e8e0d2] bg-white shadow-sm">
              <div className="grid gap-0 lg:grid-cols-[1.2fr_0.8fr]">
                <div className="relative min-h-[240px] overflow-hidden bg-linear-to-br from-[#d8c7ad] via-[#bca17c] to-[#7f6344] p-6 text-white">
                  {collection.items[0]?.banner ? (
                    <img
                      alt={collection.items[0].name}
                      className="absolute inset-0 h-full w-full object-cover opacity-30"
                      src={collection.items[0].banner}
                    />
                  ) : null}
                  <div className="absolute inset-0 bg-linear-to-tr from-black/45 via-black/10 to-transparent" />
                  <div className="relative flex h-full flex-col justify-between">
                    <div className="inline-flex w-fit items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-[11px] font-black uppercase tracking-[0.28em] text-white/90 backdrop-blur-sm">
                      <FolderOpen size={14} />
                      Local Collection
                    </div>

                    <div>
                      <h3 className="max-w-2xl text-4xl font-black tracking-tight">{collection.name}</h3>
                      <p className="mt-3 max-w-xl text-sm font-bold leading-6 text-white/80">
                        像画廊一样浏览这个收藏夹，支持批量选择、快速换文件夹、移出当前收藏夹，以及直接叠层打开详情页。
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 p-6">
                  <div className="rounded-[1.6rem] bg-[#faf6ef] p-4">
                    <div className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Games</div>
                    <div className="mt-3 text-3xl font-black text-slate-900">{collection.itemCount}</div>
                  </div>
                  <div className="rounded-[1.6rem] bg-[#faf6ef] p-4">
                    <div className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Avg</div>
                    <div className="mt-3 text-3xl font-black text-amber-600">
                      {averageRating > 0 ? averageRating.toFixed(1) : '–'}
                    </div>
                  </div>
                  <div className="rounded-[1.6rem] bg-[#faf6ef] p-4">
                    <div className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Downloads</div>
                    <div className="mt-3 text-3xl font-black text-slate-900">{totalDownloads.toLocaleString()}</div>
                  </div>
                  <div className="flex flex-col justify-between rounded-[1.6rem] bg-[#faf6ef] p-4">
                    <div className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Manage</div>
                    <button
                      className="mt-3 rounded-2xl bg-rose-500 px-4 py-3 text-sm font-black text-white transition-all hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={activeActionKey === 'delete-collection'}
                      onClick={() => void handleDeleteCollection()}
                      type="button"
                    >
                      {activeActionKey === 'delete-collection' ? '处理中...' : '删除收藏夹'}
                    </button>
                  </div>
                </div>
              </div>

              <div className="border-t border-[#efe8db] bg-[#fcfaf6] p-5">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                  <div className="relative xl:max-w-md xl:flex-1">
                    <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      className="w-full rounded-2xl border border-[#e8e0d2] bg-white px-11 py-3 text-sm font-bold text-slate-800 outline-none transition-all focus:border-[#b99867]"
                      onChange={(event) => setSearchQuery(event.target.value)}
                      placeholder="搜索这个收藏夹里的游戏"
                      value={searchQuery}
                    />
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <button
                      className={`rounded-2xl px-4 py-3 text-sm font-black transition-all ${
                        selectionMode || hasSelected
                          ? 'bg-slate-900 text-white'
                          : 'border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900'
                      }`}
                      onClick={() => {
                        if (selectionMode && !hasSelected) {
                          setSelectionMode(false);
                          return;
                        }
                        setSelectionMode((current) => !current);
                        if (selectionMode && !hasSelected) {
                          setSelectedIds([]);
                        }
                      }}
                      type="button"
                    >
                      {selectionMode || hasSelected ? `批量模式 ${selectedIds.length}` : '开启批量选择'}
                    </button>
                    <button
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-600 transition-all hover:border-slate-300 hover:text-slate-900"
                      onClick={onClose}
                      type="button"
                    >
                      返回收藏页
                    </button>
                  </div>
                </div>

                <div className="mt-4 flex flex-col gap-3 rounded-[1.75rem] border border-[#eee6d8] bg-white p-4 xl:flex-row xl:items-center xl:justify-between">
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-600 transition-all hover:border-[#c7af85] hover:text-slate-900"
                      onClick={handleToggleSelectAllVisible}
                      type="button"
                    >
                      {allVisibleSelected ? '取消全选当前结果' : '全选当前结果'}
                    </button>
                    <button
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-600 transition-all hover:border-slate-300 hover:text-slate-900"
                      onClick={() => {
                        setSelectedIds([]);
                        setSelectionMode(false);
                      }}
                      type="button"
                    >
                      清空选择
                    </button>
                    <div className="rounded-full bg-[#f5efe5] px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                      {filteredItems.length === collection.items.length
                        ? `共 ${collection.items.length} 项`
                        : `筛选 ${filteredItems.length} / ${collection.items.length}`}
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
                    <select
                      className="rounded-2xl border border-[#e8e0d2] bg-white px-4 py-2.5 text-sm font-bold text-slate-700 outline-none"
                      onChange={(event) => setBulkTargetId(event.target.value)}
                      value={bulkTargetId}
                    >
                      <option value="">选择目标收藏夹</option>
                      {otherCollections.map((candidate) => (
                        <option key={candidate.id} value={candidate.id}>
                          {candidate.name}
                        </option>
                      ))}
                    </select>
                    <div className="flex flex-wrap gap-3">
                      <button
                        className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-600 transition-all hover:border-[#c7af85] hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={!hasSelected || !bulkTargetId || !!activeActionKey}
                        onClick={() => void handleBulkCopy()}
                        type="button"
                      >
                        批量复制
                      </button>
                      <button
                        className="rounded-2xl bg-[#b17c3d] px-4 py-2.5 text-sm font-black text-white transition-all hover:bg-[#99652f] disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={!hasSelected || !bulkTargetId || !!activeActionKey}
                        onClick={() => void handleBulkMove()}
                        type="button"
                      >
                        批量移动
                      </button>
                      <button
                        className="rounded-2xl bg-rose-500 px-4 py-2.5 text-sm font-black text-white transition-all hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={!hasSelected || !!activeActionKey}
                        onClick={() => void handleBulkRemove()}
                        type="button"
                      >
                        批量移出
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {actionError && (
              <div className="rounded-3xl border border-rose-100 bg-rose-50 px-5 py-4 text-sm font-bold text-rose-600">
                {actionError}
              </div>
            )}

            {filteredItems.length === 0 ? (
              <div className="rounded-[2rem] border border-dashed border-[#ddd1be] bg-white px-6 py-16 text-center shadow-sm">
                <div className="text-lg font-black text-slate-800">没有匹配到结果</div>
                <div className="mt-2 text-sm font-bold text-slate-400">换个关键词试试，或者清空搜索。</div>
              </div>
            ) : (
              <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {filteredItems.map((item) => {
                  const isSelected = selectedSet.has(item.uniqueId);
                  const manageTargetValue = manageTargetId[item.uniqueId] ?? '';
                  const openKey = `open:${item.uniqueId}`;
                  const removeKey = `remove:${item.uniqueId}`;
                  const copyKey = manageTargetValue ? `copy:${item.uniqueId}:${manageTargetValue}` : '';
                  const moveKey = manageTargetValue ? `move:${item.uniqueId}:${manageTargetValue}` : '';

                  return (
                    <article
                      key={`${collection.id}-${item.uniqueId}`}
                      className={`group overflow-hidden rounded-[2rem] border bg-white shadow-sm transition-all ${
                        isSelected
                          ? 'border-[#c99d65] shadow-lg shadow-[#cfb289]/20'
                          : 'border-[#e8e0d2] hover:-translate-y-1 hover:border-[#d5b486] hover:shadow-lg hover:shadow-[#d9c5a0]/20'
                      }`}
                    >
                      <div className="relative">
                        <button
                          className="block h-52 w-full overflow-hidden bg-[#ebe3d5]"
                          onClick={() => void handleOpenResource(item)}
                          type="button"
                        >
                          {item.banner ? (
                            <img
                              alt={item.name}
                              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                              src={item.banner}
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center text-xs font-black uppercase tracking-[0.2em] text-slate-400">
                              No Cover
                            </div>
                          )}
                        </button>

                        <button
                          className={`absolute left-4 top-4 flex h-10 w-10 items-center justify-center rounded-full border transition-all ${
                            isSelected
                              ? 'border-white bg-slate-900 text-white'
                              : 'border-white/70 bg-white/85 text-slate-500 hover:text-slate-900'
                          }`}
                          onClick={() => toggleItemSelection(item.uniqueId)}
                          type="button"
                        >
                          <Check size={16} />
                        </button>

                        <button
                          className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full border border-white/70 bg-white/85 text-slate-500 transition-all hover:bg-rose-50 hover:text-rose-500"
                          disabled={activeActionKey === removeKey}
                          onClick={() => void handleRemoveItem(item.uniqueId)}
                          type="button"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>

                      <div className="space-y-4 p-5">
                        <div>
                          <button
                            className="line-clamp-2 text-left text-lg font-black leading-6 text-slate-900 transition-colors hover:text-[#9a6230]"
                            onClick={() => void handleOpenResource(item)}
                            type="button"
                          >
                            {item.name}
                          </button>
                          <div className="mt-2 text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">
                            {item.uniqueId}
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2 text-xs font-black">
                          <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-600">
                            {item.averageRating ? item.averageRating.toFixed(1) : '暂无评分'}
                          </span>
                          <span className="rounded-full bg-[#f5efe5] px-3 py-1 text-slate-600">
                            {item.viewCount.toLocaleString()} 浏览
                          </span>
                          <span className="rounded-full bg-[#f5efe5] px-3 py-1 text-slate-600">
                            {item.downloadCount.toLocaleString()} 下载
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <button
                            className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-black text-white transition-all hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                            disabled={!!activeActionKey && activeActionKey !== openKey}
                            onClick={() => void handleOpenResource(item)}
                            type="button"
                          >
                            {activeActionKey === openKey ? '打开中...' : '打开详情'}
                          </button>
                          <button
                            className={`rounded-2xl border px-4 py-3 text-sm font-black transition-all ${
                              activeManageId === item.uniqueId
                                ? 'border-[#b17c3d] bg-[#f7efe4] text-[#8a5b27]'
                                : 'border-[#e8e0d2] bg-white text-slate-600 hover:border-[#cdb38d] hover:text-slate-900'
                            }`}
                            onClick={() =>
                              setActiveManageId((current) => (current === item.uniqueId ? null : item.uniqueId))
                            }
                            type="button"
                          >
                            <span className="inline-flex items-center gap-2">
                              <FolderCog size={16} />
                              更换收藏夹
                            </span>
                          </button>
                        </div>

                        {activeManageId === item.uniqueId && (
                          <div className="rounded-[1.6rem] border border-[#e8e0d2] bg-[#fcfaf6] p-4">
                            {otherCollections.length === 0 ? (
                              <div className="text-sm font-bold text-slate-400">
                                先创建第二个本地收藏夹，才能执行快速转移。
                              </div>
                            ) : (
                              <div className="space-y-3">
                                <select
                                  className="w-full rounded-2xl border border-[#e8e0d2] bg-white px-4 py-3 text-sm font-bold text-slate-700 outline-none"
                                  onChange={(event) =>
                                    setManageTargetId((current) => ({
                                      ...current,
                                      [item.uniqueId]: event.target.value
                                    }))
                                  }
                                  value={manageTargetValue}
                                >
                                  <option value="">选择目标收藏夹</option>
                                  {otherCollections.map((candidate) => (
                                    <option key={candidate.id} value={candidate.id}>
                                      {candidate.name}
                                    </option>
                                  ))}
                                </select>
                                <div className="grid grid-cols-2 gap-3">
                                  <button
                                    className="rounded-2xl border border-[#d7c0a1] bg-white px-4 py-3 text-sm font-black text-[#9a6230] transition-all hover:bg-[#f7efe4] disabled:cursor-not-allowed disabled:opacity-50"
                                    disabled={!manageTargetValue || !!activeActionKey}
                                    onClick={() => void handleCopyItem(item, Number(manageTargetValue))}
                                    type="button"
                                  >
                                    <span className="inline-flex items-center gap-2">
                                      <Copy size={15} />
                                      {activeActionKey === copyKey ? '复制中...' : '复制过去'}
                                    </span>
                                  </button>
                                  <button
                                    className="rounded-2xl bg-[#b17c3d] px-4 py-3 text-sm font-black text-white transition-all hover:bg-[#99652f] disabled:cursor-not-allowed disabled:opacity-50"
                                    disabled={!manageTargetValue || !!activeActionKey}
                                    onClick={() => void handleMoveItem(item, Number(manageTargetValue))}
                                    type="button"
                                  >
                                    {activeActionKey === moveKey ? '移动中...' : '移动过去'}
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </article>
                  );
                })}
              </section>
            )}
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
    addToCollection,
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

  const handleAddToCollection = async (collectionId: number, game: LocalCollectionGameInput) => {
    setActionError(null);
    try {
      await addToCollection(collectionId, game);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Failed to update collection');
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
          allCollections={collections}
          collection={selectedCollection}
          onAddToCollection={handleAddToCollection}
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
