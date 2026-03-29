import React, { useEffect, useState } from 'react';
import { useTouchGalStore } from '../store/useTouchGalStore';
import { ResourceCard } from './ResourceCard.tsx';
import { FilterBar } from './FilterBar.tsx';
import { SortDropdown } from './SortDropdown.tsx';
import { Loader2, ChevronLeft, ChevronRight, Settings, User, SortAsc, SortDesc, X } from 'lucide-react';

export const Home: React.FC = () => {
  const { 
    resources, totalResources, currentPage, isLoading, error, 
    fetchResources, selectResource, user, logout, setIsLoginOpen,
    selectedTags, removeTagFilter, clearTags
  } = useTouchGalStore();
  const [lastQuery, setLastQuery] = useState<any>({});
  const [showFilters, setShowFilters] = useState(false);
  const [sortField, setSortField] = useState('resource_update_time');
  const [sortOrder, setSortOrder] = useState('desc');

  const totalPages = Math.ceil(totalResources / 24);
  const [jumpPage, setJumpPage] = useState(String(currentPage));

  useEffect(() => {
    setJumpPage(String(currentPage));
    const scrollArea = document.querySelector('.scroll-area') as HTMLElement;
    if (scrollArea) {
      scrollArea.scrollTo({ top: 0, behavior: 'auto' });
      scrollArea.focus();
    }
  }, [currentPage]);

  const handleJumpPage = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const page = parseInt(jumpPage);
      if (!isNaN(page) && page >= 1 && page <= totalPages) {
        goToPage(page);
      } else {
        setJumpPage(String(currentPage));
      }
    }
  };

  useEffect(() => {
    fetchResources(1, { ...lastQuery, sortField, sortOrder });
  }, [fetchResources, lastQuery, sortField, sortOrder]);

  const handleFilterChange = (filters: any) => {
    const newQuery = { ...lastQuery, ...filters };
    setLastQuery(newQuery);
    fetchResources(1, { ...newQuery, sortField, sortOrder });
  };

  const sortOptions = [
    { label: '资源更新时间', value: 'resource_update_time' },
    { label: '游戏创建时间', value: 'created' },
    { label: '评分', value: 'rating' },
    { label: '浏览量', value: 'visit' },
    { label: '下载量', value: 'download' },
    { label: '收藏量', value: 'favorite' }
  ];

  const updateSort = (field: string, order: string) => {
    setSortField(field);
    setSortOrder(order);
    fetchResources(1, { ...lastQuery, sortField: field, sortOrder: order });
  };

  const goToPage = (page: number) => {
    if (page < 1 || page > totalPages) return;
    fetchResources(page, { ...lastQuery, sortField, sortOrder });
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
          <SortDropdown 
            value={sortField} 
            options={sortOptions} 
            onSelect={(val) => updateSort(val, sortOrder)}
            disabled={isLoading}
          />

          <button 
            className={`order-toggle-btn-header ${sortOrder === 'asc' ? 'asc' : 'desc'}`}
            onClick={() => updateSort(sortField, sortOrder === 'desc' ? 'asc' : 'desc')}
            disabled={isLoading}
          >
            {sortOrder === 'desc' ? <SortDesc size={18} /> : <SortAsc size={18} />}
            <span>{sortOrder === 'desc' ? '降序' : '升序'}</span>
          </button>
        </div>
        
        <div className="action-group">
          <button className={`icon-pill high-screen ${showFilters ? 'active' : ''}`} onClick={() => setShowFilters(!showFilters)}>
            <Settings size={18} />
            <span>高级筛选</span>
          </button>

          {user ? (
            <button className="icon-pill blue" onClick={logout}>
              <User size={18} />
              <span>{user.name || '已登录'}</span>
            </button>
          ) : (
            <button className="icon-pill" onClick={() => setIsLoginOpen(true)}>
              <User size={18} />
              <span>登录</span>
            </button>
          )}
        </div>
      </div>

      {selectedTags.length > 0 && (
        <div className="active-tags-row">
          <div className="tag-chips-container">
            {selectedTags.map(tag => (
              <div key={tag} className="tag-chip-active">
                <span>{tag}</span>
                <button 
                  onClick={() => removeTagFilter(tag)}
                  className="remove-tag-btn"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
          <button onClick={clearTags} className="clear-all-tags">清空标签</button>
        </div>
      )}

      {showFilters && (
        <FilterBar 
          onFilterChange={handleFilterChange} 
          isLoading={isLoading} 
        />
      )}

      {isLoading ? (
        <div className="loading-container">
          <Loader2 className="animate-spin" size={48} />
          <span>正在寻找更多游戏...</span>
        </div>
      ) : (
        <div className="resource-grid">
          {resources?.map((resource: any) => (
            <ResourceCard 
              key={resource.uniqueId} 
              resource={resource} 
              onClick={selectResource}
            />
          ))}
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
            <input 
              type="text" 
              className="page-input" 
              value={jumpPage} 
              onChange={(e) => setJumpPage(e.target.value)}
              onKeyDown={handleJumpPage}
              onBlur={() => setJumpPage(String(currentPage))}
            />
            <span className="total-pages">/ {totalPages || 1}</span>
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
        .home-container { flex: 1; display: flex; flex-direction: column; gap: 8px; padding: 16px; padding-bottom: 60px; background-color: #f8fafc; }
        
        .top-action-bar { display: flex; justify-content: space-between; align-items: center; width: 100%; padding: 0 4px; margin-bottom: 8px; }
        .pill-group { display: flex; align-items: center; gap: 6px; }
        .action-group { display: flex; align-items: center; gap: 6px; }

        .order-toggle-btn-header { display: flex; align-items: center; gap: 6px; padding: 0 14px; border-radius: 40px; border: 1.5px solid transparent; height: 44px; font-weight: 700; font-size: 13.5px; cursor: pointer; transition: all 0.2s; background: #f1f5f9; color: #475569; position: relative; }
        .order-toggle-btn-header:hover { background: #e2e8f0; }
        .order-toggle-btn-header.active { background: #f1f5f9; }

        .icon-pill { display: flex; align-items: center; gap: 8px; padding: 12px 20px; border-radius: 32px; border: none; font-weight: 700; font-size: 14px; cursor: pointer; transition: all 0.2s; background: #e2e8f0; color: #1e293b; }
        .icon-pill.blue { background: #e0f2fe; color: #0369a1; }
        .icon-pill.high-screen.active { background: #bae6fd; border: 1.5px solid #0369a1; }
        
        .resource-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 24px; }
        .loading-container { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 400px; color: #0369a1; gap: 16px; font-weight: 600; font-size: 16px; }
        .animate-spin { animation: spin 1s linear infinite; }
        
        .pagination-bar-sticky { position: fixed; bottom: 0; left: 50%; transform: translateX(-50%); z-index: 100; margin-left: 36px; /* offset for compact sidebar */ }
        .pagination-content { display: flex; align-items: center; gap: 12px; background: rgba(255, 255, 255, 0.9); backdrop-filter: blur(12px); padding: 6px; border-radius: 40px; box-shadow: 0 8px 32px rgba(0,0,0,0.1); border: 1px solid #e2e8f0; }
        .pagi-btn-circle { width: 44px; height: 44px; border-radius: 22px; border: none; background: #f1f5f9; color: #64748b; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s; }
        .pagi-btn-circle.active { background: #0369a1; color: #fff; }
        .pagi-btn-circle:disabled { opacity: 0.3; cursor: not-allowed; }
        .page-indicator-pill { background: #fff; border: 1.5px solid #e2e8f0; padding: 4px 16px; border-radius: 20px; font-weight: 800; font-size: 15px; color: #0369a1; display: flex; align-items: center; gap: 8px; }
        .page-input { width: 36px; border: none; background: #f1f5f9; border-radius: 6px; padding: 2px 4px; text-align: center; font-weight: 800; font-size: 15px; color: #0369a1; outline: none; }
        .page-input:focus { background: #e0f2fe; box-shadow: 0 0 0 1.5px #0369a1; }
        .total-pages { color: #64748b; font-size: 14px; }
        
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        
        .active-tags-row { display: flex; align-items: center; gap: 12px; padding: 4px 8px; margin-bottom: 8px; overflow-x: auto; scrollbar-width: none; }
        .tag-chips-container { display: flex; gap: 8px; }
        .tag-chip-active { display: flex; align-items: center; gap: 6px; padding: 6px 12px; background: #e0f2fe; border: 1.5px solid #0369a1; border-radius: 20px; font-weight: 700; font-size: 13px; color: #0369a1; }
        .remove-tag-btn { background: transparent; border: none; color: #0369a1; cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 0; }
        .clear-all-tags { font-size: 13px; color: #64748b; font-weight: 700; background: none; border: none; cursor: pointer; text-decoration: underline; white-space: nowrap; }
      `}</style>
    </div>
  );
};
