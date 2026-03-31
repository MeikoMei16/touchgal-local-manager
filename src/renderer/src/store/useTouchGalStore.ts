import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { TouchGalResource, TouchGalDetail } from '../types';
import { TouchGalClient } from '../data/TouchGalClient';
import { mergeDetailResource, toDetailShell } from '../features/detail/detailResource';
import {
  ADVANCED_CATALOG_CONCURRENCY,
  ADVANCED_PAGE_SIZE,
  ADVANCED_TAG_CONCURRENCY,
  applyAdvancedPredicate,
  createAdvancedSessionId,
  getAdvancedUpstreamKey,
  normalizeYear,
  paginateAdvancedResources,
  runBounded,
  sortAdvancedResources,
  toAdvancedResourceRecord,
  uniqueById,
  compareConstraint
} from '../features/home/advancedDataset';
import {
  AdvancedBuildProgress,
  AdvancedDatasetCache,
  AdvancedFilterDraft,
  AdvancedResourceRecord,
  defaultAdvancedDatasetCache,
  defaultAdvancedFilterDraft,
  defaultBuildProgress,
  defaultHomeQuery,
  HomeMode,
  HomeQueryState,
  NsfwDomain,
  normalizeHomeQuery,
  normalizePage
} from '../features/home/homeState';

let activeDetailRequestKey: string | null = null;

// --- AUTH STORE ---
interface AuthState {
  user: any | null;
  userProfile: any | null;
  userComments: any[];
  userRatings: any[];
  userCollections: any[];
  isLoginOpen: boolean;
  captchaUrl: string | null;
  captchaChallenge: { images: any[], sessionId: string, target?: string } | null;
  sessionError: 'SESSION_EXPIRED' | null;
  isLoading: boolean;
  error: string | null;

  login: (username: string, password: string, captcha: string) => Promise<void>;
  logout: () => void;
  setIsLoginOpen: (isOpen: boolean) => void;
  setSessionError: (error: 'SESSION_EXPIRED' | null) => void;
  clearAuthUi: () => void;
  fetchCaptcha: () => Promise<void>;
  verifyCaptcha: (ids: string[]) => Promise<string | null>;
  fetchUserProfile: () => Promise<void>;
  fetchUserActivity: (type: 'comments' | 'ratings' | 'collections', page?: number) => Promise<void>;
}

