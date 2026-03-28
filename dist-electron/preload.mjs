"use strict";
const renderer = require("electron/renderer");
renderer.contextBridge.exposeInMainWorld("api", {
  // Local File System
  scanLocalLibrary: (paths) => renderer.ipcRenderer.invoke("scan-local-library", paths),
  tagFolder: (folderPath, id) => renderer.ipcRenderer.invoke("tag-folder", folderPath, id),
  // TouchGal API Relay (Bypass CORS)
  fetchResources: (page, limit, query) => renderer.ipcRenderer.invoke("tg-fetch-resources", page, limit, query),
  searchResources: (keyword, page, limit, options) => renderer.ipcRenderer.invoke("tg-search-resources", keyword, page, limit, options),
  getPatchDetail: (uniqueId) => renderer.ipcRenderer.invoke("tg-get-patch-detail", uniqueId),
  getPatchIntroduction: (uniqueId) => renderer.ipcRenderer.invoke("tg-get-patch-introduction", uniqueId),
  fetchCaptcha: () => renderer.ipcRenderer.invoke("tg-fetch-captcha"),
  login: (username, password, captcha) => renderer.ipcRenderer.invoke("tg-login", username, password, captcha)
});
