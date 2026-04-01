import { TouchGalClient } from '../../data/TouchGalClient';
import {
  ADVANCED_CATALOG_CONCURRENCY,
  ADVANCED_PAGE_SIZE,
  createRatingSessionId,
  getRatingCatalogKey,
  paginateAdvancedResources,
  runBounded,
  sortAdvancedResources,
  toAdvancedResourceRecord,
  uniqueById
} from '../../features/home/advancedDataset';
import {
  AdvancedResourceRecord,
  defaultBuildProgress,
  defaultRatingCatalogCache
} from '../../features/home/homeState';
import type { UIGetState, UISetState } from '../uiStoreTypes';

export const createRatingCatalogActions = (set: UISetState, get: UIGetState) => ({
  buildRatingCatalog: async (sortOrder: string) => {
    const query = get().lastHomeQuery;
    const domain = get().activeNsfwDomain;
    const catalogKey = getRatingCatalogKey(domain, query.selectedPlatform, query.minRatingCount);
    const sessionId = createRatingSessionId();

    set({ homeMode: 'rating_building', ratingBuildSessionId: sessionId, error: null });

    const existing = get().ratingCatalogsByKey[catalogKey];
    if (existing && existing.resources.length > 0 && existing.upstreamKey === catalogKey) {
      set({
        homeMode: 'rating_ready',
        ratingBuildProgress: {
          stage: 'ready',
          completed: existing.resources.length,
          total: existing.resources.length,
          message: `复用已缓存评分目录，${existing.resources.length} 个条目`
        }
      });
      get().applyRatingSort(1, sortOrder);
      return;
    }

    try {
      const upstreamQuery: Record<string, unknown> = {
        nsfwMode: query.nsfwMode,
        selectedPlatform: query.selectedPlatform
      };
      if (query.minRatingCount > 0) upstreamQuery.minRatingCount = query.minRatingCount;

      set((s) => ({
        ratingCatalogsByKey: {
          ...s.ratingCatalogsByKey,
          [catalogKey]: defaultRatingCatalogCache()
        },
        ratingBuildProgress: { stage: 'catalog', completed: 0, total: 0, message: '正在获取评分目录总量...' }
      }));

      const firstPage = await TouchGalClient.fetchGalgameResources(1, ADVANCED_PAGE_SIZE, upstreamQuery);
      if (get().ratingBuildSessionId !== sessionId) return;

      const totalPages = Math.max(1, Math.ceil(firstPage.total / ADVANCED_PAGE_SIZE));
      set((s) => ({
        ratingBuildProgress: {
          ...s.ratingBuildProgress,
          total: totalPages,
          completed: 1,
          message: `正在拉取评分目录 (1/${totalPages})...`
        }
      }));

      let globalIndex = 0;
      const allRecords: AdvancedResourceRecord[] = firstPage.list.map((r: unknown, i: number) => ({
        ...toAdvancedResourceRecord(r as Parameters<typeof toAdvancedResourceRecord>[0]),
        __catalogIndex: globalIndex + i
      }));
      globalIndex += firstPage.list.length;

      const remainingPages = Array.from({ length: totalPages - 1 }, (_, i) => i + 2);
      await runBounded(remainingPages, ADVANCED_CATALOG_CONCURRENCY, async (pageNum) => {
        if (get().ratingBuildSessionId !== sessionId) return;
        const page = await TouchGalClient.fetchGalgameResources(pageNum, ADVANCED_PAGE_SIZE, upstreamQuery);
        if (get().ratingBuildSessionId !== sessionId) return;

        const start = globalIndex;
        const pageRecords = page.list.map((r: unknown, i: number) => ({
          ...toAdvancedResourceRecord(r as Parameters<typeof toAdvancedResourceRecord>[0]),
          __catalogIndex: start + i
        }));
        globalIndex += page.list.length;
        allRecords.push(...pageRecords);

        set((s) => {
          const completed = s.ratingBuildProgress.completed + 1;
          return {
            ratingBuildProgress: {
              ...s.ratingBuildProgress,
              completed,
              message: `正在拉取评分目录 (${completed}/${totalPages})...`
            }
          };
        });
      });

      if (get().ratingBuildSessionId !== sessionId) return;

      const dedupedRecords = uniqueById(allRecords);
      set((s) => ({
        homeMode: 'rating_ready',
        ratingBuildProgress: {
          stage: 'ready',
          completed: dedupedRecords.length,
          total: dedupedRecords.length,
          message: `评分目录完成，共 ${dedupedRecords.length} 个条目`
        },
        ratingCatalogsByKey: {
          ...s.ratingCatalogsByKey,
          [catalogKey]: {
            resources: dedupedRecords,
            total: dedupedRecords.length,
            upstreamKey: catalogKey,
            lastBuiltAt: Date.now()
          }
        }
      }));
      get().applyRatingSort(1, sortOrder);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      set({
        homeMode: 'normal',
        ratingBuildSessionId: null,
        ratingBuildProgress: { stage: 'error', completed: 0, total: 0, message },
        error: message
      });
    }
  },

  applyRatingSort: (page: number, sortOrder: string) => {
    const query = get().lastHomeQuery;
    const domain = get().activeNsfwDomain;
    const catalogKey = getRatingCatalogKey(domain, query.selectedPlatform, query.minRatingCount);
    const catalog = get().ratingCatalogsByKey[catalogKey];
    if (!catalog || catalog.resources.length === 0) return;

    const sorted = sortAdvancedResources(catalog.resources, 'rating', sortOrder);
    const maxPage = Math.max(1, Math.ceil(sorted.length / ADVANCED_PAGE_SIZE));
    const safePage = Math.min(Math.max(1, page), maxPage);
    set({
      resources: paginateAdvancedResources(sorted, safePage),
      totalResources: sorted.length,
      currentPage: safePage
    });
  },

  exitRatingMode: () =>
    set({
      homeMode: 'normal',
      ratingBuildSessionId: null,
      ratingBuildProgress: defaultBuildProgress()
    })
});