const formatAuthError = (err: unknown): string => {
  const fallback = 'Login failed';
  const raw =
    err instanceof Error
      ? err.message
      : typeof err === 'string'
        ? err
        : fallback;

  const validationPrefix = 'Error invoking remote method \'tg-login\': Error: ';
  const normalized = raw.startsWith(validationPrefix) ? raw.slice(validationPrefix.length) : raw;

  if (!normalized.startsWith('[')) {
    return normalized || fallback;
  }

  try {
    const parsed = JSON.parse(normalized);
    if (!Array.isArray(parsed)) return normalized;

    const messages = parsed
      .map((item: any) => {
        const path = Array.isArray(item?.path) && item.path.length > 0 ? String(item.path[0]) : null;
        const message = typeof item?.message === 'string' ? item.message : null;
        if (!message) return null;
        return path ? `${path}: ${message}` : message;
      })
      .filter(Boolean);

    return messages.length > 0 ? messages.join('\n') : normalized;
  } catch {
    return normalized;
  }
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      userProfile: null,
      userComments: [],
      userRatings: [],
      userCollections: [],
      isLoginOpen: false,
      captchaUrl: null,
      captchaChallenge: null,
      sessionError: null,
      isLoading: false,
      error: null,

      login: async (username: string, password: string, captcha: string) => {
        set({ isLoading: true, error: null });
        try {
          const user = await TouchGalClient.login(username, password, captcha);
          set({ user, isLoading: false, sessionError: null, captchaUrl: null, captchaChallenge: null });
        } catch (err: any) {
          // Do not immediately fetch a new captcha here. If credentials are wrong after
          // a successful captcha solve, the user should return to the login form, see the
          // error, and retry credentials before requesting a new captcha on the next submit.
          set({ error: formatAuthError(err), isLoading: false, captchaUrl: null, captchaChallenge: null });
        }
      },
      logout: () => set({ user: null, userProfile: null, sessionError: null, captchaUrl: null, captchaChallenge: null, error: null }),
      setIsLoginOpen: (isOpen) => set({ isLoginOpen: isOpen }),
      setSessionError: (error) => set({ sessionError: error }),
      clearAuthUi: () => set({ error: null, captchaUrl: null, captchaChallenge: null, isLoading: false }),
      fetchCaptcha: async () => {
        set({ isLoading: true, error: null });
        try {
          const data = await TouchGalClient.fetchCaptcha();
          if (data.images && data.sessionId) set({ captchaChallenge: data, captchaUrl: null, isLoading: false });
          else set({ captchaUrl: data.url || data, captchaChallenge: null, isLoading: false });
        } catch (err: any) { set({ error: err.message, isLoading: false }); }
      },
      verifyCaptcha: async (ids) => {
        try {
          set({ isLoading: true, error: null });
          const result = await window.api.verifyCaptcha(get().captchaChallenge?.sessionId || '', ids);
          set({ isLoading: false });
          return result.code;
        } catch {
          set({ error: 'Captcha verification failed', isLoading: false });
          await get().fetchCaptcha();
          return null;
        }
      },
      fetchUserProfile: async () => {
        set({ isLoading: true });
        try {
          const selfStatus = await window.api.getUserStatusSelf();
          if (selfStatus?.uid || selfStatus?.id) {
            const uid = selfStatus.uid || selfStatus.id;
            const profileDetail = await window.api.getUserStatus(uid);
            set({ userProfile: profileDetail, user: { ...get().user, id: uid, uid }, isLoading: false });
          }
        } catch (err: any) { set({ error: err.message, isLoading: false }); }
      },
      fetchUserActivity: async (type, page = 1) => {
        const uid = get().userProfile?.id || get().user?.uid || get().user?.id;
        if (!uid) return;
        set({ isLoading: true });
        try {
          if (type === 'comments') {
            const data = await window.api.getUserComments(Number(uid), page, 20);
            set({ userComments: data.comments || [], isLoading: false });
          } else if (type === 'ratings') {
            const data = await window.api.getUserRatings(Number(uid), page, 20);
            set({ userRatings: data.ratings || [], isLoading: false });
          } else if (type === 'collections') {
            const data = await window.api.getFavoriteFolders(Number(uid));
            set({ userCollections: data || [], isLoading: false });
          }
        } catch (err: any) { set({ error: err.message, isLoading: false }); }
      }
    }),
    { name: 'touchgal-auth-storage' }
  )
);

// --- UI STORE ---
interface UIState {
  hasHydratedUi: boolean;
  resources: TouchGalResource[];
  totalResources: number;
  currentPage: number;
  isLoading: boolean;
  isDetailLoading: boolean;
  error: string | null;
  selectedResource: TouchGalDetail | null;
  patchComments: any[];
  patchRatings: any[];
  homeMode: HomeMode;
  activeNsfwDomain: NsfwDomain;
  advancedFilterDraft: AdvancedFilterDraft;
  advancedBuildSessionId: string | null;
  advancedBuildProgress: AdvancedBuildProgress;
  advancedDatasetsByDomain: Record<NsfwDomain, AdvancedDatasetCache>;
  lastHomeQuery: HomeQueryState;

  fetchResources: (page?: number, query?: Partial<HomeQueryState>) => Promise<void>;
  searchResources: (keyword: string, page?: number, options?: any) => Promise<void>;
  selectResource: (uniqueId: string) => Promise<void>;
  clearSelected: () => void;
  updateAdvancedFilterDraft: (draft: Partial<AdvancedFilterDraft>) => void;
  setActiveNsfwDomain: (domain: NsfwDomain) => void;
  enterAdvancedMode: (sortField: string, sortOrder: string) => Promise<void>;
  exitAdvancedMode: () => void;
  clearAdvancedSearch: () => void;
  applyAdvancedFilters: (page: number, sortField: string, sortOrder: string) => void;
  addTagFilter: (tag: string) => void;
  removeTagFilter: (tag: string) => void;
  clearTags: () => void;
  resetAdvancedFilterDraft: () => void;
  setLastHomeQuery: (query: Partial<HomeQueryState>) => void;
  setCurrentPage: (page: number) => void;
  setHasHydratedUi: (hydrated: boolean) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      hasHydratedUi: false,
      resources: [],
      totalResources: 0,
      currentPage: 1,
      isLoading: false,
      isDetailLoading: false,
      error: null,
      selectedResource: null,
      patchComments: [],
      patchRatings: [],
      homeMode: 'normal',
      activeNsfwDomain: 'sfw',
      advancedFilterDraft: defaultAdvancedFilterDraft(),
      advancedBuildSessionId: null,
      advancedBuildProgress: defaultBuildProgress(),
      advancedDatasetsByDomain: {
        sfw: defaultAdvancedDatasetCache(),
        nsfw: defaultAdvancedDatasetCache(),
        all: defaultAdvancedDatasetCache()
      },
      lastHomeQuery: defaultHomeQuery(),

