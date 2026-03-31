import React, { useEffect, useState } from 'react';
import { useUIStore } from '../store/useTouchGalStore';
import { HomeQueryState } from '../features/home/homeState';
import { ResourceCard } from './ResourceCard.tsx';
import { FilterBar } from './FilterBar.tsx';
import { Loader2, X } from 'lucide-react';
import { HomeToolbar } from './home/HomeToolbar';
import { HomePagination } from './home/HomePagination';
import { useHomeQueryController } from '../features/home/useHomeQueryController';

export const Home: React.FC = () => {
  const { 
    resources, totalResources, currentPage, isLoading, error, 
    fetchResources, selectResource,
    removeTagFilter, clearTags, advancedFilterDraft,
    homeMode, activeNsfwDomain, advancedBuildProgress, clearAdvancedSearch,
    advancedDatasetsByDomain,
    lastHomeQuery, setCurrentPage
  } = useUIStore();
  const {
    sortField,
    sortOrder,
    handleFilterChange,
    handleAdvancedSubmit,
    applyFiltersFromCurrentDraft,
    updateSort,
    goToPage: goToAdvancedPage
  } = useHomeQueryController();
  const [showFilters, setShowFilters] = useState(false);
  const [isPlatformOpen, setIsPlatformOpen] = useState(false);
  const [isMinRatingCountOpen, setIsMinRatingCountOpen] = useState(false);
  const [minRatingCountDraft, setMinRatingCountDraft] = useState(String(lastHomeQuery.minRatingCount || 0));
  const platformRef = React.useRef<HTMLDivElement>(null);
  const minRatingCountRef = React.useRef<HTMLDivElement>(null);

  const totalPages = Math.ceil(totalResources / 24);
  const [jumpPage, setJumpPage] = useState(String(currentPage));
  const activeAdvancedDataset = advancedDatasetsByDomain[activeNsfwDomain];
  const failedTagCount = activeAdvancedDataset?.failedTagIds.length ?? 0;

  useEffect(() => {
    setMinRatingCountDraft(String(lastHomeQuery.minRatingCount || 0));
  }, [lastHomeQuery.minRatingCount]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (platformRef.current && !platformRef.current.contains(event.target as Node)) setIsPlatformOpen(false);
      if (minRatingCountRef.current && !minRatingCountRef.current.contains(event.target as Node)) setIsMinRatingCountOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  const cycleNsfwMode = () => {
    const modes: HomeQueryState['nsfwMode'][] = ['safe', 'nsfw', 'all'];
    const currentIndex = modes.indexOf(lastHomeQuery.nsfwMode);
    const nextMode = modes[(currentIndex + 1) % modes.length];
    handleFilterChange({ nsfwMode: nextMode });
  };

  const applyMinRatingCount = (value: number) => {
    handleFilterChange({ minRatingCount: Math.max(0, value) });
    setMinRatingCountDraft(String(Math.max(0, value)));
    setIsMinRatingCountOpen(false);
  };

  const handleExitAdvancedMode = () => {
    clearAdvancedSearch();
    setShowFilters(false);
  };

  const goToPage = (page: number) => {
    if (page < 1 || page > totalPages) return;
    if (homeMode === 'normal') {
      setCurrentPage(page);
      return;
    }
    goToAdvancedPage(page);
  };

  if (error) {
    return (
      <div className="error-container">
        <p>{error}</p>
        <button onClick={() => fetchResources(currentPage, lastHomeQuery)}>Retry</button>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col gap-2 p-4 pb-16 bg-slate-50/50">
      <HomeToolbar
        isLoading={isLoading}
        showFilters={showFilters}
        sortField={sortField}
        sortOrder={sortOrder}
        query={lastHomeQuery}
        isPlatformOpen={isPlatformOpen}
        isMinRatingCountOpen={isMinRatingCountOpen}
        minRatingCountDraft={minRatingCountDraft}
        platformRef={platformRef}
        minRatingCountRef={minRatingCountRef}
        onToggleFilters={() => setShowFilters(!showFilters)}
        onUpdateSort={updateSort}
        onCycleNsfwMode={cycleNsfwMode}
        onTogglePlatform={() => setIsPlatformOpen((open) => !open)}
        onSelectPlatform={(value) => {
          setIsPlatformOpen(false);
          handleFilterChange({ selectedPlatform: value });
        }}
        onToggleMinRatingCount={() => setIsMinRatingCountOpen((open) => !open)}
        onMinRatingCountDraftChange={setMinRatingCountDraft}
        onApplyMinRatingCount={applyMinRatingCount}
      />

      {homeMode !== 'normal' && (
        <div className="flex items-center justify-between gap-4 px-4 py-3 mb-2 rounded-3xl border border-amber-200 bg-amber-50 text-amber-900 shadow-sm">
          <div className="flex flex-col gap-1">
            <span className="text-sm font-black uppercase tracking-wide">
              {homeMode === 'advanced_building' ? '高级筛选构建中' : '高级筛选已就绪'}
            </span>
            <span className="text-sm font-semibold">
              当前数据域: {activeNsfwDomain.toUpperCase()} · {advancedBuildProgress.message || '本地高级筛选数据已切换为独立模式'}
            </span>
            {advancedFilterDraft.selectedTags.length > 0 && failedTagCount > 0 && (
              <span className="text-xs font-bold text-amber-800/80">
                标签富化失败 {failedTagCount} 条，这些候选已从严格标签结果中排除
              </span>
            )}
          </div>
          <button
            className="px-4 py-2 rounded-full border border-amber-300 bg-white font-bold text-sm cursor-pointer transition-colors hover:bg-amber-100"
            onClick={handleExitAdvancedMode}
          >
            退出高级模式
          </button>
        </div>
      )}

      {advancedFilterDraft.selectedTags.length > 0 && (
        <div className="flex items-center gap-3 px-2 py-1 mb-2 overflow-x-auto scrollbar-hide">
          <div className="flex gap-2">
            {advancedFilterDraft.selectedTags.map(tag => (
              <div key={tag} className="flex items-center gap-2 px-3.5 py-1.5 bg-primary-container border border-primary/20 rounded-full font-bold text-[13px] text-on-primary-container shadow-xs animate-in zoom-in-95">
                <span>{tag}</span>
                <button 
                  onClick={() => {
                    removeTagFilter(tag);
                    void applyFiltersFromCurrentDraft({
                      selectedTags: advancedFilterDraft.selectedTags.filter((currentTag) => currentTag !== tag)
                    });
                  }}
                  className="bg-transparent border-none text-on-primary-container cursor-pointer flex items-center justify-center p-0 hover:text-error"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={() => {
              clearTags();
              void applyFiltersFromCurrentDraft({ selectedTags: [] });
            }}
            className="text-[13px] color-on-surface-variant font-bold bg-none border-none cursor-pointer underline whitespace-nowrap hover:text-primary"
          >
            清空标签
          </button>
        </div>
      )}

      {showFilters && (
        <FilterBar 
          onFilterChange={handleFilterChange} 
          onSubmit={handleAdvancedSubmit}
          isLoading={isLoading} 
        />
      )}

      {isLoading && resources.length === 0 ? (
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
      <HomePagination
        currentPage={currentPage}
        totalPages={totalPages}
        isLoading={isLoading}
        jumpPage={jumpPage}
        onJumpPageChange={setJumpPage}
        onJumpPageCommit={handleJumpPage}
        onJumpPageReset={() => setJumpPage(String(currentPage))}
        onGoToPage={goToPage}
      />
    </div>
  );
};
