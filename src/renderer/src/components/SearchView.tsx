import React, { useEffect, useRef, useState } from 'react';
import { Loader2, Search as SearchIcon, X } from 'lucide-react';
import { TouchGalClient } from '../data/TouchGalClient';
import { ResourceCard } from './ResourceCard';
import { HomePagination } from './home/HomePagination';
import { SearchOptionsPanel, type SearchScopeOptions } from './SearchOptionsPanel';
import { useUIStore } from '../store/useTouchGalStore';
import { useAuthStore } from '../store/useTouchGalStore';
import type { TouchGalResource } from '../types';
import type { HomeSortField, HomeSortOrder } from '../features/home/homeState';
import { runBounded } from '../features/home/advancedDataset';

const SEARCH_PAGE_SIZE = 20;
const SEARCH_UPSTREAM_PAGE_SIZE = 24;
const SEARCH_RATING_CONCURRENCY = 4;

type LocalRatingProgressStage = 'idle' | 'fetching' | 'sorting' | 'ready' | 'error';

interface LocalRatingProgress {
  stage: LocalRatingProgressStage;
  completed: number;
  total: number;
  message: string;
}

const idleLocalRatingProgress = (): LocalRatingProgress => ({
  stage: 'idle',
  completed: 0,
  total: 0,
  message: ''
});

const defaultSearchOptions = (): SearchScopeOptions => ({
  searchInIntroduction: true,
  searchInAlias: true,
  searchInTag: true
});

const paginateSearchResults = (items: TouchGalResource[], page: number) => {
  const start = (page - 1) * SEARCH_PAGE_SIZE;
  return items.slice(start, start + SEARCH_PAGE_SIZE);
};

const sortSearchResultsByRating = (items: TouchGalResource[], sortOrder: HomeSortOrder) => {
  const direction = sortOrder === 'asc' ? 1 : -1;
  return [...items].sort((left, right) => {
    const leftRating = left.averageRating || 0;
    const rightRating = right.averageRating || 0;
    if (leftRating !== rightRating) {
      return leftRating > rightRating ? direction : -direction;
    }

    const leftCreated = left.created ? new Date(left.created).getTime() : 0;
    const rightCreated = right.created ? new Date(right.created).getTime() : 0;
    if (leftCreated !== rightCreated) {
      return leftCreated > rightCreated ? -1 : 1;
    }

    return left.uniqueId.localeCompare(right.uniqueId);
  });
};

