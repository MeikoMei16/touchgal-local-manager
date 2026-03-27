import { BrowserWindow as e, app as t, ipcMain as n } from "electron";
import r from "node:path";
import i from "node:fs";
import { fileURLToPath as a } from "node:url";
import o from "axios";
//#region electron/main.ts
var s = a(import.meta.url), c = r.dirname(s);
process.env.DIST = r.join(c, "../dist"), process.env.VITE_PUBLIC = t.isPackaged ? process.env.DIST : r.join(process.env.DIST, "../public");
var l, u = o.create({
	baseURL: "https://www.touchgal.top/api",
	headers: {
		"Content-Type": "application/json",
		"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
		Referer: "https://www.touchgal.top/",
		Origin: "https://www.touchgal.top"
	},
	timeout: 15e3
}), d = (e) => Array.isArray(e) ? e.filter(Boolean) : typeof e == "string" && e.trim() ? [e] : [], f = (e) => Array.isArray(e.tags) && e.tags.length > 0 ? e.tags.filter(Boolean) : Array.isArray(e.tag) ? e.tag.map((e) => e?.tag?.name ?? e?.name).filter((e) => !!e) : [], p = (e) => {
	let t = e._count ?? {}, n = d(e.platform), r = d(e.language), i = typeof e.company == "string" ? e.company : Array.isArray(e.company) ? e.company.map((e) => e?.name).filter(Boolean).join(", ") : null;
	return {
		id: e.id ?? 0,
		uniqueId: e.uniqueId ?? e.unique_id ?? "",
		name: e.name ?? "Unknown title",
		banner: e.banner ?? null,
		platform: n.join(", "),
		language: r.join(", "),
		releasedDate: e.releasedDate ?? e.released ?? null,
		averageRating: e.averageRating ?? e.rating_stat?.avg_overall ?? 0,
		tags: f(e),
		alias: e.alias ?? [],
		favoriteCount: t.favorite_folder ?? 0,
		resourceCount: t.resource ?? 0,
		commentCount: t.comment ?? 0,
		introduction: e.introduction ?? null,
		company: i,
		vndbId: e.vndbId ?? e.vndb_id ?? null,
		bangumiId: e.bangumiId ?? e.bangumi_id ?? null,
		steamId: e.steamId == null ? e.steam_id == null ? null : String(e.steam_id) : String(e.steamId),
		contentLimit: e.contentLimit ?? null
	};
}, m = (e) => e.map((e) => ({
	id: e.id ?? 0,
	name: e.name ?? "Unnamed resource",
	size: e.size ?? null,
	url: e.url ?? e.content ?? null
})), h = (e) => ({
	list: (e.galgames ?? []).map(p),
	total: e.total ?? 0
}), g = (e, t, n) => ({
	queryString: JSON.stringify([{
		type: "keyword",
		name: e
	}]),
	limit: n,
	page: t,
	selectedType: "all",
	selectedLanguage: "all",
	selectedPlatform: "all",
	sortField: "created",
	sortOrder: "desc",
	selectedYears: ["all"],
	selectedMonths: ["all"],
	searchOption: {
		searchInIntroduction: !0,
		searchInAlias: !0,
		searchInTag: !0
	}
}), _ = (e) => {
	if (typeof e == "string") throw Error(e);
	if (Array.isArray(e)) {
		let t = e[0];
		throw t && typeof t == "object" && "message" in t ? Error(String(t.message)) : Error("TouchGal returned a validation error");
	}
	return e;
}, v = (e) => {
	let t = [];
	return e.forEach((e) => {
		i.existsSync(e) && i.readdirSync(e, { withFileTypes: !0 }).forEach((n) => {
			if (!n.isDirectory()) return;
			let a = r.join(e, n.name), o = r.join(a, ".tg_id");
			if (i.existsSync(o)) {
				let e = i.readFileSync(o, "utf8").trim();
				t.push({
					path: a,
					folderName: n.name,
					tg_id: e
				});
			} else t.push({
				path: a,
				folderName: n.name,
				tg_id: null
			});
		});
	}), t;
};
function y() {
	l = new e({
		icon: r.join(process.env.VITE_PUBLIC, "electron-vite.svg"),
		width: 1200,
		height: 800,
		titleBarStyle: "hiddenInset",
		autoHideMenuBar: !0,
		webPreferences: { preload: r.join(c, "preload.mjs") }
	}), l.webContents.on("did-finish-load", () => {
		l?.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
	}), process.env.VITE_DEV_SERVER_URL ? (l.loadURL(process.env.VITE_DEV_SERVER_URL), l.webContents.openDevTools()) : l.loadFile(r.join(process.env.DIST || "", "index.html"));
}
t.on("window-all-closed", () => {
	process.platform !== "darwin" && (t.quit(), l = null);
}), t.on("activate", () => {
	e.getAllWindows().length === 0 && y();
}), n.handle("scan-local-library", (e, t) => v(t)), n.handle("tag-folder", (e, t, n) => {
	let a = r.join(t, ".tg_id");
	try {
		return i.writeFileSync(a, n, "utf8"), { success: !0 };
	} catch (e) {
		return {
			success: !1,
			error: e
		};
	}
}), n.handle("tg-fetch-resources", async (e, t, n, r) => h(_((await u.get("/galgame", { params: {
	page: t,
	limit: n,
	selectedType: r.selectedType ?? "all",
	selectedLanguage: r.selectedLanguage ?? "all",
	selectedPlatform: r.selectedPlatform ?? "all",
	sortField: r.sortField ?? "resource_update_time",
	sortOrder: r.sortOrder ?? "desc",
	yearString: r.yearString ?? ["all"],
	monthString: r.monthString ?? ["all"],
	minRatingCount: r.minRatingCount ?? 0,
	...r
} })).data))), n.handle("tg-search-resources", async (e, t, n, r, i) => {
	let a = {
		...g(t, n, r),
		...i
	};
	return h(_((await u.post("/search", a)).data));
}), n.handle("tg-get-patch-detail", async (e, t) => {
	console.log(`[IPC] Fetching detail for: ${t}`);
	try {
		let e = p(_((await u.get("/patch", { params: { uniqueId: t } })).data)), n = m(_((await u.get("/patch/resource", { params: { patchId: e.id } })).data));
		return {
			...e,
			downloads: n
		};
	} catch (e) {
		throw console.error(`[IPC] Error in tg-get-patch-detail for ${t}:`, e), e;
	}
}), n.handle("tg-get-patch-introduction", async (e, t) => {
	let n = _((await u.get("/patch/introduction", { params: { uniqueId: t } })).data);
	return {
		introduction: n.introduction ?? null,
		releasedDate: n.released ?? null,
		alias: n.alias ?? [],
		tags: (n.tag ?? []).map((e) => e?.name).filter((e) => !!e),
		company: (n.company ?? []).map((e) => e?.name).filter(Boolean).join(", ") || null,
		vndbId: n.vndbId ?? null,
		bangumiId: n.bangumiId ?? null,
		steamId: n.steamId == null ? null : String(n.steamId)
	};
}), n.handle("tg-fetch-captcha", async () => _((await u.get("/auth/captcha")).data)), n.handle("tg-login", async (e, t, n, r) => _((await u.post("/auth/login", {
	name: t,
	password: n,
	captcha: r
})).data)), t.whenReady().then(y);
//#endregion
