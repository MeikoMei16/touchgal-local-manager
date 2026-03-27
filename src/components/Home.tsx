import React, { useEffect, useState } from 'react';
import { useTouchGalStore } from '../store/useTouchGalStore';
import { ResourceCard } from './ResourceCard.tsx';
import { FilterBar } from './FilterBar.tsx';
import { Loader2, Search, ChevronLeft, ChevronRight, ArrowDown, Settings } from 'lucide-react';

export const Home: React.FC = () => {
  const { resources, totalResources, currentPage, isLoading, error, fetchResources, searchResources, selectResource } = useTouchGalStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [lastQuery, setLastQuery] = useState<any>({});
  const [showFilters, setShowFilters] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  const totalPages = Math.ceil(totalResources / 12);

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
      <div className="top-action-bar">
        <div className="pill-group">
          <div className="sort-dropdown-pill">
            <span className="label">排序</span>
            <div className="current-sort">
               <span className="text">更新时间</span>
               <ArrowDown size={14} />
            </div>
          </div>
          <button className="icon-pill blue">
            <ArrowDown size={18} />
            <span>降序</span>
          </button>
        </div>
        
        <div className="action-group">
          {showSearch && (
            <input 
              type="text" 
              className="search-input-pill" 
              placeholder="搜索资源..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearch}
              autoFocus
            />
          )}
          <button className={`icon-pill-circle ${showSearch ? 'active' : ''}`} onClick={() => setShowSearch(!showSearch)}>
            <Search size={20} />
          </button>
          <button className={`icon-pill high-screen ${showFilters ? 'active' : ''}`} onClick={() => setShowFilters(!showFilters)}>
            <Settings size={18} />
            <span>高级筛选</span>
          </button>
        </div>
      </div>

      {showFilters && (
        <FilterBar 
          onFilterChange={handleFilterChange} 
          onSortChange={handleSortChange} 
          isLoading={isLoading} 
        />
      )}

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
            className="pagi-btn-circle" 
            disabled={currentPage === 1 || isLoading}
            onClick={() => goToPage(currentPage - 1)}
          >
            <ChevronLeft size={24} />
          </button>
          
          <div className="page-indicator-pill">
            {currentPage} / {totalPages || 1}
          </div>

          <button 
            className="pagi-btn-circle active" 
            disabled={currentPage === totalPages || isLoading}
            onClick={() => goToPage(currentPage + 1)}
          >
            <ChevronRight size={24} />
          </button>
        </div>
      </div>

      <style>{`
        .home-container { flex: 1; display: flex; flex-direction: column; gap: 20px; padding: 20px; padding-bottom: 60px; background-color: #f8fafc; }
        
        .top-action-bar { display: flex; justify-content: space-between; align-items: center; }
        .pill-group, .action-group { display: flex; align-items: center; gap: 12px; }
        
        .sort-dropdown-pill { background: #fff; border: 1.5px solid #cbd5e1; border-radius: 12px; padding: 6px 12px; display: flex; flex-direction: column; min-width: 140px; position: relative; }
        .sort-dropdown-pill .label { position: absolute; top: -10px; left: 10px; background: #f8fafc; padding: 0 4px; font-size: 11px; font-weight: 700; color: #64748b; }
        .current-sort { display: flex; align-items: center; justify-content: space-between; margin-top: 2px; }
        .current-sort .text { font-size: 15px; font-weight: 600; }
        
        .icon-pill { display: flex; align-items: center; gap: 8px; padding: 12px 20px; border-radius: 32px; border: none; font-weight: 700; font-size: 14px; cursor: pointer; transition: all 0.2s; background: #e2e8f0; color: #1e293b; }
        .icon-pill.blue { background: #dcfce7; color: #166534; } 
        .icon-pill.high-screen.active { background: #bae6fd; border: 1.5px solid #0369a1; }
        .icon-pill-circle.active { background: #bae6fd; border: 1.5px solid #0369a1; }
        .icon-pill-circle { width: 44px; height: 44px; border-radius: 22px; display: flex; align-items: center; justify-content: center; background: #e0f2fe; color: #0369a1; border: none; cursor: pointer; transition: all 0.2s; }
        
        .search-input-pill { background: #fff; border: 1.5px solid #cbd5e1; border-radius: 22px; padding: 0 16px; height: 44px; width: 220px; font-size: 14px; font-weight: 600; outline: none; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
        .search-input-pill:focus { border-color: #0369a1; box-shadow: 0 4px 12px rgba(3, 105, 161, 0.1); }
        
        .resource-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 24px; }
        .loading-container { display: flex; justify-content: center; padding: 24px; color: #0369a1; }
        .animate-spin { animation: spin 1s linear infinite; }
        
        .pagination-bar-sticky { position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%); z-index: 100; margin-left: 40px; /* offset for sidebar */ }
        .pagination-content { display: flex; align-items: center; gap: 12px; background: rgba(255, 255, 255, 0.9); backdrop-filter: blur(12px); padding: 6px; border-radius: 40px; box-shadow: 0 8px 32px rgba(0,0,0,0.1); border: 1px solid #e2e8f0; }
        .pagi-btn-circle { width: 44px; height: 44px; border-radius: 22px; border: none; background: #f1f5f9; color: #64748b; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s; }
        .pagi-btn-circle.active { background: #0369a1; color: #fff; }
        .pagi-btn-circle:disabled { opacity: 0.3; cursor: not-allowed; }
        .page-indicator-pill { background: #fff; border: 1.5px solid #e2e8f0; padding: 6px 28px; border-radius: 20px; font-weight: 800; font-size: 15px; color: #0369a1; }
        
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};
