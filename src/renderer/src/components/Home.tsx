import React, { useEffect, useState } from 'react';
import { useTouchGalStore } from '../store/useTouchGalStore';
import { ResourceCard } from './ResourceCard.tsx';
import { FilterBar } from './FilterBar.tsx';
import { SortDropdown } from './SortDropdown.tsx';
import { UserMenu } from './UserMenu.tsx';
import { Loader2, ChevronLeft, ChevronRight, Settings, SortAsc, SortDesc, X } from 'lucide-react';

export const Home: React.FC = () => {
  const { 
    resources, totalResources, currentPage, isLoading, error, 
    fetchResources, selectResource,
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
    <div className="flex-1 flex flex-col gap-2 p-4 pb-16 bg-slate-50/50">
      <div className="flex justify-between items-center w-full px-1 mb-2">
        <div className="flex items-center gap-1.5">
          <SortDropdown 
            value={sortField} 
            options={sortOptions} 
            onSelect={(val) => updateSort(val, sortOrder)}
            disabled={isLoading}
          />

          <button 
            className={`flex items-center gap-1.5 px-4 h-11 rounded-full border-1.5 border-transparent font-bold text-[13.5px] cursor-pointer transition-all bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed ${sortOrder === 'asc' ? 'bg-primary-container text-on-primary-container' : ''}`}
            onClick={() => updateSort(sortField, sortOrder === 'desc' ? 'asc' : 'desc')}
            disabled={isLoading}
          >
            {sortOrder === 'desc' ? <SortDesc size={18} /> : <SortAsc size={18} />}
            <span>{sortOrder === 'desc' ? '降序' : '升序'}</span>
          </button>
        </div>
        
        <div className="flex items-center gap-1.5">
          <button 
            className={`flex items-center gap-2 px-5 py-3 rounded-[32px] border-none font-bold text-sm cursor-pointer transition-all bg-slate-200 text-slate-800 hover:bg-slate-300 ${showFilters ? 'bg-primary-container ring-2 ring-primary border-primary' : ''}`} 
            onClick={() => setShowFilters(!showFilters)}
          >
            <Settings size={18} />
            <span>高级筛选</span>
          </button>
          
          <UserMenu />
        </div>
      </div>

      {selectedTags.length > 0 && (
        <div className="flex items-center gap-3 px-2 py-1 mb-2 overflow-x-auto scrollbar-hide">
          <div className="flex gap-2">
            {selectedTags.map(tag => (
              <div key={tag} className="flex items-center gap-2 px-3.5 py-1.5 bg-primary-container border border-primary/20 rounded-full font-bold text-[13px] text-on-primary-container shadow-xs animate-in zoom-in-95">
                <span>{tag}</span>
                <button 
                  onClick={() => removeTagFilter(tag)}
                  className="bg-transparent border-none text-on-primary-container cursor-pointer flex items-center justify-center p-0 hover:text-error"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
          <button onClick={clearTags} className="text-[13px] color-on-surface-variant font-bold bg-none border-none cursor-pointer underline whitespace-nowrap hover:text-primary">清空标签</button>
        </div>
      )}

      {showFilters && (
        <FilterBar 
          onFilterChange={handleFilterChange} 
          isLoading={isLoading} 
        />
      )}

      {isLoading ? (
        <div className="flex-1 flex flex-col items-center justify-center min-h-[400px] text-primary gap-4 font-bold text-lg">
          <Loader2 className="animate-spin" size={48} />
          <span className="animate-pulse">正在寻找更多游戏...</span>
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-8">
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
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 ml-10">
        <div className="flex items-center gap-3 bg-white/90 backdrop-blur-xl p-1.5 rounded-full shadow-2xl border border-outline-variant">
          <button 
            className="w-11 h-11 rounded-full border-none bg-surface-container text-on-surface-variant flex items-center justify-center cursor-pointer transition-all hover:bg-secondary-container disabled:opacity-30 disabled:cursor-not-allowed" 
            disabled={currentPage === 1 || isLoading}
            onClick={() => goToPage(currentPage - 1)}
          >
            <ChevronLeft size={24} />
          </button>
          
          <div className="bg-white border-1.5 border-outline-variant px-4 py-1.5 rounded-full font-extrabold text-[15px] text-primary flex items-center gap-2 shadow-inner">
            <input 
              type="text" 
              className="w-9 border-none bg-surface-container-low rounded-md py-0.5 text-center font-black text-[15px] text-primary outline-hidden focus:bg-primary-container focus:ring-1 focus:ring-primary" 
              value={jumpPage} 
              onChange={(e) => setJumpPage(e.target.value)}
              onKeyDown={handleJumpPage}
              onBlur={() => setJumpPage(String(currentPage))}
            />
            <span className="text-on-surface-variant/60 text-sm">/ {totalPages || 1}</span>
          </div>

          <button 
            className={`w-11 h-11 rounded-full border-none flex items-center justify-center cursor-pointer transition-all disabled:opacity-30 disabled:cursor-not-allowed ${currentPage === totalPages ? 'bg-surface-container text-on-surface-variant' : 'bg-primary text-on-primary shadow-lg hover:bg-primary/90'}`} 
            disabled={currentPage === totalPages || isLoading}
            onClick={() => goToPage(currentPage + 1)}
          >
            <ChevronRight size={24} />
          </button>
        </div>
      </div>
    </div>
  );
};
