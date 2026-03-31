import { TouchGalClient } from '../../data/TouchGalClient';
import {
  ADVANCED_CATALOG_CONCURRENCY,
  ADVANCED_PAGE_SIZE,
  ADVANCED_TAG_CONCURRENCY,
  applyAdvancedPredicate,
  compareConstraint,
  createAdvancedSessionId,
  getAdvancedUpstreamKey,
  normalizeYear,
  paginateAdvancedResources,
  runBounded,
  sortAdvancedResources,
  toAdvancedResourceRecord,
  uniqueById
} from '../../features/home/advancedDataset';
import {
  AdvancedResourceRecord,
  defaultAdvancedDatasetCache,
  defaultAdvancedFilterDraft,
  defaultBuildProgress,
  defaultHomeQuery
} from '../../features/home/homeState';
import type { UIGetState, UISetState } from '../uiStoreTypes';

export const createAdvancedActions = (set: UISetState, get: UIGetState) => ({
  updateAdvancedFilterDraft: (draft: any) => set((s) => ({ advancedFilterDraft: { ...s.advancedFilterDraft, ...draft } })),
  setActiveNsfwDomain: (domain: any) => set((s) => ({ activeNsfwDomain: domain, advancedFilterDraft: { ...s.advancedFilterDraft, nsfwMode: domain } })),
  enterAdvancedMode: async (sortField: string, sortOrder: string) => {
    const draft = get().advancedFilterDraft;
    const domain = get().activeNsfwDomain;
    const sessionId = createAdvancedSessionId();
    const upstreamKey = getAdvancedUpstreamKey(draft, domain);
    set({ homeMode: 'advanced_building', advancedBuildSessionId: sessionId, error: null });

    try {
      const upstreamQuery: Record<string, any> = {
        nsfwMode: domain === 'all' ? 'all' : domain === 'nsfw' ? 'nsfw' : 'safe',
        selectedPlatform: draft.selectedPlatform ?? 'all'
      };
      if (draft.minRatingCount > 0) upstreamQuery.minRatingCount = draft.minRatingCount;

      const midstreamPass = (record: AdvancedResourceRecord): boolean => {
        if (draft.yearConstraints.length > 0) {
          if (record.normalizedYear == null) return false;
          if (!draft.yearConstraints.every((c) => compareConstraint(record.normalizedYear as number, c.op, c.val))) return false;
        }
        if (draft.minRatingScore > 0 && (record.averageRating || 0) < draft.minRatingScore) return false;
        if (draft.minCommentCount > 0 && (record.commentCount || (record as any).comments || 0) < draft.minCommentCount) return false;
        return true;
      };

      const existingDataset = get().advancedDatasetsByDomain[domain];
      const canReuseCatalog = existingDataset.upstreamKey === upstreamKey && existingDataset.resources.length > 0;

      if (canReuseCatalog) {
        if (draft.selectedTags.length > 0) {
          const pendingResources = existingDataset.resources.filter(
            (resource) => !resource.tagsHydrated && !existingDataset.failedTagIds.includes(resource.uniqueId)
          );

          if (pendingResources.length > 0) {
            set({
              homeMode: 'advanced_building',
              advancedBuildProgress: {
                stage: 'enrichment',
                completed: 0,
                total: pendingResources.length,
                message: `正在富化标签 (0/${pendingResources.length})...`
              }
            });
            get().applyAdvancedFilters(1, sortField, sortOrder);

            let hydrated = 0;
            await runBounded(pendingResources, ADVANCED_TAG_CONCURRENCY, async (resource) => {
              if (get().advancedBuildSessionId !== sessionId) return;
              try {
                const intro = await TouchGalClient.getPatchIntroduction(resource.uniqueId);
                if (get().advancedBuildSessionId !== sessionId) return;
                hydrated++;
                set((s) => {
                  const ds = s.advancedDatasetsByDomain[domain];
                  if (!ds) return {};
                  const next = ds.resources.map((item: AdvancedResourceRecord) =>
                    item.uniqueId === resource.uniqueId
                      ? {
                          ...item,
                          fullTags: intro.tags?.length ? intro.tags : item.fullTags,
                          releasedDate: intro.releasedDate || item.releasedDate,
                          normalizedYear: intro.releasedDate ? normalizeYear({ ...item, releasedDate: intro.releasedDate }) : item.normalizedYear,
                          tagsHydrated: true
                        }
                      : item
                  );
                  return {
                    advancedBuildProgress: {
                      ...s.advancedBuildProgress,
                      completed: hydrated,
                      message: `正在富化标签 (${hydrated}/${pendingResources.length})...`
                    },
                    advancedDatasetsByDomain: {
                      ...s.advancedDatasetsByDomain,
                      [domain]: {
                        ...ds,
                        resources: next,
                        hydratedTagIds: ds.hydratedTagIds.includes(resource.uniqueId)
                          ? ds.hydratedTagIds
                          : [...ds.hydratedTagIds, resource.uniqueId]
                      }
                    }
                  };
                });
                get().applyAdvancedFilters(get().currentPage, sortField, sortOrder);
              } catch {
                set((s) => {
                  const ds = s.advancedDatasetsByDomain[domain];
                  if (!ds) return {};
                  return {
                    advancedDatasetsByDomain: {
                      ...s.advancedDatasetsByDomain,
                      [domain]: {
                        ...ds,
                        failedTagIds: ds.failedTagIds.includes(resource.uniqueId)
                          ? ds.failedTagIds
                          : [...ds.failedTagIds, resource.uniqueId]
                      }
                    }
                  };
                });
              }
            });

            if (get().advancedBuildSessionId !== sessionId) return;
            set((s) => ({
              homeMode: 'advanced_ready',
              advancedBuildProgress: {
                ...s.advancedBuildProgress,
                stage: 'ready',
                message: `标签富化完成，${hydrated} 个`
              }
            }));
            get().applyAdvancedFilters(get().currentPage, sortField, sortOrder);
          } else {
            set({
              homeMode: 'advanced_ready',
              advancedBuildProgress: {
                stage: 'ready',
                completed: existingDataset.resources.length,
                total: existingDataset.resources.length,
                message: `复用已缓存目录，${existingDataset.resources.length} 个候选`
              }
            });
            get().applyAdvancedFilters(1, sortField, sortOrder);
          }
        } else {
          set({
            homeMode: 'advanced_ready',
            advancedBuildProgress: {
              stage: 'ready',
              completed: existingDataset.resources.length,
              total: existingDataset.resources.length,
              message: `复用已缓存目录，${existingDataset.resources.length} 个候选`
            }
          });
          get().applyAdvancedFilters(1, sortField, sortOrder);
        }
        return;
      }

      set((s) => ({
        advancedDatasetsByDomain: {
          ...s.advancedDatasetsByDomain,
          [domain]: defaultAdvancedDatasetCache()
        },
        advancedBuildProgress: { stage: 'catalog', completed: 0, total: 0, message: '正在获取目录总量...' }
      }));

      const firstPage = await TouchGalClient.fetchGalgameResources(1, ADVANCED_PAGE_SIZE, upstreamQuery);
      if (get().advancedBuildSessionId !== sessionId) return;

      const totalPages = Math.max(1, Math.ceil(firstPage.total / ADVANCED_PAGE_SIZE));
      set((s) => ({
        advancedBuildProgress: {
          ...s.advancedBuildProgress,
          total: totalPages,
          completed: 1,
          message: `正在拉取目录 (1/${totalPages})...`
        }
      }));

      let globalIndex = 0;
      const addToPool = (pageList: any[]) => {
        const start = globalIndex;
        globalIndex += pageList.length;
        return pageList.map((r, i) => ({ ...toAdvancedResourceRecord(r), __catalogIndex: start + i })).filter(midstreamPass);
      };

      const candidates = addToPool(firstPage.list);
      const remainingPages = Array.from({ length: totalPages - 1 }, (_, i) => i + 2);
      await runBounded(remainingPages, ADVANCED_CATALOG_CONCURRENCY, async (pageNum) => {
        if (get().advancedBuildSessionId !== sessionId) return;
        const page = await TouchGalClient.fetchGalgameResources(pageNum, ADVANCED_PAGE_SIZE, upstreamQuery);
        if (get().advancedBuildSessionId !== sessionId) return;

        const pageCandidates = addToPool(page.list);
        candidates.push(...pageCandidates);

        set((s) => {
          const completed = s.advancedBuildProgress.completed + 1;
          const ds = s.advancedDatasetsByDomain[domain];
          const merged = uniqueById([...ds.resources, ...pageCandidates]);
          return {
            advancedBuildProgress: { ...s.advancedBuildProgress, completed, message: `正在拉取目录 (${completed}/${totalPages})...` },
            advancedDatasetsByDomain: { ...s.advancedDatasetsByDomain, [domain]: { ...ds, resources: merged, total: merged.length } }
          };
        });
        get().applyAdvancedFilters(1, sortField, sortOrder);
      });

      if (get().advancedBuildSessionId !== sessionId) return;

      const finalCandidates = uniqueById(candidates);
      set((s) => {
        const hasTagFiltering = draft.selectedTags.length > 0;
        return {
          homeMode: hasTagFiltering ? 'advanced_building' : 'advanced_ready',
          advancedBuildProgress: hasTagFiltering
            ? { stage: 'enrichment', completed: 0, total: finalCandidates.length, message: `正在富化标签 (0/${finalCandidates.length})...` }
            : { stage: 'ready', completed: finalCandidates.length, total: finalCandidates.length, message: `目录完成，${finalCandidates.length} 个候选` },
          advancedDatasetsByDomain: {
            ...s.advancedDatasetsByDomain,
            [domain]: {
              resources: finalCandidates,
              total: finalCandidates.length,
              hydratedTagIds: [],
              failedTagIds: [],
              lastBuiltAt: Date.now(),
              upstreamKey
            }
          }
        };
      });
      get().applyAdvancedFilters(1, sortField, sortOrder);

      if (draft.selectedTags.length === 0) return;
      let hydrated = 0;

      await runBounded(finalCandidates, ADVANCED_TAG_CONCURRENCY, async (resource) => {
        if (get().advancedBuildSessionId !== sessionId) return;
        try {
          const intro = await TouchGalClient.getPatchIntroduction(resource.uniqueId);
          if (get().advancedBuildSessionId !== sessionId) return;
          hydrated++;
          set((s) => {
            const ds = s.advancedDatasetsByDomain[domain];
            if (!ds) return {};
            const next = ds.resources.map((item: AdvancedResourceRecord) =>
              item.uniqueId === resource.uniqueId
                ? {
                    ...item,
                    fullTags: intro.tags?.length ? intro.tags : item.fullTags,
                    releasedDate: intro.releasedDate || item.releasedDate,
                    normalizedYear: intro.releasedDate ? normalizeYear({ ...item, releasedDate: intro.releasedDate }) : item.normalizedYear,
                    tagsHydrated: true
                  }
                : item
            );
            return {
              advancedBuildProgress: { ...s.advancedBuildProgress, completed: hydrated, message: `正在富化标签 (${hydrated}/${finalCandidates.length})...` },
              advancedDatasetsByDomain: {
                ...s.advancedDatasetsByDomain,
                [domain]: { ...ds, resources: next, hydratedTagIds: [...ds.hydratedTagIds, resource.uniqueId] }
              }
            };
          });
          get().applyAdvancedFilters(get().currentPage, sortField, sortOrder);
        } catch {
          set((s) => {
            const ds = s.advancedDatasetsByDomain[domain];
            if (!ds) return {};
            return {
              advancedDatasetsByDomain: {
                ...s.advancedDatasetsByDomain,
                [domain]: { ...ds, failedTagIds: [...ds.failedTagIds, resource.uniqueId] }
              }
            };
          });
        }
      });

      if (get().advancedBuildSessionId !== sessionId) return;
      set((s) => ({ advancedBuildProgress: { ...s.advancedBuildProgress, stage: 'ready', message: `标签富化完成，${hydrated} 个` } }));
      get().applyAdvancedFilters(get().currentPage, sortField, sortOrder);
    } catch (e: any) {
      set({
        homeMode: 'normal',
        advancedBuildSessionId: null,
        advancedBuildProgress: { stage: 'error', completed: 0, total: 0, message: e.message },
        error: e.message
      });
    }
  },
  exitAdvancedMode: () => set({ homeMode: 'normal', advancedBuildSessionId: null }),
  clearAdvancedSearch: () => {
    const currentQuery = get().lastHomeQuery;
    const resetQuery = { ...defaultHomeQuery(), sortField: currentQuery.sortField, sortOrder: currentQuery.sortOrder };

    set({
      homeMode: 'normal',
      activeNsfwDomain: 'sfw',
      advancedFilterDraft: defaultAdvancedFilterDraft(),
      advancedBuildSessionId: null,
      advancedBuildProgress: defaultBuildProgress(),
      currentPage: 1,
      lastHomeQuery: resetQuery
    });
  },
  applyAdvancedFilters: (page: number, sortField: string, sortOrder: string) => {
    const domain = get().activeNsfwDomain;
    const ds = get().advancedDatasetsByDomain[domain];
    if (!ds) return;
    const filtered = applyAdvancedPredicate(ds.resources, get().advancedFilterDraft);
    const sorted = sortAdvancedResources(filtered, sortField, sortOrder);
    const maxPage = Math.max(1, Math.ceil(sorted.length / ADVANCED_PAGE_SIZE));
    const safePage = Math.min(Math.max(1, page), maxPage);
    set({
      resources: paginateAdvancedResources(sorted, safePage),
      totalResources: sorted.length,
      currentPage: safePage
    });
  },
  addTagFilter: (tag: string) => {
    const currentTags = get().advancedFilterDraft.selectedTags;
    const next = currentTags.includes(tag) ? currentTags : [...currentTags, tag];
    set({ advancedFilterDraft: { ...get().advancedFilterDraft, selectedTags: next } });
  },
  removeTagFilter: (tag: string) => {
    const next = get().advancedFilterDraft.selectedTags.filter((t) => t !== tag);
    set({ advancedFilterDraft: { ...get().advancedFilterDraft, selectedTags: next } });
  },
  clearTags: () => set({ advancedFilterDraft: { ...get().advancedFilterDraft, selectedTags: [] } }),
  resetAdvancedFilterDraft: () => set({ advancedFilterDraft: defaultAdvancedFilterDraft() })
});
