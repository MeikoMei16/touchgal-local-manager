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

const companyDisplay = z.union([z.string(), z.array(z.any())]).nullable().optional().transform(val => {
  if (Array.isArray(val)) return val.map(i => i?.name || i).filter(Boolean).join(', ');
  return val ?? null;
});

const RatingRecommendSchema = z.preprocess(
  objectInput,
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

export const TouchGalResourceSchema = z.object({
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
}).passthrough();

export const TouchGalDetailSchema = TouchGalResourceSchema.extend({
  introduction: nullableString,
  company: companyDisplay,
  vndbId: nullableString,
  bangumiId: nullableNumber,
  steamId: nullableString,
  resourceUpdateTime: nullableString,
  contentLimit: nullableString,
  screenshots: stringArray,
  pvUrl: nullableString,
  touchgalUrl: nullableString,
  downloads: arrayOf(TouchGalDownloadSchema),
}).passthrough();

export const TouchGalCommentSchema = z.object({
  id: numberDefault(),
  content: stringDefault(),
  userName: stringDefault(),
  userAvatar: nullableString,
  createdAt: stringDefault(),
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
  vndbId: nullableString,
  bangumiId: nullableNumber,
  steamId: nullableString,
}).passthrough();

export const UserProfileSchema = z.object({
  id: numberDefault(),
  name: stringDefault(),
  avatar: nullableString,
  bio: nullableString,
  moemoepoint: numberDefault(),
  follower: numberDefault(),
  following: numberDefault(),
  _count: UserProfileCountSchema,
}).passthrough();

export const UserActivityCommentSchema = z.object({
  id: numberDefault(),
  content: stringDefault(),
  createdAt: stringDefault(),
  patchName: stringDefault(),
}).passthrough();

export const UserActivityRatingSchema = z.object({
  id: numberDefault(),
  overall: numberDefault(),
  recommend: stringDefault(),
  shortSummary: stringDefault(),
  playStatus: stringDefault(),
  patchName: stringDefault(),
}).passthrough();

export const UserActivityResponseSchema = z.object({
  total: numberDefault(),
  comments: arrayOf(UserActivityCommentSchema).optional(),
  ratings: arrayOf(UserActivityRatingSchema).optional(),
  resources: arrayOf(TouchGalResourceSchema).optional(),
}).passthrough();
