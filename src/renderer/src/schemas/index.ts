import { z } from 'zod';

const primitiveToString = (value: unknown) => {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value);
  }
  return null;
};

const stringDefault = (fallback = '') =>
  z.preprocess((value) => primitiveToString(value) ?? fallback, z.string());

const nullableString = z.preprocess(
  (value) => {
    if (value == null) return null;
    return primitiveToString(value);
  },
  z.string().nullable()
).default(null);

const numberDefault = (fallback = 0) =>
  z.preprocess(
    (value) => (value == null || value === '' ? fallback : value),
    z.coerce.number().catch(fallback)
  ).default(fallback);

const nullableNumber = z.preprocess(
  (value) => (value == null || value === '' ? null : value),
  z.coerce.number().nullable().catch(null)
).default(null);

const booleanDefault = (fallback = false) =>
  z.preprocess(
    (value) => {
      if (value == null || value === '') return fallback;
      if (typeof value === 'string') {
        if (value === 'true') return true;
        if (value === 'false') return false;
      }
      return value;
    },
    z.coerce.boolean().catch(fallback)
  ).default(fallback);

const stringArray = z.preprocess(
  (value) => {
    if (Array.isArray(value)) {
      return value.map(primitiveToString).filter((item): item is string => Boolean(item));
    }

    const text = primitiveToString(value);
    return text ? [text] : [];
  },
  z.array(z.string())
).default([]);

const stringListDisplay = z.preprocess(
  (value) => {
    if (Array.isArray(value)) {
      return value.map(primitiveToString).filter(Boolean).join(', ');
    }
    return primitiveToString(value) ?? '';
  },
  z.string()
).default('');

const arrayOf = <T extends z.ZodType>(schema: T) =>
  z.preprocess((value) => (Array.isArray(value) ? value : []), z.array(schema)).default([]);

const objectInput = (value: unknown) =>
  value && typeof value === 'object' && !Array.isArray(value) ? value : {};

const objectRecord = (value: unknown): Record<string, unknown> =>
  objectInput(value) as Record<string, unknown>;

const companyDisplay = z.union([z.string(), z.array(z.any())]).nullable().optional().transform(val => {
  if (Array.isArray(val)) return val.map(i => i?.name || i).filter(Boolean).join(', ');
  return val ?? null;
});

const normalizeRatingRecommendInput = (value: unknown) => {
  const raw = objectRecord(value);
  return {
    ...raw,
    strong_no: raw.strong_no ?? raw.strongNo ?? 0,
    strong_yes: raw.strong_yes ?? raw.strongYes ?? 0,
  };
};

const RatingRecommendSchema = z.preprocess(
  normalizeRatingRecommendInput,
  z.object({
    strong_no: numberDefault(),
    no: numberDefault(),
    neutral: numberDefault(),
    yes: numberDefault(),
    strong_yes: numberDefault(),
  }).passthrough()
);

const UserProfileCountSchema = z.preprocess(
  objectInput,
  z.object({
    patch_comment: numberDefault(),
    patch_rating: numberDefault(),
    patch_resource: numberDefault(),
    patch_favorite: numberDefault(),
  }).passthrough()
);

const normalizeUserProfileInput = (value: unknown) => {
  const raw = objectRecord(value);
  return {
    ...raw,
    id: raw.id ?? raw.uid,
    follower: raw.follower ?? (raw._count as any)?.follower,
    following: raw.following,
  };
};

const normalizeUserCommentInput = (value: unknown) => {
  const raw = objectRecord(value);
  const patch = objectRecord(raw.patch);
  return {
    ...raw,
    createdAt: raw.createdAt ?? raw.created ?? '',
    patchName: raw.patchName ?? raw.patch_name ?? patch.name ?? '',
  };
};

const normalizeUserRatingInput = (value: unknown) => {
  const raw = objectRecord(value);
  const patch = objectRecord(raw.patch);
  return {
    ...raw,
    createdAt: raw.createdAt ?? raw.created ?? '',
    patchName: raw.patchName ?? raw.patch_name ?? patch.name ?? '',
    shortSummary: raw.shortSummary ?? raw.short_summary ?? '',
    playStatus: raw.playStatus ?? raw.play_status ?? '',
  };
};

