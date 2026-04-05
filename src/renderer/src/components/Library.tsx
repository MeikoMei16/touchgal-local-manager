import React from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Database,
  Folder,
  FolderPlus,
  Link2,
  Play,
  RefreshCw,
  Trash2
} from 'lucide-react';
import { useUIStore } from '../store/useTouchGalStore';
import type { LibraryRoot, LinkedLocalGame, LocalFolder } from '../types/electron';

const formatTimestamp = (value: string | null) => {
  if (!value) return '尚未扫描';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('zh-CN');
};

const formatCompactNumber = (value: number | null | undefined) => {
  if (!value) return '0';
  if (value >= 1000000) return `${(value / 1000000).toFixed(1).replace(/\.0$/, '')}m`;
  if (value >= 1000) return `${(value / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return String(value);
};

const formatPathTail = (value: string) => {
  const normalized = value.replace(/\\/g, '/');
  const parts = normalized.split('/').filter(Boolean);
  return parts[parts.length - 1] ?? value;
};

export const Library: React.FC = () => {
  const pushToast = useUIStore((state) => state.pushToast);

  const [roots, setRoots] = React.useState<LibraryRoot[]>([]);
  const [linkedGames, setLinkedGames] = React.useState<LinkedLocalGame[]>([]);
  const [lastScanFolders, setLastScanFolders] = React.useState<LocalFolder[]>([]);
  const [manualRootPath, setManualRootPath] = React.useState('');
  const [isBootLoading, setIsBootLoading] = React.useState(true);
  const [isScanning, setIsScanning] = React.useState(false);
  const [isPickingRoot, setIsPickingRoot] = React.useState(false);
  const [isSavingRoot, setIsSavingRoot] = React.useState(false);
  const [removingRootId, setRemovingRootId] = React.useState<number | null>(null);
  const [launchingGameId, setLaunchingGameId] = React.useState<number | null>(null);
  const [launchChoicesByGameId, setLaunchChoicesByGameId] = React.useState<Record<number, string[]>>({});
  const [selectedGameIds, setSelectedGameIds] = React.useState<number[]>([]);
  const [isDeletingSelectedGames, setIsDeletingSelectedGames] = React.useState(false);

  const unresolvedFolders = lastScanFolders.filter((folder) => folder.matchState === 'unresolved');
  const orphanedFolders = lastScanFolders.filter((folder) => folder.matchState === 'orphaned');
  const brokenGames = linkedGames.filter((game) => game.status === 'broken');
  const isAllGamesSelected = linkedGames.length > 0 && selectedGameIds.length === linkedGames.length;
  const hasSelectedGames = selectedGameIds.length > 0;

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

  const handleLaunchGame = async (game: LinkedLocalGame, exeName: string) => {
    setLaunchingGameId(game.id);
    try {
      const result = await window.api.launchGame(game.path, exeName);
      if (!result.success) {
        throw new Error(result.error || '启动失败');
      }
      pushToast(`已启动 ${exeName}`);
    } catch (error) {
      pushToast(error instanceof Error ? error.message : '启动游戏失败');
    } finally {
      setLaunchingGameId(null);
    }
  };

  const handleRevealGameDirectory = async (game: LinkedLocalGame) => {
    try {
      const result = await window.api.revealPath(game.path);
      if (!result.success) {
        throw new Error('打开目录失败');
      }
    } catch (error) {
      pushToast(error instanceof Error ? error.message : '打开目录失败');
    }
  };

  const handleOpenLocalGameWindow = async (game: LinkedLocalGame) => {
    try {
      const result = await window.api.openLocalGameWindow(game.id);
      if (!result.success) {
        throw new Error('打开本地游戏窗口失败');
      }
    } catch (error) {
      pushToast(error instanceof Error ? error.message : '打开本地游戏窗口失败');
    }
  };

  const handleDiscoverExecutables = async (game: LinkedLocalGame) => {
    setLaunchingGameId(game.id);
    try {
      const executables = await window.api.getExecutables(game.path);
      if (executables.length === 0) {
        pushToast('未找到可用的启动程序');
        return;
      }

      if (executables.length === 1) {
        await handleLaunchGame(game, executables[0]);
        return;
      }

      setLaunchChoicesByGameId((current) => ({
        ...current,
        [game.id]: executables,
      }));
      pushToast('发现多个可执行文件，请手动选择');
    } catch (error) {
      pushToast(error instanceof Error ? error.message : '读取启动程序失败');
    } finally {
      setLaunchingGameId(null);
    }
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
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 p-4 md:p-8">
      <section className="overflow-hidden rounded-[2.2rem] border border-slate-200 bg-white shadow-sm">
        <div className="bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.15),_transparent_35%),linear-gradient(135deg,_#ffffff_0%,_#f8fbff_55%,_#eef6ff_100%)] p-8">
          <div className="flex flex-col gap-8 xl:flex-row xl:items-end xl:justify-between">
            <div className="flex max-w-3xl flex-col gap-3">
              <div className="flex items-center gap-3 text-slate-900">
                <div className="flex h-13 w-13 items-center justify-center rounded-2xl bg-sky-100 text-sky-700 shadow-sm">
                  <Database size={24} />
                </div>
                <div>
                  <h1 className="text-3xl font-black tracking-tight">Local Library</h1>
                  <p className="text-sm font-medium leading-7 text-slate-500">
                    这里现在以“本地游戏库”而不是“扫描配置器”为主。默认情况下，压缩包进入 `download/`，解压后的游戏进入 `library/`，Library 会优先围绕这些本地游戏本身展开。
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-[1.4rem] border border-white/80 bg-white/80 p-4 shadow-sm">
                  <div className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">Local Games</div>
                  <div className="mt-2 text-3xl font-black text-slate-900">{linkedGames.length}</div>
                </div>
                <div className="rounded-[1.4rem] border border-white/80 bg-white/80 p-4 shadow-sm">
                  <div className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">Needs Attention</div>
                  <div className="mt-2 text-3xl font-black text-slate-900">{unresolvedFolders.length + orphanedFolders.length + brokenGames.length}</div>
                </div>
                <div className="rounded-[1.4rem] border border-white/80 bg-white/80 p-4 shadow-sm">
                  <div className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">Watched Roots</div>
                  <div className="mt-2 text-3xl font-black text-slate-900">{roots.length}</div>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 xl:min-w-[28rem]">
              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  type="text"
                  value={manualRootPath}
                  onChange={(event) => setManualRootPath(event.target.value)}
                  placeholder="输入额外本地根目录，例如 D:\\Galgames"
                  className="min-w-0 flex-1 rounded-2xl border border-white/90 bg-white/90 px-4 py-3 text-sm font-bold text-slate-800 outline-none transition focus:border-sky-300 focus:bg-white"
                />
                <button
                  type="button"
                  onClick={() => void handleAddRoot(manualRootPath)}
                  disabled={isSavingRoot || !manualRootPath.trim()}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-sky-600 px-4 py-3 text-sm font-black text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <FolderPlus size={16} />
                  添加目录
                </button>
                <button
                  type="button"
                  onClick={() => void handlePickRoot()}
                  disabled={isPickingRoot}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Folder size={16} />
                  选择目录
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
          </div>
        </div>
      </section>

      <div className="grid gap-8 xl:grid-cols-[1.7fr_0.95fr]">
        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-black text-slate-900">Linked Local Games</h2>
              <p className="text-sm font-medium text-slate-500">本地游戏库的主区。优先展示已经建立稳定映射、可以直接打开目录或启动的条目。</p>
            </div>
            {linkedGames.length > 0 && (
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

          {linkedGames.length === 0 ? (
            <div className="rounded-[1.6rem] border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-slate-400 shadow-sm">
                <Link2 size={24} />
              </div>
              <div className="mt-4 text-base font-black text-slate-900">还没有已关联的本地游戏</div>
              <div className="mt-2 text-sm font-medium leading-7 text-slate-500">
                默认情况下，下载的压缩包会进入 `download/`，解压后的游戏会进入 `library/`，并自动生成 `.tg_id` 和 `local_paths`。
              </div>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
              {linkedGames.map((game) => {
                return (
                  <article
                    key={game.id}
                    className="cursor-pointer overflow-hidden rounded-[1.6rem] border border-slate-200 bg-slate-50 transition-all hover:-translate-y-0.5 hover:border-sky-300 hover:shadow-lg hover:shadow-sky-100/60"
                    onClick={() => void handleOpenLocalGameWindow(game)}
                  >
                    <div className="aspect-[16/8] bg-slate-200">
                      {game.banner_url ? (
                        <img
                          src={game.banner_url}
                          alt={game.name ?? 'Linked local game'}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-slate-400">
                          <Database size={30} />
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-4 p-5">
                      <div>
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={selectedGameIds.includes(game.id)}
                            onClick={(event) => event.stopPropagation()}
                            onChange={() => toggleGameSelected(game.id)}
                            className="mt-1 h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="text-lg font-black text-slate-900">{game.name ?? '未命名条目'}</div>
                          </div>
                        </div>
                        <div className="mt-1 break-all font-mono text-[12px] text-slate-500">{game.path}</div>
                      </div>
                      <div className="flex flex-wrap gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
                        <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-700">{game.source}</span>
                        <span className={`rounded-full px-3 py-1 ${
                          game.status === 'broken'
                            ? 'bg-rose-100 text-rose-700'
                            : 'bg-slate-200 text-slate-700'
                        }`}>{game.status}</span>
                        {game.unique_id && <span className="rounded-full bg-sky-100 px-3 py-1 text-sky-700">{game.unique_id}</span>}
                        {game.exe_path && <span className="rounded-full bg-indigo-100 px-3 py-1 text-indigo-700">{game.exe_path}</span>}
                      </div>
                      <div className="grid grid-cols-3 gap-3 rounded-[1.2rem] border border-slate-200 bg-white p-3 text-center">
                        <div>
                          <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Score</div>
                          <div className="mt-1 text-base font-black text-slate-900">
                            {game.avg_rating ? game.avg_rating.toFixed(1) : '--'}
                          </div>
                        </div>
                        <div>
                          <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Views</div>
                          <div className="mt-1 text-base font-black text-slate-900">{formatCompactNumber(game.view_count)}</div>
                        </div>
                        <div>
                          <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">DL</div>
                          <div className="mt-1 text-base font-black text-slate-900">{formatCompactNumber(game.download_count)}</div>
                        </div>
                      </div>
                      <div className="flex flex-col gap-3">
                        <div className="flex gap-3">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              void handleRevealGameDirectory(game);
                            }}
                            className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                          >
                            <Folder size={16} />
                            打开目录
                          </button>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              void (game.exe_path
                                ? handleLaunchGame(game, game.exe_path)
                                : handleDiscoverExecutables(game));
                            }}
                            disabled={game.status === 'broken' || launchingGameId === game.id}
                            className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm font-black text-indigo-700 transition hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <Play size={16} />
                            {game.exe_path ? '启动游戏' : '查找启动程序'}
                          </button>
                        </div>

                        {(launchChoicesByGameId[game.id]?.length ?? 0) > 1 && (
                          <div className="rounded-[1.2rem] border border-slate-200 bg-white p-3">
                            <div className="mb-2 text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Executable Choices</div>
                            <div className="flex flex-wrap gap-2">
                              {launchChoicesByGameId[game.id].map((exe) => (
                                <button
                                  key={`${game.id}-${exe}`}
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    void handleLaunchGame(game, exe);
                                  }}
                                  disabled={launchingGameId === game.id}
                                  className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
                                >
                                  {exe}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <aside className="flex flex-col gap-8">
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
                <p className="text-sm font-medium text-slate-500">保留，但降级为管理面板。大多数时候你只需要默认的 `library/` 即可。</p>
              </div>
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
  );
};
