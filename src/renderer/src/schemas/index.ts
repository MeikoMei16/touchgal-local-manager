import { z } from 'zod';

const TouchGalDownloadUserSchema = z.object({
  id: z.number(),
  name: z.string(),
  avatar: z.string().nullable(),
  role: z.number().default(0),
  patchCount: z.number().default(0),
}).passthrough();

export const TouchGalDownloadSchema = z.object({
  id: z.number(),
  name: z.string(),
  section: z.string().nullable().default(null),
  size: z.string().nullable(),
  url: z.string().nullable(),
  content: z.string().nullable().default(null),
  storage: z.string().nullable(),
  type: z.array(z.string()).default([]),
  language: z.array(z.string()).default([]),
  code: z.string().nullable(),
  password: z.string().nullable(),
  note: z.string().nullable().default(null),
  hash: z.string().nullable().default(null),
  platform: z.array(z.string()).default([]),
  likeCount: z.number().default(0),
  downloadCount: z.number().default(0),
  created: z.string().nullable().default(null),
  userId: z.number().nullable().default(null),
  user: TouchGalDownloadUserSchema.nullable().default(null),
}).passthrough();

export const RatingSummarySchema = z.object({
  average: z.number().default(0),
  count: z.number().default(0),
  histogram: z.array(z.object({
    score: z.number(),
    count: z.number()
  })).default([]),
  recommend: z.object({
    strong_no: z.number().default(0),
    no: z.number().default(0),
    neutral: z.number().default(0),
    yes: z.number().default(0),
    strong_yes: z.number().default(0),
  }).default({
    strong_no: 0,
    no: 0,
    neutral: 0,
    yes: 0,
    strong_yes: 0
  }),
}).passthrough();

export const TouchGalResourceSchema = z.object({
  id: z.number(),
  uniqueId: z.string(),
  name: z.string(),
  banner: z.string().nullable(),
  platform: z.union([z.string(), z.array(z.string())]).optional().transform(val => {
    if (Array.isArray(val)) return val.join(', ');
    return val ?? '';
  }),
  language: z.union([z.string(), z.array(z.string())]).optional().transform(val => {
    if (Array.isArray(val)) return val.join(', ');
    return val ?? '';
  }),
  releasedDate: z.string().nullable(),
  averageRating: z.number().default(0),
  tags: z.array(z.string()).default([]),
  alias: z.array(z.string()).default([]),
  favoriteCount: z.number().default(0),
  resourceCount: z.number().default(0),
  commentCount: z.number().default(0),
  viewCount: z.number().default(0),
  downloadCount: z.number().default(0),
  ratingSummary: RatingSummarySchema.nullable().optional(),
}).passthrough();

export const TouchGalDetailSchema = TouchGalResourceSchema.extend({
  introduction: z.string().nullable().default(null),
  company: z.union([z.string(), z.array(z.any())]).nullable().optional().transform(val => {
    if (Array.isArray(val)) return val.map(i => i?.name || i).filter(Boolean).join(', ');
    return val ?? null;
  }),
  vndbId: z.string().nullable().default(null),
  bangumiId: z.number().nullable().default(null),
  steamId: z.string().nullable().default(null),
  resourceUpdateTime: z.string().nullable().default(null),
  contentLimit: z.string().nullable().default(null),
  screenshots: z.array(z.string()).default([]),
  pvUrl: z.string().nullable().default(null),
  downloads: z.array(TouchGalDownloadSchema).default([]),
}).passthrough();

export const TouchGalCommentSchema = z.object({
  id: z.number(),
  content: z.string(),
  userName: z.string(),
  userAvatar: z.string().nullable(),
  createdAt: z.string(),
}).passthrough();

export const TouchGalFeedResponseSchema = z.object({
  total: z.number().default(0),
  list: z.array(TouchGalResourceSchema).default([]),
}).passthrough();

export const PatchIntroductionSchema = z.object({
  introduction: z.string().nullable().default(null),
  releasedDate: z.string().nullable().default(null),
  resourceUpdateTime: z.string().nullable().default(null),
  alias: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  company: z.union([z.string(), z.array(z.any())]).nullable().optional().transform(val => {
    if (Array.isArray(val)) return val.map(i => i?.name || i).filter(Boolean).join(', ');
    return val ?? null;
  }),
  vndbId: z.string().nullable().default(null),
  bangumiId: z.number().nullable().default(null),
  steamId: z.string().nullable().default(null),
}).passthrough();

export const UserProfileSchema = z.object({
  id: z.number(),
  name: z.string(),
  avatar: z.string().nullable(),
  bio: z.string().nullable(),
  moemoepoint: z.number().default(0),
  follower: z.number().default(0),
  following: z.number().default(0),
  _count: z.object({
    patch_comment: z.number().default(0),
    patch_rating: z.number().default(0),
    patch_resource: z.number().default(0),
    patch_favorite: z.number().default(0),
  }).passthrough(),
}).passthrough();

export const UserActivityCommentSchema = z.object({
  id: z.number(),
  content: z.string(),
  createdAt: z.string(),
  patchName: z.string(),
}).passthrough();

export const UserActivityRatingSchema = z.object({
  id: z.number(),
  overall: z.number(),
  recommend: z.string(),
  shortSummary: z.string(),
  playStatus: z.string(),
  patchName: z.string(),
}).passthrough();

export const UserActivityResponseSchema = z.object({
  total: z.number().default(0),
  comments: z.array(UserActivityCommentSchema).optional(),
  ratings: z.array(UserActivityRatingSchema).optional(),
  resources: z.array(TouchGalResourceSchema).optional(),
}).passthrough();
