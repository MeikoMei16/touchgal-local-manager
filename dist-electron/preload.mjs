"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("api", {
  // Local File System
  scanLocalLibrary: (paths) => electron.ipcRenderer.invoke("scan-local-library", paths),
  tagFolder: (folderPath, id) => electron.ipcRenderer.invoke("tag-folder", folderPath, id),
  // TouchGal API Relay (Bypass CORS)
  fetchResources: (page, limit, query) => electron.ipcRenderer.invoke("tg-fetch-resources", page, limit, query),
  searchResources: (keyword, page, limit) => electron.ipcRenderer.invoke("tg-search-resources", keyword, page, limit),
  getPatchDetail: (uniqueId) => electron.ipcRenderer.invoke("tg-get-patch-detail", uniqueId),
  getPatchIntroduction: (uniqueId) => electron.ipcRenderer.invoke("tg-get-patch-introduction", uniqueId),
  fetchCaptcha: () => electron.ipcRenderer.invoke("tg-fetch-captcha"),
  login: (username, password, captcha) => electron.ipcRenderer.invoke("tg-login", username, password, captcha)
});
