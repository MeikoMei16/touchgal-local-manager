import React, { useEffect, useState } from 'react';
import { useTouchGalStore } from '../store/useTouchGalStore';
import { ResourceCard } from './ResourceCard.tsx';
import { FilterBar } from './FilterBar.tsx';
import { Loader2, Search } from 'lucide-react';

export const Home: React.FC = () => {
  const { resources, totalResources, currentPage, isLoading, error, fetchResources, searchResources, selectResource } = useTouchGalStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [lastQuery, setLastQuery] = useState<any>({});

  useEffect(() => {
    if (searchQuery.trim() === '') {
      fetchResources(1, lastQuery);
    }
  }, [fetchResources, searchQuery, lastQuery]);

  const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchQuery.trim() !== '') {
      searchResources(searchQuery, 1, lastQuery);
    }
  };

  const handleFilterChange = (filters: any) => {
    const newQuery = { ...lastQuery, ...filters };
    setLastQuery(newQuery);
    if (searchQuery.trim() !== '') {
      searchResources(searchQuery, 1, newQuery);
    } else {
      fetchResources(1, newQuery);
    }
  };

  const handleSortChange = (sort: { field: string, order: string }) => {
    const newQuery = { ...lastQuery, sortField: sort.field, sortOrder: sort.order };
    setLastQuery(newQuery);
    if (searchQuery.trim() !== '') {
      searchResources(searchQuery, 1, newQuery);
    } else {
      fetchResources(1, newQuery);
    }
  };

  if (error) {
    return (
      <div className="error-container">
        <p>{error}</p>
        <button onClick={() => fetchResources(1, lastQuery)}>Retry</button>
      </div>
    );
  }

  return (
    <div className="home-container">
      <div className="search-bar-inline">
        <div className="search-input-wrapper">
          <Search size={18} />
          <input 
            type="text" 
            placeholder="Search for Galgames (Press Enter)..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleSearch}
          />
          {searchQuery && (
            <button className="clear-search" onClick={() => setSearchQuery('')}>
              <Loader2 size={14} className={isLoading ? 'animate-spin' : ''} />
            </button>
          )}
        </div>
      </div>

      <FilterBar 
        onFilterChange={handleFilterChange} 
        onSortChange={handleSortChange} 
        isLoading={isLoading} 
      />

      <div className="resource-grid">
        {resources?.map((resource: any) => (
          <ResourceCard 
            key={resource.uniqueId} 
            resource={resource} 
            onClick={selectResource}
          />
        ))}
      </div>

      {isLoading && (
        <div className="loading-container">
          <Loader2 className="animate-spin" />
        </div>
      )}

      {resources?.length < totalResources && !isLoading && (
        <div className="pagination-container">
          <button className="secondary-btn" onClick={() => fetchResources(currentPage + 1)}>
            Load More
          </button>
        </div>
      )}

      <style>{`
        .home-container { flex: 1; display: flex; flex-direction: column; gap: 24px; }
        .search-bar-inline { padding: 8px 16px; background-color: var(--md-sys-color-surface-variant); border-radius: var(--radius-xl); display: flex; align-items: center; border: 1px solid transparent; }
        .search-input-wrapper { display: flex; align-items: center; gap: 12px; flex: 1; }
        .search-input-wrapper input { border: none; background: transparent; outline: none; font-family: var(--font-body); font-size: 15px; flex: 1; }
        .resource-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 24px; padding-bottom: 40px; }
        .loading-container { display: flex; justify-content: center; padding: 24px; color: var(--md-sys-color-primary); }
        .animate-spin { animation: spin 1s linear infinite; }
        .pagination-container { display: flex; justify-content: center; padding: 24px; }
        .secondary-btn { padding: 10px 24px; background: transparent; border: 1px solid var(--md-sys-color-outline); border-radius: var(--radius-xl); cursor: pointer; color: var(--md-sys-color-on-surface); font-weight: 500; }
        .secondary-btn:hover { background: var(--md-sys-color-surface-variant); }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};
