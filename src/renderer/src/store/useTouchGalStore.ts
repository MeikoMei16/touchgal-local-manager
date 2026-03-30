import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { TouchGalResource, TouchGalDetail } from '../types';
import { TouchGalClient } from '../data/TouchGalClient';

// --- TYPES ---
export type HomeMode = 'normal' | 'advanced_building' | 'advanced_ready';
export type NsfwDomain = 'sfw' | 'nsfw' | 'all';

export interface AdvancedFilterDraft {
  nsfwMode: NsfwDomain;
  selectedPlatform: string;
  yearConstraints: Array<{ op: string; val: number }>;
  minRatingCount: number;
  minRatingScore: number;
  minCommentCount: number;
  selectedTags: string[];
}

export interface AdvancedBuildProgress {
  stage: 'idle' | 'catalog' | 'enrichment' | 'ready' | 'error';
  completed: number;
  total: number;
  message: string;
}

export interface AdvancedResourceRecord extends TouchGalResource {
  fullTags: string[];
  normalizedYear: number | null;
  tagsHydrated: boolean;
}

export interface AdvancedDatasetCache {
  resources: AdvancedResourceRecord[];
  total: number;
  hydratedTagIds: string[];
  failedTagIds: string[];
  lastBuiltAt: number | null;
  upstreamKey: string | null;
}

export const defaultAdvancedFilterDraft = (): AdvancedFilterDraft => ({
  nsfwMode: 'sfw',
  selectedPlatform: 'all',
  yearConstraints: [],
  minRatingCount: 0,
  minRatingScore: 0,
  minCommentCount: 0,
  selectedTags: []
});

const defaultBuildProgress = (): AdvancedBuildProgress => ({
  stage: 'idle',
  completed: 0,
  total: 0,
  message: ''
});

const defaultAdvancedDatasetCache = (): AdvancedDatasetCache => ({
  resources: [],
  total: 0,
  hydratedTagIds: [],
  failedTagIds: [],
  lastBuiltAt: null,
  upstreamKey: null
});

// --- HELPERS (Copied from old store) ---
const ADVANCED_PAGE_SIZE = 24;
const ADVANCED_CATALOG_CONCURRENCY = 4;
const ADVANCED_TAG_CONCURRENCY = 6;

const uniqueById = <T extends { uniqueId: string }>(items: T[]): T[] => {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const item of items) {
    if (!item.uniqueId || seen.has(item.uniqueId)) continue;
    seen.add(item.uniqueId);
    result.push(item);
  }
  return result;
};

const normalizeYear = (resource: TouchGalResource): number | null => {
  const rawDate = resource.releasedDate || (resource as any).released || (resource as any).created || null;
  if (!rawDate) return null;
  const directMatch = String(rawDate).match(/\b(19|20)\d{2}\b/);
  if (directMatch) return Number(directMatch[0]);
  const parsed = new Date(rawDate);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.getFullYear();
};

const toAdvancedResourceRecord = (resource: TouchGalResource): AdvancedResourceRecord => ({
  ...resource,
  fullTags: Array.isArray(resource.tags) ? resource.tags : [],
  normalizedYear: normalizeYear(resource),
  tagsHydrated: false
});

const compareConstraint = (year: number, op: string, value: number): boolean => {
  if (op === '=') return year === value;
  if (op === '>=') return year >= value;
  if (op === '<=') return year <= value;
  if (op === '>') return year > value;
  if (op === '<') return year < value;
  return true;
};

// applyAdvancedPredicate re-filters the in-memory candidate set.
// Stage 1 fields (platform, minRatingCount) are server-side — not re-applied here.
const applyAdvancedPredicate = (resources: AdvancedResourceRecord[], draft: AdvancedFilterDraft): AdvancedResourceRecord[] =>
  resources.filter((resource) => {
    // Midstream: year constraints
    if (draft.yearConstraints.length > 0) {
      if (resource.normalizedYear == null) return false;
      if (!draft.yearConstraints.every(c => compareConstraint(resource.normalizedYear as number, c.op, c.val))) return false;
    }
    // Midstream: minimum rating score
    if (draft.minRatingScore > 0 && (resource.averageRating || 0) < draft.minRatingScore) return false;
    // Midstream: minimum comment count
    if (draft.minCommentCount > 0 && (resource.commentCount || (resource as any).comments || 0) < draft.minCommentCount) return false;
    // Downstream: strict tag filtering — cards must be hydrated before they can match.
    if (draft.selectedTags.length > 0) {
      if (!resource.tagsHydrated) return false;
      const tagSet = new Set(resource.fullTags);
      if (!draft.selectedTags.every(tag => tagSet.has(tag))) return false;
    }
    return true;
  });

const getSortableValue = (resource: AdvancedResourceRecord, sortField: string, originalIndex: number) => {
  if (sortField === 'rating') return resource.averageRating || 0;
  if (sortField === 'view' || sortField === 'visit') return resource.viewCount || (resource as any).view || 0;
  if (sortField === 'download') return resource.downloadCount || (resource as any).download || 0;
  if (sortField === 'favorite') return resource.favoriteCount || 0;
  if (sortField === 'created') {
    const created = (resource as any).created ? new Date((resource as any).created).getTime() : 0;
    return isNaN(created) ? 0 : created;
  }
  return originalIndex;
};

