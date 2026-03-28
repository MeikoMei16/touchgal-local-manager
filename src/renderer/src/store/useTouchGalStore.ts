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
  isLoginOpen: boolean;

  fetchResources: (page?: number, query?: Record<string, unknown>) => Promise<void>;
  searchResources: (keyword: string, page?: number, options?: Record<string, any>) => Promise<void>;
  selectResource: (uniqueId: string) => Promise<void>;
  clearSelected: () => void;
  fetchCaptcha: () => Promise<void>;
  login: (username: string, password: string, captcha: string) => Promise<void>;
  logout: () => void;
  setIsLoginOpen: (isOpen: boolean) => void;
}

export const useTouchGalStore = create<TouchGalState>((set) => ({
  resources: [],
  totalResources: 0,
  currentPage: 1,
  isLoading: false,
  error: null,
  selectedResource: null,
  user: null,
  captchaUrl: null,
  isLoginOpen: false,

  fetchResources: async (page = 1, query = {}) => {
    set({ isLoading: true, error: null });
    try {
      const data = await TouchGalClient.fetchGalgameResources(page, 24, query);
      set((_state) => ({
        resources: data.list,
        totalResources: data.total,
        currentPage: page,
        isLoading: false
      }));
    } catch (err: any) {
      set({ error: err.message || 'Failed to fetch resources', isLoading: false });
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
    try {
      const payload = await TouchGalClient.fetchCaptcha();
      const url = typeof payload === 'string'
        ? payload
        : payload?.images?.[0]?.data ?? payload?.images?.[0]?.image ?? null;
      set({ captchaUrl: url });
    } catch (err: any) {
      set({ error: err.message || 'Failed to fetch captcha' });
    }
  },

  login: async (username, password, captcha) => {
    set({ isLoading: true, error: null });
    try {
      const userData = await TouchGalClient.login(username, password, captcha);
      set({ user: userData, isLoading: false });
    } catch (err: any) {
      set({ error: err.message || 'Login failed', isLoading: false });
    }
  },

  logout: () => set({ user: null }),
  setIsLoginOpen: (isOpen: boolean) => set({ isLoginOpen: isOpen })
}));
