import React from 'react';
import { SortAsc, SortDesc, ChevronDown, Calendar, Hash, Globe, Monitor } from 'lucide-react';

interface FilterBarProps {
  onFilterChange: (filters: any) => void;
  onSortChange: (sort: { field: string, order: string }) => void;
  isLoading?: boolean;
}

export const FilterBar: React.FC<FilterBarProps> = ({ onFilterChange, onSortChange, isLoading }) => {
  const [activeSort, setActiveSort] = React.useState('resource_update_time');
  const [activeOrder, setActiveOrder] = React.useState('desc');
  const [filters, setFilters] = React.useState({
    type: 'all',
    language: 'all',
    platform: 'all',
    year: 'all',
    month: 'all'
  });

  const categories = {
    types: [
      { label: '全部类型', value: 'all' },
      { label: 'PC游戏', value: 'pc' },
      { label: '汉化资源', value: 'chinese' },
      { label: '手机游戏', value: 'mobile' },
      { label: '模拟器资源', value: 'emulator' },
      { label: '生肉资源', value: 'row' },
      { label: '直装资源', value: 'app' },
      { label: '补丁资源', value: 'patch' },
      { label: '游戏工具', value: 'tool' },
      { label: '官方通知', value: 'notice' },
      { label: '其它', value: 'other' }
    ],
    languages: [
      { label: '全部语言', value: 'all' },
      { label: '简体中文', value: 'zh-Hans' },
      { label: '繁體中文', value: 'zh-Hant' },
      { label: '日本語', value: 'ja' },
      { label: 'English', value: 'en' },
      { label: '其它', value: 'other' }
    ],
    platforms: [
      { label: '全部平台', value: 'all' },
      { label: 'Windows', value: 'windows' },
      { label: 'Android', value: 'android' },
      { label: 'MacOS', value: 'macos' },
      { label: 'iOS', value: 'ios' },
      { label: 'Linux', value: 'linux' },
      { label: '其它', value: 'other' }
    ],
    years: [
      { label: '全部年份', value: 'all' },
      { label: '未发售', value: 'future' },
      { label: '未知年份', value: 'unknown' },
      ...Array.from({ length: 45 }, (_, i) => ({ label: `${2025 - i}年`, value: String(2025 - i) }))
    ]
  };

  const sortOptions = [
    { label: '更新时间', value: 'resource_update_time' },
    { label: '创建时间', value: 'created' },
    { label: '浏览量', value: 'view' },
    { label: '下载量', value: 'download' },
    { label: '收藏量', value: 'favorite' },
    { label: '评分', value: 'rating' },
  ];

  const handleSort = (field: string) => {
    const newOrder = field === activeSort && activeOrder === 'desc' ? 'asc' : 'desc';
    setActiveSort(field);
    setActiveOrder(newOrder);
    onSortChange({ field, order: newOrder });
  };

  const handleFilterChange = (key: string, value: string) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    onFilterChange({
      ...newFilters,
      sortField: activeSort,
      sortOrder: activeOrder
    });
  };

  return (
    <div className="filter-bar">
      <div className="filter-rows">
        <div className="filter-row">
           <div className="filter-select-wrapper">
            <Hash size={14} className="icon-prefix" />
            <select value={filters.type} disabled={isLoading} onChange={(e) => handleFilterChange('type', e.target.value)}>
              {categories.types.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
            <ChevronDown size={14} className="select-arrow" />
          </div>

          <div className="filter-select-wrapper">
            <Globe size={14} className="icon-prefix" />
            <select value={filters.language} disabled={isLoading} onChange={(e) => handleFilterChange('language', e.target.value)}>
              {categories.languages.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select>
            <ChevronDown size={14} className="select-arrow" />
          </div>

          <div className="filter-select-wrapper">
            <Monitor size={14} className="icon-prefix" />
            <select value={filters.platform} disabled={isLoading} onChange={(e) => handleFilterChange('platform', e.target.value)}>
              {categories.platforms.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
            <ChevronDown size={14} className="select-arrow" />
          </div>

          <div className="filter-select-wrapper">
            <Calendar size={14} className="icon-prefix" />
            <select value={filters.year} disabled={isLoading} onChange={(e) => handleFilterChange('year', e.target.value)}>
              {categories.years.map(y => <option key={y.value} value={y.value}>{y.label}</option>)}
            </select>
            <ChevronDown size={14} className="select-arrow" />
          </div>
        </div>

        <div className="sort-group">
          {sortOptions.map(option => (
            <button 
              key={option.value}
              className={`sort-btn ${activeSort === option.value ? 'active' : ''}`}
              onClick={() => handleSort(option.value)}
            >
              {option.label}
              {activeSort === option.value && (
                activeOrder === 'desc' ? <SortDesc size={14} /> : <SortAsc size={14} />
              )}
            </button>
          ))}
        </div>
      </div>

      <style>{`
        .filter-bar { display: flex; flex-direction: column; gap: 16px; padding: 16px; background-color: var(--md-sys-color-surface-container-low); border-radius: 24px; border: 1px solid var(--md-sys-color-outline-variant); }
        .filter-rows { display: flex; flex-direction: column; gap: 12px; }
        .filter-row { display: flex; flex-wrap: wrap; gap: 10px; }
        .filter-select-wrapper { position: relative; display: flex; align-items: center; gap: 6px; padding: 8px 14px; background-color: var(--md-sys-color-surface-container); border-radius: 12px; border: 1.5px solid var(--md-sys-color-outline-variant); transition: all 0.2s ease; flex: 1; min-width: 120px; }
        .filter-select-wrapper:hover { border-color: var(--md-sys-color-primary); background: var(--md-sys-color-surface-container-high); }
        .filter-select-wrapper select { appearance: none; background: transparent; border: none; outline: none; font-size: 13px; font-weight: 600; color: var(--md-sys-color-on-surface); cursor: pointer; width: 100%; padding-right: 20px; }
        .icon-prefix { color: var(--md-sys-color-primary); opacity: 0.8; }
        .select-arrow { position: absolute; right: 10px; pointer-events: none; opacity: 0.6; }
        .sort-group { display: flex; gap: 6px; overflow-x: auto; padding-top: 4px; scrollbar-width: none; }
        .sort-group::-webkit-scrollbar { display: none; }
        .sort-btn { display: flex; align-items: center; gap: 6px; padding: 6px 14px; border-radius: 10px; border: 1.5px solid transparent; background: var(--md-sys-color-surface-container-highest); font-size: 13px; font-weight: 700; cursor: pointer; color: var(--md-sys-color-on-surface-variant); transition: all 0.2s ease; white-space: nowrap; }
        .sort-btn:hover { background-color: var(--md-sys-color-primary-container); color: var(--md-sys-color-on-primary-container); }
        .sort-btn.active { background-color: var(--md-sys-color-primary); color: var(--md-sys-color-on-primary); }
      `}</style>
    </div>
  );
};
