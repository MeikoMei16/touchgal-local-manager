import React from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Database,
  Funnel,
  Folder,
  FolderPlus,
  Gamepad2,
  Search,
  RefreshCw,
  Trash2
} from 'lucide-react';
import { useUIStore } from '../store/useTouchGalStore';
import type { LibraryRoot, LinkedLocalGame, LocalFolder } from '../types/electron';
import LocalGameWindow from './LocalGameWindow';

const formatTimestamp = (value: string | null) => {
  if (!value) return '尚未扫描';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('zh-CN');
};

const formatPathTail = (value: string) => {
  const normalized = value.replace(/\\/g, '/');
  const parts = normalized.split('/').filter(Boolean);
  return parts[parts.length - 1] ?? value;
};

const normalizeSearchToken = (value: string) =>
  value
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[_\-./\\()[\]{}"'`~!@#$%^&*+=|:;，。、《》？、·]/g, '');

const isSubsequenceMatch = (needle: string, haystack: string) => {
  if (!needle) return true;
  let index = 0;
  for (const char of haystack) {
    if (char === needle[index]) {
      index += 1;
      if (index === needle.length) return true;
    }
  }
  return false;
};

const matchesLibraryNameFuzzy = (query: string, candidates: string[]) => {
  const normalizedQuery = normalizeSearchToken(query);
  if (!normalizedQuery) return true;

  return candidates.some((candidate) => {
    const normalizedCandidate = normalizeSearchToken(candidate);
    if (!normalizedCandidate) return false;
    return normalizedCandidate.includes(normalizedQuery) || isSubsequenceMatch(normalizedQuery, normalizedCandidate);
  });
};

type LibraryCollectionKey =
  | 'all'
  | 'installed'
  | 'downloaded'
  | 'manual'
  | 'scan'
  | 'needs_attention'
  | 'broken';

type LibrarySortKey = 'recent' | 'opened';

export const Library: React.FC = () => {
  const pushToast = useUIStore((state) => state.pushToast);
  const libraryManageOpenMode = useUIStore((state) => state.libraryManageOpenMode);

  const [roots, setRoots] = React.useState<LibraryRoot[]>([]);
  const [linkedGames, setLinkedGames] = React.useState<LinkedLocalGame[]>([]);
  const [lastScanFolders, setLastScanFolders] = React.useState<LocalFolder[]>([]);
  const [manualRootPath, setManualRootPath] = React.useState('');
  const [isBootLoading, setIsBootLoading] = React.useState(true);
  const [isScanning, setIsScanning] = React.useState(false);
  const [isPickingRoot, setIsPickingRoot] = React.useState(false);
  const [isSavingRoot, setIsSavingRoot] = React.useState(false);
  const [removingRootId, setRemovingRootId] = React.useState<number | null>(null);
  const [selectedGameIds, setSelectedGameIds] = React.useState<number[]>([]);
  const [isDeletingSelectedGames, setIsDeletingSelectedGames] = React.useState(false);
  const [activeLocalGame, setActiveLocalGame] = React.useState<LinkedLocalGame | null>(null);
  const [searchValue, setSearchValue] = React.useState('');
  const [selectedCollection, setSelectedCollection] = React.useState<LibraryCollectionKey>('all');
  const [sortBy, setSortBy] = React.useState<LibrarySortKey>('recent');

  const unresolvedFolders = lastScanFolders.filter((folder) => folder.matchState === 'unresolved');
  const orphanedFolders = lastScanFolders.filter((folder) => folder.matchState === 'orphaned');
  const brokenGames = linkedGames.filter((game) => game.status === 'broken');
  const isAllGamesSelected = linkedGames.length > 0 && selectedGameIds.length === linkedGames.length;
  const hasSelectedGames = selectedGameIds.length > 0;

  const collectionItems = React.useMemo(() => {
    const items: Array<{ key: LibraryCollectionKey; label: string; description: string; count: number }> = [
      {
        key: 'all',
        label: '全部游戏',
        description: '当前本地库里所有已关联条目',
        count: linkedGames.length,
      },
      {
        key: 'installed',
        label: '已安装',
        description: '状态稳定，可直接进入管理',
        count: linkedGames.filter((game) => game.status !== 'broken').length,
      },
      {
        key: 'downloaded',
        label: '下载导入',
        description: '由下载器自动解压并接入',
        count: linkedGames.filter((game) => game.source === 'download').length,
      },
      {
        key: 'manual',
        label: '手动导入',
        description: '人工加入或整理的本地目录',
        count: linkedGames.filter((game) => game.source === 'manual').length,
      },
      {
        key: 'scan',
        label: '扫描发现',
        description: '由目录扫描链路识别出的条目',
        count: linkedGames.filter((game) => game.source === 'scan').length,
      },
      {
        key: 'needs_attention',
        label: '待处理',
        description: '需要人工确认或修复的条目',
        count: unresolvedFolders.length + orphanedFolders.length + brokenGames.length,
      },
      {
        key: 'broken',
        label: 'Broken',
        description: '路径失效或目标已丢失',
        count: brokenGames.length,
      },
    ];

    return items.filter((item) => item.count > 0 || item.key === 'all' || item.key === 'needs_attention');
  }, [brokenGames.length, linkedGames, orphanedFolders.length, unresolvedFolders.length]);

  const visibleGames = React.useMemo(() => {
    const normalizedQuery = searchValue.trim();
    const filtered = linkedGames.filter((game) => {
      const matchesCollection =
        selectedCollection === 'all'
          ? true
          : selectedCollection === 'installed'
            ? game.status !== 'broken'
            : selectedCollection === 'downloaded'
              ? game.source === 'download'
              : selectedCollection === 'manual'
                ? game.source === 'manual'
                : selectedCollection === 'scan'
                  ? game.source === 'scan'
                  : selectedCollection === 'broken'
                    ? game.status === 'broken'
                    : false;

      if (!matchesCollection) return false;
      if (!normalizedQuery) return true;

      return matchesLibraryNameFuzzy(normalizedQuery, [
        game.name ?? '',
        ...(game.alias ?? []),
      ]);
    });

    const sorted = [...filtered];
    sorted.sort((a, b) => {
      if (sortBy === 'opened') {
        return new Date(b.last_opened_at ?? 0).getTime() - new Date(a.last_opened_at ?? 0).getTime();
      }
      return new Date(b.linked_at).getTime() - new Date(a.linked_at).getTime();
    });

    return sorted;
  }, [linkedGames, searchValue, selectedCollection, sortBy]);

  const hydrateLibrary = async () => {
    setIsBootLoading(true);
    try {
      const [nextRoots, nextLinked] = await Promise.all([
        window.api.listLibraryRoots(),
        window.api.listLinkedLocalGames()
      ]);
      setRoots(nextRoots);
      setLinkedGames(nextLinked);
    } catch (error) {
      pushToast(error instanceof Error ? error.message : '加载本地库失败');
    } finally {
      setIsBootLoading(false);
    }
  };

  React.useEffect(() => {
    void hydrateLibrary();
  }, []);

  React.useEffect(() => {
    setSelectedGameIds((current) => current.filter((id) => linkedGames.some((game) => game.id === id)));
  }, [linkedGames]);

  const handleAddRoot = async (candidatePath: string) => {
    const normalized = candidatePath.trim();
    if (!normalized) return;

    setIsSavingRoot(true);
    try {
      const nextRoots = await window.api.addLibraryRoot(normalized);
      setRoots(nextRoots);
      setManualRootPath('');
      pushToast('监控目录已添加');
    } catch (error) {
      pushToast(error instanceof Error ? error.message : '添加目录失败');
    } finally {
      setIsSavingRoot(false);
    }
  };

  const handlePickRoot = async () => {
    setIsPickingRoot(true);
    try {
      const selected = await window.api.pickLibraryRoot();
      if (!selected) return;
      setManualRootPath(selected);
      await handleAddRoot(selected);
    } catch (error) {
      pushToast(error instanceof Error ? error.message : '无法选择目录');
    } finally {
      setIsPickingRoot(false);
    }
  };

  const handleRemoveRoot = async (rootId: number) => {
    setRemovingRootId(rootId);
    try {
      const nextRoots = await window.api.removeLibraryRoot(rootId);
      setRoots(nextRoots);
      pushToast('监控目录已移除');
    } catch (error) {
      pushToast(error instanceof Error ? error.message : '移除目录失败');
    } finally {
      setRemovingRootId(null);
    }
  };

  const handleRescan = async () => {
    setIsScanning(true);
    try {
      const result = await window.api.rescanLibrary();
      setRoots(result.roots);
      setLinkedGames(result.linkedGames);
      setLastScanFolders(result.folders);
      pushToast(`扫描完成，发现 ${result.folders.length} 个候选游戏文件夹`);
    } catch (error) {
      pushToast(error instanceof Error ? error.message : '扫描失败');
    } finally {
      setIsScanning(false);
    }
  };

  const handleRevealGameDirectory = async (game: LinkedLocalGame) => {
    try {
      await window.api.markLocalGameOpened(game.id);
      const result = await window.api.revealPath(game.path);
      if (!result.success) {
        throw new Error('打开目录失败');
      }
      setLinkedGames((current) =>
        current.map((item) =>
          item.id === game.id
            ? { ...item, last_opened_at: new Date().toISOString() }
            : item
        )
      );
    } catch (error) {
      pushToast(error instanceof Error ? error.message : '打开目录失败');
    }
  };

  const handleOpenLocalGameWindow = async (game: LinkedLocalGame) => {
    if (libraryManageOpenMode === 'window') {
      try {
        const result = await window.api.openLocalGameWindow(game.id);
        if (!result.success) {
          throw new Error('打开本地游戏窗口失败');
        }
        return;
      } catch (error) {
        pushToast(error instanceof Error ? error.message : '打开本地游戏窗口失败');
      }
    }

    setActiveLocalGame(game);
  };

  const toggleGameSelected = (gameId: number) => {
    setSelectedGameIds((current) =>
      current.includes(gameId)
        ? current.filter((id) => id !== gameId)
        : [...current, gameId]
    );
  };

  const handleToggleSelectAllGames = () => {
    setSelectedGameIds(isAllGamesSelected ? [] : linkedGames.map((game) => game.id));
  };

  const handleDeleteSelectedGames = async () => {
    if (!hasSelectedGames) return;

    const confirmed = window.confirm(
      `删除所选 ${selectedGameIds.length} 个本地库条目，并删除这些 library 路径上的真实文件夹？该操作不会删除线上游戏数据，但会移除本地文件和 local_paths 记录。`
    );
    if (!confirmed) return;

    setIsDeletingSelectedGames(true);
    try {
      const result = await window.api.deleteLibraryGamesAndFiles(selectedGameIds);
      setSelectedGameIds((current) => current.filter((id) => !result.deletedIds.includes(id)));
      await hydrateLibrary();

      const skippedNote = result.skippedPaths.length > 0
        ? `，跳过 ${result.skippedPaths.length} 个越界或失败路径`
        : '';
      pushToast(`已删除 ${result.deletedIds.length} 个本地库目录${skippedNote}`);
    } catch (error) {
      pushToast(error instanceof Error ? error.message : '批量删除本地库目录失败');
    } finally {
      setIsDeletingSelectedGames(false);
    }
  };

  return (
    <>
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 p-4 md:p-8">
        <section className="overflow-hidden rounded-[2.2rem] border border-slate-200 bg-white shadow-sm">
          <div className="bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.14),_transparent_36%),linear-gradient(135deg,_#ffffff_0%,_#f9fbff_58%,_#eef6ff_100%)] px-6 py-6 md:px-8">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex items-center gap-4 text-slate-900">
                <div className="flex h-13 w-13 items-center justify-center rounded-2xl bg-sky-100 text-sky-700 shadow-sm">
                  <Database size={24} />
                </div>
                <div>
                  <h1 className="text-3xl font-black tracking-tight">本地库</h1>
              <p className="mt-1 text-sm font-medium leading-7 text-slate-500">
                先看游戏，再进管理。下载内容默认进入 <span className="font-mono text-[13px]">library/</span>，重操作下沉到 popup 或独立窗口。
              </p>
              <p className="mt-1 text-xs font-bold text-slate-400">
                TODO: 恢复“启动游戏 / 多可执行文件手动选择”入口，但不要重新把卡片做回信息过载。
              </p>
            </div>
              </div>

              <div className="flex flex-col gap-3 lg:min-w-[34rem] lg:flex-row">
                <label className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl border border-slate-200 bg-white/85 px-4 py-3 shadow-sm">
                  <Search size={16} className="text-slate-400" />
                  <input
                    type="text"
                    value={searchValue}
                    onChange={(event) => setSearchValue(event.target.value)}
                    placeholder="搜索本地游戏名或别名"
                    className="min-w-0 flex-1 bg-transparent text-sm font-bold text-slate-800 outline-none"
                  />
                </label>

                <label className="inline-flex items-center gap-3 rounded-2xl border border-slate-200 bg-white/85 px-4 py-3 text-sm font-black text-slate-700 shadow-sm">
                  <Funnel size={16} className="text-slate-400" />
                  <span>排序</span>
                  <select
                    value={sortBy}
                    onChange={(event) => setSortBy(event.target.value as LibrarySortKey)}
                    className="bg-transparent text-sm font-black text-slate-800 outline-none"
                  >
                    <option value="recent">最近加入</option>
                    <option value="opened">最近打开</option>
                  </select>
                </label>
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[240px_minmax(0,1fr)_300px]">
        <aside className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4 px-2">
            <h2 className="text-[1.15rem] font-black text-slate-900">分组</h2>
            <p className="mt-1 text-sm font-medium text-slate-500">组织层</p>
          </div>

          <div className="flex flex-col gap-3">
            {collectionItems.map((item) => {
              const isActive = selectedCollection === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setSelectedCollection(item.key)}
                  className={`rounded-[1.35rem] border px-4 py-4 text-left transition-all ${
                    isActive
                      ? 'border-cyan-300 bg-cyan-50 shadow-sm shadow-cyan-100/60'
                      : 'border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-black text-slate-900">{item.label}</div>
                      <div className="mt-1 text-[12px] font-medium leading-5 text-slate-500">{item.description}</div>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-[11px] font-black ${
                      isActive ? 'bg-white text-cyan-700' : 'bg-white text-slate-600'
                    }`}>
                      {item.count}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-black text-slate-900">已关联本地游戏</h2>
              <p className="text-sm font-medium text-slate-500">
                本地库前台视图。点击卡片进入管理层，默认不要把路径和运行细节铺满首页。
              </p>
              <p className="mt-1 text-xs font-bold text-slate-400">
                TODO: 恢复“启动游戏 / 多可执行文件手动选择”入口，但不要重新把卡片做回信息过载。
              </p>
            </div>
            {visibleGames.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleToggleSelectAllGames()}
                  disabled={isDeletingSelectedGames}
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  {isAllGamesSelected ? '取消全选' : '全选'}
                </button>
                <button
                  type="button"
                  onClick={() => void handleDeleteSelectedGames()}
                  disabled={!hasSelectedGames || isDeletingSelectedGames}
                  className="inline-flex items-center gap-2 rounded-2xl bg-rose-600 px-4 py-2 text-sm font-black text-white transition hover:bg-rose-700 disabled:opacity-50"
                >
                  <Trash2 size={15} />
                  删除所选目录
                </button>
              </div>
            )}
          </div>

          {hasSelectedGames && (
            <div className="mb-5 rounded-[1.4rem] border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
              已选择 {selectedGameIds.length} 个本地库条目。批量删除只会处理位于已登记 library roots 下的真实目录，并同步移除 `local_paths` 记录。
            </div>
          )}

          {selectedCollection === 'needs_attention' ? (
            <div className="rounded-[1.8rem] border border-dashed border-amber-300 bg-amber-50 p-10">
              <div className="flex items-center gap-3 text-amber-800">
                <AlertCircle size={22} />
                <div className="text-lg font-black">待处理层</div>
              </div>
              <div className="mt-3 text-sm font-medium leading-7 text-amber-800/80">
                这里不直接展示游戏墙，而是把 unresolved / orphaned / broken 留给右侧的人工处理面板。这个层更像 collection hierarchy 里的“异常集合”。
              </div>
            </div>
          ) : visibleGames.length === 0 ? (
            <div className="rounded-[1.8rem] border border-dashed border-slate-300 bg-slate-50 p-14 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white text-slate-400 shadow-sm">
                <Gamepad2 size={26} />
              </div>
              <div className="mt-5 text-xl font-black text-slate-900">当前集合下没有可显示的本地游戏</div>
              <div className="mt-2 text-sm font-medium leading-7 text-slate-500">
                你可以切换左侧集合层级，或调整搜索与排序条件。
              </div>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {visibleGames.map((game) => {
                return (
                  <article
                    key={game.id}
                    className="group cursor-pointer overflow-hidden rounded-[1.4rem] border border-slate-200 bg-white transition-all hover:-translate-y-1 hover:border-sky-300 hover:shadow-[0_18px_36px_-24px_rgba(14,165,233,0.3)]"
                    onClick={() => void handleOpenLocalGameWindow(game)}
                  >
                    <div className="aspect-[0.74] bg-slate-200">
                      {game.banner_url ? (
                        <img
                          src={game.banner_url}
                          alt={game.name ?? 'Linked local game'}
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-slate-400">
                          <Database size={30} />
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-3 p-3">
                      <div className="flex items-start gap-3">
                        <div className="pt-0.5">
                          <input
                            type="checkbox"
                            checked={selectedGameIds.includes(game.id)}
                            onClick={(event) => event.stopPropagation()}
                            onChange={() => toggleGameSelected(game.id)}
                            className="mt-1 h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="line-clamp-2 text-[0.95rem] font-black leading-5 text-slate-900">
                            {game.name ?? '未命名条目'}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          void handleRevealGameDirectory(game);
                        }}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-3 py-2 text-sm font-black text-white transition hover:bg-slate-800"
                      >
                        <Folder size={15} />
                        打开目录
                      </button>
                      <div className="truncate text-[11px] font-mono text-slate-400" title={game.path}>
                        {formatPathTail(game.path)}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <aside className="flex flex-col gap-6">
          <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-black text-slate-900">Needs Attention</h2>
                <p className="text-sm font-medium text-slate-500">把真正需要人工介入的内容集中起来，不让它们干扰主游戏库。</p>
              </div>
            </div>

            {lastScanFolders.length === 0 ? (
              <div className="rounded-[1.6rem] border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-slate-400 shadow-sm">
                  <RefreshCw size={24} />
                </div>
                <div className="mt-4 text-base font-black text-slate-900">还没有扫描结果</div>
                <div className="mt-2 text-sm font-medium leading-7 text-slate-500">
                  添加监控目录后点击“扫描全部监控目录”，这里会显示需要处理的目录和 broken 路径。
                </div>
              </div>
            ) : unresolvedFolders.length === 0 && orphanedFolders.length === 0 && brokenGames.length === 0 ? (
              <div className="rounded-[1.6rem] border border-emerald-200 bg-emerald-50 p-6 text-emerald-700">
                <div className="flex items-center gap-3">
                  <CheckCircle2 size={22} />
                  <div>
                    <div className="text-base font-black">当前没有待处理问题</div>
                    <div className="mt-1 text-sm font-medium">扫描结果都处于稳定状态，可以把 Library 当成纯浏览和启动入口来用。</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-5">
                {orphanedFolders.length > 0 && (
                  <div className="flex flex-col gap-3">
                    <div className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">Orphaned `.tg_id`</div>
                    {orphanedFolders.map((folder) => (
                      <div key={folder.path} className="rounded-[1.5rem] border border-sky-200 bg-sky-50 p-4">
                        <div className="flex items-center gap-2 text-sky-800">
                          <AlertCircle size={16} />
                          <span className="text-sm font-black">{folder.folderName}</span>
                        </div>
                        <div className="mt-2 break-all font-mono text-[12px] text-sky-700/80">{folder.path}</div>
                        <div className="mt-2 text-xs font-bold text-sky-700">`.tg_id`: {folder.tg_id}</div>
                      </div>
                    ))}
                  </div>
                )}

                {unresolvedFolders.length > 0 && (
                  <div className="flex flex-col gap-3">
                    <div className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">Unresolved Candidates</div>
                    {unresolvedFolders.map((folder) => (
                      <div key={folder.path} className="rounded-[1.5rem] border border-amber-200 bg-amber-50 p-4">
                        <div className="flex items-center gap-2 text-amber-800">
                          <AlertCircle size={16} />
                          <span className="text-sm font-black">{folder.folderName}</span>
                        </div>
                        <div className="mt-2 break-all font-mono text-[12px] text-amber-700/80">{folder.path}</div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <span className="rounded-full bg-white px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-amber-700">
                            depth {folder.depth}
                          </span>
                          {folder.executableNames.slice(0, 3).map((exe) => (
                            <span
                              key={`${folder.path}-${exe}`}
                              className="rounded-full bg-white px-3 py-1 text-[11px] font-black text-amber-700"
                            >
                              {exe}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {brokenGames.length > 0 && (
                  <div className="flex flex-col gap-3">
                    <div className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">Broken Paths</div>
                    {brokenGames.map((game) => (
                      <div key={`broken-${game.id}`} className="rounded-[1.5rem] border border-rose-200 bg-rose-50 p-4">
                        <div className="flex items-center gap-2 text-rose-800">
                          <AlertCircle size={16} />
                          <span className="text-sm font-black">{game.name ?? formatPathTail(game.path)}</span>
                        </div>
                        <div className="mt-2 break-all font-mono text-[12px] text-rose-700/80">{game.path}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>

          <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-black text-slate-900">Watched Directories</h2>
                <p className="text-sm font-medium text-slate-500">辅助管理层。大多数时候你只需要默认的 `library/`。</p>
              </div>
            </div>

            <div className="mb-4 flex flex-col gap-3">
              <input
                type="text"
                value={manualRootPath}
                onChange={(event) => setManualRootPath(event.target.value)}
                placeholder="输入额外本地根目录"
                className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-800 outline-none transition focus:border-sky-300 focus:bg-white"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void handleAddRoot(manualRootPath)}
                  disabled={isSavingRoot || !manualRootPath.trim()}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-sky-600 px-4 py-3 text-sm font-black text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <FolderPlus size={16} />
                  添加
                </button>
                <button
                  type="button"
                  onClick={() => void handlePickRoot()}
                  disabled={isPickingRoot}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Folder size={16} />
                  选择
                </button>
              </div>
              <button
                type="button"
                onClick={() => void handleRescan()}
                disabled={isScanning || roots.length === 0}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-900 px-4 py-3 text-sm font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RefreshCw size={16} className={isScanning ? 'animate-spin' : ''} />
                {isScanning ? '扫描中...' : '扫描全部监控目录'}
              </button>
            </div>

            {isBootLoading ? (
              <div className="py-12 text-center text-sm font-bold text-slate-400">读取本地库配置中...</div>
            ) : roots.length === 0 ? (
              <div className="rounded-[1.6rem] border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-slate-400 shadow-sm">
                  <Folder size={22} />
                </div>
                <div className="mt-3 text-sm font-black text-slate-900">还没有监控目录</div>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {roots.map((root) => (
                  <div key={root.id} className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="text-sm font-black text-slate-900">{formatPathTail(root.path)}</div>
                        <div className="mt-1 break-all font-mono text-[12px] text-slate-500">{root.path}</div>
                        <div className="mt-2 text-xs font-bold text-slate-500">Last Scan: {formatTimestamp(root.last_scanned_at)}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleRemoveRoot(root.id)}
                        disabled={removingRootId === root.id}
                        className="inline-flex items-center gap-2 rounded-xl border border-red-100 bg-white px-3 py-2 text-xs font-black text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                      >
                        <Trash2 size={13} />
                        移除
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </aside>
      </div>
      </div>

      {activeLocalGame ? (
        <div
          className="fixed inset-0 z-[1450] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm md:p-8"
          onClick={() => setActiveLocalGame(null)}
        >
          <div
            className="max-h-[min(92vh,980px)] w-full max-w-6xl overflow-y-auto rounded-[2.25rem] border border-white/60 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.12),_transparent_28%),linear-gradient(180deg,_#f8fbff_0%,_#f3f7fb_48%,_#eef4fa_100%)] p-4 shadow-[0_32px_90px_-34px_rgba(15,23,42,0.45)] md:p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <LocalGameWindow embedded game={activeLocalGame} onClose={() => setActiveLocalGame(null)} />
          </div>
        </div>
      ) : null}
    </>
  );
};
