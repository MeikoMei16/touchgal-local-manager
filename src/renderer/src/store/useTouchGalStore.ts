import { create } from 'zustand';
import { TouchGalResource, TouchGalDetail } from '../types';
import { TouchGalClient } from '../data/TouchGalClient';

interface TouchGalState {
  resources: TouchGalResource[];
  totalResources: number;
  currentPage: number;
  isLoading: boolean;
  error: string | null;
  selectedResource: TouchGalDetail | null;
  user: any | null;
  captchaUrl: string | null;
  captchaChallenge: { images: any[], sessionId: string } | null;
  isLoginOpen: boolean;
  selectedTags: string[];

  fetchResources: (page?: number, query?: Record<string, unknown>) => Promise<void>;
  searchResources: (keyword: string, page?: number, options?: Record<string, any>) => Promise<void>;
  selectResource: (uniqueId: string) => Promise<void>;
  clearSelected: () => void;
  fetchCaptcha: () => Promise<void>;
  verifyCaptcha: (selectedIds: string[]) => Promise<string | null>;
  login: (username: string, password: string, captcha: string) => Promise<void>;
  logout: () => void;
  setIsLoginOpen: (isOpen: boolean) => void;
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
    error: null,
    selectedResource: null,
    user: initialUser,
    captchaUrl: null,
    captchaChallenge: null,
    isLoginOpen: false,
    selectedTags: [],

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
    set({ isLoading: true, error: null });
    try {
      const detail = await TouchGalClient.getPatchDetail(uniqueId);
      const introData = await TouchGalClient.getPatchIntroduction(uniqueId);
      set({
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
        isLoading: false
      });
    } catch (err: any) {
      set({ error: err.message || 'Failed to load details', isLoading: false });
    }
  },

  clearSelected: () => set({ selectedResource: null }),

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
  clearTags: () => set({ selectedTags: [] })
})));
