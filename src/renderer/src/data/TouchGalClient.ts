import { 
  TouchGalFeedResponseSchema, 
  TouchGalDetailSchema, 
  PatchIntroductionSchema 
} from '../schemas';

/**
 * TouchGalClient - Renderer Side
 * Now redirects all calls to the Main Process via window.api
 * This completely bypasses CORS restrictions and adds Zod validation.
 */
export const TouchGalClient = {
  fetchGalgameResources: async (page = 1, limit = 24, query = {}) => {
    const raw = await window.api.fetchResources(page, limit, query);
    return TouchGalFeedResponseSchema.parse(raw);
  },

  searchResources: async (keyword: string, page = 1, limit = 20, options?: Record<string, any>) => {
    const raw = await window.api.searchResources(keyword, page, limit, options);
    return TouchGalFeedResponseSchema.parse(raw);
  },

  getPatchDetail: async (uniqueId: string) => {
    const raw = await window.api.getPatchDetail(uniqueId);
    return TouchGalDetailSchema.parse(raw);
  },

  getPatchIntroduction: async (uniqueId: string) => {
    const raw = await window.api.getPatchIntroduction(uniqueId);
    return PatchIntroductionSchema.parse(raw);
  },

  fetchPatchComments: async (patchId: number, page = 1, limit = 20) => {
    return await window.api.getPatchComments(patchId, page, limit);
  },

  fetchPatchRatings: async (patchId: number, page = 1, limit = 20) => {
    return await window.api.getPatchRatings(patchId, page, limit);
  },

  fetchCaptcha: async () => {
    return await window.api.fetchCaptcha();
  },

  verifyCaptcha: async (sessionId: string, selectedIds: string[]) => {
    return await window.api.verifyCaptcha(sessionId, selectedIds);
  },

  login: async (username: string, password: string, captcha: string) => {
    return await window.api.login(username, password, captcha);
  },

  logout: async () => {
    return await window.api.logout();
  },

  clearPersistedAuth: async () => {
    return await window.api.clearPersistedAuth();
  },

  searchTags: async (keyword: string) => {
    return await window.api.searchTags(keyword);
  },

  getUserStatus: async (id: number) => {
    return await window.api.getUserStatus(id);
  },

  getUserStatusSelf: async () => {
    return await window.api.getUserStatusSelf();
  },

  getUserComments: async (uid: number, pageNum: number, limitNum: number) => {
    return await window.api.getUserComments(uid, pageNum, limitNum);
  },

  getUserRatings: async (uid: number, pageNum: number, limitNum: number) => {
    return await window.api.getUserRatings(uid, pageNum, limitNum);
  },

  getUserResources: async (uid: number, pageNum: number, limitNum: number) => {
    return await window.api.getUserResources(uid, pageNum, limitNum);
  },

  getFavoriteFolders: async (uid: number) => {
    return await window.api.getFavoriteFolders(uid);
  }
};
