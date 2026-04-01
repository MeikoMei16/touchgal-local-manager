import { TouchGalResource } from '../../types';

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

export interface AdvancedResourceRecord extends TouchGalResource {
  fullTags: string[];
  normalizedYear: number | null;
  tagsHydrated: boolean;
}

export interface AdvancedDatasetCache {
  resources: AdvancedResourceRecord[];
  total: number;
  hydratedTagIds: string[];
  failedTagIds: string[];
  lastBuiltAt: number | null;
  upstreamKey: string | null;
}

export type HomeSortField =
  | 'resource_update_time'
  | 'created'
  | 'rating'
  | 'view'
  | 'download'
  | 'favorite';

export type HomeSortOrder = 'asc' | 'desc';

export interface HomeQueryState {
  nsfwMode: 'safe' | 'nsfw' | 'all';
  selectedPlatform: string;
  yearConstraints: Array<{ op: string; val: number }>;
  minRatingCount: number;
  minRatingScore: number;
  minCommentCount: number;
  selectedTags: string[];
  sortField: HomeSortField;
  sortOrder: HomeSortOrder;
}

export const defaultAdvancedFilterDraft = (): AdvancedFilterDraft => ({
  nsfwMode: 'sfw',
  selectedPlatform: 'all',
  yearConstraints: [],
  minRatingCount: 0,
  minRatingScore: 0,
  minCommentCount: 0,
  selectedTags: []
});

export const defaultBuildProgress = (): AdvancedBuildProgress => ({
  stage: 'idle',
  completed: 0,
  total: 0,
  message: ''
});

export const defaultAdvancedDatasetCache = (): AdvancedDatasetCache => ({
  resources: [],
  total: 0,
  hydratedTagIds: [],
  failedTagIds: [],
  lastBuiltAt: null,
  upstreamKey: null
});

export const defaultHomeQuery = (): HomeQueryState => ({
  nsfwMode: 'safe',
  selectedPlatform: 'all',
  yearConstraints: [],
  minRatingCount: 0,
  minRatingScore: 0,
  minCommentCount: 0,
  selectedTags: [],
  sortField: 'created',
  sortOrder: 'desc'
});

export const normalizeSortField = (value: unknown): HomeSortField => {
  if (value === 'visit') return 'view';
  if (value === 'resource_update_time' || value === 'created' || value === 'rating' || value === 'view' || value === 'download' || value === 'favorite') {
    return value;
  }
  return 'created';
};

export const normalizeSortOrder = (value: unknown): HomeSortOrder => (value === 'asc' ? 'asc' : 'desc');

export const normalizePage = (value: unknown): number => {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : 1;
};

export const normalizeHomeQuery = (query: Partial<HomeQueryState> | null | undefined): HomeQueryState => ({
  ...defaultHomeQuery(),
  ...query,
  nsfwMode: query?.nsfwMode === 'nsfw' || query?.nsfwMode === 'all' ? query.nsfwMode : 'safe',
  selectedPlatform: query?.selectedPlatform ?? 'all',
  yearConstraints: Array.isArray(query?.yearConstraints) ? query.yearConstraints : [],
  minRatingCount: Number(query?.minRatingCount ?? 0) || 0,
  minRatingScore: Number(query?.minRatingScore ?? 0) || 0,
  minCommentCount: Number(query?.minCommentCount ?? 0) || 0,
  selectedTags: Array.isArray(query?.selectedTags) ? query.selectedTags : [],
  sortField: normalizeSortField(query?.sortField),
  sortOrder: normalizeSortOrder(query?.sortOrder)
});