const normalizeUserResourceInput = (value: unknown) => {
  const raw = objectRecord(value);
  return {
    ...raw,
    id: raw.patchId ?? raw.id ?? 0,
    uniqueId: raw.patchUniqueId ?? raw.uniqueId ?? raw.unique_id ?? '',
    name: raw.patchName ?? raw.name ?? '',
    banner: raw.patchBanner ?? raw.banner ?? null,
    created: raw.created ?? null,
    averageRating: raw.averageRating ?? 0,
    favoriteCount: raw.favoriteCount ?? 0,
    resourceCount: raw.resourceCount ?? 0,
    commentCount: raw.commentCount ?? 0,
    viewCount: raw.viewCount ?? raw.view ?? 0,
    downloadCount: raw.downloadCount ?? raw.download ?? 0,
    ratingSummary: raw.ratingSummary ?? null,
  };
};

const buildRatingSummaryFromStat = (stat: Record<string, unknown>) => ({
  average: stat.avg_overall ?? 0,
  count: stat.count ?? 0,
  histogram: [
    { score: 1, count: stat.o1 ?? 0 },
    { score: 2, count: stat.o2 ?? 0 },
    { score: 3, count: stat.o3 ?? 0 },
    { score: 4, count: stat.o4 ?? 0 },
    { score: 5, count: stat.o5 ?? 0 },
    { score: 6, count: stat.o6 ?? 0 },
    { score: 7, count: stat.o7 ?? 0 },
    { score: 8, count: stat.o8 ?? 0 },
    { score: 9, count: stat.o9 ?? 0 },
    { score: 10, count: stat.o10 ?? 0 }
  ],
  recommend: {
    strong_no: stat.rec_strong_no ?? 0,
    no: stat.rec_no ?? 0,
    neutral: stat.rec_neutral ?? 0,
    yes: stat.rec_yes ?? 0,
    strong_yes: stat.rec_strong_yes ?? 0
  }
});

const normalizeNameList = (value: unknown) =>
  Array.isArray(value)
    ? value.map((item) => typeof item === 'string' ? item : objectRecord(item).name).filter(Boolean)
    : value;

const normalizeTouchGalResourceInput = (value: unknown) => {
  const raw = objectRecord(value);
  const counts = objectRecord(raw._count);
  const ratingStat = objectRecord(raw.rating_stat);
  const developerRating = objectRecord(raw.rating);
  const ratingSummary = raw.ratingSummary ?? raw.rating_summary ?? (
    Object.keys(ratingStat).length > 0
      ? buildRatingSummaryFromStat(ratingStat)
      : Object.keys(developerRating).length > 0
        ? {
            average: developerRating.average ?? 0,
            count: developerRating.count ?? 0,
            histogram: [],
            recommend: developerRating.recommend ?? {}
          }
        : null
  );
  const companies = Array.isArray(raw.companies) ? raw.companies : [];
  const companyNames = companies.map((company) => objectRecord(company).name).filter(Boolean);
  const companyAliases = raw.companyAliases ?? raw.company_aliases ?? companies.flatMap((company) => {
    const record = objectRecord(company);
    const aliases = record.aliases ?? record.alias;
    return Array.isArray(aliases) ? aliases : [];
  });

  return {
    ...raw,
    id: raw.id ?? raw.patchId ?? raw.patch_id ?? raw.galgameId ?? raw.galgame_id ?? 0,
    uniqueId: raw.uniqueId ?? raw.unique_id ?? raw.patchUniqueId ?? '',
    name: raw.name ?? raw.patchName ?? 'Unknown title',
    banner: raw.banner ?? raw.bannerUrl ?? raw.banner_url ?? raw.patchBanner ?? null,
    platform: raw.platform ?? [],
    language: raw.language ?? [],
    type: raw.type ?? [],
    created: raw.created ?? raw.publishTime ?? raw.publish_time ?? null,
    releasedDate: raw.releasedDate ?? raw.releaseDate ?? raw.release_date ?? raw.released ?? null,
    averageRating: raw.averageRating ?? (ratingSummary as any)?.average ?? ratingStat.avg_overall ?? 0,
    tags: raw.tags ?? normalizeNameList(raw.tag),
    alias: normalizeNameList(raw.alias ?? raw.aliases),
    favoriteCount: raw.favoriteCount ?? raw.favorite_count ?? counts.favorite_folder ?? 0,
    resourceCount: raw.resourceCount ?? raw.resource_count ?? counts.patch_resource ?? counts.resource ?? 0,
    commentCount: raw.commentCount ?? raw.comment_count ?? counts.patch_comment ?? counts.comment ?? 0,
    viewCount: raw.viewCount ?? raw.view_count ?? raw.view ?? 0,
    downloadCount: raw.downloadCount ?? raw.download_count ?? raw.download ?? 0,
    ratingSummary,
    company: raw.company ?? (companyNames.length > 0 ? companyNames.join(', ') : undefined),
    companyAliases,
    resourceUpdateTime: raw.resourceUpdateTime ?? raw.resource_update_time ?? raw.updatedAt ?? raw.updated_at ?? null,
    touchgalUrl: raw.touchgalUrl ?? raw.touchgal_url ?? null
  };
};

