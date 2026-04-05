export interface LocalFolder {
  rootPath: string;
  path: string;
  folderName: string;
  tg_id: string | null;
  matchState: 'linked' | 'orphaned' | 'unresolved';
  executableNames: string[];
  depth: number;
}

export interface LibraryRoot {
  id: number;
  path: string;
  created_at: string;
  last_scanned_at: string | null;
}

export interface LinkedLocalGame {
  id: number;
  path: string;
  exe_path: string | null;
  size_bytes: number | null;
  linked_at: string;
  last_opened_at: string | null;
  source: 'scan' | 'download' | 'manual';
  status: 'discovered' | 'linked' | 'verified' | 'broken';
  last_verified_at: string | null;
  game_id: number | null;
  unique_id: string | null;
  name: string | null;
  alias: string[];
  banner_url: string | null;
  avg_rating: number | null;
  view_count: number | null;
  download_count: number | null;
}

export interface LibraryRescanResult {
  roots: LibraryRoot[];
  folders: LocalFolder[];
  linkedGames: LinkedLocalGame[];
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

export interface DownloadQueueGameMetadata {
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
  extractedPath: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ExtractorCandidateStatus {
  name: string;
  path: string;
  detected: boolean;
  supported: boolean;
}

export interface ExtractorStatus {
  found: boolean;
  path: string | null;
  name: string | null;
  supported: boolean;
  candidates: ExtractorCandidateStatus[];
}


export interface BrowseHistoryEntry {
  id: number;
  unique_id: string;
  game_id: number | null;
  name: string;
  banner_url: string | null;
  viewed_at: string;
}

export interface ElectronAPI {
  // Local File System
  scanLocalLibrary: (paths: string[]) => Promise<LocalFolder[]>;
  tagFolder: (folderPath: string, id: string) => Promise<{ success: boolean; error?: any }>;
  listLibraryRoots: () => Promise<LibraryRoot[]>;
  addLibraryRoot: (rootPath: string) => Promise<LibraryRoot[]>;
  removeLibraryRoot: (rootId: number) => Promise<LibraryRoot[]>;
  pickLibraryRoot: () => Promise<string | null>;
  rescanLibrary: (rootPaths?: string[]) => Promise<LibraryRescanResult>;
  listLinkedLocalGames: () => Promise<LinkedLocalGame[]>;
  getLinkedLocalGame: (localGameId: number) => Promise<LinkedLocalGame | null>;
  markLocalGameOpened: (localGameId: number) => Promise<{ success: boolean }>;
  openLocalGameWindow: (localGameId: number) => Promise<{ success: boolean }>;
  deleteLibraryGamesAndFiles: (localPathIds: number[]) => Promise<{
    success: boolean;
    deletedIds: number[];
    deletedPaths: string[];
    skippedPaths: string[];
  }>;
  getExecutables: (folderPath: string) => Promise<string[]>;
  launchGame: (folderPath: string, exeName: string) => Promise<{ success: boolean; pid?: number; error?: string }>;
  revealPath: (targetPath: string) => Promise<{ success: boolean }>;

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
  getDownloadConcurrency: () => Promise<number>;
  setDownloadConcurrency: (value: number) => Promise<number>;
  getArchiveExtractionDepth: () => Promise<number>;
  setArchiveExtractionDepth: (value: number) => Promise<number>;
  queueDownload: (gameId: number | null, sourceUrl: string, downloadRoot?: string, gameMetadata?: DownloadQueueGameMetadata) => Promise<{
    added: number;
    reused: number;
    tasks: DownloadQueueTask[];
  }>;
  getDownloadQueue: () => Promise<DownloadQueueTask[]>;
  resumeDownloadTask: (taskId: number) => Promise<DownloadQueueTask | null>;
  retryDownloadTask: (taskId: number) => Promise<DownloadQueueTask | null>;
  pauseDownloadTask: (taskId: number) => Promise<DownloadQueueTask | null>;
  deleteDownloadTask: (taskId: number) => Promise<{ success: boolean }>;
  deleteDownloadTasksAndFiles: (taskIds: number[], downloadRoot: string) => Promise<{
    success: boolean;
    deletedTaskIds: number[];
    deletedFiles: string[];
  }>;
  clearFinishedDownloadTasks: () => Promise<{ success: boolean }>;
  revealDownloadTask: (outputPath: string) => Promise<{ success: boolean }>;
  onDownloadQueueUpdated: (callback: (queue: DownloadQueueTask[]) => void) => () => void;
  getLocalCollections: () => Promise<LocalCollection[]>;
  createLocalCollection: (name: string) => Promise<LocalCollection[]>;
  deleteLocalCollection: (collectionId: number) => Promise<LocalCollection[]>;
  addLocalCollectionItem: (collectionId: number, game: LocalCollectionGameInput) => Promise<LocalCollection[]>;
  removeLocalCollectionItem: (collectionId: number, uniqueId: string) => Promise<LocalCollection[]>;

  // Browse history
  recordHistory: (entry: { uniqueId: string; gameId?: number | null; name: string; bannerUrl?: string | null }) => Promise<{ success: boolean }>;
  getHistory: (limit?: number) => Promise<BrowseHistoryEntry[]>;
  clearHistory: () => Promise<{ success: boolean }>;

  // Extractor
  checkExtractor: () => Promise<ExtractorStatus>;

  // Maintenance
  resetDatabase: () => Promise<{ success: boolean; deletedPaths: string[] }>;
  clearAppCache: () => Promise<{ success: boolean; deletedPaths: string[] }>;
}

declare global {
  interface Window {
    api: ElectronAPI;
  }
}
