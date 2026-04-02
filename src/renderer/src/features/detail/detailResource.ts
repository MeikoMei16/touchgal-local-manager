import { TouchGalDetail, TouchGalResource } from '../../types';

export const toDetailShell = (resource: TouchGalResource): TouchGalDetail => ({
  ...resource,
  introduction: null,
  company: null,
  vndbId: null,
  bangumiId: null,
  steamId: null,
  resourceUpdateTime: null,
  contentLimit: null,
  screenshots: [],
  pvUrl: null,
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
  company: detail.company ?? null,
  vndbId: detail.vndbId ?? null,
  bangumiId: detail.bangumiId ?? null,
  steamId: detail.steamId ?? null,
  resourceUpdateTime: detail.resourceUpdateTime ?? null,
  contentLimit:
    typeof detail.contentLimit === 'string'
      ? detail.contentLimit
      : typeof (fallback as TouchGalDetail | null | undefined)?.contentLimit === 'string'
        ? (fallback as TouchGalDetail | null | undefined)?.contentLimit ?? null
        : null,
  screenshots: Array.isArray(detail.screenshots) ? detail.screenshots : [],
  pvUrl: detail.pvUrl ?? null,
  downloads: Array.isArray(detail.downloads) ? detail.downloads : [],
  alias: Array.isArray(detail.alias) ? detail.alias : [],
  tags: Array.isArray(detail.tags) ? detail.tags : []
});
