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

  searchResources: async (keyword: string, page = 1, limit = 20, options?: Record<string, any>) => {
    return await window.api.searchResources(keyword, page, limit, options) as { list: TouchGalResource[], total: number };
  },

  getPatchDetail: async (uniqueId: string) => {
    return await window.api.getPatchDetail(uniqueId) as TouchGalDetail;
  },

  getPatchIntroduction: async (uniqueId: string) => {
    return await window.api.getPatchIntroduction(uniqueId) as {
      introduction: string | null;
      releasedDate: string | null;
      alias: string[];
      tags: string[];
      company: string | null;
      vndbId: string | null;
      bangumiId: number | null;
      steamId: string | null;
    };
  },

  fetchCaptcha: async () => {
    return await window.api.fetchCaptcha();
  },

  login: async (username: string, password: string, captcha: string) => {
    return await window.api.login(username, password, captcha);
  }
};
