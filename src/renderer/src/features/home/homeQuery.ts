import { AdvancedFilterDraft, HomeQueryState, NsfwDomain } from './homeState';

export const HOME_PLATFORM_OPTIONS = [
  { label: '全部平台', value: 'all' },
  { label: 'Windows', value: 'windows' },
  { label: 'Android', value: 'android' },
  { label: 'MacOS', value: 'macos' },
  { label: 'iOS', value: 'ios' },
  { label: 'Linux', value: 'linux' }
] as const;

export const HOME_TYPE_OPTIONS = [
  { label: '全部类型', value: 'all' },
  { label: 'PC游戏', value: 'pc' },
  { label: '汉化资源', value: 'chinese' },
  { label: '手机游戏', value: 'mobile' },
  { label: '模拟器资源', value: 'emulator' },
  { label: '生肉资源', value: 'row' },
  { label: '直装资源', value: 'app' },
  { label: '补丁资源', value: 'patch' },
  { label: '游戏工具', value: 'tool' },
  { label: '官方通知', value: 'notice' },
  { label: '其它', value: 'other' }
] as const;

export const HOME_LANGUAGE_OPTIONS = [
  { label: '全部语言', value: 'all' },
  { label: '简体中文', value: 'zh-Hans' },
  { label: '繁體中文', value: 'zh-Hant' },
  { label: '日本語', value: 'ja' },
  { label: 'English', value: 'en' },
  { label: '其它', value: 'other' }
] as const;

export const mapNsfwModeToDomain = (value: HomeQueryState['nsfwMode'] | NsfwDomain): NsfwDomain => {
  if (value === 'nsfw') return 'nsfw';
  if (value === 'all') return 'all';
  return 'sfw';
};

export const requiresAdvancedMode = (filters: HomeQueryState) =>
  filters.sortField === 'rating' ||
  (filters.yearConstraints?.length ?? 0) > 0 ||
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
  selectedType: query.selectedType ?? 'all',
  selectedLanguage: query.selectedLanguage ?? 'all',
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
  selectedType: overrides.selectedType ?? draft.selectedType,
  selectedLanguage: overrides.selectedLanguage ?? draft.selectedLanguage,
  selectedPlatform: overrides.selectedPlatform ?? draft.selectedPlatform,
  yearConstraints: overrides.yearConstraints ?? draft.yearConstraints,
  selectedTags: overrides.selectedTags ?? draft.selectedTags,
  minRatingCount: overrides.minRatingCount ?? draft.minRatingCount,
  minRatingScore: overrides.minRatingScore ?? draft.minRatingScore,
  minCommentCount: overrides.minCommentCount ?? draft.minCommentCount
});
