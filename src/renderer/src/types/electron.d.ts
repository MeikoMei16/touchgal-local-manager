export interface LocalFolder {
  path: string;
  folderName: string;
  tg_id: string | null;
}

export interface LocalCollectionItem {
  gameId: number;
  resourceId: number;
  uniqueId: string;
  name: string;
  banner: string | null;
  averageRating: number;
  viewCount: number;
  downloadCount: number;
}

export interface LocalCollection {
  id: number;
  name: string;
  itemCount: number;
  items: LocalCollectionItem[];
}

export interface LocalCollectionGameInput {
  id: number;
  uniqueId: string;
  name: string;
  banner?: string | null;
  averageRating?: number;
  viewCount?: number;
  downloadCount?: number;
  alias?: string[];
}

export interface DownloadQueueTask {
  id: number;
  gameId: number | null;
  sourceUrl: string;
  storageUrl: string;
  remotePath: string | null;
  displayName: string;
  outputPath: string;
  status: 'queued' | 'downloading' | 'paused' | 'verifying' | 'extracting' | 'done' | 'error';
  progressBytes: number;
  totalBytes: number | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ElectronAPI {
  // Local File System
  scanLocalLibrary: (paths: string[]) => Promise<LocalFolder[]>;
  tagFolder: (folderPath: string, id: string) => Promise<{ success: boolean; error?: any }>;

  // TouchGal API Relay (Bypass CORS)
  fetchResources: (page: number, limit: number, query: any) => Promise<any>;
  searchResources: (keyword: string, page: number, limit: number, options?: any) => Promise<any>;
  getPatchDetail: (uniqueId: string) => Promise<any>;
  getPatchIntroduction: (uniqueId: string) => Promise<any>;
  getPatchComments: (patchId: number, page: number, limit: number) => Promise<any>;
  getPatchRatings: (patchId: number, page: number, limit: number) => Promise<any>;
  fetchCaptcha: () => Promise<any>;
  verifyCaptcha: (sessionId: string, selectedIds: string[]) => Promise<any>;
  login: (username: string, password: string, captcha: string) => Promise<any>;
  logout: () => Promise<{ success: boolean }>;
  clearPersistedAuth: () => Promise<{ success: boolean }>;
  searchTags: (keyword: string) => Promise<any>;
  getUserStatus: (id: number) => Promise<any>;
  getUserStatusSelf: () => Promise<any>;
  getUserComments: (uid: number, page: number, limit: number) => Promise<any>;
  getUserRatings: (uid: number, page: number, limit: number) => Promise<any>;
  getUserResources: (uid: number, page: number, limit: number) => Promise<any>;
  getFavoriteFolders: (uid: number, patchId?: number) => Promise<any>;
  createFavoriteFolder: (input: { name: string; description?: string; isPublic?: boolean }) => Promise<any>;
  deleteFavoriteFolder: (folderId: number) => Promise<any>;
  getFavoriteFolderPatches: (folderId: number, page: number, limit: number) => Promise<any>;
  togglePatchFavorite: (patchId: number, folderId: number) => Promise<any>;
  getDefaultDownloadDirectory: () => Promise<string>;
  pickDownloadDirectory: () => Promise<string | null>;
  queueDownload: (gameId: number | null, sourceUrl: string, downloadRoot?: string) => Promise<{
    added: number;
    reused: number;
    tasks: DownloadQueueTask[];
  }>;
  getDownloadQueue: () => Promise<DownloadQueueTask[]>;
  resumeDownloadTask: (taskId: number) => Promise<DownloadQueueTask | null>;
  retryDownloadTask: (taskId: number) => Promise<DownloadQueueTask | null>;
  pauseDownloadTask: (taskId: number) => Promise<DownloadQueueTask | null>;
  deleteDownloadTask: (taskId: number) => Promise<{ success: boolean }>;
  clearFinishedDownloadTasks: () => Promise<{ success: boolean }>;
  revealDownloadTask: (outputPath: string) => Promise<{ success: boolean }>;
  getLocalCollections: () => Promise<LocalCollection[]>;
  createLocalCollection: (name: string) => Promise<LocalCollection[]>;
  deleteLocalCollection: (collectionId: number) => Promise<LocalCollection[]>;
  addLocalCollectionItem: (collectionId: number, game: LocalCollectionGameInput) => Promise<LocalCollection[]>;
  removeLocalCollectionItem: (collectionId: number, uniqueId: string) => Promise<LocalCollection[]>;
}

declare global {
  interface Window {
    api: ElectronAPI;
  }
}