const normalizeFavoriteFolderInput = (value: unknown) => {
  const raw = objectRecord(value);
  return {
    ...raw,
    is_public: raw.is_public ?? raw.isPublic ?? false,
    isAdd: raw.isAdd ?? raw.is_add ?? false,
    _count: raw._count ?? { patch: raw.patchCount ?? raw.count ?? 0 },
  };
};

const normalizeSearchTagSuggestionInput = (value: unknown) => {
  const raw = objectRecord(value);
  return {
    ...raw,
    name: raw.name ?? raw.label ?? raw.value ?? '',
    type: raw.type ?? 'tag',
    mode: raw.mode ?? 'include',
    count: raw.count ?? 0,
  };
};

const normalizeCaptchaImageInput = (value: unknown) => {
  const raw = objectRecord(value);
  return {
    ...raw,
    id: raw.id ?? '',
    url: raw.url ?? raw.data ?? '',
  };
};

const normalizeCaptchaResponseInput = (value: unknown) => {
  if (typeof value === 'string') {
    return { url: value };
  }

  const raw = objectRecord(value);
  return {
    ...raw,
    url: raw.url ?? raw.data ?? '',
    images: raw.images,
    sessionId: raw.sessionId ?? raw.session_id ?? '',
  };
};

const normalizeCaptchaVerifyInput = (value: unknown) => {
  if (typeof value === 'string') {
    return { code: value };
  }

  const raw = objectRecord(value);
  return {
    ...raw,
    code: raw.code ?? raw.captcha ?? raw.token ?? '',
  };
};

const normalizeDeveloperApiStatusInput = (value: unknown) => {
  const raw = objectRecord(value);
  const quota = objectRecord(raw.quota);
  const rateLimit = objectRecord(raw.rateLimit ?? raw.rate_limit);
  return {
    ...raw,
    configured: raw.configured ?? true,
    applicationId: raw.applicationId ?? raw.application_id ?? raw.id,
    applicationStatus: raw.applicationStatus ?? raw.application_status ?? raw.status ?? 'unknown',
    dailyLimit: raw.dailyLimit ?? raw.daily_limit ?? quota.daily ?? null,
    minuteLimit: raw.minuteLimit ?? raw.minute_limit ?? rateLimit.minute ?? quota.minute ?? null,
  };
};

const normalizePatchCommentInput = (value: unknown) => {
  const raw = objectRecord(value);
  const user = objectRecord(raw.user);
  const author = objectRecord(raw.author);
  return {
    ...raw,
    userName: raw.userName ?? raw.user_name ?? user.name ?? author.name ?? 'Anonymous',
    userAvatar: raw.userAvatar ?? raw.user_avatar ?? user.avatar ?? author.avatar ?? null,
    createdAt: raw.createdAt ?? raw.created_at ?? raw.created ?? '',
    likeCount: raw.likeCount ?? raw.like_count ?? (raw._count as any)?.like_by ?? 0,
    isLike: raw.isLike ?? raw.is_like ?? false,
    isSpoiler: raw.isSpoiler ?? raw.is_spoiler ?? false,
  };
};

const normalizePatchRatingInput = (value: unknown) => {
  const raw = objectRecord(value);
  const user = objectRecord(raw.user);
  const author = objectRecord(raw.author);
  return {
    ...raw,
    overall: raw.overall ?? raw.rating ?? raw.score ?? 0,
    shortSummary: raw.shortSummary ?? raw.short_summary ?? raw.comment ?? '',
    playStatus: raw.playStatus ?? raw.play_status ?? 'other',
    spoilerLevel: raw.spoilerLevel ?? raw.spoiler_level ?? 'none',
    userName: raw.userName ?? raw.user_name ?? user.name ?? author.name ?? 'Anonymous',
    userAvatar: raw.userAvatar ?? raw.user_avatar ?? user.avatar ?? author.avatar ?? null,
    likeCount: raw.likeCount ?? raw.like_count ?? (raw._count as any)?.like ?? 0,
    isLike: raw.isLike ?? raw.is_like ?? false,
    createdAt: raw.createdAt ?? raw.created_at ?? raw.created ?? '',
  };
};

