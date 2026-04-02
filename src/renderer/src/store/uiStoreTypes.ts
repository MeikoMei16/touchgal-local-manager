import type { StoreApi } from 'zustand';
import type { TouchGalDetail, TouchGalResource } from '../types';
import type {
  AdvancedBuildProgress,
  AdvancedDatasetCache,
  AdvancedFilterDraft,
  HomeMode,
  HomeQueryState,
  NsfwDomain
} from '../features/home/homeState';

export type DetailSecondaryClickAction = 'back' | 'native';

export interface UIState {
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
  detailSecondaryClickAction: DetailSecondaryClickAction;
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
  pauseAdvancedBuild: () => void;
  resumeAdvancedBuild: (sortField: string, sortOrder: string) => Promise<void>;
  clearAdvancedSearch: () => void;
  applyAdvancedFilters: (page: number, sortField: string, sortOrder: string) => void;
  addTagFilter: (tag: string) => void;
  removeTagFilter: (tag: string) => void;
  clearTags: () => void;
  resetAdvancedFilterDraft: () => void;
  setDetailSecondaryClickAction: (action: DetailSecondaryClickAction) => void;
  setLastHomeQuery: (query: Partial<HomeQueryState>) => void;
  setCurrentPage: (page: number) => void;
  setHasHydratedUi: (hydrated: boolean) => void;
}

export type UISetState = StoreApi<UIState>['setState'];
export type UIGetState = StoreApi<UIState>['getState'];
