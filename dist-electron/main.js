import { app, BrowserWindow, ipcMain } from "electron";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import axios from "axios";
const __filename$1 = fileURLToPath(import.meta.url);
const __dirname$1 = path.dirname(__filename$1);
process.env.DIST = path.join(__dirname$1, "../dist");
process.env.VITE_PUBLIC = app.isPackaged ? process.env.DIST : path.join(process.env.DIST, "../public");
let win;
const API_CLIENT = axios.create({
  baseURL: "https://www.touchgal.top/api",
  headers: {
    "Content-Type": "application/json",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    Referer: "https://www.touchgal.top/",
    Origin: "https://www.touchgal.top",
    "Cookie": "kun-patch-setting-store|state|data|kunNsfwEnable=all"
  },
  timeout: 3e4
});
const asArray = (value) => {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === "string" && value.trim()) return [value];
  return [];
};
const extractTags = (resource) => {
  if (Array.isArray(resource.tags) && resource.tags.length > 0) {
    return resource.tags.filter(Boolean);
  }
  if (!Array.isArray(resource.tag)) return [];
  return resource.tag.map((item) => {
    var _a;
    return ((_a = item == null ? void 0 : item.tag) == null ? void 0 : _a.name) ?? (item == null ? void 0 : item.name);
  }).filter((tag) => Boolean(tag));
};
const normalizeResource = (resource) => {
  var _a;
  const counts = resource._count ?? {};
  const platforms = asArray(resource.platform);
  const languages = asArray(resource.language);
  const company = typeof resource.company === "string" ? resource.company : Array.isArray(resource.company) ? resource.company.map((item) => item == null ? void 0 : item.name).filter(Boolean).join(", ") : null;
  return {
    id: resource.id ?? 0,
    uniqueId: resource.uniqueId ?? resource.unique_id ?? "",
    name: resource.name ?? "Unknown title",
    banner: resource.banner ?? null,
    platform: platforms.join(", "),
    language: languages.join(", "),
    releasedDate: resource.releasedDate ?? resource.released ?? null,
    averageRating: resource.averageRating ?? ((_a = resource.rating_stat) == null ? void 0 : _a.avg_overall) ?? 0,
    tags: extractTags(resource),
    alias: resource.alias ?? [],
    favoriteCount: counts.favorite_folder ?? 0,
    resourceCount: counts.resource ?? 0,
    commentCount: counts.comment ?? 0,
    introduction: resource.introduction ?? null,
    company,
    vndbId: resource.vndbId ?? resource.vndb_id ?? null,
    bangumiId: resource.bangumiId ?? resource.bangumi_id ?? null,
    steamId: resource.steamId != null ? String(resource.steamId) : resource.steam_id != null ? String(resource.steam_id) : null,
    contentLimit: resource.contentLimit ?? null,
    ratingSummary: resource.ratingSummary ?? {
      average: 0,
      count: 0,
      histogram: Array.from({ length: 10 }, (_, i) => ({ score: i + 1, count: 0 })),
      recommend: { strong_no: 0, no: 0, neutral: 0, yes: 0, strong_yes: 0 }
    },
    screenshots: resource.fullScreenshotUrls ?? [],
    pvUrl: resource.pvVideoUrl ?? null
  };
};
const normalizeDownloads = (downloads) => downloads.map((download) => ({
  id: download.id ?? 0,
  name: download.name ?? "Unnamed resource",
  size: download.size ?? null,
  url: download.url ?? download.content ?? null,
  storage: download.storage ?? null,
  code: download.code ?? null,
  password: download.password ?? null,
  platform: asArray(download.platform)
}));
const normalizeFeedResponse = (payload) => ({
  list: (payload.galgames ?? []).map(normalizeResource),
  total: payload.total ?? 0
});
const buildSearchBody = (keyword, page, limit) => ({
  queryString: JSON.stringify([{ type: "keyword", name: keyword }]),
  limit,
  page,
  selectedType: "all",
  selectedLanguage: "all",
  selectedPlatform: "all",
  sortField: "created",
  sortOrder: "desc",
  selectedYears: ["all"],
  selectedMonths: ["all"],
  searchOption: {
    searchInIntroduction: true,
    searchInAlias: true,
    searchInTag: true
  }
});
const ensureValidResponse = (payload) => {
  if (typeof payload === "string") {
    console.error("[API] Error payload (string):", payload);
    throw new Error(payload);
  }
  if (Array.isArray(payload)) {
    const first = payload[0];
    if (first && typeof first === "object" && "code" in first && "path" in first) {
      console.error("[API] Validation errors (Zod):", JSON.stringify(payload, null, 2));
      throw new Error(String(first.message || "TouchGal returned a validation error"));
    }
  }
  return payload;
};
const scanForGalgameFolders = async (rootPaths) => {
  const results = [];
  const scanTasks = rootPaths.map(async (rootPath) => {
    try {
      if (!fs.existsSync(rootPath)) return;
      const dirs = await fs.promises.readdir(rootPath, { withFileTypes: true });
      const dirTasks = dirs.map(async (dir) => {
        if (!dir.isDirectory()) return;
        const fullPath = path.join(rootPath, dir.name);
        const tgIdPath = path.join(fullPath, ".tg_id");
        let tg_id = null;
        try {
          if (fs.existsSync(tgIdPath)) {
            tg_id = (await fs.promises.readFile(tgIdPath, "utf8")).trim();
          }
        } catch (e) {
        }
        results.push({ path: fullPath, folderName: dir.name, tg_id });
      });
      await Promise.all(dirTasks);
    } catch (e) {
    }
  });
  await Promise.all(scanTasks);
  return results;
};
function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, "electron-vite.svg"),
    width: 1200,
    height: 800,
    titleBarStyle: "hiddenInset",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname$1, "preload.mjs")
    }
  });
  win.webContents.on("did-finish-load", () => {
    win == null ? void 0 : win.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  });
  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL);
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(process.env.DIST || "", "index.html"));
  }
}
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
    win = null;
  }
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
ipcMain.handle("scan-local-library", async (_event, paths) => {
  return await scanForGalgameFolders(paths);
});
ipcMain.handle("tag-folder", (_event, folderPath, id) => {
  const tgIdPath = path.join(folderPath, ".tg_id");
  try {
    fs.writeFileSync(tgIdPath, id, "utf8");
    return { success: true };
  } catch (error) {
    return { success: false, error };
  }
});
ipcMain.handle("tg-fetch-resources", async (_event, page, limit, query) => {
  const response = await API_CLIENT.get("/galgame", {
    params: {
      page,
      limit,
      selectedType: query.selectedType ?? "all",
      selectedLanguage: query.selectedLanguage ?? "all",
      selectedPlatform: query.selectedPlatform ?? "all",
      sortField: query.sortField ?? "resource_update_time",
      sortOrder: query.sortOrder ?? "desc",
      yearString: query.yearString ?? ["all"],
      monthString: query.monthString ?? ["all"],
      minRatingCount: query.minRatingCount ?? 0,
      ...query
    }
  });
  return normalizeFeedResponse(ensureValidResponse(response.data));
});
ipcMain.handle("tg-search-resources", async (_event, keyword, page, limit, options) => {
  const body = {
    ...buildSearchBody(keyword, page, limit),
    ...options
  };
  const response = await API_CLIENT.post("/search", body);
  return normalizeFeedResponse(ensureValidResponse(response.data));
});
ipcMain.handle("tg-get-patch-detail", async (_event, uniqueId) => {
  console.log(`[IPC] Fetching detail for: ${uniqueId}`);
  if (!uniqueId || uniqueId.length !== 8) {
    console.error(`[IPC] Invalid uniqueId: ${uniqueId}`);
    throw new Error("Invalid resource ID (must be 8 characters)");
  }
  try {
    const [detailResponse, introResponse] = await Promise.all([
      API_CLIENT.get("/patch", { params: { uniqueId } }),
      API_CLIENT.get("/patch/introduction", { params: { uniqueId } })
    ]);
    const detailData = ensureValidResponse(detailResponse.data);
    const detail = normalizeResource(detailData);
    const downloadsResponse = await API_CLIENT.get("/patch/resource", {
      params: { patchId: detail.id }
    });
    const downloads = normalizeDownloads(ensureValidResponse(downloadsResponse.data));
    return {
      ...detail,
      ...ensureValidResponse(introResponse.data),
      // In case intro has more fields
      downloads
    };
  } catch (error) {
    console.error(`[IPC] Error in tg-get-patch-detail for ${uniqueId}:`, error);
    throw error;
  }
});
ipcMain.handle("tg-get-patch-introduction", async (_event, uniqueId) => {
  const response = await API_CLIENT.get("/patch/introduction", { params: { uniqueId } });
  const payload = ensureValidResponse(response.data);
  return {
    introduction: payload.introduction ?? null,
    releasedDate: payload.released ?? null,
    alias: payload.alias ?? [],
    tags: (payload.tag ?? []).map((item) => item == null ? void 0 : item.name).filter((tag) => Boolean(tag)),
    company: (payload.company ?? []).map((item) => item == null ? void 0 : item.name).filter(Boolean).join(", ") || null,
    vndbId: payload.vndbId ?? null,
    bangumiId: payload.bangumiId ?? null,
    steamId: payload.steamId != null ? String(payload.steamId) : null
  };
});
ipcMain.handle("tg-fetch-captcha", async () => {
  const response = await API_CLIENT.get("/auth/captcha");
  return ensureValidResponse(response.data);
});
ipcMain.handle("tg-login", async (_event, username, password, captcha) => {
  const response = await API_CLIENT.post("/auth/login", {
    name: username,
    password,
    captcha
  });
  return ensureValidResponse(response.data);
});
app.whenReady().then(createWindow);
