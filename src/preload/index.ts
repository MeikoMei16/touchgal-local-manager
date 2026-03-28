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

  fetchCaptcha: () =>
    ipcRenderer.invoke('tg-fetch-captcha'),

  login: (username: string, password: string, captcha: string) =>
    ipcRenderer.invoke('tg-login', username, password, captcha),
})
