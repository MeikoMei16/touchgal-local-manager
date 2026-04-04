import React from 'react';
import { Download, FolderSearch, MousePointer2, RotateCcw, SquareMousePointer } from 'lucide-react';
import { useUIStore } from '../store/useTouchGalStore';
import type { DetailSecondaryClickAction } from '../store/uiStoreTypes';

const OPTIONS: Array<{
  value: DetailSecondaryClickAction;
  title: string;
  description: string;
  icon: React.ReactNode;
}> = [
  {
    value: 'back',
    title: 'Right Click Goes Back',
    description: 'In detail pages and the full-screen image viewer, right click behaves like a back action.',
    icon: <RotateCcw size={18} />
  },
  {
    value: 'native',
    title: 'Native Context Menu',
    description: 'Right click keeps the browser-style context menu behavior instead of closing the current detail layer.',
    icon: <SquareMousePointer size={18} />
  }
];

const SettingsView: React.FC = () => {
  const { detailSecondaryClickAction, setDetailSecondaryClickAction, downloadPathOverride, setDownloadPathOverride, pushToast } = useUIStore();
  const [defaultDownloadPath, setDefaultDownloadPath] = React.useState('');

  React.useEffect(() => {
    let cancelled = false;

    const loadDefaultPath = async () => {
      try {
        const value = await window.api.getDefaultDownloadDirectory();
        if (!cancelled) setDefaultDownloadPath(value);
      } catch {
        if (!cancelled) setDefaultDownloadPath('');
      }
    };

    void loadDefaultPath();
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

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 p-4 md:p-8">
      <section className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
            <MousePointer2 size={26} />
          </div>
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-black tracking-tight text-slate-900">Interaction</h1>
            <p className="max-w-2xl text-sm font-medium leading-7 text-slate-500">
              Control how desktop pointer gestures behave inside the detail overlay. The default mode maps right click to back.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 flex flex-col gap-2">
          <h2 className="text-xl font-black text-slate-900">Detail Page Secondary Click</h2>
          <p className="text-sm font-medium leading-7 text-slate-500">
            Applies to the detail overlay and the full-screen screenshot viewer. Links and buttons still keep their native context behavior.
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
                      {option.value === 'back' ? ' (Default)' : ''}
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
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-100 text-blue-700">
            <Download size={22} />
          </div>
          <div className="flex flex-col gap-2">
            <h2 className="text-xl font-black text-slate-900">Download Path</h2>
            <p className="text-sm font-medium leading-7 text-slate-500">
              快速下载默认保存到项目根目录下的 <span className="font-mono text-[13px]">download</span> 文件夹。你也可以在这里改成任意自定义目录。
            </p>
          </div>
        </div>

        <div className="rounded-[1.6rem] border border-slate-200 bg-slate-50 p-4">
          <div className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">Current Download Directory</div>
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
    </div>
  );
};

export default SettingsView;
