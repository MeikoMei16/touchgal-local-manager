import { 
  TouchGalFeedResponseSchema, 
  TouchGalDetailSchema, 
  PatchIntroductionSchema,
  UserProfileSchema,
  UserActivityResponseSchema,
  FavoriteFolderListSchema,
  FavoriteFolderPatchResponseSchema,
  PatchCommentResponseSchema,
  PatchRatingResponseSchema,
  FavoriteFolderSchema,
  FavoriteToggleResponseSchema,
  SearchTagSuggestionListSchema,
  CaptchaResponseSchema,
  CaptchaVerifyResponseSchema,
  LoginResponseSchema,
  DeveloperApiStatusSchema
} from '../schemas';

const asRecord = (value: unknown): Record<string, any> =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {};

const unwrapResponseData = (raw: unknown) => {
  const data = asRecord(raw);
  return data.data && typeof data.data === 'object' && !Array.isArray(data.data) ? data.data : raw;
};

const normalizeListResponse = (
  raw: unknown,
  keys: string[]
) => {
  const payload = unwrapResponseData(raw);
  const data = asRecord(payload);
  const list = keys.reduce<unknown[]>((found, key) => {
    if (found.length > 0) return found;
    return Array.isArray(data[key]) ? data[key] : [];
  }, []);

  return {
    ...data,
    total: data.total ?? list.length,
    list,
  };
};

const normalizeUserActivityResponse = (
  raw: unknown,
  key: 'comments' | 'ratings' | 'resources'
) => {
  const normalized = normalizeListResponse(raw, [key, 'list', 'galgames']);
  return { ...normalized, [key]: normalized.list };
};

const normalizeFavoriteFolderPatchResponse = (raw: unknown) => {
  const normalized = normalizeListResponse(raw, ['patches', 'list', 'resources']);

  return {
    ...normalized,
    patches: normalized.list
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
    const raw = await window.api.getDeveloperApiStatus();
    return DeveloperApiStatusSchema.parse(unwrapResponseData(raw));
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
    const raw = await window.api.getPatchComments(patchId, page, limit);
    return PatchCommentResponseSchema.parse(normalizeListResponse(raw, ['list', 'comments']));
  },

  fetchPatchRatings: async (patchId: number, page = 1, limit = 20) => {
    const raw = await window.api.getPatchRatings(patchId, page, limit);
    return PatchRatingResponseSchema.parse(normalizeListResponse(raw, ['list', 'ratings']));
  },

  fetchCaptcha: async () => {
    const raw = await window.api.fetchCaptcha();
    return CaptchaResponseSchema.parse(unwrapResponseData(raw));
  },

  verifyCaptcha: async (sessionId: string, selectedIds: string[]) => {
    const raw = await window.api.verifyCaptcha(sessionId, selectedIds);
    return CaptchaVerifyResponseSchema.parse(unwrapResponseData(raw));
  },

  login: async (username: string, password: string, captcha: string) => {
    const raw = await window.api.login(username, password, captcha);
    return LoginResponseSchema.parse(unwrapResponseData(raw));
  },

  logout: async () => {
    return await window.api.logout();
  },

  clearPersistedAuth: async () => {
    return await window.api.clearPersistedAuth();
  },

  searchTags: async (keyword: string) => {
    const raw = await window.api.searchTags(keyword);
    const payload = unwrapResponseData(raw);
    const data = asRecord(payload);
    const suggestions = Array.isArray(payload)
      ? payload
      : Array.isArray(data.suggestions)
        ? data.suggestions
        : Array.isArray(data.tags)
          ? data.tags
          : Array.isArray(data.list)
            ? data.list
            : [];
    return SearchTagSuggestionListSchema.parse(suggestions);
  },

  getUserStatus: async (id: number) => {
    const raw = await window.api.getUserStatus(id);
    return UserProfileSchema.parse(raw);
  },

  getUserStatusSelf: async () => {
    const raw = await window.api.getUserStatusSelf();
    const data = asRecord(raw);
    if (data.isDeveloperApiCredential) return null;
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
    const payload = unwrapResponseData(raw);
    const data = asRecord(payload);
    const folders = Array.isArray(payload)
      ? payload
      : Array.isArray(data.folders)
        ? data.folders
        : Array.isArray(data.list)
          ? data.list
          : [];
    return FavoriteFolderListSchema.parse(folders);
  },

  createFavoriteFolder: async (input: { name: string; description?: string; isPublic?: boolean }) => {
    const raw = await window.api.createFavoriteFolder(input);
    return FavoriteFolderSchema.parse(unwrapResponseData(raw));
  },

  deleteFavoriteFolder: async (folderId: number) => {
    return await window.api.deleteFavoriteFolder(folderId);
  },

  getFavoriteFolderPatches: async (folderId: number, pageNum: number, limitNum: number) => {
    const raw = await window.api.getFavoriteFolderPatches(folderId, pageNum, limitNum);
    return FavoriteFolderPatchResponseSchema.parse(normalizeFavoriteFolderPatchResponse(raw));
  },

  togglePatchFavorite: async (patchId: number, folderId: number) => {
    const raw = await window.api.togglePatchFavorite(patchId, folderId);
    return FavoriteToggleResponseSchema.parse(unwrapResponseData(raw));
  }
};
