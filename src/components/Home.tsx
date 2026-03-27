import React, { useEffect, useState } from 'react';
import { useTouchGalStore } from '../store/useTouchGalStore';
import { ResourceCard } from './ResourceCard.tsx';
import { FilterBar } from './FilterBar.tsx';
import { Loader2, Search, ChevronLeft, ChevronRight, Hash } from 'lucide-react';

export const Home: React.FC = () => {
  const { resources, totalResources, currentPage, isLoading, error, fetchResources, searchResources, selectResource } = useTouchGalStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [lastQuery, setLastQuery] = useState<any>({});
  const [jumpPage, setJumpPage] = useState('');

  const totalPages = Math.ceil(totalResources / 12); // Assuming 12 per page from API

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

  const goToPage = (page: number) => {
    if (page < 1 || page > totalPages) return;
    if (searchQuery.trim() !== '') {
      searchResources(searchQuery, page, lastQuery);
    } else {
      fetchResources(page, lastQuery);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleJump = (e: React.FormEvent) => {
    e.preventDefault();
    const p = parseInt(jumpPage);
    if (!isNaN(p)) {
      goToPage(p);
      setJumpPage('');
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

      {/* Pagination Bar */}
      <div className="pagination-bar-sticky">
        <div className="pagination-content">
          <button 
            className="pagi-btn" 
            disabled={currentPage === 1 || isLoading}
            onClick={() => goToPage(currentPage - 1)}
          >
            <ChevronLeft size={20} />
          </button>
          
          <div className="page-info">
            <span className="current">{currentPage}</span>
            <span className="separator">/</span>
            <span className="total">{totalPages || 1}</span>
          </div>

          <button 
            className="pagi-btn" 
            disabled={currentPage === totalPages || isLoading}
            onClick={() => goToPage(currentPage + 1)}
          >
            <ChevronRight size={20} />
          </button>

          <form className="jump-form" onSubmit={handleJump}>
            <div className="jump-input-wrapper">
              <Hash size={12} />
              <input 
                type="text" 
                placeholder="Jump" 
                value={jumpPage} 
                onChange={(e) => setJumpPage(e.target.value)}
              />
            </div>
          </form>
        </div>
      </div>

      <style>{`
        .home-container { flex: 1; display: flex; flex-direction: column; gap: 24px; padding-bottom: 80px; }
        .search-bar-inline { padding: 12px 20px; background-color: var(--md-sys-color-surface-container-high); border-radius: 20px; display: flex; align-items: center; border: 1.5px solid var(--md-sys-color-outline-variant); }
        .search-input-wrapper { display: flex; align-items: center; gap: 12px; flex: 1; }
        .search-input-wrapper input { border: none; background: transparent; outline: none; font-family: var(--font-body); font-size: 15px; flex: 1; color: var(--md-sys-color-on-surface); font-weight: 500; }
        .resource-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 24px; }
        .loading-container { display: flex; justify-content: center; padding: 24px; color: var(--md-sys-color-primary); }
        .animate-spin { animation: spin 1s linear infinite; }
        
        .pagination-bar-sticky { position: sticky; bottom: 24px; align-self: center; background: var(--md-sys-color-surface-container-highest); padding: 8px 24px; border-radius: 32px; box-shadow: 0 16px 32px rgba(0, 0, 0, 0.2); border: 1px solid var(--md-sys-color-outline-variant); z-index: 50; animation: slideUp 0.4s cubic-bezier(0, 1, 0, 1); }
        .pagination-content { display: flex; align-items: center; gap: 20px; }
        .pagi-btn { width: 44px; height: 44px; border-radius: 22px; border: none; background: transparent; color: var(--md-sys-color-primary); display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s; }
        .pagi-btn:hover:not(:disabled) { background: var(--md-sys-color-primary-container); }
        .pagi-btn:disabled { color: var(--md-sys-color-outline); cursor: not-allowed; }
        
        .page-info { display: flex; align-items: center; gap: 8px; font-weight: 800; font-size: 18px; }
        .page-info .current { color: var(--md-sys-color-primary); }
        .page-info .separator { opacity: 0.3; }
        .page-info .total { color: var(--md-sys-color-on-surface-variant); }
        
        .jump-form { border-left: 1px solid var(--md-sys-color-outline-variant); padding-left: 20px; }
        .jump-input-wrapper { background: var(--md-sys-color-surface-container); border-radius: 12px; padding: 4px 12px; display: flex; align-items: center; gap: 6px; border: 1px solid transparent; transition: all 0.2s; }
        .jump-input-wrapper:focus-within { border-color: var(--md-sys-color-primary); background: var(--md-sys-color-surface); }
        .jump-input-wrapper input { width: 40px; border: none; background: transparent; outline: none; font-size: 13px; font-weight: 700; color: var(--md-sys-color-on-surface); text-align: center; }
        
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      `}</style>
    </div>
  );
};
