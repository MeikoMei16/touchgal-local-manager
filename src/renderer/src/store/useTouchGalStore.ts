import { create } from 'zustand';
import { TouchGalResource, TouchGalDetail } from '../types';
import { TouchGalClient } from '../data/TouchGalClient';

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

// Initialize store with persistent user if available
const savedUser = localStorage.getItem('tg_user');
const initialUser = savedUser ? JSON.parse(savedUser) : null;

export const useTouchGalStore = create<TouchGalState>()(
  logMiddleware((set, get) => ({
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

    fetchResources: async (page = 1, query = {}) => {
      set({ isLoading: true, error: null });
      try {
        const data = await TouchGalClient.fetchGalgameResources(page, 24, query);
        set((_state: any) => ({
          resources: data.list,
          totalResources: data.total,
          currentPage: page,
          isLoading: false
        }));
      } catch (err: any) {
        console.error('[Store] Fetch Error:', err.message, err);
        set({ error: err.message || "Failed to fetch resources", isLoading: false });
      }
    },

  searchResources: async (keyword: string, page = 1, options = {}) => {
    set({ isLoading: true, error: null });
    try {
      const data = await TouchGalClient.searchResources(keyword, page, 20, options);
      set({ resources: data.list, totalResources: data.total, currentPage: page, isLoading: false });
    } catch (err: any) {
      set({ error: err.message || 'Search failed', isLoading: false });
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
      
      set(() => ({ // Use functional update to ensure we have latest id if not in basicInfo
        selectedResource: {
          ...detail,
          introduction: introData.introduction ?? detail.introduction,
          releasedDate: introData.releasedDate ?? detail.releasedDate,
          alias: introData.alias?.length ? introData.alias : detail.alias,
          tags: introData.tags?.length ? introData.tags : detail.tags,
          company: introData.company ?? detail.company,
          vndbId: introData.vndbId ?? detail.vndbId,
          bangumiId: introData.bangumiId ?? detail.bangumiId,
          steamId: introData.steamId ?? detail.steamId,
        },
        patchComments: comments.list || comments.comments || [],
        patchRatings: ratings.list || ratings.ratings || [],
        isDetailLoading: false
      }));

      // If basicInfo didn't have ID, fetch again using detail.id
      if (!gId && detail.id) {
        const [c, r] = await Promise.all([
          TouchGalClient.fetchPatchComments(detail.id, 1, 50),
          TouchGalClient.fetchPatchRatings(detail.id, 1, 50)
        ]);
        set({
          patchComments: c.list || c.comments || [],
          patchRatings: r.list || r.ratings || [],
        });
      }
    } catch (err: any) {
      console.error('[Store] Detail Load Error:', err);
      set({ error: err.message || 'Failed to load details', isDetailLoading: false });
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
      set({ user, isLoading: false });
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
    set({ user: null });
    localStorage.removeItem('tg_user');
  },
  setIsLoginOpen: (isOpen: boolean) => set({ isLoginOpen: isOpen }),
  addTagFilter: (tag: string) => set((state: TouchGalState) => ({
    selectedTags: state.selectedTags.includes(tag) ? state.selectedTags : [...state.selectedTags, tag]
  })),
  removeTagFilter: (tag: string) => set((state: TouchGalState) => ({
    selectedTags: state.selectedTags.filter((t: string) => t !== tag)
  })),
  clearTags: () => set({ selectedTags: [] }),

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
  }
})));
