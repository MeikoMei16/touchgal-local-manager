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
    exitAdvancedMode
  } = useUIStore();

  const sortField = lastHomeQuery.sortField;
  const sortOrder = lastHomeQuery.sortOrder;

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

  useEffect(() => {
    if (!hasHydratedUi || homeMode !== 'normal') return;
    fetchResources(currentPage, {
      ...lastHomeQuery,
      nsfwMode: lastHomeQuery.nsfwMode || activeNsfwDomain || 'safe',
      sortOrder
    });
  }, [hasHydratedUi, fetchResources, homeMode, lastHomeQuery, currentPage, sortOrder, activeNsfwDomain]);

  const commitFilterDraft = (filters: Partial<HomeQueryState>) => {
    const newQuery = buildHomeQuery(lastHomeQuery, filters);
    const nextDomain = syncDraftFromQuery(newQuery);
    setLastHomeQuery(newQuery);
    return { newQuery, nextDomain };
  };

  const handleFilterChange = (filters: Partial<HomeQueryState>) => {
    const { newQuery } = commitFilterDraft(filters);
    const domainChanged =
      filters.nsfwMode !== undefined && mapNsfwModeToDomain(filters.nsfwMode) !== activeNsfwDomain;
    const platformChanged = filters.selectedPlatform !== undefined;

    if (!requiresAdvancedMode(newQuery)) {
      if (homeMode !== 'normal') exitAdvancedMode();
      return;
    }

    if (homeMode === 'advanced_ready' && !domainChanged && !platformChanged) {
      applyAdvancedFilters(currentPage, sortField, sortOrder);
    }
  };

  const handleAdvancedSubmit = async (filters: Partial<HomeQueryState>) => {
    const { newQuery } = commitFilterDraft(filters);

    if (!requiresAdvancedMode(newQuery)) {
      if (homeMode !== 'normal') exitAdvancedMode();
      return false;
    }

    await enterAdvancedMode(sortField, sortOrder);
    return true;
  };

  const applyFiltersFromCurrentDraft = async (overrides: Partial<HomeQueryState>) =>
    handleAdvancedSubmit(buildQueryFromAdvancedDraft(advancedFilterDraft, overrides));

  const updateSort = (field: HomeQueryState['sortField'], order: HomeQueryState['sortOrder']) => {
    setLastHomeQuery({ ...lastHomeQuery, sortField: field, sortOrder: order });
    if (homeMode !== 'normal') applyAdvancedFilters(currentPage, field, order);
  };

  const goToPage = (page: number) => {
    if (homeMode === 'normal') return false;
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
