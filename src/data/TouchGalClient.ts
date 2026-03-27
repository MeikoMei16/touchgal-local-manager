import { TouchGalFeedResponse, TouchGalResource, TouchGalDetail } from '../types';

/**
 * TouchGalClient - Renderer Side
 * Now redirects all calls to the Main Process via window.api
 * This completely bypasses CORS restrictions.
 */
export const TouchGalClient = {
  fetchGalgameResources: async (page = 1, limit = 24, query = {}) => {
    return await window.api.fetchResources(page, limit, query) as TouchGalFeedResponse;
  },

  searchResources: async (keyword: string, page = 1, limit = 20) => {
    return await window.api.searchResources(keyword, page, limit) as { list: TouchGalResource[], total: number };
  },

  getPatchDetail: async (uniqueId: string) => {
    return await window.api.getPatchDetail(uniqueId) as TouchGalDetail;
  },

  getPatchIntroduction: async (uniqueId: string) => {
    return await window.api.getPatchIntroduction(uniqueId) as { introduction: string };
  },

  fetchCaptcha: async () => {
    return await window.api.fetchCaptcha(); // Returns base64 string
  },

  login: async (username: string, password: string, captcha: string) => {
    return await window.api.login(username, password, captcha);
  }
};
