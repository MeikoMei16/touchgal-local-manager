import { TouchGalClient } from '../../data/TouchGalClient';
import { useAuthStore } from '../authStore';
import { normalizeHomeQuery } from '../../features/home/homeState';
import type { UIGetState, UISetState } from '../uiStoreTypes';

export const createBrowseActions = (set: UISetState, get: UIGetState) => ({
  fetchResources: async (page = 1, query = {}) => {
    set({ isLoading: true, error: null });
    try {
      const normalizedQuery = normalizeHomeQuery({ ...get().lastHomeQuery, ...query });
      const data = await TouchGalClient.fetchGalgameResources(page, 24, normalizedQuery);
      set({ resources: data.list, totalResources: data.total, currentPage: page, isLoading: false });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
      if (err.message?.includes('SESSION_EXPIRED')) useAuthStore.getState().setSessionError('SESSION_EXPIRED');
    }
  },
  searchResources: async (keyword: string, page = 1, options = {}) => {
    set({ isLoading: true, error: null });
    try {
      const data = await TouchGalClient.searchResources(keyword, page, 20, options);
      set({ resources: data.list, totalResources: data.total, currentPage: page, isLoading: false });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
      if (err.message?.includes('SESSION_EXPIRED')) useAuthStore.getState().setSessionError('SESSION_EXPIRED');
    }
  },
  setLastHomeQuery: (query: any) => set({ lastHomeQuery: normalizeHomeQuery(query) }),
  setCurrentPage: (page: number) => set({ currentPage: page }),
  setHasHydratedUi: (hydrated: boolean) => set({ hasHydratedUi: hydrated })
});
