export { useAuthStore } from './authStore';
export { useUIStore } from './uiStore';
export type { AuthState } from './authStore';
export type { UIState } from './uiStore';
export type {
  AdvancedBuildProgress,
  AdvancedDatasetCache,
  AdvancedFilterDraft,
  AdvancedResourceRecord,
  HomeMode,
  HomeQueryState,
  HomeSortField,
  HomeSortOrder,
  NsfwDomain
} from '../features/home/homeState';
export {
  defaultAdvancedDatasetCache,
  defaultAdvancedFilterDraft,
  defaultBuildProgress,
  defaultHomeQuery,
  normalizeHomeQuery,
  normalizePage,
  normalizeSortField,
  normalizeSortOrder
} from '../features/home/homeState';

import { useAuthStore } from './authStore';
import { useUIStore } from './uiStore';

export const useTouchGalStore = () => {
  const auth = useAuthStore();
  const ui = useUIStore();
  return { ...auth, ...ui };
};
