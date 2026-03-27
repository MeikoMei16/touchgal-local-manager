import React from 'react';
import { Filter, SortAsc, SortDesc, ChevronDown } from 'lucide-react';

interface FilterBarProps {
  onFilterChange: (filters: any) => void;
  onSortChange: (sort: { field: string, order: string }) => void;
  isLoading?: boolean;
}

export const FilterBar: React.FC<FilterBarProps> = ({ onFilterChange, onSortChange, isLoading }) => {
  const [activeSort, setActiveSort] = React.useState('resource_update_time');
  const [activeOrder, setActiveOrder] = React.useState('desc');
  const [selectedPlatform, setSelectedPlatform] = React.useState('all');
  const [selectedLanguage, setSelectedLanguage] = React.useState('all');

  const platforms = [
    { label: 'All Platforms', value: 'all' },
    { label: 'PC', value: 'PC' },
    { label: 'Android', value: 'Android' },
    { label: 'IOS', value: 'IOS' },
    { label: 'Switch', value: 'Switch' },
    { label: 'PSV', value: 'PSV' },
  ];

  const languages = [
    { label: 'All Languages', value: 'all' },
    { label: 'Chinese', value: 'Chinese' },
    { label: 'Japanese', value: 'Japanese' },
    { label: 'English', value: 'English' },
  ];

  const sortOptions = [
    { label: 'Update Time', value: 'resource_update_time' },
    { label: 'Release Date', value: 'releasedDate' },
    { label: 'Rating', value: 'averageRating' },
    { label: 'Downloads', value: 'resource' },
    { label: 'Favorites', value: 'favorite_folder' },
  ];

  const handleSort = (field: string) => {
    const newOrder = field === activeSort && activeOrder === 'desc' ? 'asc' : 'desc';
    setActiveSort(field);
    setActiveOrder(newOrder);
    onSortChange({ field, order: newOrder });
  };

  const updateFilters = (platform: string, language: string) => {
    onFilterChange({
      selectedPlatform: platform,
      selectedLanguage: language,
      sortField: activeSort,
      sortOrder: activeOrder
    });
  };

  return (
    <div className="filter-bar">
      <div className="filter-group">
        <div className="filter-select-wrapper">
          <Filter size={16} />
          <select 
            value={selectedPlatform} 
            disabled={isLoading}
            onChange={(e) => {
              setSelectedPlatform(e.target.value);
              updateFilters(e.target.value, selectedLanguage);
            }}
          >
            {platforms.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
          <ChevronDown size={14} className="select-arrow" />
        </div>

        <div className="filter-select-wrapper">
          <select 
            value={selectedLanguage} 
            disabled={isLoading}
            onChange={(e) => {
              setSelectedLanguage(e.target.value);
              updateFilters(selectedPlatform, e.target.value);
            }}
          >
            {languages.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
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

      <style>{`
        .filter-bar { display: flex; flex-wrap: wrap; gap: 16px; align-items: center; justify-content: space-between; padding: 12px 16px; background-color: var(--md-sys-color-surface); border-radius: var(--radius-lg); border: 1px solid var(--md-sys-color-outline-variant); }
        .filter-group { display: flex; gap: 12px; }
        .filter-select-wrapper { position: relative; display: flex; align-items: center; gap: 8px; padding: 6px 12px; background-color: var(--md-sys-color-surface-container-low); border-radius: var(--radius-full); border: 1px solid var(--md-sys-color-outline-variant); transition: all 0.2s ease; }
        .filter-select-wrapper:hover { border-color: var(--md-sys-color-primary); }
        .filter-select-wrapper select { appearance: none; background: transparent; border: none; outline: none; font-size: 13px; font-weight: 500; color: var(--md-sys-color-on-surface); cursor: pointer; padding-right: 18px; }
        .select-arrow { position: absolute; right: 8px; pointer-events: none; opacity: 0.6; }
        .sort-group { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 4px; }
        .sort-btn { display: flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: var(--radius-full); border: 1px solid transparent; background: transparent; font-size: 13px; font-weight: 500; cursor: pointer; color: var(--md-sys-color-on-surface-variant); transition: all 0.2s ease; }
        .sort-btn:hover { background-color: var(--md-sys-color-surface-container-high); }
        .sort-btn.active { background-color: var(--md-sys-color-primary-container); color: var(--md-sys-color-on-primary-container); border-color: var(--md-sys-color-primary); }
      `}</style>
    </div>
  );
};
