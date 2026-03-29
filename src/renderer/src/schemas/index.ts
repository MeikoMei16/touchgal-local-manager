import { z } from 'zod';

export const TouchGalDownloadSchema = z.object({
  id: z.number(),
  name: z.string(),
  size: z.string().nullable(),
  url: z.string().nullable(),
  storage: z.string().nullable(),
  code: z.string().nullable(),
  password: z.string().nullable(),
  platform: z.array(z.string()).default([]),
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
  company: z.string().nullable().default(null),
  vndbId: z.string().nullable().default(null),
  bangumiId: z.number().nullable().default(null),
  steamId: z.string().nullable().default(null),
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
  alias: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  company: z.string().nullable().default(null),
  vndbId: z.string().nullable().default(null),
  bangumiId: z.number().nullable().default(null),
  steamId: z.string().nullable().default(null),
}).passthrough();
