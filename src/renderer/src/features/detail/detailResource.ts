import { TouchGalDetail, TouchGalResource } from '../../types';

const readDetailFallbackString = (
  resource: TouchGalResource | null | undefined,
  key: keyof TouchGalDetail
) => {
  if (!resource) return null;
  const value = (resource as Partial<TouchGalDetail>)[key];
  return typeof value === 'string' ? value : null;
};

const preserveString = (primary: string | null | undefined, fallback: string | null | undefined) =>
  primary && primary.trim().length > 0 ? primary : fallback ?? '';

const preserveStringArray = (primary: string[] | undefined, fallback: string[] | undefined) =>
  Array.isArray(primary) && primary.length > 0 ? primary : fallback ?? [];

export const toDetailShell = (resource: TouchGalResource): TouchGalDetail => ({
  ...resource,
  introduction: null,
  company: resource.company ?? null,
  vndbId: readDetailFallbackString(resource, 'vndbId'),
  bangumiId: (resource as Partial<TouchGalDetail>).bangumiId ?? null,
  steamId: readDetailFallbackString(resource, 'steamId'),
  resourceUpdateTime: resource.resourceUpdateTime ?? null,
  contentLimit: readDetailFallbackString(resource, 'contentLimit'),
  screenshots: [],
  pvUrl: readDetailFallbackString(resource, 'pvUrl'),
  touchgalUrl: resource.touchgalUrl ?? null,
  downloads: []
});

export const mergeDetailResource = (
  detail: TouchGalDetail,
  fallback?: TouchGalResource | null
): TouchGalDetail => ({
  ...(fallback ? toDetailShell(fallback) : {}),
  ...detail,
  id: detail.id || fallback?.id || 0,
  created: detail.created ?? fallback?.created ?? null,
  introduction: detail.introduction ?? null,
  company: detail.company ?? fallback?.company ?? null,
  vndbId: detail.vndbId ?? readDetailFallbackString(fallback, 'vndbId'),
  bangumiId: detail.bangumiId ?? (fallback as Partial<TouchGalDetail> | null | undefined)?.bangumiId ?? null,
  steamId: detail.steamId ?? readDetailFallbackString(fallback, 'steamId'),
  resourceUpdateTime: detail.resourceUpdateTime ?? fallback?.resourceUpdateTime ?? null,
  contentLimit:
    typeof detail.contentLimit === 'string'
      ? detail.contentLimit
      : typeof (fallback as TouchGalDetail | null | undefined)?.contentLimit === 'string'
        ? (fallback as TouchGalDetail | null | undefined)?.contentLimit ?? null
        : null,
  screenshots: Array.isArray(detail.screenshots) ? detail.screenshots : [],
  pvUrl: detail.pvUrl ?? readDetailFallbackString(fallback, 'pvUrl'),
  touchgalUrl: detail.touchgalUrl ?? fallback?.touchgalUrl ?? null,
  downloads: Array.isArray(detail.downloads) && detail.downloads.length > 0
    ? detail.downloads
    : (fallback as Partial<TouchGalDetail> | null | undefined)?.downloads ?? [],
  platform: preserveString(detail.platform, fallback?.platform),
  language: preserveString(detail.language, fallback?.language),
  type: preserveStringArray(detail.type, fallback?.type),
  alias: preserveStringArray(detail.alias, fallback?.alias),
  tags: preserveStringArray(detail.tags, fallback?.tags)
});
