import React from 'react';
import { ChevronDown } from 'lucide-react';

interface FilterBarProps {
  onFilterChange: (filters: any) => void;
  onSortChange?: (sort: { field: string, order: string }) => void;
  isLoading?: boolean;
}

export const FilterBar: React.FC<FilterBarProps> = ({ onFilterChange, isLoading }) => {
  const [filters, setFilters] = React.useState({
    selectedType: 'all',
    selectedLanguage: 'all',
    selectedPlatform: 'all',
    selectedYears: ['all'],
    selectedMonths: ['all'],
    minRatingCount: 10
  });

  const categories = {
    types: [
      { label: '全部类型', value: 'all' },
      { label: 'PC游戏', value: 'pc' },
      { label: '汉化资源', value: 'chinese' },
      { label: '手机游戏', value: 'mobile' },
      { label: '模拟器资源', value: 'emulator' },
      { label: '生肉资源', value: 'raw' },
      { label: '直装资源', value: 'app' },
      { label: '补丁资源', value: 'patch' },
      { label: '游戏工具', value: 'tool' },
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
      { label: '2026', value: '2026' },
      { label: '2025', value: '2025' },
      { label: '2024', value: '2024' },
      { label: '2023', value: '2023' },
      { label: '2022', value: '2022' },
      ...Array.from({ length: 20 }, (_, i) => ({ label: `${2021 - i}年`, value: String(2021 - i) }))
    ],
    months: [
      { label: '全部月份', value: 'all' },
      ...Array.from({ length: 12 }, (_, i) => ({ label: `${i + 1}月`, value: String(i + 1) }))
    ]
  };

  const handleChange = (key: string, value: any) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  return (
    <div className="advanced-filter-pane">
      <div className="filter-grid">
        <div className="filter-item-box">
          <span className="floating-label">类型</span>
          <select value={filters.selectedType} onChange={(e) => handleChange('selectedType', e.target.value)} disabled={isLoading}>
             {categories.types.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <ChevronDown size={18} className="arrow" />
        </div>

        <div className="filter-item-box">
          <span className="floating-label">语言</span>
          <select value={filters.selectedLanguage} onChange={(e) => handleChange('selectedLanguage', e.target.value)} disabled={isLoading}>
             {categories.languages.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
          </select>
          <ChevronDown size={18} className="arrow" />
        </div>

        <div className="filter-item-box">
          <span className="floating-label">平台</span>
          <select value={filters.selectedPlatform} onChange={(e) => handleChange('selectedPlatform', e.target.value)} disabled={isLoading}>
             {categories.platforms.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
          <ChevronDown size={18} className="arrow" />
        </div>

        <div className="filter-item-box">
          <span className="floating-label">发售年份</span>
          <select value={filters.selectedYears[0]} onChange={(e) => handleChange('selectedYears', [e.target.value])} disabled={isLoading}>
             {categories.years.map(y => <option key={y.value} value={y.value}>{y.label}</option>)}
          </select>
          <ChevronDown size={18} className="arrow" />
        </div>

        <div className="filter-item-box">
          <span className="floating-label">发售月份</span>
          <select value={filters.selectedMonths[0]} onChange={(e) => handleChange('selectedMonths', [e.target.value])} disabled={isLoading}>
             {categories.months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
          <ChevronDown size={18} className="arrow" />
        </div>

        <div className="filter-item-box">
          <span className="floating-label">最低评分人数</span>
          <input 
            type="number" 
            value={filters.minRatingCount} 
            onChange={(e) => handleChange('minRatingCount', parseInt(e.target.value))} 
            disabled={isLoading}
            placeholder="10"
          />
        </div>
      </div>

      <style>{`
        .advanced-filter-pane { background: #f0f4f8; padding: 24px; border-radius: 24px; border: 1.5px solid #cbd5e1; margin-bottom: 24px; }
        .filter-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
        
        .filter-item-box { position: relative; border: 1.5px solid #94a3b8; border-radius: 12px; height: 56px; display: flex; align-items: center; padding: 0 16px; background: transparent; }
        .floating-label { position: absolute; top: -10px; left: 12px; background: #f0f4f8; padding: 0 4px; font-size: 13px; font-weight: 700; color: #64748b; }
        
        .filter-item-box select, .filter-item-box input { width: 100%; border: none; background: transparent; outline: none; font-size: 16px; font-weight: 600; color: #1e293b; appearance: none; cursor: pointer; }
        .filter-item-box input::-webkit-inner-spin-button { display: none; }
        
        .arrow { position: absolute; right: 16px; pointer-events: none; color: #64748b; }
        
        @media (max-width: 600px) {
          .filter-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
};
