import React from 'react';
import { CheckCircle2, Database, Download, FolderSearch, MonitorUp, MousePointer2, RefreshCw, RotateCcw, SquareMousePointer, TriangleAlert } from 'lucide-react';
import { useUIStore } from '../store/useTouchGalStore';
import type { DetailSecondaryClickAction, LibraryManageOpenMode } from '../store/uiStoreTypes';
import type { ExtractorStatus } from '../types/electron';

const OPTIONS: Array<{
  value: DetailSecondaryClickAction;
  title: string;
  description: string;
  icon: React.ReactNode;
}> = [
  {
    value: 'back',
    title: '右键返回上一层',
    description: '在详情页和全屏截图查看器里，右键会被映射成返回动作。',
    icon: <RotateCcw size={18} />
  },
  {
    value: 'native',
    title: '系统右键菜单',
    description: '右键保持原生上下文菜单行为，不会关闭当前详情层。',
    icon: <SquareMousePointer size={18} />
  }
];

const LIBRARY_OPEN_OPTIONS: Array<{
  value: LibraryManageOpenMode;
  title: string;
  description: string;
}> = [
  {
    value: 'popup',
    title: '应用内弹层',
    description: '在当前应用窗口内部弹出本地游戏管理面板。'
  },
  {
    value: 'window',
    title: '独立窗口',
    description: '点击 Library 游戏卡片时打开独立窗口，适合后续更重的本地管理流。'
  }
];