const TouchGalDownloadUserSchema = z.object({
  id: numberDefault(),
  name: stringDefault('Unknown'),
  avatar: nullableString,
  role: numberDefault(),
  patchCount: numberDefault(),
}).passthrough();

const TouchGalDownloadLinkSchema = z.object({
  id: nullableNumber,
  storage: nullableString,
  size: nullableString,
  url: nullableString,
  content: nullableString,
  code: nullableString,
  password: nullableString,
  hash: nullableString,
  sortOrder: nullableNumber,
  download: nullableNumber,
}).passthrough();

export const TouchGalDownloadSchema = z.object({
  id: numberDefault(),
  name: stringDefault(),
  section: nullableString,
  size: nullableString,
  url: nullableString,
  content: nullableString,
  storage: nullableString,
  type: stringArray,
  language: stringArray,
  code: nullableString,
  password: nullableString,
  note: nullableString,
  hash: nullableString,
  platform: stringArray,
  likeCount: numberDefault(),
  downloadCount: numberDefault(),
  created: nullableString,
  links: arrayOf(TouchGalDownloadLinkSchema),
  userId: nullableNumber,
  user: TouchGalDownloadUserSchema.nullable().default(null),
}).passthrough();

export const RatingSummarySchema = z.object({
  average: numberDefault(),
  count: numberDefault(),
  histogram: arrayOf(z.object({
    score: numberDefault(),
    count: numberDefault()
  })),
  recommend: RatingRecommendSchema,
}).passthrough();

const TouchGalResourceObjectSchema = z.object({
  id: numberDefault(),
  uniqueId: stringDefault(),
  name: stringDefault('Unknown title'),
  banner: nullableString,
  platform: stringListDisplay,
  language: stringListDisplay,
  type: stringArray,
  created: nullableString,
  releasedDate: nullableString,
  averageRating: numberDefault(),
  tags: stringArray,
  alias: stringArray,
  favoriteCount: numberDefault(),
  resourceCount: numberDefault(),
  commentCount: numberDefault(),
  viewCount: numberDefault(),
  downloadCount: numberDefault(),
  ratingSummary: RatingSummarySchema.nullable().optional(),
  company: companyDisplay,
  companyAliases: stringArray,
  resourceUpdateTime: nullableString,
  touchgalUrl: nullableString,
}).passthrough();

export const TouchGalResourceSchema = z.preprocess(
  normalizeTouchGalResourceInput,
  TouchGalResourceObjectSchema
);

export const TouchGalDetailSchema = z.preprocess(normalizeTouchGalResourceInput, TouchGalResourceObjectSchema.extend({
  introduction: nullableString,
  vndbId: nullableString,
  bangumiId: nullableNumber,
  steamId: nullableString,
  contentLimit: nullableString,
  screenshots: stringArray,
  pvUrl: nullableString,
  downloads: arrayOf(TouchGalDownloadSchema),
}).passthrough());

export const TouchGalCommentSchema = z.object({
  id: numberDefault(),
  content: stringDefault(),
  userName: stringDefault(),
  userAvatar: nullableString,
  createdAt: stringDefault(),
  likeCount: numberDefault(),
  isLike: booleanDefault(),
  isSpoiler: booleanDefault(),
  reply: arrayOf(z.unknown()),
}).passthrough();

export const PatchCommentSchema = z.preprocess(normalizePatchCommentInput, TouchGalCommentSchema);

export const PatchCommentResponseSchema = z.object({
  total: numberDefault(),
  list: arrayOf(PatchCommentSchema),
  requiresLogin: booleanDefault(),
  error: nullableString,
}).passthrough();

export const PatchRatingSchema = z.preprocess(
  normalizePatchRatingInput,
  z.object({
    id: numberDefault(),
    overall: numberDefault(),
    recommend: stringDefault('neutral'),
    shortSummary: stringDefault(),
    playStatus: stringDefault('other'),
    spoilerLevel: stringDefault('none'),
    userName: stringDefault('Anonymous'),
    userAvatar: nullableString,
    likeCount: numberDefault(),
    isLike: booleanDefault(),
    createdAt: stringDefault(),
  }).passthrough()
);

export const PatchRatingResponseSchema = z.object({
  total: numberDefault(),
  list: arrayOf(PatchRatingSchema),
  requiresLogin: booleanDefault(),
  error: nullableString,
}).passthrough();

