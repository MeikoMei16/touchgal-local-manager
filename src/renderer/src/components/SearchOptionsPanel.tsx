import React from 'react';
import { Check, Search as SearchIcon, SlidersHorizontal, Sparkles } from 'lucide-react';
import { SortDropdown } from './SortDropdown';
import type { HomeQueryState, HomeSortField, HomeSortOrder } from '../features/home/homeState';

export interface SearchScopeOptions {
  searchInIntroduction: boolean;
  searchInAlias: boolean;
  searchInTag: boolean;
}

interface SearchOptionsPanelProps {
  options: SearchScopeOptions;
  nsfwMode: HomeQueryState['nsfwMode'];
  sortField: HomeSortField;
  sortOrder: HomeSortOrder;
  disabled?: boolean;
  onToggleOption: (key: keyof SearchScopeOptions) => void;
  onCycleNsfwMode: () => void;
  onSelectSortField: (field: HomeSortField) => void;
  onToggleSortOrder: () => void;
}

const searchOptionLabels: Record<keyof SearchScopeOptions, { title: string; description: string }> = {
  searchInAlias: {
    title: '别名',
    description: '匹配常见译名、日文原名和别名字段'
  },
  searchInIntroduction: {
    title: '简介',
    description: '匹配游戏简介正文中的相关关键词'
  },
  searchInTag: {
    title: '标签',
    description: '匹配标签文字中的相关关键词'
  }
};

const searchSortOptions: Array<{ label: string; value: HomeSortField }> = [
  { label: '资源更新时间', value: 'resource_update_time' },
  { label: '游戏创建时间', value: 'created' },
  { label: '评分', value: 'rating' },
  { label: '浏览量', value: 'view' },
  { label: '下载量', value: 'download' },
  { label: '收藏量', value: 'favorite' }
];

export const SearchOptionsPanel: React.FC<SearchOptionsPanelProps> = ({
  options,
  nsfwMode,
  sortField,
  sortOrder,
  disabled,
  onToggleOption,
  onCycleNsfwMode,
  onSelectSortField,
  onToggleSortOrder
}) => (
  <section className="relative z-30 overflow-visible rounded-[28px] border border-slate-200 bg-white/90 shadow-sm backdrop-blur-sm">
    <div className="flex flex-col gap-5 p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-slate-900">
            <SlidersHorizontal size={18} />
            <h3 className="text-lg font-black tracking-tight">搜索设置</h3>
          </div>
          <p className="mt-1 text-sm font-medium text-slate-500">
            标题始终参与关键词 fuzzy search。下面这些范围开关和排序会直接传给上游搜索接口。
          </p>
        </div>
        <div className="rounded-full bg-slate-100 px-4 py-2 text-xs font-black uppercase tracking-widest text-slate-500">
          Default: 全开
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[24px] border border-primary/20 bg-primary-container/60 p-4">
          <div className="flex items-center gap-2 text-on-primary-container">
            <SearchIcon size={18} />
            <span className="text-sm font-black">标题</span>
          </div>
          <p className="mt-2 text-sm font-medium text-on-primary-container/80">
            基础搜索项，始终开启，不能关闭。
          </p>
        </div>

        {(Object.keys(searchOptionLabels) as Array<keyof SearchScopeOptions>).map((key) => {
          const config = searchOptionLabels[key];
          const enabled = options[key];
          return (
            <button
              key={key}
              className={`rounded-[24px] border p-4 text-left transition-all disabled:cursor-not-allowed disabled:opacity-60 ${
                enabled
                  ? 'border-emerald-200 bg-emerald-50 shadow-sm'
                  : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
              }`}
              onClick={() => onToggleOption(key)}
              disabled={disabled}
            >
              <div className="flex items-center justify-between gap-3">
                <div className={`flex items-center gap-2 ${enabled ? 'text-emerald-900' : 'text-slate-700'}`}>
                  <Sparkles size={18} />
                  <span className="text-sm font-black">{config.title}</span>
                </div>
                <div
                  className={`flex h-6 w-6 items-center justify-center rounded-full border ${
                    enabled
                      ? 'border-emerald-500 bg-emerald-500 text-white'
                      : 'border-slate-300 bg-white text-transparent'
                  }`}
                >
                  <Check size={14} />
                </div>
              </div>
              <p className={`mt-2 text-sm font-medium ${enabled ? 'text-emerald-800/80' : 'text-slate-500'}`}>
                {config.description}
              </p>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-3 rounded-[24px] border border-slate-200 bg-slate-50/80 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="text-sm font-black text-slate-900">结果排序</div>
          <p className="mt-1 text-sm font-medium text-slate-500">
            使用上游搜索接口支持的排序字段、方向和 NSFW 数据域。
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            className="rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={onCycleNsfwMode}
            disabled={disabled}
          >
            {nsfwMode === 'safe' ? '仅 SFW' : nsfwMode === 'nsfw' ? '仅 NSFW' : '全部内容'}
          </button>
          <SortDropdown
            value={sortField}
            options={searchSortOptions}
            onSelect={(value) => onSelectSortField(value as HomeSortField)}
            disabled={disabled}
          />
          <button
            className="rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={onToggleSortOrder}
            disabled={disabled}
          >
            {sortOrder === 'desc' ? '降序' : '升序'}
          </button>
        </div>
      </div>
    </div>
  </section>
);
