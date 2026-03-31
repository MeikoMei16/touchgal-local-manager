import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import {
  defaultAdvancedDatasetCache,
  defaultAdvancedFilterDraft,
  defaultBuildProgress,
  defaultHomeQuery,
  normalizeHomeQuery,
  normalizePage
} from '../features/home/homeState';
import { createBrowseActions } from './uiActions/browseActions';
import { createDetailActions } from './uiActions/detailActions';
import { createAdvancedActions } from './uiActions/advancedActions';
import type { UIState } from './uiStoreTypes';

export type { UIState } from './uiStoreTypes';

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
      ...createBrowseActions(set, get),
      ...createDetailActions(set, get),
      ...createAdvancedActions(set, get)
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
          typedPersisted && 'state' in typedPersisted ? typedPersisted.state : typedPersisted
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