export const TouchGalFeedResponseSchema = z.object({
  total: numberDefault(),
  list: arrayOf(TouchGalResourceSchema),
}).passthrough();

export const PatchIntroductionSchema = z.object({
  introduction: nullableString,
  created: nullableString,
  releasedDate: nullableString,
  resourceUpdateTime: nullableString,
  alias: stringArray,
  tags: stringArray,
  company: companyDisplay,
  companyAliases: stringArray,
  platform: stringListDisplay,
  language: stringListDisplay,
  type: stringArray,
  vndbId: nullableString,
  bangumiId: nullableNumber,
  steamId: nullableString,
  touchgalUrl: nullableString,
}).passthrough();

export const SearchTagSuggestionSchema = z.preprocess(
  normalizeSearchTagSuggestionInput,
  z.object({
    id: numberDefault(),
    name: stringDefault(),
    type: stringDefault('tag'),
    mode: stringDefault('include'),
    count: numberDefault(),
  }).passthrough()
);

export const SearchTagSuggestionListSchema = arrayOf(SearchTagSuggestionSchema);

export const CaptchaImageSchema = z.preprocess(
  normalizeCaptchaImageInput,
  z.object({
    id: stringDefault(),
    url: stringDefault(),
  }).passthrough()
);

export const CaptchaResponseSchema = z.preprocess(
  normalizeCaptchaResponseInput,
  z.object({
    url: stringDefault(),
    images: arrayOf(CaptchaImageSchema).optional(),
    sessionId: stringDefault(),
    target: nullableString,
  }).passthrough()
);

export const CaptchaVerifyResponseSchema = z.preprocess(
  normalizeCaptchaVerifyInput,
  z.object({
    code: stringDefault(),
  }).passthrough()
);

export const DeveloperApiStatusSchema = z.preprocess(
  normalizeDeveloperApiStatusInput,
  z.object({
    configured: booleanDefault(),
    isDeveloperApiCredential: z.literal(true).catch(true),
    applicationId: stringDefault().optional(),
    applicationStatus: stringDefault('unknown'),
    dailyLimit: nullableNumber,
    minuteLimit: nullableNumber,
  }).passthrough()
);

export const UserProfileSchema = z.preprocess(
  normalizeUserProfileInput,
  z.object({
    id: numberDefault(),
    uid: numberDefault(),
    name: stringDefault(),
    avatar: nullableString,
    bio: nullableString,
    moemoepoint: numberDefault(),
    follower: numberDefault(),
    following: numberDefault(),
    _count: UserProfileCountSchema,
  }).passthrough()
).transform((user) => ({ ...user, uid: user.uid || user.id }));

export const LoginResponseSchema = UserProfileSchema.and(
  z.object({
    require2FA: booleanDefault(),
  }).passthrough()
);

export const UserActivityCommentSchema = z.preprocess(
  normalizeUserCommentInput,
  z.object({
    id: numberDefault(),
    content: stringDefault(),
    createdAt: stringDefault(),
    patchName: stringDefault(),
  }).passthrough()
);

export const UserActivityRatingSchema = z.preprocess(
  normalizeUserRatingInput,
  z.object({
    id: numberDefault(),
    overall: numberDefault(),
    recommend: stringDefault(),
    shortSummary: stringDefault(),
    playStatus: stringDefault(),
    patchName: stringDefault(),
    createdAt: stringDefault(),
  }).passthrough()
);

export const UserResourceSchema = z.preprocess(normalizeUserResourceInput, TouchGalResourceSchema);

export const UserActivityResponseSchema = z.object({
  total: numberDefault(),
  comments: arrayOf(UserActivityCommentSchema).optional(),
  ratings: arrayOf(UserActivityRatingSchema).optional(),
  resources: arrayOf(UserResourceSchema).optional(),
}).passthrough();

export const FavoriteFolderSchema = z.preprocess(
  normalizeFavoriteFolderInput,
  z.object({
    id: numberDefault(),
    name: stringDefault(),
    description: nullableString,
    is_public: booleanDefault(),
    isAdd: booleanDefault(),
    _count: z.preprocess(
      objectInput,
      z.object({
        patch: numberDefault(),
      }).passthrough()
    ),
  }).passthrough()
);

export const FavoriteFolderListSchema = arrayOf(FavoriteFolderSchema);

export const FavoriteToggleResponseSchema = z.object({
  added: booleanDefault(),
}).passthrough();

export const FavoriteFolderPatchResponseSchema = z.object({
  patches: arrayOf(TouchGalResourceSchema),
  total: numberDefault(),
}).passthrough();