const sortAdvancedResources = (resources: AdvancedResourceRecord[], sortField: string, sortOrder: string): AdvancedResourceRecord[] => {
  const direction = sortOrder === 'asc' ? 1 : -1;
  return [...resources].sort((left, right) => {
    const lIdx = (left as any).__catalogIndex ?? 0;
    const rIdx = (right as any).__catalogIndex ?? 0;
    const lVal = getSortableValue(left, sortField, lIdx);
    const rVal = getSortableValue(right, sortField, rIdx);
    return lVal === rVal ? lIdx - rIdx : (lVal > rVal ? direction : -direction);
  });
};

const paginateAdvancedResources = (
  resources: AdvancedResourceRecord[],
  page: number
): AdvancedResourceRecord[] => {
  const start = (page - 1) * ADVANCED_PAGE_SIZE;
  return resources.slice(start, start + ADVANCED_PAGE_SIZE);
};

const createSessionId = () => `adv-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const getAdvancedUpstreamKey = (draft: AdvancedFilterDraft, domain: NsfwDomain) =>
  JSON.stringify({
    domain,
    selectedPlatform: draft.selectedPlatform ?? 'all',
    minRatingCount: draft.minRatingCount ?? 0
  });

async function runBounded<TInput, TOutput>(items: TInput[], limit: number, worker: (item: TInput, index: number) => Promise<TOutput>): Promise<TOutput[]> {
  const results = new Array<TOutput>(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const idx = cursor++;
      results[idx] = await worker(items[idx], idx);
    }
  });
  await Promise.all(runners);
  return results;
}

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
  selectedTags: string[];
  lastHomeQuery: any;

  fetchResources: (page?: number, query?: any) => Promise<void>;
  searchResources: (keyword: string, page?: number, options?: any) => Promise<void>;
  selectResource: (uniqueId: string) => Promise<void>;
  clearSelected: () => void;
  updateAdvancedFilterDraft: (draft: Partial<AdvancedFilterDraft>) => void;
  setActiveNsfwDomain: (domain: NsfwDomain) => void;
  enterAdvancedMode: (sortField: string, sortOrder: string) => Promise<void>;
  exitAdvancedMode: () => void;
  applyAdvancedFilters: (page: number, sortField: string, sortOrder: string) => void;
  addTagFilter: (tag: string) => void;
  removeTagFilter: (tag: string) => void;
  clearTags: () => void;
  resetAdvancedFilterDraft: () => void;
  setLastHomeQuery: (query: any) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
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
      selectedTags: [],
      lastHomeQuery: {},

      fetchResources: async (page = 1, query = {}) => {
        console.log('[useUIStore] fetchResources called:', { page, query });
        set({ isLoading: true, error: null });
        try {
          const data = await TouchGalClient.fetchGalgameResources(page, 24, query);
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
        if (basicInfo) set({ selectedResource: { ...basicInfo } as TouchGalDetail, isDetailLoading: true, error: null });
        else set({ isDetailLoading: true, error: null });

        try {
          const gId = basicInfo?.id;
          const [detail, introData, comments, ratings] = await Promise.all([
            TouchGalClient.getPatchDetail(uniqueId),
            TouchGalClient.getPatchIntroduction(uniqueId),
            gId ? TouchGalClient.fetchPatchComments(gId, 1, 50) : Promise.resolve({ list: [] }),
            gId ? TouchGalClient.fetchPatchRatings(gId, 1, 50) : Promise.resolve({ list: [] })
          ]);
          
          const finalId = detail.id || basicInfo?.id || 0;
          const hasSessError = (comments as any).requiresLogin || (ratings as any).requiresLogin;

          set({
            selectedResource: { ...detail, id: finalId, introduction: introData.introduction ?? detail.introduction, releasedDate: introData.releasedDate ?? detail.releasedDate, alias: introData.alias?.length ? introData.alias : detail.alias, tags: introData.tags?.length ? introData.tags : detail.tags, company: introData.company ?? detail.company, vndbId: introData.vndbId ?? detail.vndbId, bangumiId: introData.bangumiId ?? detail.bangumiId, steamId: introData.steamId ?? detail.steamId },
            patchComments: comments.list || [],
            patchRatings: ratings.list || [],
            isDetailLoading: false
          });
          if (hasSessError) useAuthStore.getState().setSessionError('SESSION_EXPIRED');
        } catch (err: any) {
          set({ error: err.message, isDetailLoading: false });
          if (err.message?.includes('SESSION_EXPIRED')) useAuthStore.getState().setSessionError('SESSION_EXPIRED');
        }
      },
      clearSelected: () => set({ selectedResource: null, patchComments: [], patchRatings: [] }),
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
        const sessionId = createSessionId();
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
      addTagFilter: (tag) => { const next = get().selectedTags.includes(tag) ? get().selectedTags : [...get().selectedTags, tag]; set({ selectedTags: next, advancedFilterDraft: { ...get().advancedFilterDraft, selectedTags: next } }); },
      removeTagFilter: (tag) => { const next = get().selectedTags.filter(t => t !== tag); set({ selectedTags: next, advancedFilterDraft: { ...get().advancedFilterDraft, selectedTags: next } }); },
      clearTags: () => { const next: string[] = []; set({ selectedTags: next, advancedFilterDraft: { ...get().advancedFilterDraft, selectedTags: next } }); },
      resetAdvancedFilterDraft: () => set({ advancedFilterDraft: defaultAdvancedFilterDraft(), selectedTags: [] }),
      setLastHomeQuery: (query) => set({ lastHomeQuery: query })
    }),
    { name: 'touchgal-ui-storage', storage: createJSONStorage(() => sessionStorage) }
  )
);

// --- LEGACY BRIDGE ---
// This ensures that existing components don't crash, but they should be updated.
export const useTouchGalStore = () => {
  const auth = useAuthStore();
  const ui = useUIStore();
  return { ...auth, ...ui };
};
