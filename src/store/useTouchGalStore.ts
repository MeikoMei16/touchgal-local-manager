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

  fetchResources: (page?: number, query?: any) => Promise<void>;
  searchResources: (keyword: string, page?: number) => Promise<void>;
  selectResource: (uniqueId: string) => Promise<void>;
  clearSelected: () => void;
  fetchCaptcha: () => Promise<void>;
  login: (username: string, password: string, captcha: string) => Promise<void>;
  logout: () => void;
}

export const useTouchGalStore = create<TouchGalState>((set) => ({
  resources: [],
  totalResources: 0,
  currentPage: 1,
  totalPages: 1,
  isLoading: false,
  error: null,
  selectedResource: null,
  user: null,
  captchaUrl: null,

  fetchResources: async (page = 1, query = {}) => {
    set({ isLoading: true, error: null });
    try {
      const data = await TouchGalClient.fetchGalgameResources(page, 24, query);
      set({ resources: data.list, totalResources: data.total, currentPage: page, isLoading: false });
    } catch (err: any) {
      set({ error: err.message || 'Failed to fetch resources', isLoading: false });
    }
  },

  searchResources: async (keyword: string, page = 1) => {
    set({ isLoading: true, error: null });
    try {
      const data = await TouchGalClient.searchResources(keyword, page);
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
      set({ selectedResource: { ...detail, introduction: introData.introduction }, isLoading: false });
    } catch (err: any) {
      set({ error: err.message || 'Failed to load details', isLoading: false });
    }
  },

  clearSelected: () => set({ selectedResource: null }),

  fetchCaptcha: async () => {
    try {
      const url = await TouchGalClient.fetchCaptcha();
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

  logout: () => set({ user: null })
}));