export const SearchView: React.FC = () => {
  const selectResource = useUIStore((state) => state.selectResource);
  const setSessionError = useAuthStore((state) => state.setSessionError);

  const [queryInput, setQueryInput] = useState('');
  const [activeKeyword, setActiveKeyword] = useState('');
  const [resources, setResources] = useState<TouchGalResource[]>([]);
  const [totalResources, setTotalResources] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [jumpPage, setJumpPage] = useState('1');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchOptions, setSearchOptions] = useState<SearchScopeOptions>(defaultSearchOptions);
  const [sortField, setSortField] = useState<HomeSortField>('created');
  const [sortOrder, setSortOrder] = useState<HomeSortOrder>('desc');
  const [localRatingResults, setLocalRatingResults] = useState<TouchGalResource[] | null>(null);
  const [localRatingProgress, setLocalRatingProgress] = useState<LocalRatingProgress>(idleLocalRatingProgress);
  const requestKeyRef = useRef(0);
  const isLocalRatingMode = sortField === 'rating';

  const totalPages = Math.max(1, Math.ceil(totalResources / SEARCH_PAGE_SIZE));

  useEffect(() => {
    setJumpPage(String(currentPage));
  }, [currentPage]);

  useEffect(() => {
    if (!activeKeyword) {
      setResources([]);
      setTotalResources(0);
      setCurrentPage(1);
      setJumpPage('1');
      setHasSearched(false);
      setError(null);
      setLocalRatingResults(null);
      setLocalRatingProgress(idleLocalRatingProgress());
    }
  }, [activeKeyword]);

  useEffect(() => {
    if (!activeKeyword || isLocalRatingMode) return;

    const requestKey = requestKeyRef.current + 1;
    requestKeyRef.current = requestKey;
    setIsLoading(true);
    setError(null);
    setLocalRatingResults(null);
    setLocalRatingProgress(idleLocalRatingProgress());

    void TouchGalClient.searchResources(activeKeyword, currentPage, SEARCH_PAGE_SIZE, {
      searchOption: searchOptions,
      sortField,
      sortOrder
    })
      .then((data) => {
        if (requestKeyRef.current !== requestKey) return;
        setResources(data.list);
        setTotalResources(data.total);
        setHasSearched(true);
      })
      .catch((err: unknown) => {
        if (requestKeyRef.current !== requestKey) return;
        const message =
          err instanceof Error && err.message ? err.message : '搜索失败';
        setError(message);
        setResources([]);
        setTotalResources(0);
        setHasSearched(true);
        if (message.includes('SESSION_EXPIRED')) {
          setSessionError('SESSION_EXPIRED');
        }
      })
      .finally(() => {
        if (requestKeyRef.current !== requestKey) return;
        setIsLoading(false);
      });
  }, [activeKeyword, currentPage, isLocalRatingMode, searchOptions, setSessionError, sortField, sortOrder]);

  useEffect(() => {
    if (!activeKeyword || !isLocalRatingMode) return;

    const requestKey = requestKeyRef.current + 1;
    requestKeyRef.current = requestKey;
    setIsLoading(true);
    setError(null);
    setHasSearched(true);
    setResources([]);
    setTotalResources(0);
    setLocalRatingResults([]);

    const updateLocalRatingProgress = (next: LocalRatingProgress) => {
      if (requestKeyRef.current !== requestKey) return;
      setLocalRatingProgress(next);
    };

    const publishPartialResults = (items: TouchGalResource[], message: string, completed: number, total: number) => {
      if (requestKeyRef.current !== requestKey) return;
      const sorted = sortSearchResultsByRating(items, sortOrder);
      setLocalRatingResults(sorted);
      setTotalResources(sorted.length);
      updateLocalRatingProgress({
        stage: 'fetching',
        completed,
        total,
        message
      });
    };

    void (async () => {
      const collectedById = new Map<string, TouchGalResource>();
      updateLocalRatingProgress({
        stage: 'fetching',
        completed: 0,
        total: 0,
        message: '正在拉取评分候选，命中即渐进渲染...'
      });

      const firstPage = await TouchGalClient.searchResources(activeKeyword, 1, SEARCH_UPSTREAM_PAGE_SIZE, {
        searchOption: searchOptions,
        sortField: 'created',
        sortOrder: 'desc'
      });

      const upstreamTotalPages = Math.max(1, Math.ceil(firstPage.total / SEARCH_UPSTREAM_PAGE_SIZE));
      for (const resource of firstPage.list) {
        collectedById.set(resource.uniqueId, resource);
      }
      publishPartialResults(
        Array.from(collectedById.values()),
        `正在拉取评分候选 (1/${upstreamTotalPages})，已渐进渲染 ${collectedById.size} 条...`,
        1,
        upstreamTotalPages
      );

      let completedPages = 1;
      const remainingPages = Array.from({ length: upstreamTotalPages - 1 }, (_, index) => index + 2);
      await runBounded(remainingPages, SEARCH_RATING_CONCURRENCY, async (pageNum) => {
        const page = await TouchGalClient.searchResources(activeKeyword, pageNum, SEARCH_UPSTREAM_PAGE_SIZE, {
          searchOption: searchOptions,
          sortField: 'created',
          sortOrder: 'desc'
        });
        for (const resource of page.list) {
          collectedById.set(resource.uniqueId, resource);
        }
        completedPages += 1;
        publishPartialResults(
          Array.from(collectedById.values()),
          `正在拉取评分候选 (${completedPages}/${upstreamTotalPages})，已渐进渲染 ${collectedById.size} 条...`,
          completedPages,
          upstreamTotalPages
        );
        return page;
      });

      if (requestKeyRef.current !== requestKey) return;
      const finalSorted = sortSearchResultsByRating(Array.from(collectedById.values()), sortOrder);
      setLocalRatingResults(finalSorted);
      setTotalResources(finalSorted.length);
      updateLocalRatingProgress({
        stage: 'ready',
        completed: upstreamTotalPages,
        total: upstreamTotalPages,
        message: `评分本地重排已完成，共 ${finalSorted.length} 条结果。`
      });
    })()
      .catch((err: unknown) => {
        if (requestKeyRef.current !== requestKey) return;
        const message =
          err instanceof Error && err.message ? err.message : '搜索失败';
        setError(message);
        setResources([]);
        setTotalResources(0);
        setLocalRatingResults(null);
        setLocalRatingProgress({
          stage: 'error',
          completed: 0,
          total: 0,
          message: `评分本地重排失败: ${message}`
        });
        if (message.includes('SESSION_EXPIRED')) {
          setSessionError('SESSION_EXPIRED');
        }
      })
      .finally(() => {
        if (requestKeyRef.current !== requestKey) return;
        setIsLoading(false);
      });
  }, [activeKeyword, isLocalRatingMode, searchOptions, setSessionError, sortOrder]);

  useEffect(() => {
    if (sortField !== 'rating' || !localRatingResults) return;
    setResources(paginateSearchResults(localRatingResults, currentPage));
    setTotalResources(localRatingResults.length);
  }, [currentPage, localRatingResults, sortField]);

  const executeSearch = () => {
    const normalized = queryInput.trim();
    if (!normalized) return;
    setCurrentPage(1);
    setJumpPage('1');
    setActiveKeyword(normalized);
  };

  const clearSearch = () => {
    requestKeyRef.current += 1;
    setQueryInput('');
    setActiveKeyword('');
    setResources([]);
    setTotalResources(0);
    setCurrentPage(1);
    setJumpPage('1');
    setIsLoading(false);
    setHasSearched(false);
    setError(null);
    setLocalRatingResults(null);
    setLocalRatingProgress(idleLocalRatingProgress());
  };

  const updateSearchOptions = (key: keyof SearchScopeOptions) => {
    setCurrentPage(1);
    setJumpPage('1');
    setSearchOptions((current) => ({
      ...current,
      [key]: !current[key]
    }));
  };

  const updateSortField = (value: HomeSortField) => {
    setCurrentPage(1);
    setJumpPage('1');
    setSortField(value);
    if (value !== 'rating') {
      setLocalRatingProgress(idleLocalRatingProgress());
    }
  };

  const toggleSortOrder = () => {
    setCurrentPage(1);
    setJumpPage('1');
    setSortOrder((current) => (current === 'desc' ? 'asc' : 'desc'));
  };

  const goToPage = (page: number) => {
    if (page < 1 || page > totalPages) return;
    if (isLoading && !isLocalRatingMode) return;
    setCurrentPage(page);
  };

  const handleJumpPage = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return;
    const page = Number.parseInt(jumpPage, 10);
    if (Number.isNaN(page) || page < 1 || page > totalPages) {
      setJumpPage(String(currentPage));
      return;
    }
    goToPage(page);
  };

  const showProgressiveRatingResults = isLocalRatingMode && resources.length > 0;
  const showFullscreenLoading = isLoading && !showProgressiveRatingResults;

  return (
    <div className="flex-1 flex flex-col gap-6 overflow-visible p-4 pb-16 bg-slate-50/50">
      <section className="rounded-[28px] border border-slate-200 bg-white/90 shadow-sm backdrop-blur-sm">
        <div className="flex flex-col gap-3 p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-xl font-black tracking-tight text-slate-900">搜索 Galgame</h3>
          <p className="mt-1 text-sm font-medium text-slate-500">
            这里只有关键词关联的 fuzzy search。标题始终参与匹配，其余搜索范围和排序可在下方设置面板里勾选。评分排序会先抓取搜索候选，再在本地重排。
          </p>
            </div>
            {activeKeyword && (
              <div className="rounded-full bg-primary-container px-4 py-2 text-sm font-bold text-on-primary-container">
                当前关键词: {activeKeyword}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3 md:flex-row">
            <div className="flex flex-1 items-center gap-3 rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-3 shadow-inner">
              <SearchIcon size={18} className="shrink-0 text-slate-400" />
              <input
                type="text"
                value={queryInput}
                onChange={(event) => setQueryInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') executeSearch();
                }}
                placeholder="输入部分游戏名、别名或关键词"
                className="w-full border-none bg-transparent text-base font-semibold text-slate-800 outline-hidden placeholder:text-slate-400"
              />
              {queryInput && (
                <button
                  className="flex h-8 w-8 items-center justify-center rounded-full border-none bg-slate-200 text-slate-500 transition-colors hover:bg-slate-300 hover:text-slate-700"
                  onClick={() => setQueryInput('')}
                >
                  <X size={16} />
                </button>
              )}
            </div>

            <div className="flex gap-3">
              <button
                className="rounded-[20px] border-none bg-primary px-6 py-3 text-sm font-black text-on-primary shadow-lg shadow-primary/20 transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={executeSearch}
                disabled={!queryInput.trim() || isLoading}
              >
                搜索
              </button>
              <button
                className="rounded-[20px] border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={clearSearch}
                disabled={(!queryInput && !activeKeyword && !hasSearched) || isLoading}
              >
                清空
              </button>
            </div>
          </div>
        </div>
      </section>

      <SearchOptionsPanel
        options={searchOptions}
        sortField={sortField}
        sortOrder={sortOrder}
        disabled={isLoading}
        onToggleOption={updateSearchOptions}
        onSelectSortField={updateSortField}
        onToggleSortOrder={toggleSortOrder}
      />

      {sortField === 'rating' && localRatingProgress.stage !== 'idle' && (
        <section
          className={`rounded-[24px] border px-5 py-4 shadow-sm ${
            localRatingProgress.stage === 'error'
              ? 'border-rose-200 bg-rose-50 text-rose-800'
              : localRatingProgress.stage === 'ready'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                : 'border-amber-200 bg-amber-50 text-amber-900'
          }`}
        >
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-sm font-black">
                {localRatingProgress.stage === 'fetching' && '评分排序: 拉取候选中'}
                {localRatingProgress.stage === 'sorting' && '评分排序: 本地重排中'}
                {localRatingProgress.stage === 'ready' && '评分排序: 已完成'}
                {localRatingProgress.stage === 'error' && '评分排序: 失败'}
              </div>
              <p className="mt-1 text-sm font-medium">
                {localRatingProgress.message}
              </p>
            </div>

            {localRatingProgress.total > 0 && (
              <div className="rounded-full bg-white/70 px-4 py-2 text-sm font-black">
                {localRatingProgress.completed}/{localRatingProgress.total}
              </div>
            )}
          </div>
        </section>
      )}

      {error && (
        <section className="rounded-[24px] border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-semibold text-rose-800">
          {error}
        </section>
      )}

      {showFullscreenLoading ? (
        <div className="flex-1 flex flex-col items-center justify-center min-h-[400px] gap-4 text-primary">
          <Loader2 className="animate-spin" size={48} />
          <span className="text-lg font-bold">正在搜索相关资源...</span>
        </div>
      ) : hasSearched && resources.length === 0 ? (
        <div className="flex-1 rounded-[28px] border border-dashed border-slate-300 bg-white/70 px-8 py-16 text-center shadow-sm">
          <h3 className="text-xl font-black tracking-tight text-slate-800">未找到相关内容</h3>
          <p className="mt-3 text-sm font-medium text-slate-500">
            试试更短的关键词，或者使用游戏的日文原名 / 常见别名。
          </p>
        </div>
      ) : hasSearched ? (
        <>
          <div className="relative z-0 grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-8">
            {resources.map((resource) => (
              <ResourceCard
                key={resource.uniqueId}
                resource={resource}
                onClick={selectResource}
              />
            ))}
          </div>

          {totalResources > SEARCH_PAGE_SIZE && (
            <HomePagination
              currentPage={currentPage}
              totalPages={totalPages}
              isLoading={isLoading && !isLocalRatingMode}
              jumpPage={jumpPage}
              onJumpPageChange={setJumpPage}
              onJumpPageCommit={handleJumpPage}
              onJumpPageReset={() => setJumpPage(String(currentPage))}
              onGoToPage={goToPage}
            />
          )}
        </>
      ) : (
        <div className="flex-1 rounded-[28px] border border-slate-200 bg-white/70 px-8 py-16 shadow-sm">
          <div className="mx-auto max-w-2xl text-center">
            <h3 className="text-2xl font-black tracking-tight text-slate-900">关键词搜索</h3>
            <p className="mt-3 text-sm font-medium leading-7 text-slate-500">
              搜索页只负责关键词关联 fuzzy search，不承载首页高级筛选。
              你可以勾选别名、简介、标签等检索范围，并用上游支持的排序字段重排结果。
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
