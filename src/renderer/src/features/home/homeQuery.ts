import { AdvancedFilterDraft, HomeQueryState, NsfwDomain } from './homeState';

export const HOME_PLATFORM_OPTIONS = [
  { label: '全部平台', value: 'all' },
  { label: 'Windows', value: 'windows' },
  { label: 'Android', value: 'android' },
  { label: 'MacOS', value: 'macos' },
  { label: 'iOS', value: 'ios' },
  { label: 'Linux', value: 'linux' }
] as const;

export const mapNsfwModeToDomain = (value: HomeQueryState['nsfwMode'] | NsfwDomain): NsfwDomain => {
  if (value === 'nsfw') return 'nsfw';
  if (value === 'all') return 'all';
  return 'sfw';
};

export const requiresAdvancedMode = (filters: HomeQueryState) =>
  (filters.yearConstraints?.length ?? 0) > 0 ||
  (filters.minRatingCount ?? 0) > 0 ||
  (filters.minRatingScore ?? 0) > 0 ||
  (filters.minCommentCount ?? 0) > 0 ||
  (filters.selectedTags?.length ?? 0) > 0;

export const buildHomeQuery = (
  currentQuery: HomeQueryState,
  overrides: Partial<HomeQueryState>
): HomeQueryState => ({
  ...currentQuery,
  ...overrides
});

export const toDraftPayload = (query: HomeQueryState): Partial<AdvancedFilterDraft> => ({
  nsfwMode: mapNsfwModeToDomain(query.nsfwMode ?? 'safe'),
  selectedPlatform: query.selectedPlatform ?? 'all',
  yearConstraints: query.yearConstraints ?? [],
  selectedTags: query.selectedTags ?? [],
  minRatingCount: query.minRatingCount ?? 0,
  minRatingScore: query.minRatingScore ?? 0,
  minCommentCount: query.minCommentCount ?? 0
});

export const buildQueryFromAdvancedDraft = (
  draft: AdvancedFilterDraft,
  overrides: Partial<HomeQueryState>
): Partial<HomeQueryState> => ({
  nsfwMode:
    overrides.nsfwMode ??
    (draft.nsfwMode === 'nsfw'
      ? 'nsfw'
      : draft.nsfwMode === 'all'
        ? 'all'
        : 'safe'),
  selectedPlatform: overrides.selectedPlatform ?? draft.selectedPlatform,
  yearConstraints: overrides.yearConstraints ?? draft.yearConstraints,
  selectedTags: overrides.selectedTags ?? draft.selectedTags,
  minRatingCount: overrides.minRatingCount ?? draft.minRatingCount,
  minRatingScore: overrides.minRatingScore ?? draft.minRatingScore,
  minCommentCount: overrides.minCommentCount ?? draft.minCommentCount
});
