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
  getFavoriteFolders: (uid: number) => Promise<any>;
  getFavoriteFolderPatches: (folderId: number, page: number, limit: number) => Promise<any>;
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