      fetchResources: async (page = 1, query = {}) => {
        console.log('[useUIStore] fetchResources called:', { page, query });
        set({ isLoading: true, error: null });
        try {
          const normalizedQuery = normalizeHomeQuery({ ...get().lastHomeQuery, ...query });
          const data = await TouchGalClient.fetchGalgameResources(page, 24, normalizedQuery);
          set({ resources: data.list, totalResources: data.total, currentPage: page, isLoading: false });
        } catch (err: any) {
          console.error('[useUIStore] fetchResources error:', err);
          set({ error: err.message, isLoading: false });
          if (err.message?.includes('SESSION_EXPIRED')) useAuthStore.getState().setSessionError('SESSION_EXPIRED');
        }
      },
      searchResources: async (keyword, page = 1, options = {}) => {
        set({ isLoading: true, error: null });
        try {
          const data = await TouchGalClient.searchResources(keyword, page, 20, options);
          set({ resources: data.list, totalResources: data.total, currentPage: page, isLoading: false });
        } catch (err: any) {
          set({ error: err.message, isLoading: false });
          if (err.message?.includes('SESSION_EXPIRED')) useAuthStore.getState().setSessionError('SESSION_EXPIRED');
        }
      },
      selectResource: async (uniqueId) => {
        const basicInfo = get().resources.find(r => r.uniqueId === uniqueId);
        activeDetailRequestKey = uniqueId;
        if (basicInfo) {
          set({
            selectedResource: toDetailShell(basicInfo),
            patchComments: [],
            patchRatings: [],
            isDetailLoading: true,
            error: null
          });
        } else {
          set({ patchComments: [], patchRatings: [], isDetailLoading: true, error: null });
        }

        try {
          const detail = await TouchGalClient.getPatchDetail(uniqueId);
          if (activeDetailRequestKey !== uniqueId) return;

          const mergedDetail = mergeDetailResource(detail, basicInfo);
          const finalId = mergedDetail.id || 0;
          const [comments, ratings] = await Promise.all([
            finalId ? TouchGalClient.fetchPatchComments(finalId, 1, 50) : Promise.resolve({ list: [] }),
            finalId ? TouchGalClient.fetchPatchRatings(finalId, 1, 50) : Promise.resolve({ list: [] })
          ]);
          if (activeDetailRequestKey !== uniqueId) return;

          const hasSessError = (comments as any).requiresLogin || (ratings as any).requiresLogin;

          set({
            selectedResource: mergedDetail,
            patchComments: comments.list || [],
            patchRatings: ratings.list || [],
            isDetailLoading: false
          });
          useAuthStore.getState().setSessionError(hasSessError ? 'SESSION_EXPIRED' : null);
        } catch (err: any) {
          if (activeDetailRequestKey !== uniqueId) return;
          set({ error: err.message, isDetailLoading: false });
          if (err.message?.includes('SESSION_EXPIRED')) useAuthStore.getState().setSessionError('SESSION_EXPIRED');
        }
      },
      clearSelected: () => {
        activeDetailRequestKey = null;
        set({ selectedResource: null, patchComments: [], patchRatings: [] });
      },
      updateAdvancedFilterDraft: (draft) => set(s => ({ advancedFilterDraft: { ...s.advancedFilterDraft, ...draft } })),
      setActiveNsfwDomain: (domain) => set(s => ({ activeNsfwDomain: domain, advancedFilterDraft: { ...s.advancedFilterDraft, nsfwMode: domain } })),
      enterAdvancedMode: async (sortField, sortOrder) => {
        /**
         * Three-Stage Data Pipeline
         * Stage 1 — Upstream  (API):   nsfwMode + platform + minRatingCount sent as server params
         * Stage 2 — Midstream (local): yearConstraints + minRatingScore + minCommentCount filtered in-memory per page
         * Stage 3 — Downstream (IO):   selectedTags — enrich ONLY the midstream candidate set, not full catalog
         */
        const draft = get().advancedFilterDraft;
        const domain = get().activeNsfwDomain;
        const sessionId = createAdvancedSessionId();
        const upstreamKey = getAdvancedUpstreamKey(draft, domain);
        set({ homeMode: 'advanced_building', advancedBuildSessionId: sessionId, error: null });

        try {
          // ── Stage 1: build upstream API query ───────────────────────────────
          const upstreamQuery: Record<string, any> = {
            nsfwMode: domain === 'all' ? 'all' : domain === 'nsfw' ? 'nsfw' : 'safe',
            selectedPlatform: draft.selectedPlatform ?? 'all',
          };
          if (draft.minRatingCount > 0) upstreamQuery.minRatingCount = draft.minRatingCount;

          // ── Stage 2: midstream predicate (pure, no IO) ─────────────────────
          const midstreamPass = (record: AdvancedResourceRecord): boolean => {
            if (draft.yearConstraints.length > 0) {
              if (record.normalizedYear == null) return false;
              if (!draft.yearConstraints.every(c => compareConstraint(record.normalizedYear as number, c.op, c.val))) return false;
            }
            if (draft.minRatingScore > 0 && (record.averageRating || 0) < draft.minRatingScore) return false;
            if (draft.minCommentCount > 0 && (record.commentCount || (record as any).comments || 0) < draft.minCommentCount) return false;
            return true;
          };

          const existingDataset = get().advancedDatasetsByDomain[domain];
          const canReuseCatalog =
            existingDataset.upstreamKey === upstreamKey &&
            existingDataset.resources.length > 0;

          if (canReuseCatalog) {
            if (draft.selectedTags.length > 0) {
              const pendingResources = existingDataset.resources.filter(
                (resource) =>
                  !resource.tagsHydrated &&
                  !existingDataset.failedTagIds.includes(resource.uniqueId)
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
                    set(s => {
                      const ds = s.advancedDatasetsByDomain[domain];
                      if (!ds) return {};
                      const next = ds.resources.map((item: AdvancedResourceRecord) =>
                        item.uniqueId === resource.uniqueId
                          ? {
                              ...item,
                              fullTags: intro.tags?.length ? intro.tags : item.fullTags,
                              releasedDate: intro.releasedDate || item.releasedDate,
                              normalizedYear: intro.releasedDate
                                ? normalizeYear({ ...item, releasedDate: intro.releasedDate })
                                : item.normalizedYear,
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
                    set(s => {
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
                set(s => ({
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

          // Reset dataset for this domain when upstream inputs changed or no cache exists.
          set(s => ({
            advancedDatasetsByDomain: {
              ...s.advancedDatasetsByDomain,
              [domain]: defaultAdvancedDatasetCache()
            },
            advancedBuildProgress: { stage: 'catalog', completed: 0, total: 0, message: '正在获取目录总量...' }
          }));

          // ── Fetch page 1 to get total count ────────────────────────────────
          const firstPage = await TouchGalClient.fetchGalgameResources(1, ADVANCED_PAGE_SIZE, upstreamQuery);
          if (get().advancedBuildSessionId !== sessionId) return;

          const totalPages = Math.max(1, Math.ceil(firstPage.total / ADVANCED_PAGE_SIZE));
          set(s => ({ advancedBuildProgress: { ...s.advancedBuildProgress, total: totalPages, completed: 1, message: `正在拉取目录 (1/${totalPages})...` } }));

          // Midstream on page 1
          let globalIndex = 0;
          const addToPool = (pageList: any[]) => {
            const start = globalIndex;
            globalIndex += pageList.length;
            return pageList
              .map((r, i) => ({ ...toAdvancedResourceRecord(r), __catalogIndex: start + i }))
              .filter(midstreamPass);
          };

          const candidates = addToPool(firstPage.list);

          // Stream remaining pages
          const remainingPages = Array.from({ length: totalPages - 1 }, (_, i) => i + 2);
          await runBounded(remainingPages, ADVANCED_CATALOG_CONCURRENCY, async (pageNum) => {
            if (get().advancedBuildSessionId !== sessionId) return;
            const page = await TouchGalClient.fetchGalgameResources(pageNum, ADVANCED_PAGE_SIZE, upstreamQuery);
            if (get().advancedBuildSessionId !== sessionId) return;

            const pageCandidates = addToPool(page.list);
            candidates.push(...pageCandidates);

            set(s => {
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
          set(s => {
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

          // ── Stage 3: enrich ONLY candidates, not full catalog ───────────────
          if (draft.selectedTags.length === 0) return;
          let hydrated = 0;

          await runBounded(finalCandidates, ADVANCED_TAG_CONCURRENCY, async (resource) => {
            if (get().advancedBuildSessionId !== sessionId) return;
            try {
              const intro = await TouchGalClient.getPatchIntroduction(resource.uniqueId);
              if (get().advancedBuildSessionId !== sessionId) return;
              hydrated++;
              set(s => {
                const ds = s.advancedDatasetsByDomain[domain];
                if (!ds) return {};
                const next = ds.resources.map((item: AdvancedResourceRecord) =>
                  item.uniqueId === resource.uniqueId
                    ? { ...item, fullTags: intro.tags?.length ? intro.tags : item.fullTags, releasedDate: intro.releasedDate || item.releasedDate, normalizedYear: intro.releasedDate ? normalizeYear({ ...item, releasedDate: intro.releasedDate }) : item.normalizedYear, tagsHydrated: true }
                    : item
                );
                return {
                  advancedBuildProgress: { ...s.advancedBuildProgress, completed: hydrated, message: `正在富化标签 (${hydrated}/${finalCandidates.length})...` },
                  advancedDatasetsByDomain: { ...s.advancedDatasetsByDomain, [domain]: { ...ds, resources: next, hydratedTagIds: [...ds.hydratedTagIds, resource.uniqueId] } }
                };
              });
              get().applyAdvancedFilters(get().currentPage, sortField, sortOrder);
            } catch {
              set(s => {
                const ds = s.advancedDatasetsByDomain[domain];
                if (!ds) return {};
                return { advancedDatasetsByDomain: { ...s.advancedDatasetsByDomain, [domain]: { ...ds, failedTagIds: [...ds.failedTagIds, resource.uniqueId] } } };
              });
            }
          });

          if (get().advancedBuildSessionId !== sessionId) return;
          set(s => ({ advancedBuildProgress: { ...s.advancedBuildProgress, stage: 'ready', message: `标签富化完成，${hydrated} 个` } }));
          get().applyAdvancedFilters(get().currentPage, sortField, sortOrder);

        } catch (e: any) {
          set({ homeMode: 'normal', advancedBuildSessionId: null, advancedBuildProgress: { stage: 'error', completed: 0, total: 0, message: e.message }, error: e.message });
        }
      },
      exitAdvancedMode: () => set({ homeMode: 'normal', advancedBuildSessionId: null }),
      clearAdvancedSearch: () => {
        const currentQuery = get().lastHomeQuery;
        const resetQuery = {
          ...defaultHomeQuery(),
          sortField: currentQuery.sortField,
          sortOrder: currentQuery.sortOrder
        };

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
      applyAdvancedFilters: (page, sortField, sortOrder) => {
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
      addTagFilter: (tag) => {
        const currentTags = get().advancedFilterDraft.selectedTags;
        const next = currentTags.includes(tag) ? currentTags : [...currentTags, tag];
        set({ advancedFilterDraft: { ...get().advancedFilterDraft, selectedTags: next } });
      },
      removeTagFilter: (tag) => {
        const next = get().advancedFilterDraft.selectedTags.filter(t => t !== tag);
        set({ advancedFilterDraft: { ...get().advancedFilterDraft, selectedTags: next } });
      },
      clearTags: () => set({ advancedFilterDraft: { ...get().advancedFilterDraft, selectedTags: [] } }),
      resetAdvancedFilterDraft: () => set({ advancedFilterDraft: defaultAdvancedFilterDraft() }),
      setLastHomeQuery: (query) => set({ lastHomeQuery: normalizeHomeQuery(query) }),
      setCurrentPage: (page) => set({ currentPage: page }),
      setHasHydratedUi: (hydrated) => set({ hasHydratedUi: hydrated })
    }),
    {
      name: 'touchgal-ui-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        currentPage: state.currentPage,
        lastHomeQuery: state.lastHomeQuery
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydratedUi(true);
      },
      merge: (persistedState, currentState) => {
        const typedPersisted = persistedState as Record<string, unknown> | undefined;
        const persistedSlice = (
          typedPersisted && 'state' in typedPersisted
            ? typedPersisted.state
            : typedPersisted
        ) as Partial<UIState> | undefined;
        const persistedQuery = persistedSlice?.lastHomeQuery;
        return {
          ...currentState,
          ...persistedSlice,
          hasHydratedUi: true,
          currentPage: normalizePage(persistedSlice?.currentPage),
          lastHomeQuery: normalizeHomeQuery(persistedQuery)
        };
      }
    }
  )
);

// --- LEGACY BRIDGE ---
// This ensures that existing components don't crash, but they should be updated.
export const useTouchGalStore = () => {
  const auth = useAuthStore();
  const ui = useUIStore();
  return { ...auth, ...ui };
};
