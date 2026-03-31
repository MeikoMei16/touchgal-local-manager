import { TouchGalResource } from '../../types';
import {
  AdvancedFilterDraft,
  AdvancedResourceRecord,
  HomeSortField,
  HomeSortOrder,
  NsfwDomain
} from './homeState';

export const ADVANCED_PAGE_SIZE = 24;
export const ADVANCED_CATALOG_CONCURRENCY = 4;
export const ADVANCED_TAG_CONCURRENCY = 6;

export const uniqueById = <T extends { uniqueId: string }>(items: T[]): T[] => {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const item of items) {
    if (!item.uniqueId || seen.has(item.uniqueId)) continue;
    seen.add(item.uniqueId);
    result.push(item);
  }
  return result;
};

export const normalizeYear = (resource: TouchGalResource): number | null => {
  const rawDate = resource.releasedDate || (resource as any).released || (resource as any).created || null;
  if (!rawDate) return null;
  const directMatch = String(rawDate).match(/\b(19|20)\d{2}\b/);
  if (directMatch) return Number(directMatch[0]);
  const parsed = new Date(rawDate);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.getFullYear();
};

export const toAdvancedResourceRecord = (resource: TouchGalResource): AdvancedResourceRecord => ({
  ...resource,
  fullTags: Array.isArray(resource.tags) ? resource.tags : [],
  normalizedYear: normalizeYear(resource),
  tagsHydrated: false
});

export const compareConstraint = (year: number, op: string, value: number): boolean => {
  if (op === '=') return year === value;
  if (op === '>=') return year >= value;
  if (op === '<=') return year <= value;
  if (op === '>') return year > value;
  if (op === '<') return year < value;
  return true;
};

export const applyAdvancedPredicate = (resources: AdvancedResourceRecord[], draft: AdvancedFilterDraft): AdvancedResourceRecord[] =>
  resources.filter((resource) => {
    if (draft.yearConstraints.length > 0) {
      if (resource.normalizedYear == null) return false;
      if (!draft.yearConstraints.every(c => compareConstraint(resource.normalizedYear as number, c.op, c.val))) return false;
    }
    if (draft.minRatingScore > 0 && (resource.averageRating || 0) < draft.minRatingScore) return false;
    if (draft.minCommentCount > 0 && (resource.commentCount || (resource as any).comments || 0) < draft.minCommentCount) return false;
    if (draft.selectedTags.length > 0) {
      if (!resource.tagsHydrated) return false;
      const tagSet = new Set(resource.fullTags);
      if (!draft.selectedTags.every(tag => tagSet.has(tag))) return false;
    }
    return true;
  });

const getSortableValue = (resource: AdvancedResourceRecord, sortField: HomeSortField | string, originalIndex: number) => {
  if (sortField === 'rating') return resource.averageRating || 0;
  if (sortField === 'view' || sortField === 'visit') return resource.viewCount || (resource as any).view || 0;
  if (sortField === 'download') return resource.downloadCount || (resource as any).download || 0;
  if (sortField === 'favorite') return resource.favoriteCount || 0;
  if (sortField === 'created') {
    const created = (resource as any).created ? new Date((resource as any).created).getTime() : 0;
    return isNaN(created) ? 0 : created;
  }
  return originalIndex;
};

export const sortAdvancedResources = (
  resources: AdvancedResourceRecord[],
  sortField: HomeSortField | string,
  sortOrder: HomeSortOrder | string
): AdvancedResourceRecord[] => {
  const direction = sortOrder === 'asc' ? 1 : -1;
  return [...resources].sort((left, right) => {
    const lIdx = (left as any).__catalogIndex ?? 0;
    const rIdx = (right as any).__catalogIndex ?? 0;
    const lVal = getSortableValue(left, sortField, lIdx);
    const rVal = getSortableValue(right, sortField, rIdx);
    return lVal === rVal ? lIdx - rIdx : (lVal > rVal ? direction : -direction);
  });
};

export const paginateAdvancedResources = (
  resources: AdvancedResourceRecord[],
  page: number
): AdvancedResourceRecord[] => {
  const start = (page - 1) * ADVANCED_PAGE_SIZE;
  return resources.slice(start, start + ADVANCED_PAGE_SIZE);
};

export const createAdvancedSessionId = () => `adv-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

export const getAdvancedUpstreamKey = (draft: AdvancedFilterDraft, domain: NsfwDomain) =>
  JSON.stringify({
    domain,
    selectedPlatform: draft.selectedPlatform ?? 'all',
    minRatingCount: draft.minRatingCount ?? 0
  });

export async function runBounded<TInput, TOutput>(
  items: TInput[],
  limit: number,
  worker: (item: TInput, index: number) => Promise<TOutput>
): Promise<TOutput[]> {
  const results = new Array<TOutput>(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const idx = cursor++;
      results[idx] = await worker(items[idx], idx);
    }
  });
  await Promise.all(runners);
  return results;
}
