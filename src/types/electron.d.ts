export interface LocalFolder {
  path: string;
  folderName: string;
  tg_id: string | null;
}

export interface ElectronAPI {
  // Local File System
  scanLocalLibrary: (paths: string[]) => Promise<LocalFolder[]>;
  tagFolder: (folderPath: string, id: string) => Promise<{ success: boolean; error?: any }>;

  // TouchGal API Relay (Bypass CORS)
  fetchResources: (page: number, limit: number, query: any) => Promise<any>;
  searchResources: (keyword: string, page: number, limit: number) => Promise<any>;
  getPatchDetail: (uniqueId: string) => Promise<any>;
  getPatchIntroduction: (uniqueId: string) => Promise<any>;
  fetchCaptcha: () => Promise<string>; // Returns base64 data URI
  login: (username: string, password: string, captcha: string) => Promise<any>;
}

declare global {
  interface Window {
    api: ElectronAPI;
  }
}
