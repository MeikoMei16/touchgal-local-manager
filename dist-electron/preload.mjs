let electron_renderer = require("electron/renderer");
//#region electron/preload.ts
electron_renderer.contextBridge.exposeInMainWorld("api", {
	scanLocalLibrary: (paths) => electron_renderer.ipcRenderer.invoke("scan-local-library", paths),
	tagFolder: (folderPath, id) => electron_renderer.ipcRenderer.invoke("tag-folder", folderPath, id),
	fetchResources: (page, limit, query) => electron_renderer.ipcRenderer.invoke("tg-fetch-resources", page, limit, query),
	searchResources: (keyword, page, limit, options) => electron_renderer.ipcRenderer.invoke("tg-search-resources", keyword, page, limit, options),
	getPatchDetail: (uniqueId) => electron_renderer.ipcRenderer.invoke("tg-get-patch-detail", uniqueId),
	getPatchIntroduction: (uniqueId) => electron_renderer.ipcRenderer.invoke("tg-get-patch-introduction", uniqueId),
	fetchCaptcha: () => electron_renderer.ipcRenderer.invoke("tg-fetch-captcha"),
	login: (username, password, captcha) => electron_renderer.ipcRenderer.invoke("tg-login", username, password, captcha)
});
//#endregion
