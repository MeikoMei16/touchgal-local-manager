import React from 'react';
import { Folder, Gamepad2, HardDrive, Play, Sparkles } from 'lucide-react';
import type { LinkedLocalGame } from '../types/electron';

const formatCompactNumber = (value: number | null | undefined) => {
  if (!value) return '0';
  if (value >= 1000000) return `${(value / 1000000).toFixed(1).replace(/\.0$/, '')}m`;
  if (value >= 1000) return `${(value / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return String(value);
};

const formatDate = (value: string | null) => {
  if (!value) return '未知';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString('zh-CN');
};

export const LocalGameWindow: React.FC = () => {
  const [game, setGame] = React.useState<LinkedLocalGame | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const localGameId = React.useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    const parsed = Number.parseInt(params.get('localGameId') ?? '', 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }, []);

  React.useEffect(() => {
    if (!localGameId) {
      setError('缺少本地游戏 ID');
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    const loadGame = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const nextGame = await window.api.getLinkedLocalGame(localGameId);
        if (cancelled) return;
        if (!nextGame) {
          setError('未找到对应的本地游戏条目');
          setGame(null);
          return;
        }
        setGame(nextGame);
      } catch (loadError) {
        if (cancelled) return;
        setError(loadError instanceof Error ? loadError.message : '读取本地游戏失败');
        setGame(null);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadGame();
    return () => {
      cancelled = true;
    };
  }, [localGameId]);

  const handleRevealDirectory = async () => {
    if (!game) return;
    await window.api.revealPath(game.path);
  };

  const handleLaunch = async () => {
    if (!game?.exe_path) return;
    await window.api.launchGame(game.path, game.exe_path);
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.12),_transparent_30%),linear-gradient(180deg,_#f8fbff_0%,_#f3f7fb_100%)] text-slate-500">
        <div className="rounded-[2rem] border border-slate-200 bg-white px-8 py-6 text-sm font-bold shadow-sm">
          正在载入本地游戏管理窗口...
        </div>
      </div>
    );
  }

  if (error || !game) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.12),_transparent_30%),linear-gradient(180deg,_#f8fbff_0%,_#f3f7fb_100%)] p-8">
        <div className="max-w-xl rounded-[2rem] border border-rose-200 bg-white px-8 py-7 shadow-sm">
          <div className="text-lg font-black text-rose-700">本地游戏窗口加载失败</div>
          <div className="mt-3 text-sm font-medium leading-7 text-slate-500">{error ?? '未知错误'}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.14),_transparent_30%),linear-gradient(180deg,_#f8fbff_0%,_#f3f7fb_48%,_#eef4fa_100%)] p-6 md:p-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">
        <section className="overflow-hidden rounded-[2.25rem] border border-slate-200 bg-white shadow-[0_24px_70px_-40px_rgba(15,23,42,0.35)]">
          <div className="grid gap-0 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="relative min-h-[320px] overflow-hidden bg-slate-100">
              {game.banner_url ? (
                <img src={game.banner_url} alt={game.name ?? 'Local game'} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full min-h-[320px] items-center justify-center bg-slate-200 text-slate-400">
                  <Gamepad2 size={72} />
                </div>
              )}
              <div className="absolute inset-0 bg-linear-to-t from-slate-950/55 via-slate-900/15 to-transparent" />
              <div className="absolute left-6 top-6 inline-flex items-center gap-2 rounded-full bg-white/90 px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-sky-700 shadow-sm">
                <Sparkles size={14} />
                Local Game Workspace
              </div>
            </div>

            <div className="flex flex-col gap-5 p-6 md:p-8">
              <div>
                <div className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">Template Window</div>
                <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">{game.name ?? `Local Game ${game.id}`}</h1>
                <p className="mt-3 text-sm font-medium leading-7 text-slate-500">
                  这是本地游戏重管理窗口模板。后续可以继续塞安装检查、补丁状态、启动配置、资源校验、目录清理等重逻辑。
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-[1.4rem] border border-slate-200 bg-slate-50 p-4">
                  <div className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Status</div>
                  <div className="mt-2 text-base font-black text-slate-900">{game.status}</div>
                </div>
                <div className="rounded-[1.4rem] border border-slate-200 bg-slate-50 p-4">
                  <div className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Views</div>
                  <div className="mt-2 text-base font-black text-slate-900">{formatCompactNumber(game.view_count)}</div>
                </div>
                <div className="rounded-[1.4rem] border border-slate-200 bg-slate-50 p-4">
                  <div className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">DL</div>
                  <div className="mt-2 text-base font-black text-slate-900">{formatCompactNumber(game.download_count)}</div>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => void handleRevealDirectory()}
                  className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-black text-white transition hover:bg-slate-800"
                >
                  <Folder size={16} />
                  打开目录
                </button>
                <button
                  type="button"
                  onClick={() => void handleLaunch()}
                  disabled={!game.exe_path}
                  className="inline-flex items-center gap-2 rounded-2xl border border-indigo-200 bg-indigo-50 px-5 py-3 text-sm font-black text-indigo-700 transition hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Play size={16} />
                  {game.exe_path ? '直接启动' : '缺少已记录启动程序'}
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">Local Context</div>
            <div className="mt-5 space-y-4">
              <div>
                <div className="text-sm font-black text-slate-900">本地路径</div>
                <div className="mt-2 break-all rounded-[1.25rem] bg-slate-50 px-4 py-3 font-mono text-[13px] text-slate-600">
                  {game.path}
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-[1.25rem] border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Source</div>
                  <div className="mt-2 text-sm font-black text-slate-900">{game.source}</div>
                </div>
                <div className="rounded-[1.25rem] border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Linked At</div>
                  <div className="mt-2 text-sm font-black text-slate-900">{formatDate(game.linked_at)}</div>
                </div>
                <div className="rounded-[1.25rem] border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Unique ID</div>
                  <div className="mt-2 text-sm font-black text-slate-900">{game.unique_id ?? '未关联'}</div>
                </div>
                <div className="rounded-[1.25rem] border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Executable</div>
                  <div className="mt-2 break-all text-sm font-black text-slate-900">{game.exe_path ?? '尚未记录'}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[2rem] border border-dashed border-slate-300 bg-white/85 p-6 shadow-sm">
            <div className="inline-flex items-center gap-2 rounded-full bg-sky-100 px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] text-sky-700">
              <HardDrive size={13} />
              Coming Next
            </div>
            <div className="mt-4 text-2xl font-black tracking-tight text-slate-900">Heavy Local Management Area</div>
            <div className="mt-3 text-sm font-medium leading-7 text-slate-500">
              这里预留给后续更重的本地管理逻辑，例如多 exe 策略、补丁切换、完整性检测、目录结构整理、save/config 定位、局部重扫、metadata 回填等。
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default LocalGameWindow;
