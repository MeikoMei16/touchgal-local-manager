import { contextBridge, ipcRenderer } from 'electron' 

contextBridge.exposeInMainWorld('api', {
  // Local File System
  scanLocalLibrary: (paths: string[]) => ipcRenderer.invoke('scan-local-library', paths),
  tagFolder: (folderPath: string, id: string) => ipcRenderer.invoke('tag-folder', folderPath, id),

  // TouchGal API Relay (Bypass CORS)
  fetchResources: (page: number, limit: number, query: Record<string, unknown>) =>
    ipcRenderer.invoke('tg-fetch-resources', page, limit, query),

  searchResources: (keyword: string, page: number, limit: number, options?: Record<string, unknown>) =>
    ipcRenderer.invoke('tg-search-resources', keyword, page, limit, options),

  getPatchDetail: (uniqueId: string) =>
    ipcRenderer.invoke('tg-get-patch-detail', uniqueId),

  getPatchIntroduction: (uniqueId: string) =>
    ipcRenderer.invoke('tg-get-patch-introduction', uniqueId),

  getPatchComments: (patchId: number, page: number, limit: number) =>
    ipcRenderer.invoke('tg-get-patch-comments', patchId, page, limit),

  getPatchRatings: (patchId: number, page: number, limit: number) =>
    ipcRenderer.invoke('tg-get-patch-ratings', patchId, page, limit),

  fetchCaptcha: () => ipcRenderer.invoke('tg-fetch-captcha'),
  verifyCaptcha: (sessionId: string, selectedIds: string[]) => ipcRenderer.invoke('tg-verify-captcha', sessionId, selectedIds),
  login: (username: string, password: string, captcha: string) => ipcRenderer.invoke('tg-login', username, password, captcha),
  logout: () => ipcRenderer.invoke('tg-logout'),
  clearPersistedAuth: () => ipcRenderer.invoke('tg-clear-persisted-auth'),

  searchTags: (keyword: string) =>
    ipcRenderer.invoke('tg-search-tags', keyword),

  getUserStatus: (id: number) => ipcRenderer.invoke('tg-get-user-status', id),
  getUserStatusSelf: () => ipcRenderer.invoke('tg-get-user-status-self'),
  getUserComments: (uid: number, page: number, limit: number) => ipcRenderer.invoke('tg-get-user-comments', uid, page, limit),
  getUserRatings: (uid: number, page: number, limit: number) => ipcRenderer.invoke('tg-get-user-ratings', uid, page, limit),
  getUserResources: (uid: number, page: number, limit: number) => ipcRenderer.invoke('tg-get-user-resources', uid, page, limit),
  getFavoriteFolders: (uid: number) => ipcRenderer.invoke('tg-get-favorite-folders', uid),
  createFavoriteFolder: (input: { name: string; description?: string; isPublic?: boolean }) =>
    ipcRenderer.invoke('tg-create-favorite-folder', input),
  deleteFavoriteFolder: (folderId: number) => ipcRenderer.invoke('tg-delete-favorite-folder', folderId),
  getFavoriteFolderPatches: (folderId: number, page: number, limit: number) =>
    ipcRenderer.invoke('tg-get-favorite-folder-patches', folderId, page, limit),
  togglePatchFavorite: (patchId: number, folderId: number) =>
    ipcRenderer.invoke('tg-toggle-patch-favorite', patchId, folderId),

  getLocalCollections: () => ipcRenderer.invoke('tg-local-collections-list'),
  createLocalCollection: (name: string) => ipcRenderer.invoke('tg-local-collections-create', name),
  deleteLocalCollection: (collectionId: number) => ipcRenderer.invoke('tg-local-collections-delete', collectionId),
  addLocalCollectionItem: (collectionId: number, game: Record<string, unknown>) =>
    ipcRenderer.invoke('tg-local-collections-add-item', collectionId, game),
  removeLocalCollectionItem: (collectionId: number, uniqueId: string) =>
    ipcRenderer.invoke('tg-local-collections-remove-item', collectionId, uniqueId),
})
