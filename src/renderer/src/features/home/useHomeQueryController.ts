import { useEffect } from 'react';
import { useUIStore } from '../../store/useTouchGalStore';
import { HomeQueryState } from './homeState';
import {
  buildHomeQuery,
  buildQueryFromAdvancedDraft,
  mapNsfwModeToDomain,
  requiresAdvancedMode,
  toDraftPayload
} from './homeQuery';

export const useHomeQueryController = () => {
  const {
    hasHydratedUi,
    fetchResources,
    homeMode,
    currentPage,
    lastHomeQuery,
    advancedFilterDraft,
    activeNsfwDomain,
    setLastHomeQuery,
    setActiveNsfwDomain,
    updateAdvancedFilterDraft,
    enterAdvancedMode,
    applyAdvancedFilters,
    exitAdvancedMode,
    clearAdvancedSearch
  } = useUIStore();

  const sortField = lastHomeQuery.sortField;
  const sortOrder = lastHomeQuery.sortOrder;

  const isAdvancedMode = homeMode === 'advanced_building' || homeMode === 'advanced_ready';

  const syncDraftFromQuery = (query: HomeQueryState) => {
    const nextDomain = mapNsfwModeToDomain(query.nsfwMode ?? 'safe');
    setActiveNsfwDomain(nextDomain);
    updateAdvancedFilterDraft(toDraftPayload(query));
    return nextDomain;
  };

  useEffect(() => {
    if (!hasHydratedUi) return;
    const nextDomain = mapNsfwModeToDomain(lastHomeQuery.nsfwMode ?? 'safe');
    setActiveNsfwDomain(nextDomain);
    updateAdvancedFilterDraft(toDraftPayload(lastHomeQuery));
  }, [hasHydratedUi, lastHomeQuery, setActiveNsfwDomain, updateAdvancedFilterDraft]);

  // Fetch effect: routes to normal fetch or triggers advanced mode build
  useEffect(() => {
    if (!hasHydratedUi) return;

    if (requiresAdvancedMode(lastHomeQuery)) {
      // Advanced mode handles its own fetching; only trigger a build from 'normal'
      if (homeMode === 'normal') {
        enterAdvancedMode(lastHomeQuery.sortField, lastHomeQuery.sortOrder);
      }
      return;
    }

    if (homeMode !== 'normal') return;
    fetchResources(currentPage, {
      ...lastHomeQuery,
      nsfwMode: lastHomeQuery.nsfwMode || activeNsfwDomain || 'safe',
      sortOrder
    });
  }, [hasHydratedUi, fetchResources, homeMode, lastHomeQuery, currentPage, sortOrder, activeNsfwDomain, enterAdvancedMode]);

  const commitFilterDraft = (filters: Partial<HomeQueryState>) => {
    const newQuery = buildHomeQuery(lastHomeQuery, filters);
    const nextDomain = syncDraftFromQuery(newQuery);
    setLastHomeQuery(newQuery);
    return { newQuery, nextDomain };
  };

  const handleFilterChange = (filters: Partial<HomeQueryState>) => {
    const { newQuery } = commitFilterDraft(filters);

    if (!requiresAdvancedMode(newQuery)) {
      if (isAdvancedMode) exitAdvancedMode();
      return;
    }

    // Coarse filters (domain, platform, minRatingCount) or sort field change → rebuild
    const coarseFilterChanged =
      filters.nsfwMode !== undefined ||
      filters.selectedPlatform !== undefined ||
      filters.minRatingCount !== undefined ||
      filters.sortField !== undefined;

    const domainChanged =
      filters.nsfwMode !== undefined &&
      mapNsfwModeToDomain(filters.nsfwMode) !== activeNsfwDomain;

    if (homeMode === 'advanced_ready' && !domainChanged && !coarseFilterChanged) {
      applyAdvancedFilters(currentPage, newQuery.sortField, newQuery.sortOrder);
      return;
    }

    // Let the fetch effect handle the build trigger if homeMode was normal,
    // or kick off a rebuild for coarse changes in advanced mode
    if (isAdvancedMode && coarseFilterChanged) {
      void enterAdvancedMode(newQuery.sortField, newQuery.sortOrder);
    }
  };

  const handleAdvancedSubmit = async (filters: Partial<HomeQueryState>) => {
    const { newQuery } = commitFilterDraft(filters);

    if (!requiresAdvancedMode(newQuery)) {
      if (isAdvancedMode) clearAdvancedSearch();
      return false;
    }

    await enterAdvancedMode(newQuery.sortField, newQuery.sortOrder);
    return true;
  };

  const applyFiltersFromCurrentDraft = async (overrides: Partial<HomeQueryState>) =>
    handleAdvancedSubmit(buildQueryFromAdvancedDraft(advancedFilterDraft, overrides));

  const updateSort = (field: HomeQueryState['sortField'], order: HomeQueryState['sortOrder']) => {
    const newQuery = buildHomeQuery(lastHomeQuery, { sortField: field, sortOrder: order });
    setLastHomeQuery(newQuery);

    if (!requiresAdvancedMode(newQuery)) {
      if (isAdvancedMode) exitAdvancedMode();
      return;
    }

    // In advanced_ready mode, a sort-order flip is local-only; no rebuild needed
    if (homeMode === 'advanced_ready' && field === sortField) {
      applyAdvancedFilters(currentPage, field, order);
      return;
    }

    // Sort field changed or entering advanced for the first time → build
    void enterAdvancedMode(field, order);
  };

  const goToPage = (page: number) => {
    if (!isAdvancedMode) return false;
    applyAdvancedFilters(page, sortField, sortOrder);
    return true;
  };

  return {
    sortField,
    sortOrder,
    handleFilterChange,
    handleAdvancedSubmit,
    applyFiltersFromCurrentDraft,
    updateSort,
    goToPage
  };
};
