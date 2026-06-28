import { 
  TouchGalFeedResponseSchema, 
  TouchGalDetailSchema, 
  PatchIntroductionSchema,
  UserProfileSchema,
  UserActivityResponseSchema,
  FavoriteFolderListSchema,
  FavoriteFolderPatchResponseSchema
} from '../schemas';

const asRecord = (value: unknown): Record<string, any> =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {};

const normalizeUserActivityResponse = (
  raw: unknown,
  key: 'comments' | 'ratings' | 'resources'
) => {
  const data = asRecord(raw);
  const list = Array.isArray(data[key])
    ? data[key]
    : Array.isArray(data.list)
      ? data.list
      : Array.isArray(data.galgames)
        ? data.galgames
        : [];

  return {
    total: data.total ?? list.length,
    [key]: list
  };
};

const normalizeFavoriteFolderPatchResponse = (raw: unknown) => {
  const data = asRecord(raw);
  const patches = Array.isArray(data.patches)
    ? data.patches
    : Array.isArray(data.list)
      ? data.list
      : Array.isArray(data.resources)
        ? data.resources
        : [];

  return {
    ...data,
    patches,
    total: data.total ?? patches.length
  };
};

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

  getDeveloperApiStatus: async () => {
    return await window.api.getDeveloperApiStatus();
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
    const raw = await window.api.getUserStatus(id);
    return UserProfileSchema.parse(raw);
  },

  getUserStatusSelf: async () => {
    const raw = await window.api.getUserStatusSelf();
    const data = asRecord(raw);
    if (!data.uid && !data.id) return raw;
    return UserProfileSchema.parse(raw);
  },

  getUserComments: async (uid: number, pageNum: number, limitNum: number) => {
    const raw = await window.api.getUserComments(uid, pageNum, limitNum);
    return UserActivityResponseSchema.parse(normalizeUserActivityResponse(raw, 'comments'));
  },

  getUserRatings: async (uid: number, pageNum: number, limitNum: number) => {
    const raw = await window.api.getUserRatings(uid, pageNum, limitNum);
    return UserActivityResponseSchema.parse(normalizeUserActivityResponse(raw, 'ratings'));
  },

  getUserResources: async (uid: number, pageNum: number, limitNum: number) => {
    const raw = await window.api.getUserResources(uid, pageNum, limitNum);
    return UserActivityResponseSchema.parse(normalizeUserActivityResponse(raw, 'resources'));
  },

  getFavoriteFolders: async (uid: number, patchId?: number) => {
    const raw = await window.api.getFavoriteFolders(uid, patchId);
    const data = asRecord(raw);
    const folders = Array.isArray(raw)
      ? raw
      : Array.isArray(data.folders)
        ? data.folders
        : Array.isArray(data.list)
          ? data.list
          : [];
    return FavoriteFolderListSchema.parse(folders);
  },

  createFavoriteFolder: async (input: { name: string; description?: string; isPublic?: boolean }) => {
    return await window.api.createFavoriteFolder(input);
  },

  deleteFavoriteFolder: async (folderId: number) => {
    return await window.api.deleteFavoriteFolder(folderId);
  },

  getFavoriteFolderPatches: async (folderId: number, pageNum: number, limitNum: number) => {
    const raw = await window.api.getFavoriteFolderPatches(folderId, pageNum, limitNum);
    return FavoriteFolderPatchResponseSchema.parse(normalizeFavoriteFolderPatchResponse(raw));
  },

  togglePatchFavorite: async (patchId: number, folderId: number) => {
    return await window.api.togglePatchFavorite(patchId, folderId);
  }
};
