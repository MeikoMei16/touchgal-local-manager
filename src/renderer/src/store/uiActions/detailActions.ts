import { TouchGalClient } from '../../data/TouchGalClient';
import { useAuthStore } from '../authStore';
import { mergeDetailResource, toDetailShell } from '../../features/detail/detailResource';
import type { UIGetState, UISetState } from '../uiStoreTypes';
import type { TouchGalResource } from '../../types';

let activeDetailRequestKey: string | null = null;
let activeSocialRequestKey: string | null = null;

export const createDetailActions = (set: UISetState, get: UIGetState) => ({
  selectResource: async (uniqueId: string, fallbackResource?: TouchGalResource) => {
    const basicInfo = fallbackResource ?? get().resources.find((r) => r.uniqueId === uniqueId);
    activeDetailRequestKey = uniqueId;
    if (basicInfo) {
      set({
        selectedResource: toDetailShell(basicInfo),
        patchComments: [],
        patchRatings: [],
        isDetailLoading: true,
        error: null
      });
    } else {
      set({ patchComments: [], patchRatings: [], isDetailLoading: true, error: null });
    }

    try {
      const detail = await TouchGalClient.getPatchDetail(uniqueId);
      if (activeDetailRequestKey !== uniqueId) return;

      const mergedDetail = mergeDetailResource(detail, basicInfo);
      const finalId = mergedDetail.id || 0;
      const [comments, ratings] = await Promise.all([
        finalId ? TouchGalClient.fetchPatchComments(finalId, 1, 50) : Promise.resolve({ list: [] }),
        finalId ? TouchGalClient.fetchPatchRatings(finalId, 1, 50) : Promise.resolve({ list: [] })
      ]);
      if (activeDetailRequestKey !== uniqueId) return;

      const hasSessError = (comments as any).requiresLogin || (ratings as any).requiresLogin;
      set({
        selectedResource: mergedDetail,
        patchComments: comments.list || [],
        patchRatings: ratings.list || [],
        isDetailLoading: false
      });
      useAuthStore.getState().setSessionError(hasSessError ? 'SESSION_EXPIRED' : null);
    } catch (err: any) {
      if (activeDetailRequestKey !== uniqueId) return;
      set({ error: err.message, isDetailLoading: false });
      if (err.message?.includes('SESSION_EXPIRED')) useAuthStore.getState().setSessionError('SESSION_EXPIRED');
    }
  },
  refreshSelectedResourceSocial: async () => {
    const currentResource = get().selectedResource;
    if (!currentResource?.uniqueId || !currentResource.id) return;

    const requestKey = `${currentResource.uniqueId}:social`;
    activeSocialRequestKey = requestKey;
    set({ isDetailLoading: true, error: null });

    try {
      const [comments, ratings] = await Promise.all([
        TouchGalClient.fetchPatchComments(currentResource.id, 1, 50),
        TouchGalClient.fetchPatchRatings(currentResource.id, 1, 50)
      ]);
      if (activeSocialRequestKey !== requestKey) return;

      const hasSessError = (comments as any).requiresLogin || (ratings as any).requiresLogin;
      set({
        patchComments: comments.list || [],
        patchRatings: ratings.list || [],
        isDetailLoading: false
      });
      useAuthStore.getState().setSessionError(hasSessError ? 'SESSION_EXPIRED' : null);
    } catch (err: any) {
      if (activeSocialRequestKey !== requestKey) return;
      set({ error: err.message, isDetailLoading: false });
      if (err.message?.includes('SESSION_EXPIRED')) {
        useAuthStore.getState().setSessionError('SESSION_EXPIRED');
      }
    }
  },
  clearSelected: () => {
    activeDetailRequestKey = null;
    activeSocialRequestKey = null;
    set({ selectedResource: null, patchComments: [], patchRatings: [], detailOpenIntent: 'default' });
  }
});
