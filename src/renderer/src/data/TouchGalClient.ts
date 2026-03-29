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

  fetchCaptcha: async () => {
    return await window.api.fetchCaptcha();
  },

  verifyCaptcha: async (sessionId: string, selectedIds: string[]) => {
    return await window.api.verifyCaptcha(sessionId, selectedIds);
  },

  login: async (username: string, password: string, captcha: string) => {
    return await window.api.login(username, password, captcha);
  },

  searchTags: async (keyword: string) => {
    return await window.api.searchTags(keyword);
  }
};
