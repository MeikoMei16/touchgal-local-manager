import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { TouchGalResource, TouchGalDetail } from '../types';
import { TouchGalClient } from '../data/TouchGalClient';

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

export interface AdvancedDatasetCache {
  resources: AdvancedResourceRecord[];
  total: number;
  hydratedTagIds: string[];
  failedTagIds: string[];
  lastBuiltAt: number | null;
}

export interface AdvancedResourceRecord extends TouchGalResource {
  fullTags: string[];
  normalizedYear: number | null;
  tagsHydrated: boolean;
}

const defaultAdvancedFilterDraft = (): AdvancedFilterDraft => ({
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
  const rawDate =
    resource.releasedDate ||
    ((resource as any).released as string | undefined) ||
    ((resource as any).created as string | undefined) ||
    null;

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

const applyAdvancedPredicate = (
  resources: AdvancedResourceRecord[],
  draft: AdvancedFilterDraft
): AdvancedResourceRecord[] =>
  resources.filter((resource) => {
    if (draft.selectedPlatform !== 'all') {
      const platforms = Array.isArray((resource as any).platform)
        ? ((resource as any).platform as string[])
        : String((resource as any).platform || '')
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean);

      if (!platforms.some(p => p.toLowerCase() === draft.selectedPlatform.toLowerCase())) {
        return false;
      }
    }

    if (draft.yearConstraints.length > 0) {
      if (resource.normalizedYear == null) {
        return false;
      }
      const matchesAllYears = draft.yearConstraints.every((constraint) =>
        compareConstraint(resource.normalizedYear as number, constraint.op, constraint.val)
      );
      if (!matchesAllYears) {
        return false;
      }
    }

    if (draft.selectedTags.length > 0) {
      if (!resource.tagsHydrated) {
        return false;
      }
      const tagSet = new Set(resource.fullTags);
      const matchesAllTags = draft.selectedTags.every((tag) => tagSet.has(tag));
      if (!matchesAllTags) {
        return false;
      }
    }

    if (draft.minRatingCount > 0) {
      if ((resource.averageRatingCount || (resource as any).ratingCount || 0) < draft.minRatingCount) {
        return false;
      }
    }

    if (draft.minRatingScore > 0) {
      if ((resource.averageRating || 0) < draft.minRatingScore) {
        return false;
      }
    }

    if (draft.minCommentCount > 0) {
      if ((resource.commentCount || (resource as any).comments || 0) < draft.minCommentCount) {
        return false;
      }
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
    return Number.isNaN(created) ? 0 : created;
  }
  return originalIndex;
};

const sortAdvancedResources = (
  resources: AdvancedResourceRecord[],
  sortField: string,
  sortOrder: string
): AdvancedResourceRecord[] => {
  const direction = sortOrder === 'asc' ? 1 : -1;
  return [...resources].sort((left, right) => {
    const leftIndex = (left as any).__catalogIndex ?? 0;
    const rightIndex = (right as any).__catalogIndex ?? 0;
    const leftValue = getSortableValue(left, sortField, leftIndex);
    const rightValue = getSortableValue(right, sortField, rightIndex);

    if (leftValue === rightValue) {
      return leftIndex - rightIndex;
    }

    if (leftValue > rightValue) return direction;
    return -direction;
  });
};

const paginateAdvancedResources = (
  resources: AdvancedResourceRecord[],
  page: number
): AdvancedResourceRecord[] => {
  const start = (page - 1) * ADVANCED_PAGE_SIZE;
  return resources.slice(start, start + ADVANCED_PAGE_SIZE);
};

const createSessionId = () =>
  `adv-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

async function runBounded<TInput, TOutput>(
  items: TInput[],
  limit: number,
  worker: (item: TInput, index: number) => Promise<TOutput>
): Promise<TOutput[]> {
  if (items.length === 0) return [];

  const results = new Array<TOutput>(items.length);
  let cursor = 0;

  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const currentIndex = cursor++;
      results[currentIndex] = await worker(items[currentIndex], currentIndex);
    }
  });

  await Promise.all(runners);
  return results;
}

interface TouchGalState {
  resources: TouchGalResource[];
  totalResources: number;
  currentPage: number;
  isLoading: boolean;
  isDetailLoading: boolean;
  error: string | null;
  selectedResource: TouchGalDetail | null;
  user: any | null;
  captchaUrl: string | null;
  captchaChallenge: { images: any[], sessionId: string } | null;
  isLoginOpen: boolean;
  selectedTags: string[];
  userProfile: any | null;
  userComments: any[];
  userRatings: any[];
  userCollections: any[];
  patchComments: any[];
  patchRatings: any[];
  homeMode: HomeMode;
  activeNsfwDomain: NsfwDomain;
  advancedFilterDraft: AdvancedFilterDraft;
  advancedBuildSessionId: string | null;
  advancedBuildProgress: AdvancedBuildProgress;
  advancedDatasetsByDomain: Record<NsfwDomain, AdvancedDatasetCache>;
  advancedEnrichmentFailuresByDomain: Record<NsfwDomain, string[]>;
  lastHomeQuery: Record<string, any>;
  sessionError: 'SESSION_EXPIRED' | string | null;

  fetchResources: (page?: number, query?: Record<string, unknown>) => Promise<void>;
  searchResources: (keyword: string, page?: number, options?: Record<string, any>) => Promise<void>;
  selectResource: (uniqueId: string) => Promise<void>;
  clearSelected: () => void;
  fetchCaptcha: () => Promise<void>;
  verifyCaptcha: (selectedIds: string[]) => Promise<string | null>;
  login: (username: string, password: string, captcha: string) => Promise<void>;
  logout: () => void;
  setIsLoginOpen: (isOpen: boolean) => void;
  fetchUserProfile: () => Promise<void>;
  fetchUserActivity: (type: 'comments' | 'ratings' | 'collections', page?: number) => Promise<void>;
  addTagFilter: (tag: string) => void;
  removeTagFilter: (tag: string) => void;
  clearTags: () => void;
  setHomeMode: (mode: HomeMode) => void;
  setActiveNsfwDomain: (domain: NsfwDomain) => void;
  updateAdvancedFilterDraft: (patch: Partial<AdvancedFilterDraft>) => void;
  resetAdvancedFilterDraft: () => void;
  startAdvancedBuildSession: (sessionId: string, domain: NsfwDomain, progress?: Partial<AdvancedBuildProgress>) => void;
  updateAdvancedBuildProgress: (progress: Partial<AdvancedBuildProgress>) => void;
  completeAdvancedBuildSession: (domain: NsfwDomain, cache: Partial<AdvancedDatasetCache>) => void;
  reportAdvancedEnrichmentFailure: (domain: NsfwDomain, uniqueId: string) => void;
  failAdvancedBuildSession: (message: string) => void;
  exitAdvancedMode: () => void;
  enterAdvancedMode: (sortField: string, sortOrder: string) => Promise<void>;
  applyAdvancedFilters: (page?: number, sortField?: string, sortOrder?: string) => void;
  setLastHomeQuery: (query: Record<string, any>) => void;
}

// Simple logger middleware
const logMiddleware = <T>(config: (set: any, get: any, api: any) => T) => 
  (set: any, get: any, api: any): T => config(
    (args: any) => {
      const prevState = get();
      set(args);
      const nextState = get();
      if (prevState && nextState) {
        const action = typeof args === 'function' ? 'function' : (typeof args === 'object' ? Object.keys(args)[0] : 'unknown');
        // Avoid logging functions or massive state objects to keep terminal clean
        if (typeof args === 'object') {
          console.log(`[Store Update] Action: ${action}`, args);
        } else {
          console.log(`[Store Update] Action: ${action}`);
        }
        
        if (args.error) {
          console.error(`[Store Error]`, args.error);
        }
      }
    },
    get,
    api
  );


const compositeStorage = {
  getItem: (name: string) => {
    try {
      const sessionStr = sessionStorage.getItem(name);
      const localStr = localStorage.getItem(name);
      const sessionObj = sessionStr ? JSON.parse(sessionStr) : { state: {} };
      const localObj = localStr ? JSON.parse(localStr) : { state: {} };
      
      return JSON.stringify({
        state: {
          ...sessionObj.state,
          user: localObj.state?.user ?? null,
        },
        version: localObj.version || 0
      });
    } catch (e) {
      return null;
    }
  },
  setItem: (name: string, value: string) => {
    try {
      const fullState = JSON.parse(value);
      const { state, version } = fullState;

      localStorage.setItem(name, JSON.stringify({
        state: { user: state.user },
        version
      }));

      sessionStorage.setItem(name, JSON.stringify({
        state: {
          advancedFilterDraft: state.advancedFilterDraft,
          selectedTags: state.selectedTags,
          activeNsfwDomain: state.activeNsfwDomain,
          lastHomeQuery: state.lastHomeQuery,
        },
        version
      }));
    } catch (e) {
      console.error('[CompositeStorage] Failed to save state', e);
    }
  },
  removeItem: (name: string) => {
    localStorage.removeItem(name);
    sessionStorage.removeItem(name);
  }
};

// Initialize store with persistent user if available
const savedUser = localStorage.getItem('tg_user');
const initialUser = savedUser ? JSON.parse(savedUser) : null;

export const useTouchGalStore = create<TouchGalState>()(
  persist(
    logMiddleware<TouchGalState>((set, get) => ({
    resources: [],
    totalResources: 0,
    currentPage: 1,
    isLoading: false,
    isDetailLoading: false,
    error: null,
    selectedResource: null,
    user: initialUser,
    captchaUrl: null,
    captchaChallenge: null,
    isLoginOpen: false,
    selectedTags: [],
    userProfile: null,
    userComments: [],
    userRatings: [],
    userCollections: [],
    patchComments: [],
    patchRatings: [],
    homeMode: 'normal',
    activeNsfwDomain: 'sfw',
    advancedFilterDraft: defaultAdvancedFilterDraft(),
    advancedBuildSessionId: null,
    advancedBuildProgress: defaultBuildProgress(),
    advancedDatasetsByDomain: {
      sfw: { resources: [], total: 0, hydratedTagIds: [], failedTagIds: [], lastBuiltAt: null },
      nsfw: { resources: [], total: 0, hydratedTagIds: [], failedTagIds: [], lastBuiltAt: null },
      all: { resources: [], total: 0, hydratedTagIds: [], failedTagIds: [], lastBuiltAt: null }
    },
    advancedEnrichmentFailuresByDomain: {
      sfw: [],
      nsfw: [],
      all: []
    },
    lastHomeQuery: {},
    sessionError: null,

    fetchResources: async (page = 1, query = {}) => {
      set({ isLoading: true, error: null });
      try {
        const data = await TouchGalClient.fetchGalgameResources(page, 24, query);
        set((_state: any) => ({
          resources: data.list,
          totalResources: data.total,
          currentPage: page,
          isLoading: false,
          sessionError: null
        }));
      } catch (err: any) {
        console.error('[Store] Fetch Error:', err.message, err);
        if (err.message?.includes('SESSION_EXPIRED')) {
          set({ sessionError: 'SESSION_EXPIRED', isLoading: false });
        } else {
          set({ error: err.message || "Failed to fetch resources", isLoading: false });
        }
      }
    },

  searchResources: async (keyword: string, page = 1, options = {}) => {
    set({ isLoading: true, error: null });
    try {
      const data = await TouchGalClient.searchResources(keyword, page, 20, options);
      set({ resources: data.list, totalResources: data.total, currentPage: page, isLoading: false, sessionError: null });
    } catch (err: any) {
      if (err.message?.includes('SESSION_EXPIRED')) {
        set({ sessionError: 'SESSION_EXPIRED', isLoading: false });
      } else {
        set({ error: err.message || 'Search failed', isLoading: false });
      }
    }
  },

  selectResource: async (uniqueId: string) => {
    // Find basic info from currently loaded resources to show immediately
    const basicInfo = get().resources.find((r: TouchGalResource) => r.uniqueId === uniqueId);
    if (basicInfo) {
      set({ 
        selectedResource: { ...basicInfo } as TouchGalDetail, 
        isDetailLoading: true, 
        error: null 
      });
    } else {
      set({ isDetailLoading: true, error: null });
    }

    try {
      const gId = basicInfo?.id;
      const [detail, introData, comments, ratings] = await Promise.all([
        TouchGalClient.getPatchDetail(uniqueId),
        TouchGalClient.getPatchIntroduction(uniqueId),
        gId ? TouchGalClient.fetchPatchComments(gId, 1, 50) : Promise.resolve({ list: [] }),
        gId ? TouchGalClient.fetchPatchRatings(gId, 1, 50) : Promise.resolve({ list: [] })
      ]);
      
      const finalId = detail.id || basicInfo?.id || 0;
      const hasSessionError = (comments as any).requiresLogin || (ratings as any).requiresLogin;

      set(() => ({ 
        selectedResource: {
          ...detail,
          id: finalId,
          introduction: introData.introduction ?? detail.introduction,
          releasedDate: introData.releasedDate ?? detail.releasedDate,
          alias: introData.alias?.length ? introData.alias : detail.alias,
          tags: introData.tags?.length ? introData.tags : detail.tags,
          company: introData.company ?? detail.company,
          vndbId: introData.vndbId ?? detail.vndbId,
          bangumiId: introData.bangumiId ?? detail.bangumiId,
          steamId: introData.steamId ?? detail.steamId,
        },
        patchComments: comments.list || [],
        patchRatings: ratings.list || [],
        isDetailLoading: false,
        sessionError: hasSessionError ? 'SESSION_EXPIRED' : null
      }));

      // If basicInfo didn't have ID, fetch again using detail.id
      if (!gId && detail.id) {
        const [c, r] = await Promise.all([
          TouchGalClient.fetchPatchComments(detail.id, 1, 50),
          TouchGalClient.fetchPatchRatings(detail.id, 1, 50)
        ]);
        
        const secondHasSessionError = (c as any).requiresLogin || (r as any).requiresLogin;

        set((state: TouchGalState) => ({
          patchComments: c.list || [],
          patchRatings: r.list || [],
          sessionError: (state.sessionError || secondHasSessionError) ? 'SESSION_EXPIRED' : null
        }));
      }
    } catch (err: any) {
      console.error('[Store] Detail Load Error:', err);
      if (err.message?.includes('SESSION_EXPIRED')) {
        set({ sessionError: 'SESSION_EXPIRED' });
      } else {
        set({ error: err.message || 'Failed to load details' });
      }
      set({ isDetailLoading: false });
    }
  },

  clearSelected: () => set({ selectedResource: null, patchComments: [], patchRatings: [] }),

  fetchCaptcha: async () => {
    set({ isLoading: true });
    try {
      const data = await TouchGalClient.fetchCaptcha();
      // If it's the challenge type (contains images and sessionId)
      if (data.images && data.sessionId) {
        set({ captchaChallenge: data, captchaUrl: null, isLoading: false });
      } else {
        // Fallback to legacy captcha
        set({ captchaUrl: data.url || data, captchaChallenge: null, isLoading: false });
      }
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },

  verifyCaptcha: async (ids: string[]) => {
    try {
      set({ isLoading: true, error: null });
      const challenge = get().captchaChallenge;
      console.log('[Store] Verifying Captcha:', ids);
      const result = await window.api.verifyCaptcha(challenge?.sessionId || '', ids);
      set({ isLoading: false });
      return result.code;
    } catch (err: any) {
      console.error('[Store] Captcha Error:', err);
      set({ error: 'Captcha verification failed', isLoading: false });
      const { fetchCaptcha } = get();
      await fetchCaptcha();
      return null;
    }
  },

  login: async (username: string, password: string, captcha: string) => {
    set({ isLoading: true, error: null });
    try {
      const user = await TouchGalClient.login(username, password, captcha);
      set({ user, isLoading: false, sessionError: null });
      localStorage.setItem('tg_user', JSON.stringify(user));
      // Save session/token if needed (handled by Main Process cookies usually)
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
      // Refresh captcha on failure
      const { fetchCaptcha } = get();
      await fetchCaptcha();
    }
  },

  logout: () => {
    set({ user: null, sessionError: null });
    localStorage.removeItem('tg_user');
  },
  setIsLoginOpen: (isOpen: boolean) => set({ isLoginOpen: isOpen }),
  addTagFilter: (tag: string) => set((state: TouchGalState) => {
    const nextTags = state.selectedTags.includes(tag) ? state.selectedTags : [...state.selectedTags, tag];
    return {
      selectedTags: nextTags,
      advancedFilterDraft: {
        ...state.advancedFilterDraft,
        selectedTags: nextTags
      }
    };
  }),
  removeTagFilter: (tag: string) => set((state: TouchGalState) => {
    const nextTags = state.selectedTags.filter((t: string) => t !== tag);
    return {
      selectedTags: nextTags,
      advancedFilterDraft: {
        ...state.advancedFilterDraft,
        selectedTags: nextTags
      }
    };
  }),
  clearTags: () => set((state: TouchGalState) => ({
    selectedTags: [],
    advancedFilterDraft: {
      ...state.advancedFilterDraft,
      selectedTags: []
    }
  })),
  setHomeMode: (mode: HomeMode) => set({ homeMode: mode }),
  setActiveNsfwDomain: (domain: NsfwDomain) =>
    set((state: TouchGalState) => {
      const nextDraft = {
        ...state.advancedFilterDraft,
        nsfwMode: domain
      };
      return {
        activeNsfwDomain: domain,
        advancedFilterDraft: nextDraft
      };
    }),
  updateAdvancedFilterDraft: (patch: Partial<AdvancedFilterDraft>) =>
    set((state: TouchGalState) => {
      const nextDraft = {
        ...state.advancedFilterDraft,
        ...patch
      };
      return {
        advancedFilterDraft: nextDraft,
        ...(patch.selectedTags
          ? {
              selectedTags: patch.selectedTags
            }
          : {})
      };
    }),
  resetAdvancedFilterDraft: () =>
    set((state: TouchGalState) => {
      const nextDraft = {
        ...defaultAdvancedFilterDraft(),
        nsfwMode: state.activeNsfwDomain
      };
      return {
        advancedFilterDraft: nextDraft
      };
    }),
  setLastHomeQuery: (query: Record<string, any>) => set({ lastHomeQuery: query }),
  startAdvancedBuildSession: (
    sessionId: string,
    domain: NsfwDomain,
    progress: Partial<AdvancedBuildProgress> = {}
  ) =>
    set({
      homeMode: 'advanced_building',
      activeNsfwDomain: domain,
      advancedBuildSessionId: sessionId,
      advancedBuildProgress: {
        ...defaultBuildProgress(),
        stage: 'catalog',
        message: 'Preparing advanced filter dataset...',
        ...progress
      },
      error: null
    }),
  updateAdvancedBuildProgress: (progress: Partial<AdvancedBuildProgress>) =>
    set((state: TouchGalState) => ({
      advancedBuildProgress: {
        ...state.advancedBuildProgress,
        ...progress
      }
    })),
  completeAdvancedBuildSession: (domain: NsfwDomain, cache: Partial<AdvancedDatasetCache>) =>
    set((state: TouchGalState) => ({
      homeMode: 'advanced_ready',
      activeNsfwDomain: domain,
      advancedBuildSessionId: null,
      advancedBuildProgress: {
        stage: 'ready',
        completed: cache.resources?.length ?? state.advancedBuildProgress.completed,
        total: cache.total ?? state.advancedBuildProgress.total,
        message: 'Advanced filter dataset ready.'
      },
      advancedDatasetsByDomain: {
        ...state.advancedDatasetsByDomain,
        [domain]: {
          ...state.advancedDatasetsByDomain[domain],
          ...cache,
          lastBuiltAt: Date.now()
        }
      }
    })),
  reportAdvancedEnrichmentFailure: (domain: NsfwDomain, uniqueId: string) =>
    set((state: TouchGalState) => ({
      advancedEnrichmentFailuresByDomain: {
        ...state.advancedEnrichmentFailuresByDomain,
        [domain]: state.advancedEnrichmentFailuresByDomain[domain].includes(uniqueId)
          ? state.advancedEnrichmentFailuresByDomain[domain]
          : [...state.advancedEnrichmentFailuresByDomain[domain], uniqueId]
      },
      advancedDatasetsByDomain: {
        ...state.advancedDatasetsByDomain,
        [domain]: {
          ...state.advancedDatasetsByDomain[domain],
          failedTagIds: state.advancedDatasetsByDomain[domain].failedTagIds.includes(uniqueId)
            ? state.advancedDatasetsByDomain[domain].failedTagIds
            : [...state.advancedDatasetsByDomain[domain].failedTagIds, uniqueId]
        }
      }
    })),
  failAdvancedBuildSession: (message: string) =>
    set({
      homeMode: 'normal',
      advancedBuildSessionId: null,
      advancedBuildProgress: {
        stage: 'error',
        completed: 0,
        total: 0,
        message
      },
      error: message
    }),
  exitAdvancedMode: () =>
    set({
      homeMode: 'normal',
      advancedBuildSessionId: null,
      advancedBuildProgress: defaultBuildProgress()
    }),
  applyAdvancedFilters: (page = 1, sortField = 'resource_update_time', sortOrder = 'desc') => {
    const state = get();
    const domain = state.activeNsfwDomain;
    const dataset = state.advancedDatasetsByDomain[domain];
    const filtered = applyAdvancedPredicate(dataset.resources, state.advancedFilterDraft);
    const sorted = sortAdvancedResources(filtered, sortField, sortOrder);
    const paged = paginateAdvancedResources(sorted, page);

    set({
      resources: paged,
      totalResources: sorted.length,
      currentPage: page,
      homeMode: dataset.resources.length > 0 ? 'advanced_ready' : state.homeMode
    });
  },
  enterAdvancedMode: async (sortField = 'resource_update_time', sortOrder = 'desc') => {
    const initialState = get();
    const domain: NsfwDomain = initialState.advancedFilterDraft.nsfwMode;
    const sessionId = createSessionId();

    initialState.startAdvancedBuildSession(sessionId, domain, {
      stage: 'catalog',
      completed: 0,
      total: 0,
      message: 'Loading full homepage catalog...'
    });

    try {
      const baseQuery = {
        nsfwMode: domain === 'nsfw' ? 'nsfw' : domain === 'all' ? 'all' : 'safe',
        selectedPlatform: 'all',
        sortField,
        sortOrder
      };

      const firstPage = await TouchGalClient.fetchGalgameResources(1, ADVANCED_PAGE_SIZE, baseQuery);
      if (get().advancedBuildSessionId !== sessionId) {
        return;
      }

      const totalPages = Math.max(1, Math.ceil(firstPage.total / ADVANCED_PAGE_SIZE));
      const remainingPages = Array.from({ length: Math.max(0, totalPages - 1) }, (_, index) => index + 2);
      let completedPages = 1;

      get().updateAdvancedBuildProgress({
        stage: 'catalog',
        completed: completedPages,
        total: totalPages,
        message: `Loading full homepage catalog... ${completedPages}/${totalPages}`
      });

      const remainingResults = await runBounded(
        remainingPages,
        ADVANCED_CATALOG_CONCURRENCY,
        async (pageNumber) => {
          const response = await TouchGalClient.fetchGalgameResources(pageNumber, ADVANCED_PAGE_SIZE, baseQuery);
          completedPages += 1;
          if (get().advancedBuildSessionId === sessionId) {
            get().updateAdvancedBuildProgress({
              stage: 'catalog',
              completed: completedPages,
              total: totalPages,
              message: `Loading full homepage catalog... ${completedPages}/${totalPages}`
            });
          }
          return response.list;
        }
      );

      if (get().advancedBuildSessionId !== sessionId) {
        return;
      }

      const mergedCatalog = uniqueById([
        ...firstPage.list,
        ...remainingResults.flat()
      ]).map((resource, index) => ({
        ...toAdvancedResourceRecord(resource),
        __catalogIndex: index
      }));

      set((state: TouchGalState) => ({
        homeMode: 'advanced_ready',
        activeNsfwDomain: domain,
        advancedDatasetsByDomain: {
          ...state.advancedDatasetsByDomain,
          [domain]: {
            resources: mergedCatalog,
            total: mergedCatalog.length,
            hydratedTagIds: [],
            failedTagIds: [],
            lastBuiltAt: Date.now()
          }
        },
        advancedEnrichmentFailuresByDomain: {
          ...state.advancedEnrichmentFailuresByDomain,
          [domain]: []
        },
        advancedBuildProgress: {
          stage: 'enrichment',
          completed: 0,
          total: mergedCatalog.length,
          message: `Hydrating tags... 0/${mergedCatalog.length}`
        }
      }));

      get().applyAdvancedFilters(1, sortField, sortOrder);

      let hydratedCount = 0;

      void runBounded(
        mergedCatalog,
        ADVANCED_TAG_CONCURRENCY,
        async (resource) => {
          try {
            const intro = await TouchGalClient.getPatchIntroduction(resource.uniqueId);
            if (get().advancedBuildSessionId !== sessionId && get().homeMode === 'normal') {
              return;
            }

            hydratedCount += 1;
            set((state: TouchGalState) => {
              const currentDataset = state.advancedDatasetsByDomain[domain];
              const nextResources = currentDataset.resources.map((item: AdvancedResourceRecord) =>
                item.uniqueId === resource.uniqueId
                  ? {
                      ...item,
                      fullTags: intro.tags?.length ? intro.tags : item.fullTags,
                      releasedDate: intro.releasedDate ?? item.releasedDate,
                      normalizedYear: intro.releasedDate ? normalizeYear({ ...item, releasedDate: intro.releasedDate }) : item.normalizedYear,
                      tagsHydrated: true
                    }
                  : item
              );

              const hydratedTagIds = currentDataset.hydratedTagIds.includes(resource.uniqueId)
                ? currentDataset.hydratedTagIds
                : [...currentDataset.hydratedTagIds, resource.uniqueId];

              return {
                advancedDatasetsByDomain: {
                  ...state.advancedDatasetsByDomain,
                  [domain]: {
                    ...currentDataset,
                    resources: nextResources,
                    hydratedTagIds
                  }
                },
                advancedBuildProgress: {
                  stage: hydratedCount >= mergedCatalog.length ? 'ready' : 'enrichment',
                  completed: hydratedCount,
                  total: mergedCatalog.length,
                  message:
                    hydratedCount >= mergedCatalog.length
                      ? 'Advanced filter dataset ready.'
                      : `Hydrating tags... ${hydratedCount}/${mergedCatalog.length}`
                }
              };
            });

            const latestState = get();
            if (latestState.homeMode !== 'normal') {
              latestState.applyAdvancedFilters(latestState.currentPage, sortField, sortOrder);
            }
          } catch (err) {
            hydratedCount += 1;
            get().reportAdvancedEnrichmentFailure(domain, resource.uniqueId);
            if (process.env.NODE_ENV !== 'production') {
              console.warn('[Advanced Filter] Failed to hydrate tags for', resource.uniqueId, err);
            }
            if (get().homeMode !== 'normal') {
              get().updateAdvancedBuildProgress({
                stage: hydratedCount >= mergedCatalog.length ? 'ready' : 'enrichment',
                completed: hydratedCount,
                total: mergedCatalog.length,
                message:
                  hydratedCount >= mergedCatalog.length
                    ? 'Advanced filter dataset ready with partial tag failures.'
                    : `Hydrating tags... ${hydratedCount}/${mergedCatalog.length}`
              });
            }
          }
        }
      );
    } catch (err: any) {
      console.error('[Store] Advanced Mode Build Error:', err);
      get().failAdvancedBuildSession(err.message || 'Failed to build advanced filter dataset');
    }
  },

  fetchUserProfile: async () => {
    set({ isLoading: true });
    try {
      // First, get the current authenticated user state (includes real UID)
      const selfStatus = await window.api.getUserStatusSelf();
      if (selfStatus && typeof selfStatus === 'object') {
        // Sync user state with real UID if needed
        const currentUid = selfStatus.uid || selfStatus.id;
        set((state: any) => ({ 
          user: { ...state.user, id: currentUid, uid: currentUid },
          userProfile: selfStatus,
          isLoading: false 
        }));
        
        // Now fetch the detailed stats using the confirmed UID
        const profileDetail = await window.api.getUserStatus(currentUid);
        set({ userProfile: profileDetail, isLoading: false });
      }
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },

  fetchUserActivity: async (type, page = 1) => {
    const currentState = get();
    // Use uid or id, ensuring we don't pass NaN
    const uid = currentState.userProfile?.id || currentState.user?.uid || currentState.user?.id;
    
    if (!uid || isNaN(Number(uid))) {
      console.warn('[Store] Cannot fetch activity: UID is invalid', uid);
      return;
    }
    
    set({ isLoading: true });
    try {
      let data;
      const numericUid = Number(uid);
      if (type === 'comments') {
        data = await window.api.getUserComments(numericUid, page, 20);
        set({ userComments: data.comments || [], isLoading: false });
      } else if (type === 'ratings') {
        data = await window.api.getUserRatings(numericUid, page, 20);
        set({ userRatings: data.ratings || [], isLoading: false });
      } else if (type === 'collections') {
        data = await window.api.getFavoriteFolders(numericUid);
        set({ userCollections: data || [], isLoading: false });
      }
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },
})),
{
  name: 'touchgal-home-viewmodel',
  storage: compositeStorage as any,
  merge: (persistedState, currentState): TouchGalState => {
    const persisted = (persistedState as Partial<TouchGalState>) ?? {};
    return {
      ...currentState,
      ...persisted,
      advancedFilterDraft: persisted.advancedFilterDraft || defaultAdvancedFilterDraft(),
      selectedTags: persisted.selectedTags || [],
      lastHomeQuery: persisted.lastHomeQuery || {},
      activeNsfwDomain: persisted.activeNsfwDomain || 'sfw'
    };
  }
}
)
);

