import React, { useEffect, useState } from 'react';
import { HomeQueryState, useUIStore } from '../store/useTouchGalStore';
import { ResourceCard } from './ResourceCard.tsx';
import { FilterBar } from './FilterBar.tsx';
import { SortDropdown } from './SortDropdown.tsx';
import { UserMenu } from './UserMenu.tsx';
import { Loader2, ChevronLeft, ChevronRight, Settings, SortAsc, SortDesc, X, ChevronDown, Laptop, Users, Shield, ShieldCheck, AlertTriangle } from 'lucide-react';

export const Home: React.FC = () => {
  const { 
    hasHydratedUi,
    resources, totalResources, currentPage, isLoading, error, 
    fetchResources, selectResource,
    removeTagFilter, clearTags, advancedFilterDraft,
    homeMode, activeNsfwDomain, advancedBuildProgress, exitAdvancedMode, clearAdvancedSearch,
    updateAdvancedFilterDraft, setActiveNsfwDomain, enterAdvancedMode, applyAdvancedFilters,
    advancedDatasetsByDomain,
    lastHomeQuery, setLastHomeQuery, setCurrentPage
  } = useUIStore();
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
  const sortField = lastHomeQuery.sortField;
  const sortOrder = lastHomeQuery.sortOrder;
  const platformOptions = [
    { label: '全部平台', value: 'all' },
    { label: 'Windows', value: 'windows' },
    { label: 'Android', value: 'android' },
    { label: 'MacOS', value: 'macos' },
    { label: 'iOS', value: 'ios' },
    { label: 'Linux', value: 'linux' }
  ];

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

  const mapDomain = (value: string) => {
    if (value === 'nsfw') return 'nsfw';
    if (value === 'all') return 'all';
    return 'sfw';
  };

  const getNsfwButtonContent = (value: HomeQueryState['nsfwMode']) => {
    switch (value) {
      case 'nsfw':
        return { icon: <AlertTriangle size={18} />, label: '仅限 R18', className: 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100' };
      case 'all':
        return { icon: <Shield size={18} />, label: '混合内容', className: 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200' };
      default:
        return { icon: <ShieldCheck size={18} />, label: '仅限全年龄', className: 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100' };
    }
  };

  // 上游: nsfwMode / selectedPlatform → 直接走 API，无需 advanced mode
  // 中游: yearConstraints / minRatingCount / minRatingScore / minCommentCount → 需要 advanced mode (全量拉取后本地过滤)
  // 下游: selectedTags → 需要 advanced mode + 标签富化
  const requiresAdvancedMode = (filters: HomeQueryState) =>
    (filters.yearConstraints?.length ?? 0) > 0 ||
    (filters.minRatingCount ?? 0) > 0 ||
    (filters.minRatingScore ?? 0) > 0 ||
    (filters.minCommentCount ?? 0) > 0 ||
    (filters.selectedTags?.length ?? 0) > 0;

  const syncDraftFromQuery = (query: HomeQueryState) => {
    const nextDomain = mapDomain(query.nsfwMode ?? 'safe');
    setActiveNsfwDomain(nextDomain);
    updateAdvancedFilterDraft({
      nsfwMode: nextDomain,
      selectedPlatform: query.selectedPlatform ?? 'all',
      yearConstraints: query.yearConstraints ?? [],
      selectedTags: query.selectedTags ?? [],
      minRatingCount: query.minRatingCount ?? 0,
      minRatingScore: query.minRatingScore ?? 0,
      minCommentCount: query.minCommentCount ?? 0
    });
    return nextDomain;
  };

  useEffect(() => {
    if (!hasHydratedUi) return;
    syncDraftFromQuery(lastHomeQuery);
    // DO NOT automatically trigger enterAdvancedMode on mount.
    // Let the user stay in Normal Mode (Network IO) unless they manually Apply/Submit.
  }, [hasHydratedUi, lastHomeQuery, setActiveNsfwDomain, updateAdvancedFilterDraft]);

  useEffect(() => {
    if (!hasHydratedUi) return;
    if (homeMode === 'normal') {
      const queryParams = { 
        ...lastHomeQuery, 
        nsfwMode: lastHomeQuery.nsfwMode || activeNsfwDomain || 'safe',
        sortOrder 
      };
      console.log('[Home] useEffect triggering fetchResources:', queryParams);
      fetchResources(currentPage, queryParams);
    }
  }, [hasHydratedUi, fetchResources, homeMode, lastHomeQuery, currentPage, sortField, sortOrder, activeNsfwDomain]);

  const commitFilterDraft = (filters: Partial<HomeQueryState>) => {
    const newQuery = { ...lastHomeQuery, ...filters };
    const nextDomain = syncDraftFromQuery(newQuery);

    setLastHomeQuery(newQuery);

    return { newQuery, nextDomain };
  };

  const handleFilterChange = (filters: Partial<HomeQueryState>) => {
    const { newQuery } = commitFilterDraft(filters);

    // 上游筛选 (NSFW/Platform) 变化时，检测是否影响已构建的 advanced dataset
    // 如果 domain 切换了，旧数据集已失效，必须退出 advanced mode 重走上游
    const domainChanged = filters.nsfwMode !== undefined && mapDomain(filters.nsfwMode) !== activeNsfwDomain;
    const platformChanged = filters.selectedPlatform !== undefined;

    if (!requiresAdvancedMode(newQuery)) {
      // 纯上游筛选：直接 API 请求，无需 advanced mode
      if (homeMode !== 'normal') exitAdvancedMode();
    } else if (homeMode === 'advanced_ready' && !domainChanged && !platformChanged) {
      // Advanced 已就绪且上游未变化：直接本地重过滤，零网络 IO
      applyAdvancedFilters(currentPage, sortField, sortOrder);
    }
    // 其他情况 (advanced_building 中 / domain 变化)：等待用户点击「应用筛选」再重建
  };

  const cycleNsfwMode = () => {
    const modes: HomeQueryState['nsfwMode'][] = ['safe', 'nsfw', 'all'];
    const currentIndex = modes.indexOf(lastHomeQuery.nsfwMode);
    const nextMode = modes[(currentIndex + 1) % modes.length];
    handleFilterChange({ nsfwMode: nextMode });
  };

  const applyMinRatingCount = (value: number) => {
    handleFilterChange({ minRatingCount: Math.max(0, value) });
    setIsMinRatingCountOpen(false);
  };

  const handleAdvancedSubmit = async (filters: Partial<HomeQueryState>) => {
    const { newQuery } = commitFilterDraft(filters);

    if (!requiresAdvancedMode(newQuery)) {
      if (homeMode !== 'normal') {
        exitAdvancedMode();
      }
      setShowFilters(false);
      return;
    }

    await enterAdvancedMode(sortField, sortOrder);
    setShowFilters(false);
  };

  const applyFiltersFromCurrentDraft = async (overrides: Partial<HomeQueryState>) => {
    const merged = {
      nsfwMode:
        overrides.nsfwMode ??
        (advancedFilterDraft.nsfwMode === 'nsfw'
          ? 'nsfw'
          : advancedFilterDraft.nsfwMode === 'all'
            ? 'all'
            : 'safe'),
      selectedPlatform: overrides.selectedPlatform ?? advancedFilterDraft.selectedPlatform,
      yearConstraints: overrides.yearConstraints ?? advancedFilterDraft.yearConstraints,
      selectedTags: overrides.selectedTags ?? advancedFilterDraft.selectedTags,
      minRatingCount: overrides.minRatingCount ?? advancedFilterDraft.minRatingCount,
      minRatingScore: overrides.minRatingScore ?? advancedFilterDraft.minRatingScore,
      minCommentCount: overrides.minCommentCount ?? advancedFilterDraft.minCommentCount
    };

    await handleAdvancedSubmit(merged);
  };

  const sortOptions = [
    { label: '资源更新时间', value: 'resource_update_time' },
    { label: '游戏创建时间', value: 'created' },
    { label: '评分', value: 'rating' },
    { label: '浏览量', value: 'view' },
    { label: '下载量', value: 'download' },
    { label: '收藏量', value: 'favorite' }
  ];

  const updateSort = (field: HomeQueryState['sortField'], order: HomeQueryState['sortOrder']) => {
    const nextQuery = { ...lastHomeQuery, sortField: field, sortOrder: order };
    setLastHomeQuery(nextQuery);
    if (homeMode !== 'normal') applyAdvancedFilters(currentPage, field, order);
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
    applyAdvancedFilters(page, sortField, sortOrder);
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
      <div className="flex justify-between items-center w-full px-1 mb-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <SortDropdown 
            value={sortField} 
            options={sortOptions} 
            onSelect={(val) => updateSort(val as HomeQueryState['sortField'], sortOrder)}
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
        
        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          <button
            className={`flex items-center gap-2 px-4 h-11 rounded-full border font-bold text-[13.5px] cursor-pointer transition-all ${getNsfwButtonContent(lastHomeQuery.nsfwMode).className}`}
            onClick={cycleNsfwMode}
            disabled={isLoading}
          >
            {getNsfwButtonContent(lastHomeQuery.nsfwMode).icon}
            <span>{getNsfwButtonContent(lastHomeQuery.nsfwMode).label}</span>
          </button>

          <div className="relative" ref={platformRef}>
            <button
              className={`flex items-center gap-2 px-4 h-11 rounded-full border font-bold text-[13.5px] cursor-pointer transition-all ${lastHomeQuery.selectedPlatform !== 'all' ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}
              onClick={() => setIsPlatformOpen((open) => !open)}
              disabled={isLoading}
            >
              <Laptop size={18} />
              <span>{platformOptions.find((option) => option.value === lastHomeQuery.selectedPlatform)?.label ?? '全部平台'}</span>
              <ChevronDown size={16} className={`transition-transform ${isPlatformOpen ? 'rotate-180' : ''}`} />
            </button>
            {isPlatformOpen && (
              <div className="absolute top-full left-0 z-50 mt-2 w-44 rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl">
                {platformOptions.map((option) => (
                  <button
                    key={option.value}
                    className={`w-full rounded-xl px-4 py-2.5 text-left text-sm font-semibold transition-colors ${lastHomeQuery.selectedPlatform === option.value ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                    onClick={() => {
                      setIsPlatformOpen(false);
                      handleFilterChange({ selectedPlatform: option.value });
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="relative" ref={minRatingCountRef}>
            <button
              className={`flex items-center gap-2 px-4 h-11 rounded-full border font-bold text-[13.5px] cursor-pointer transition-all ${lastHomeQuery.minRatingCount > 0 ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}
              onClick={() => setIsMinRatingCountOpen((open) => !open)}
              disabled={isLoading}
            >
              <Users size={18} />
              <span>最低评分人数 {lastHomeQuery.minRatingCount > 0 ? `≥ ${lastHomeQuery.minRatingCount}` : '未设定'}</span>
            </button>
            {isMinRatingCountOpen && (
              <div className="absolute top-full right-0 z-50 mt-2 w-56 rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl">
                <div className="mb-2 text-xs font-black uppercase tracking-widest text-slate-400">最低评分人数</div>
                <input
                  type="number"
                  min={0}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 font-bold text-slate-700 outline-none focus:border-amber-400"
                  value={minRatingCountDraft}
                  onChange={(event) => setMinRatingCountDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      applyMinRatingCount(Number(minRatingCountDraft) || 0);
                    }
                  }}
                />
                <div className="mt-3 flex gap-2">
                  {[0, 10, 30, 50].map((value) => (
                    <button
                      key={value}
                      className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600 hover:bg-slate-200"
                      onClick={() => {
                        setMinRatingCountDraft(String(value));
                        applyMinRatingCount(value);
                      }}
                    >
                      {value === 0 ? '清除' : value}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

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
