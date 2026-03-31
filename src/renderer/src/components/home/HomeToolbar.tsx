import React from 'react';
import {
  AlertTriangle,
  ChevronDown,
  Laptop,
  Settings,
  Shield,
  ShieldCheck,
  SortAsc,
  SortDesc,
  Users
} from 'lucide-react';
import { HomeQueryState } from '../../features/home/homeState';
import { SortDropdown } from '../SortDropdown';
import { UserMenu } from '../UserMenu';
import { HOME_PLATFORM_OPTIONS } from '../../features/home/homeQuery';

interface HomeToolbarProps {
  isLoading: boolean;
  showFilters: boolean;
  sortField: HomeQueryState['sortField'];
  sortOrder: HomeQueryState['sortOrder'];
  query: HomeQueryState;
  isPlatformOpen: boolean;
  isMinRatingCountOpen: boolean;
  minRatingCountDraft: string;
  platformRef: React.RefObject<HTMLDivElement | null>;
  minRatingCountRef: React.RefObject<HTMLDivElement | null>;
  onToggleFilters: () => void;
  onUpdateSort: (field: HomeQueryState['sortField'], order: HomeQueryState['sortOrder']) => void;
  onCycleNsfwMode: () => void;
  onTogglePlatform: () => void;
  onSelectPlatform: (value: string) => void;
  onToggleMinRatingCount: () => void;
  onMinRatingCountDraftChange: (value: string) => void;
  onApplyMinRatingCount: (value: number) => void;
}

const getNsfwButtonContent = (value: HomeQueryState['nsfwMode']) => {
  switch (value) {
    case 'nsfw':
      return { icon: <AlertTriangle size={18} />, label: '仅限 R18', className: 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100' };
    case 'all':
      return { icon: <Shield size={18} />, label: '混合内容', className: 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200' };
    default:
      return { icon: <ShieldCheck size={18} />, label: '仅限全年龄', className: 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100' };
  }
};

const sortOptions = [
  { label: '资源更新时间', value: 'resource_update_time' },
  { label: '游戏创建时间', value: 'created' },
  { label: '评分', value: 'rating' },
  { label: '浏览量', value: 'view' },
  { label: '下载量', value: 'download' },
  { label: '收藏量', value: 'favorite' }
];

export const HomeToolbar: React.FC<HomeToolbarProps> = ({
  isLoading,
  showFilters,
  sortField,
  sortOrder,
  query,
  isPlatformOpen,
  isMinRatingCountOpen,
  minRatingCountDraft,
  platformRef,
  minRatingCountRef,
  onToggleFilters,
  onUpdateSort,
  onCycleNsfwMode,
  onTogglePlatform,
  onSelectPlatform,
  onToggleMinRatingCount,
  onMinRatingCountDraftChange,
  onApplyMinRatingCount
}) => {
  const nsfwButton = getNsfwButtonContent(query.nsfwMode);

  return (
    <div className="flex justify-between items-center w-full px-1 mb-2">
      <div className="flex items-center gap-1.5 flex-wrap">
        <SortDropdown
          value={sortField}
          options={sortOptions}
          onSelect={(val) => onUpdateSort(val as HomeQueryState['sortField'], sortOrder)}
          disabled={isLoading}
        />

        <button
          className={`flex items-center gap-1.5 px-4 h-11 rounded-full border-1.5 border-transparent font-bold text-[13.5px] cursor-pointer transition-all bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed ${sortOrder === 'asc' ? 'bg-primary-container text-on-primary-container' : ''}`}
          onClick={() => onUpdateSort(sortField, sortOrder === 'desc' ? 'asc' : 'desc')}
          disabled={isLoading}
        >
          {sortOrder === 'desc' ? <SortDesc size={18} /> : <SortAsc size={18} />}
          <span>{sortOrder === 'desc' ? '降序' : '升序'}</span>
        </button>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap justify-end">
        <button
          className={`flex items-center gap-2 px-4 h-11 rounded-full border font-bold text-[13.5px] cursor-pointer transition-all ${nsfwButton.className}`}
          onClick={onCycleNsfwMode}
          disabled={isLoading}
        >
          {nsfwButton.icon}
          <span>{nsfwButton.label}</span>
        </button>

        <div className="relative" ref={platformRef}>
          <button
            className={`flex items-center gap-2 px-4 h-11 rounded-full border font-bold text-[13.5px] cursor-pointer transition-all ${query.selectedPlatform !== 'all' ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}
            onClick={onTogglePlatform}
            disabled={isLoading}
          >
            <Laptop size={18} />
            <span>{HOME_PLATFORM_OPTIONS.find((option) => option.value === query.selectedPlatform)?.label ?? '全部平台'}</span>
            <ChevronDown size={16} className={`transition-transform ${isPlatformOpen ? 'rotate-180' : ''}`} />
          </button>
          {isPlatformOpen && (
            <div className="absolute top-full left-0 z-50 mt-2 w-44 rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl">
              {HOME_PLATFORM_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  className={`w-full rounded-xl px-4 py-2.5 text-left text-sm font-semibold transition-colors ${query.selectedPlatform === option.value ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                  onClick={() => onSelectPlatform(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="relative" ref={minRatingCountRef}>
          <button
            className={`flex items-center gap-2 px-4 h-11 rounded-full border font-bold text-[13.5px] cursor-pointer transition-all ${query.minRatingCount > 0 ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}
            onClick={onToggleMinRatingCount}
            disabled={isLoading}
          >
            <Users size={18} />
            <span>最低评分人数 {query.minRatingCount > 0 ? `≥ ${query.minRatingCount}` : '未设定'}</span>
          </button>
          {isMinRatingCountOpen && (
            <div className="absolute top-full right-0 z-50 mt-2 w-56 rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl">
              <div className="mb-2 text-xs font-black uppercase tracking-widest text-slate-400">最低评分人数</div>
              <input
                type="number"
                min={0}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 font-bold text-slate-700 outline-none focus:border-amber-400"
                value={minRatingCountDraft}
                onChange={(event) => onMinRatingCountDraftChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') onApplyMinRatingCount(Number(minRatingCountDraft) || 0);
                }}
              />
              <div className="mt-3 flex gap-2">
                {[0, 10, 30, 50].map((value) => (
                  <button
                    key={value}
                    className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600 hover:bg-slate-200"
                    onClick={() => onApplyMinRatingCount(value)}
                  >
                    {value === 0 ? '清除' : value}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <button
          className={`flex items-center gap-2 px-5 py-3 rounded-[32px] border-none font-bold text-sm cursor-pointer transition-all bg-slate-200 text-slate-800 hover:bg-slate-300 ${showFilters ? 'bg-primary-container ring-2 ring-primary border-primary' : ''}`}
          onClick={onToggleFilters}
        >
          <Settings size={18} />
          <span>高级筛选</span>
        </button>

        <UserMenu />
      </div>
    </div>
  );
};
