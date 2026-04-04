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
import type { DetailOpenIntent, DetailSecondaryClickAction, UIState } from './uiStoreTypes';

export type { UIState } from './uiStoreTypes';

const normalizeDetailSecondaryClickAction = (value: unknown): DetailSecondaryClickAction =>
  value === 'native' ? 'native' : 'back';

const normalizeDetailOpenIntent = (value: unknown): DetailOpenIntent =>
  value === 'links' || value === 'favorite' ? value : 'default';

const coerceLegacyHomepageDefaults = (query: Partial<UIState['lastHomeQuery']> | undefined) => {
  const normalized = normalizeHomeQuery(query);

  const looksLikeLegacyDefault =
    normalized.minRatingCount === 10 &&
    normalized.nsfwMode === 'safe' &&
    normalized.selectedPlatform === 'all' &&
    normalized.yearConstraints.length === 0 &&
    normalized.minRatingScore === 0 &&
    normalized.minCommentCount === 0 &&
    normalized.selectedTags.length === 0 &&
    normalized.sortField === 'rating' &&
    normalized.sortOrder === 'desc';

  return looksLikeLegacyDefault
    ? { ...normalized, minRatingCount: 0 }
    : normalized;
};

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
      detailSecondaryClickAction: 'back',
      detailOpenIntent: 'default',
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
      setDetailSecondaryClickAction: (action) => set({ detailSecondaryClickAction: normalizeDetailSecondaryClickAction(action) }),
      setDetailOpenIntent: (intent) => set({ detailOpenIntent: normalizeDetailOpenIntent(intent) }),
      ...createBrowseActions(set, get),
      ...createDetailActions(set, get),
      ...createAdvancedActions(set, get)
    }),
    {
      name: 'touchgal-ui-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        currentPage: state.currentPage,
        lastHomeQuery: state.lastHomeQuery,
        detailSecondaryClickAction: state.detailSecondaryClickAction
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
          lastHomeQuery: coerceLegacyHomepageDefaults(persistedQuery),
          detailSecondaryClickAction: normalizeDetailSecondaryClickAction(persistedSlice?.detailSecondaryClickAction)
        };
      }
    }
  )
);