const SettingsView: React.FC = () => {
  const {
    detailSecondaryClickAction,
    setDetailSecondaryClickAction,
    downloadPathOverride,
    setDownloadPathOverride,
    libraryManageOpenMode,
    setLibraryManageOpenMode,
    pushToast
  } = useUIStore();
  const [defaultDownloadPath, setDefaultDownloadPath] = React.useState('');
  const [extractorStatus, setExtractorStatus] = React.useState<ExtractorStatus | null>(null);
  const [isExtractorLoading, setIsExtractorLoading] = React.useState(true);
  const [downloadConcurrency, setDownloadConcurrency] = React.useState(3);
  const [isSavingConcurrency, setIsSavingConcurrency] = React.useState(false);
  const [archiveExtractionDepth, setArchiveExtractionDepth] = React.useState(3);
  const [isSavingArchiveDepth, setIsSavingArchiveDepth] = React.useState(false);
  const [isResettingDatabase, setIsResettingDatabase] = React.useState(false);
  const [isClearingCache, setIsClearingCache] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;

    const loadSettingsData = async () => {
      try {
        const [value, extractor, concurrency, extractionDepth] = await Promise.all([
          window.api.getDefaultDownloadDirectory(),
          window.api.checkExtractor(),
          window.api.getDownloadConcurrency(),
          window.api.getArchiveExtractionDepth()
        ]);
        if (!cancelled) {
          setDefaultDownloadPath(value);
          setExtractorStatus(extractor);
          setDownloadConcurrency(concurrency);
          setArchiveExtractionDepth(extractionDepth);
          setIsExtractorLoading(false);
        }
      } catch {
        if (!cancelled) {
          setDefaultDownloadPath('');
          setExtractorStatus(null);
          setIsExtractorLoading(false);
        }
      }
    };

    void loadSettingsData();
    return () => {
      cancelled = true;
    };
  }, []);

  const handlePickDownloadDirectory = async () => {
    try {
      const selectedPath = await window.api.pickDownloadDirectory();
      if (!selectedPath) return;
      setDownloadPathOverride(selectedPath);
      pushToast('下载目录已更新');
    } catch (error) {
      pushToast(error instanceof Error ? error.message : '无法选择下载目录');
    }
  };

  const resolvedDownloadPath = downloadPathOverride || defaultDownloadPath || '读取中...';

  const refreshExtractorStatus = async () => {
    setIsExtractorLoading(true);
    try {
      const nextStatus = await window.api.checkExtractor();
      setExtractorStatus(nextStatus);
      pushToast(nextStatus.supported ? '已刷新解压器状态' : '未检测到可用的自动解压器');
    } catch (error) {
      pushToast(error instanceof Error ? error.message : '无法刷新解压器状态');
    } finally {
      setIsExtractorLoading(false);
    }
  };

  const handleUpdateConcurrency = async (nextValue: number) => {
    setIsSavingConcurrency(true);
    try {
      const persisted = await window.api.setDownloadConcurrency(nextValue);
      setDownloadConcurrency(persisted);
      pushToast(`下载并发已更新为 ${persisted}`);
    } catch (error) {
      pushToast(error instanceof Error ? error.message : '无法更新下载并发');
    } finally {
      setIsSavingConcurrency(false);
    }
  };

  const handleUpdateArchiveExtractionDepth = async (nextValue: number) => {
    setIsSavingArchiveDepth(true);
    try {
      const persisted = await window.api.setArchiveExtractionDepth(nextValue);
      setArchiveExtractionDepth(persisted);
      pushToast(`自动解压层数已更新为 ${persisted}`);
    } catch (error) {
      pushToast(error instanceof Error ? error.message : '无法更新自动解压层数');
    } finally {
      setIsSavingArchiveDepth(false);
    }
  };

  const handleResetDatabase = async () => {
    const confirmed = window.confirm(
      '确定要清空本地数据库吗？这会删除本地游戏索引、下载任务、收藏夹、浏览历史等 SQLite 数据。该操作不可撤销，执行后应用会重载。'
    );
    if (!confirmed) return;

    setIsResettingDatabase(true);
    try {
      await window.api.resetDatabase();
      pushToast('本地数据库已清空，正在重载应用...');
      window.setTimeout(() => window.location.reload(), 250);
    } catch (error) {
      pushToast(error instanceof Error ? error.message : '清空数据库失败');
      setIsResettingDatabase(false);
    }
  };

  const handleClearCache = async () => {
    const confirmed = window.confirm(
      '确定要清空缓存吗？这会移除本地缓存、登录会话、renderer 本地存储与 Electron 运行态缓存，但不会删除 SQLite 数据库。执行后应用会重载。'
    );
    if (!confirmed) return;

    setIsClearingCache(true);
    try {
      await window.api.clearAppCache();
      window.localStorage.clear();
      pushToast('应用缓存已清空，正在重载应用...');
      window.setTimeout(() => window.location.reload(), 250);
    } catch (error) {
      pushToast(error instanceof Error ? error.message : '清空缓存失败');
      setIsClearingCache(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 p-4 md:p-8">
      <section className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
            <MousePointer2 size={26} />
          </div>
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-black tracking-tight text-slate-900">交互设置</h1>
            <p className="max-w-2xl text-sm font-medium leading-7 text-slate-500">
              控制桌面端在详情弹层里的鼠标交互行为。默认模式会把右键映射为返回。
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 flex flex-col gap-2">
          <h2 className="text-xl font-black text-slate-900">详情页右键行为</h2>
          <p className="text-sm font-medium leading-7 text-slate-500">
            作用于详情弹层和全屏截图查看器。链接和按钮仍然保留自己的原生右键行为。
          </p>
        </div>

        <div className="grid gap-4">
          {OPTIONS.map((option) => {
            const checked = detailSecondaryClickAction === option.value;
            return (
              <label
                key={option.value}
                className={`flex cursor-pointer items-start gap-4 rounded-[1.6rem] border p-5 transition-colors ${
                  checked
                    ? 'border-sky-300 bg-sky-50'
                    : 'border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white'
                }`}
              >
                <input
                  type="radio"
                  name="detail-secondary-click-action"
                  value={option.value}
                  checked={checked}
                  onChange={() => setDetailSecondaryClickAction(option.value)}
                  className="mt-1 h-4 w-4 accent-sky-600"
                />
                <div className="flex flex-1 items-start gap-3">
                  <div
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
                      checked ? 'bg-white text-sky-700' : 'bg-white text-slate-500'
                    }`}
                  >
                    {option.icon}
                  </div>
                  <div className="flex flex-col gap-1">
                    <div className="text-base font-black text-slate-900">
                      {option.title}
                      {option.value === 'back' ? '（默认）' : ''}
                    </div>
                    <div className="text-sm font-medium leading-7 text-slate-500">{option.description}</div>
                  </div>
                </div>
              </label>
            );
          })}
        </div>
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-cyan-100 text-cyan-700">
            <MonitorUp size={22} />
          </div>
          <div className="flex flex-col gap-2">
            <h2 className="text-xl font-black text-slate-900">本地管理打开方式</h2>
            <p className="text-sm font-medium leading-7 text-slate-500">
              控制点击库里的本地游戏卡片时，是在当前窗口里弹出管理面板，还是打开独立管理窗口。
            </p>
          </div>
        </div>

        <div className="grid gap-4">
          {LIBRARY_OPEN_OPTIONS.map((option) => {
            const checked = libraryManageOpenMode === option.value;
            return (
              <label
                key={option.value}
                className={`flex cursor-pointer items-start gap-4 rounded-[1.6rem] border p-5 transition-colors ${
                  checked
                    ? 'border-cyan-300 bg-cyan-50'
                    : 'border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white'
                }`}
              >
                <input
                  type="radio"
                  name="library-manage-open-mode"
                  value={option.value}
                  checked={checked}
                  onChange={() => setLibraryManageOpenMode(option.value)}
                  className="mt-1 h-4 w-4 accent-cyan-600"
                />
                <div className="flex flex-1 flex-col gap-1">
                  <div className="text-base font-black text-slate-900">
                    {option.title}
                    {option.value === 'popup' ? '（默认）' : ''}
                  </div>
                  <div className="text-sm font-medium leading-7 text-slate-500">{option.description}</div>
                </div>
              </label>
            );
          })}
        </div>
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-100 text-blue-700">
            <Download size={22} />
          </div>
          <div className="flex flex-col gap-2">
            <h2 className="text-xl font-black text-slate-900">下载路径</h2>
            <p className="text-sm font-medium leading-7 text-slate-500">
              快速下载默认保存到项目根目录下的 <span className="font-mono text-[13px]">download</span> 文件夹。自动解压后的游戏默认会进入独立的 <span className="font-mono text-[13px]">library</span> 文件夹。
            </p>
          </div>
        </div>

        <div className="rounded-[1.6rem] border border-slate-200 bg-slate-50 p-4">
          <div className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">当前下载目录</div>
          <div className="mt-3 break-all rounded-2xl bg-white px-4 py-3 font-mono text-[13px] font-bold text-slate-700 shadow-sm">
            {resolvedDownloadPath}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-black text-white transition-colors hover:bg-blue-700"
            onClick={() => void handlePickDownloadDirectory()}
            type="button"
          >
            <FolderSearch size={17} />
            选择目录
          </button>
          <button
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 transition-colors hover:bg-slate-50"
            onClick={() => {
              setDownloadPathOverride(null);
              pushToast('已恢复默认下载目录');
            }}
            type="button"
          >
            <RotateCcw size={17} />
            恢复默认
          </button>
        </div>
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-700">
            <Download size={22} />
          </div>
          <div className="flex flex-col gap-2">
            <h2 className="text-xl font-black text-slate-900">下载并发数</h2>
            <p className="text-sm font-medium leading-7 text-slate-500">
              控制同时进行中的下载任务数量。并发越高，总下载吞吐可能越高，但磁盘、网络和解压阶段的压力也会更明显。
            </p>
          </div>
        </div>

        <div className="rounded-[1.6rem] border border-slate-200 bg-slate-50 p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">当前并发下载数</div>
              <div className="mt-2 text-3xl font-black text-slate-900">{downloadConcurrency}</div>
            </div>
            <div className="flex flex-wrap gap-2">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  className={`rounded-2xl px-4 py-2 text-sm font-black transition-colors ${
                    downloadConcurrency === value
                      ? 'bg-indigo-600 text-white'
                      : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                  disabled={isSavingConcurrency}
                  onClick={() => void handleUpdateConcurrency(value)}
                  type="button"
                >
                  {value}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">
            <Download size={22} />
          </div>
          <div className="flex flex-col gap-2">
            <h2 className="text-xl font-black text-slate-900">递归解压层数</h2>
            <p className="text-sm font-medium leading-7 text-slate-500">
              控制自动解压会继续处理多少层嵌套压缩包。数值 1 只解第一层；默认值 3 会继续尝试处理二级和三级内层压缩包。
            </p>
          </div>
        </div>

        <div className="rounded-[1.6rem] border border-slate-200 bg-slate-50 p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">当前自动解压层数</div>
              <div className="mt-2 text-3xl font-black text-slate-900">{archiveExtractionDepth}</div>
            </div>
            <div className="flex flex-wrap gap-2">
              {[1, 2, 3, 4, 5, 6].map((value) => (
                <button
                  key={value}
                  className={`rounded-2xl px-4 py-2 text-sm font-black transition-colors ${
                    archiveExtractionDepth === value
                      ? 'bg-violet-600 text-white'
                      : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                  disabled={isSavingArchiveDepth}
                  onClick={() => void handleUpdateArchiveExtractionDepth(value)}
                  type="button"
                >
                  {value}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 flex items-start gap-4">
          <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
            extractorStatus?.supported ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
          }`}>
            <Download size={22} />
          </div>
          <div className="flex flex-col gap-2">
            <h2 className="text-xl font-black text-slate-900">解压器状态</h2>
            <p className="text-sm font-medium leading-7 text-slate-500">
              下载任务完成后，自动解压链路直接依赖命令行解压器。当前版本会优先使用 Bandizip CLI；如果 Bandizip 不可用，则回退到 7-Zip CLI。
            </p>
          </div>
        </div>

        <div className={`rounded-[1.6rem] border p-5 ${
          extractorStatus?.supported
            ? 'border-emerald-200 bg-emerald-50'
            : 'border-amber-200 bg-amber-50'
        }`}>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-3">
              <div className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${
                extractorStatus?.supported ? 'bg-white text-emerald-700' : 'bg-white text-amber-700'
              }`}>
                {extractorStatus?.supported ? <CheckCircle2 size={20} /> : <TriangleAlert size={20} />}
              </div>
              <div>
                <div className="text-base font-black text-slate-900">
                  {isExtractorLoading
                    ? '正在检测解压器...'
                    : extractorStatus?.supported
                      ? `自动解压已就绪: ${extractorStatus.name}`
                      : '自动解压当前不可用'}
                </div>
                <div className="mt-1 text-sm font-medium leading-7 text-slate-600">
                  {isExtractorLoading
                    ? '稍等片刻，正在读取本机可用的命令行解压器。'
                    : extractorStatus?.supported
                      ? '下载完成后的归档文件会尝试自动解压、重命名、写入 `.tg_id`，并回填到 Library。'
                      : '如果没有检测到 Bandizip 或 7-Zip，下载会保留压缩包，等待手动处理。'}
                </div>
              </div>
            </div>
            <button
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
              onClick={() => void refreshExtractorStatus()}
              type="button"
              disabled={isExtractorLoading}
            >
              <RefreshCw size={17} className={isExtractorLoading ? 'animate-spin' : ''} />
              刷新状态
            </button>
          </div>

          <div className="mt-5 grid gap-3">
            {(extractorStatus?.candidates ?? []).map((candidate) => (
              <div
                key={`${candidate.name}-${candidate.path}`}
                className="rounded-2xl border border-white/70 bg-white/80 p-4"
              >
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="text-sm font-black text-slate-900">{candidate.name}</div>
                    <div className="mt-1 break-all font-mono text-[12px] text-slate-500">{candidate.path}</div>
                  </div>
                  <div className="flex flex-wrap gap-2 text-[11px] font-black uppercase tracking-[0.18em]">
                    <span className={`rounded-full px-3 py-1 ${
                      candidate.detected ? 'bg-sky-100 text-sky-700' : 'bg-slate-200 text-slate-600'
                    }`}>
                      {candidate.detected ? '已检测' : '未找到'}
                    </span>
                    <span className={`rounded-full px-3 py-1 ${
                      candidate.supported ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {candidate.supported ? '可用' : '不可用'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-rose-100 text-rose-700">
            <Database size={22} />
          </div>
          <div className="flex flex-col gap-2">
            <h2 className="text-xl font-black text-slate-900">维护工具</h2>
            <p className="text-sm font-medium leading-7 text-slate-500">
              提供两个独立的重置动作。数据库和缓存分开处理，避免一次点击把所有状态一起抹掉。
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-[1.6rem] border border-rose-200 bg-rose-50 p-5">
            <div className="text-base font-black text-slate-900">清空数据库</div>
            <div className="mt-2 text-sm font-medium leading-7 text-slate-600">
              删除 SQLite 中的本地业务数据，包括下载任务、本地收藏、Library 链接、浏览历史等。
            </div>
            <button
              type="button"
              onClick={() => void handleResetDatabase()}
              disabled={isResettingDatabase || isClearingCache}
              className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-rose-600 px-4 py-3 text-sm font-black text-white transition hover:bg-rose-700 disabled:opacity-50"
            >
              <Database size={16} />
              {isResettingDatabase ? '清空中...' : '清空数据库'}
            </button>
          </div>

          <div className="rounded-[1.6rem] border border-amber-200 bg-amber-50 p-5">
            <div className="text-base font-black text-slate-900">清空缓存</div>
            <div className="mt-2 text-sm font-medium leading-7 text-slate-600">
              删除本地缓存、登录会话、renderer 本地存储和 Electron 运行态缓存，但保留 SQLite 数据库。
            </div>
            <button
              type="button"
              onClick={() => void handleClearCache()}
              disabled={isClearingCache || isResettingDatabase}
              className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-amber-500 px-4 py-3 text-sm font-black text-white transition hover:bg-amber-600 disabled:opacity-50"
            >
              <RefreshCw size={16} />
              {isClearingCache ? '清空中...' : '清空缓存'}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default SettingsView;
