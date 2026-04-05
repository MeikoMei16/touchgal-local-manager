import React from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Database,
  ExternalLink,
  Folder,
  FolderPlus,
  Link2,
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
  const selectResource = useUIStore((state) => state.selectResource);
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

  const unresolvedFolders = lastScanFolders.filter((folder) => !folder.tg_id);

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
      pushToast(`扫描完成，发现 ${result.folders.length} 个文件夹`);
    } catch (error) {
      pushToast(error instanceof Error ? error.message : '扫描失败');
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 p-4 md:p-8">
      <section className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="flex max-w-3xl flex-col gap-2">
            <div className="flex items-center gap-3 text-slate-900">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
                <Database size={24} />
              </div>
              <div>
                <h1 className="text-3xl font-black tracking-tight">Local Library</h1>
                <p className="text-sm font-medium leading-7 text-slate-500">
                  管理本地监控目录，并通过 `.tg_id` 将已知游戏文件夹稳定映射到应用内条目。
                </p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-[1.4rem] border border-slate-200 bg-slate-50 p-4">
                <div className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">Watched Roots</div>
                <div className="mt-2 text-3xl font-black text-slate-900">{roots.length}</div>
              </div>
              <div className="rounded-[1.4rem] border border-slate-200 bg-slate-50 p-4">
                <div className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">Linked Installs</div>
                <div className="mt-2 text-3xl font-black text-slate-900">{linkedGames.length}</div>
              </div>
              <div className="rounded-[1.4rem] border border-slate-200 bg-slate-50 p-4">
                <div className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">Unresolved This Scan</div>
                <div className="mt-2 text-3xl font-black text-slate-900">{unresolvedFolders.length}</div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 xl:min-w-[30rem]">
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                type="text"
                value={manualRootPath}
                onChange={(event) => setManualRootPath(event.target.value)}
                placeholder="输入本地游戏根目录，例如 D:\\Galgames"
                className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-800 outline-none transition focus:border-sky-300 focus:bg-white"
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
      </section>

      <div className="grid gap-8 xl:grid-cols-[0.95fr_1.45fr]">
        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-black text-slate-900">Watched Directories</h2>
              <p className="text-sm font-medium text-slate-500">扫描仅处理这些根目录下一层文件夹，并记录可识别的 `.tg_id`。</p>
            </div>
          </div>

          {isBootLoading ? (
            <div className="py-16 text-center text-sm font-bold text-slate-400">读取本地库配置中...</div>
          ) : roots.length === 0 ? (
            <div className="rounded-[1.6rem] border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-slate-400 shadow-sm">
                <Folder size={24} />
              </div>
              <div className="mt-4 text-base font-black text-slate-900">还没有监控目录</div>
              <div className="mt-2 text-sm font-medium leading-7 text-slate-500">
                先添加一个本地游戏根目录，再运行扫描。当前阶段不会尝试自动匹配未知来源的游戏文件夹。
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {roots.map((root) => (
                <div
                  key={root.id}
                  className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-sm font-black text-slate-900">{formatPathTail(root.path)}</div>
                      <div className="mt-1 break-all font-mono text-[12px] text-slate-500">{root.path}</div>
                      <div className="mt-3 text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">
                        Last Scan
                      </div>
                      <div className="mt-1 text-sm font-bold text-slate-600">{formatTimestamp(root.last_scanned_at)}</div>
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

        <section className="flex flex-col gap-8">
          <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-black text-slate-900">Linked Local Games</h2>
                <p className="text-sm font-medium text-slate-500">这些条目已经有稳定的本地路径映射，可以直接回到应用内详情。</p>
              </div>
            </div>

            {linkedGames.length === 0 ? (
              <div className="rounded-[1.6rem] border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-slate-400 shadow-sm">
                  <Link2 size={24} />
                </div>
                <div className="mt-4 text-base font-black text-slate-900">还没有已关联的本地游戏</div>
                <div className="mt-2 text-sm font-medium leading-7 text-slate-500">
                  下载后的自动解压链路会优先生成 `.tg_id` 和 `local_paths`。你也可以扫描已有目录来回填这些映射。
                </div>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {linkedGames.map((game) => {
                  const canOpenDetail = Boolean(game.unique_id);
                  return (
                    <article
                      key={game.id}
                      className="overflow-hidden rounded-[1.6rem] border border-slate-200 bg-slate-50"
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
                          <div className="text-lg font-black text-slate-900">{game.name ?? '未命名条目'}</div>
                          <div className="mt-1 break-all font-mono text-[12px] text-slate-500">{game.path}</div>
                        </div>
                        <div className="flex flex-wrap gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
                          <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-700">{game.source}</span>
                          <span className="rounded-full bg-slate-200 px-3 py-1 text-slate-700">{game.status}</span>
                          {game.unique_id && <span className="rounded-full bg-sky-100 px-3 py-1 text-sky-700">{game.unique_id}</span>}
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
                        <button
                          type="button"
                          onClick={() => canOpenDetail && void selectResource(game.unique_id as string)}
                          disabled={!canOpenDetail}
                          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                        >
                          <ExternalLink size={16} />
                          {canOpenDetail ? '打开详情' : '缺少详情映射'}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>

          <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-black text-slate-900">Last Scan Report</h2>
                <p className="text-sm font-medium text-slate-500">这里只展示最近一次扫描中没有 `.tg_id` 的文件夹，供后续人工处理。</p>
              </div>
            </div>

            {lastScanFolders.length === 0 ? (
              <div className="rounded-[1.6rem] border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-slate-400 shadow-sm">
                  <RefreshCw size={24} />
                </div>
                <div className="mt-4 text-base font-black text-slate-900">还没有扫描结果</div>
                <div className="mt-2 text-sm font-medium leading-7 text-slate-500">
                  添加监控目录后点击“扫描全部监控目录”，这里会显示最近一次扫描中的未解析文件夹。
                </div>
              </div>
            ) : unresolvedFolders.length === 0 ? (
              <div className="rounded-[1.6rem] border border-emerald-200 bg-emerald-50 p-6 text-emerald-700">
                <div className="flex items-center gap-3">
                  <CheckCircle2 size={22} />
                  <div>
                    <div className="text-base font-black">本次扫描未发现缺少 `.tg_id` 的文件夹</div>
                    <div className="mt-1 text-sm font-medium">当前扫描结果都已具备稳定映射，未知来源匹配工作可以继续延后。</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {unresolvedFolders.map((folder) => (
                  <div
                    key={folder.path}
                    className="flex flex-col gap-3 rounded-[1.5rem] border border-amber-200 bg-amber-50 p-4 md:flex-row md:items-center md:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-amber-800">
                        <AlertCircle size={16} />
                        <span className="text-sm font-black">{folder.folderName}</span>
                      </div>
                      <div className="mt-1 break-all font-mono text-[12px] text-amber-700/80">{folder.path}</div>
                    </div>
                    <div className="rounded-full bg-white px-3 py-2 text-xs font-black uppercase tracking-[0.18em] text-amber-700 shadow-sm">
                      unresolved
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};
