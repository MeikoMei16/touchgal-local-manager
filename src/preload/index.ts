import { contextBridge, ipcRenderer } from 'electron' 

contextBridge.exposeInMainWorld('api', {
  // Local File System
  scanLocalLibrary: (paths: string[]) => ipcRenderer.invoke('scan-local-library', paths),
  tagFolder: (folderPath: string, id: string) => ipcRenderer.invoke('tag-folder', folderPath, id),
  listLibraryRoots: () => ipcRenderer.invoke('tg-library-list-roots'),
  addLibraryRoot: (rootPath: string) => ipcRenderer.invoke('tg-library-add-root', rootPath),
  removeLibraryRoot: (rootId: number) => ipcRenderer.invoke('tg-library-remove-root', rootId),
  pickLibraryRoot: () => ipcRenderer.invoke('tg-library-pick-root'),
  rescanLibrary: (rootPaths?: string[]) => ipcRenderer.invoke('tg-library-rescan', rootPaths),
  listLinkedLocalGames: () => ipcRenderer.invoke('tg-library-list-linked-games'),
  getLinkedLocalGame: (localGameId: number) => ipcRenderer.invoke('tg-library-get-linked-game', localGameId),
  markLocalGameOpened: (localGameId: number) => ipcRenderer.invoke('tg-library-mark-opened', localGameId),
  openLocalGameWindow: (localGameId: number) => ipcRenderer.invoke('tg-open-local-game-window', localGameId),
  deleteLibraryGamesAndFiles: (localPathIds: number[]) => ipcRenderer.invoke('tg-library-delete-games-and-files', localPathIds),
  getExecutables: (folderPath: string) => ipcRenderer.invoke('tg-get-executables', folderPath),
  launchGame: (folderPath: string, exeName: string) => ipcRenderer.invoke('tg-launch-game', folderPath, exeName),
  revealPath: (targetPath: string) => ipcRenderer.invoke('tg-reveal-path', targetPath),

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
  getFavoriteFolders: (uid: number, patchId?: number) => ipcRenderer.invoke('tg-get-favorite-folders', uid, patchId),
  createFavoriteFolder: (input: { name: string; description?: string; isPublic?: boolean }) =>
    ipcRenderer.invoke('tg-create-favorite-folder', input),
  deleteFavoriteFolder: (folderId: number) => ipcRenderer.invoke('tg-delete-favorite-folder', folderId),
  getFavoriteFolderPatches: (folderId: number, page: number, limit: number) =>
    ipcRenderer.invoke('tg-get-favorite-folder-patches', folderId, page, limit),
  togglePatchFavorite: (patchId: number, folderId: number) =>
    ipcRenderer.invoke('tg-toggle-patch-favorite', patchId, folderId),

  getDefaultDownloadDirectory: () => ipcRenderer.invoke('tg-get-default-download-directory'),
  pickDownloadDirectory: () => ipcRenderer.invoke('tg-pick-download-directory'),
  getDownloadConcurrency: () => ipcRenderer.invoke('tg-get-download-concurrency'),
  setDownloadConcurrency: (value: number) => ipcRenderer.invoke('tg-set-download-concurrency', value),
  getArchiveExtractionDepth: () => ipcRenderer.invoke('tg-get-archive-extraction-depth'),
  setArchiveExtractionDepth: (value: number) => ipcRenderer.invoke('tg-set-archive-extraction-depth', value),
  queueDownload: (
    gameId: number | null,
    sourceUrl: string,
    downloadRoot?: string,
    gameMetadata?: {
      id: number,
      uniqueId: string,
      name: string,
      banner?: string | null,
      averageRating?: number,
      viewCount?: number,
      downloadCount?: number,
      alias?: string[]
    }
  ) => ipcRenderer.invoke('tg-queue-download', gameId, sourceUrl, downloadRoot, gameMetadata),
  getDownloadQueue: () => ipcRenderer.invoke('tg-get-download-queue'),
  resumeDownloadTask: (taskId: number) => ipcRenderer.invoke('tg-resume-download-task', taskId),
  retryDownloadTask: (taskId: number) => ipcRenderer.invoke('tg-retry-download-task', taskId),
  pauseDownloadTask: (taskId: number) => ipcRenderer.invoke('tg-pause-download-task', taskId),
  deleteDownloadTask: (taskId: number) => ipcRenderer.invoke('tg-delete-download-task', taskId),
  deleteDownloadTasksAndFiles: (taskIds: number[], downloadRoot: string) =>
    ipcRenderer.invoke('tg-delete-download-tasks-and-files', taskIds, downloadRoot),
  clearFinishedDownloadTasks: () => ipcRenderer.invoke('tg-clear-finished-download-tasks'),
  revealDownloadTask: (outputPath: string) => ipcRenderer.invoke('tg-reveal-download-task', outputPath),
  onDownloadQueueUpdated: (callback: (queue: unknown) => void) => {
    const listener = (_event: unknown, queue: unknown) => callback(queue)
    ipcRenderer.on('download-queue-updated', listener)
    return () => {
      ipcRenderer.removeListener('download-queue-updated', listener)
    }
  },

  getLocalCollections: () => ipcRenderer.invoke('tg-local-collections-list'),
  createLocalCollection: (name: string) => ipcRenderer.invoke('tg-local-collections-create', name),
  deleteLocalCollection: (collectionId: number) => ipcRenderer.invoke('tg-local-collections-delete', collectionId),
  addLocalCollectionItem: (collectionId: number, game: Record<string, unknown>) =>
    ipcRenderer.invoke('tg-local-collections-add-item', collectionId, game),
  removeLocalCollectionItem: (collectionId: number, uniqueId: string) =>
    ipcRenderer.invoke('tg-local-collections-remove-item', collectionId, uniqueId),

  // Browse history
  recordHistory: (entry: { uniqueId: string; gameId?: number | null; name: string; bannerUrl?: string | null }) =>
    ipcRenderer.invoke('tg-record-history', entry),
  getHistory: (limit?: number) => ipcRenderer.invoke('tg-get-history', limit),
  clearHistory: () => ipcRenderer.invoke('tg-clear-history'),

  // Extractor detection
  checkExtractor: () => ipcRenderer.invoke('tg-check-extractor'),

  // Maintenance
  resetDatabase: () => ipcRenderer.invoke('tg-maintenance-reset-database'),
  clearAppCache: () => ipcRenderer.invoke('tg-maintenance-clear-cache'),
})
