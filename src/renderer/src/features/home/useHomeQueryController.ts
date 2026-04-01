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
    buildRatingCatalog,
    applyRatingSort,
    exitRatingMode
  } = useUIStore();

  const sortField = lastHomeQuery.sortField;
  const sortOrder = lastHomeQuery.sortOrder;

  const isRatingMode = homeMode === 'rating_building' || homeMode === 'rating_ready';

  const syncDraftFromQuery = (query: HomeQueryState) => {
    const nextDomain = mapNsfwModeToDomain(query.nsfwMode ?? 'safe');
    setActiveNsfwDomain(nextDomain);
    updateAdvancedFilterDraft(toDraftPayload(query));
    return nextDomain;
  };

  useEffect(() => {
    if (!hasHydratedUi) return;
    syncDraftFromQuery(lastHomeQuery);
  }, [hasHydratedUi, lastHomeQuery, setActiveNsfwDomain, updateAdvancedFilterDraft]);

  // Normal/rating fetch effect: fires when query or page changes
  useEffect(() => {
    if (!hasHydratedUi) return;

    if (lastHomeQuery.sortField === 'rating') {
      // Only trigger a fresh build if not already in a rating mode (e.g., on first load)
      if (homeMode === 'normal') {
        buildRatingCatalog(lastHomeQuery.sortOrder);
      }
      return;
    }

    if (homeMode !== 'normal') return;
    fetchResources(currentPage, {
      ...lastHomeQuery,
      nsfwMode: lastHomeQuery.nsfwMode || activeNsfwDomain || 'safe',
      sortOrder
    });
  }, [hasHydratedUi, fetchResources, homeMode, lastHomeQuery, currentPage, sortOrder, activeNsfwDomain, buildRatingCatalog]);

  const commitFilterDraft = (filters: Partial<HomeQueryState>) => {
    const newQuery = buildHomeQuery(lastHomeQuery, filters);
    const nextDomain = syncDraftFromQuery(newQuery);
    setLastHomeQuery(newQuery);
    return { newQuery, nextDomain };
  };

  const handleFilterChange = (filters: Partial<HomeQueryState>) => {
    const { newQuery, nextDomain } = commitFilterDraft(filters);

    // Switching away from rating sort exits rating mode
    if (filters.sortField !== undefined && filters.sortField !== 'rating' && isRatingMode) {
      exitRatingMode();
      return;
    }

    // Coarse filter changes while in rating mode trigger a rebuild
    const coarseFilterChanged =
      filters.nsfwMode !== undefined ||
      filters.selectedPlatform !== undefined ||
      filters.minRatingCount !== undefined;

    if (newQuery.sortField === 'rating') {
      if (coarseFilterChanged || homeMode === 'normal') {
        void buildRatingCatalog(newQuery.sortOrder);
      }
      return;
    }

    if (!requiresAdvancedMode(newQuery)) {
      if (homeMode !== 'normal') {
        if (isRatingMode) exitRatingMode();
        else exitAdvancedMode();
      }
      return;
    }

    const domainChanged =
      filters.nsfwMode !== undefined && mapNsfwModeToDomain(filters.nsfwMode) !== activeNsfwDomain;
    const platformChanged = filters.selectedPlatform !== undefined;

    if (homeMode === 'advanced_ready' && !domainChanged && !platformChanged) {
      applyAdvancedFilters(currentPage, newQuery.sortField, newQuery.sortOrder);
    }

    void nextDomain;
  };

  const handleAdvancedSubmit = async (filters: Partial<HomeQueryState>) => {
    const { newQuery } = commitFilterDraft(filters);

    if (newQuery.sortField === 'rating') {
      await buildRatingCatalog(newQuery.sortOrder);
      return true;
    }

    if (!requiresAdvancedMode(newQuery)) {
      if (homeMode !== 'normal') {
        if (isRatingMode) exitRatingMode();
        else exitAdvancedMode();
      }
      return false;
    }

    await enterAdvancedMode(sortField, sortOrder);
    return true;
  };

  const applyFiltersFromCurrentDraft = async (overrides: Partial<HomeQueryState>) =>
    handleAdvancedSubmit(buildQueryFromAdvancedDraft(advancedFilterDraft, overrides));

  const updateSort = (field: HomeQueryState['sortField'], order: HomeQueryState['sortOrder']) => {
    setLastHomeQuery({ ...lastHomeQuery, sortField: field, sortOrder: order });

    if (field === 'rating') {
      // If already in rating mode, just flip the local sort direction
      if (isRatingMode) {
        applyRatingSort(currentPage, order);
      }
      // Otherwise the effect above will fire buildRatingCatalog
      return;
    }

    // Switching away from rating to another sort
    if (isRatingMode) {
      exitRatingMode();
      return;
    }

    if (homeMode !== 'normal') applyAdvancedFilters(currentPage, field, order);
  };

  const goToPage = (page: number) => {
    if (homeMode === 'normal') return false;
    if (isRatingMode) {
      applyRatingSort(page, sortOrder);
      return true;
    }
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
