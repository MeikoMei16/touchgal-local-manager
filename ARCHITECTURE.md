# TouchGal Local Manager — Architecture & Feature Design

> Living document. Sections marked ✅ are implemented. Sections marked 🔲 are planned.

---

## 一、当前架构概览 ✅

```
Electron App
├── Main Process (Node.js)
│   ├── index.ts         — IPC Hub + API Proxy (CORS bypass) + data normalization
│   ├── db.ts            — SQLite (better-sqlite3) + FTS5 full-text search + delta sync
│   ├── downloader.ts    — Download task queue manager (singleton)
│   └── utils.ts         — Folder name sanitization, executable discovery
├── Preload (contextBridge)
│   └── index.ts         — window.api bridge (minimum surface, no nodeIntegration)
└── Renderer (React 19 + Vite + Zustand + Tailwind 4)
    ├── components/
    │   ├── Home.tsx             — Main game list + pagination + advanced filter trigger
    │   ├── FilterBar.tsx        — Three-tier filter panel (upstream/midstream/downstream)
    │   ├── ResourceCard.tsx     — Game card with stats
    │   ├── DetailOverlay.tsx    — Detail panel: tabs, rating histogram, screenshots, tags
    │   ├── Library.tsx          — Local library management
    │   ├── LoginModal.tsx       — Login + captcha flow
    │   ├── BlurredSection.tsx   — Auth-gated content blur wrapper
    │   ├── EvaluationSection.tsx
    │   ├── CommentSection.tsx
    │   └── ScreenshotGallery.tsx
    ├── store/useTouchGalStore.ts — Zustand global state (UI + auth + advanced pipeline)
    ├── data/TouchGalClient.ts    — Typed window.api wrapper
    ├── schemas/index.ts          — Zod response validation
    └── types/                    — TypeScript interfaces
```

---

## 二、三阶段数据管线 (Three-Stage Pipeline) ✅

### 核心设计原则

`/api/search` endpoint 的标签过滤结果不可靠，**禁止使用**。全部高级筛选通过数据管线实现。

### 数据流图

```
用户开启高级筛选
        │
        ▼
┌─────────────────────────────────────────────────────────┐
│  Stage 1 — Upstream (API)                               │
│  参数: nsfwMode, platform, minRatingCount               │
│  方式: GET /api/galgame?...  (并发 4 页流式拉取)        │
│  目标: 利用后端索引圈定候选池，减少本地处理量           │
└──────────────────────┬──────────────────────────────────┘
                       │ 流式逐页输出
                       ▼
┌─────────────────────────────────────────────────────────┐
│  Stage 2 — Midstream (local CPU, per-page, in-memory)   │
│  参数: yearConstraints, minRatingScore, minCommentCount  │
│  方式: 每页到达后立即过滤，通过的才进候选集             │
│  支持: 年份区间叠加 (e.g. >=2020 AND <=2024)           │
│  实时: 每页过滤完立即更新 UI，用户看到结果流入          │
└──────────────────────┬──────────────────────────────────┘
                       │ 候选集 (数量已大幅缩小)
                       ▼
┌─────────────────────────────────────────────────────────┐
│  Stage 3 — Downstream (tag enrichment, on-demand IO)    │
│  参数: selectedTags                                      │
│  触发: 仅当 selectedTags.length > 0 时运行              │
│  方式: 对候选集调用 getPatchIntroduction (并发 6)        │
│  效果: 50 个候选 → 50 次请求，而非全站扫描             │
│  实时: 每富化一条立即重新应用标签过滤                   │
└─────────────────────────────────────────────────────────┘
```

### 筛选字段层级归属

| 字段 | 层级 | 处理位置 | 说明 |
|---|---|---|---|
| `nsfwMode` | 上游 | API query param | SFW/NSFW/全部 |
| `selectedPlatform` | 上游 | API query param | Windows/Android/iOS 等 |
| `minRatingCount` | 上游 | API query param | 后端原生支持 |
| `yearConstraints` | 中游 | 本地内存 | 支持多约束叠加 (`>=`, `<=`, `=`, `>`, `<`) |
| `minRatingScore` | 中游 | 本地内存 | 读取 `ratingSummary.average` |
| `minCommentCount` | 中游 | 本地内存 | 读取 `commentCount` |
| `selectedTags` | 下游 | 详情 API + 本地 | 富化后本地匹配 |

### 关键实现细节

```typescript
// enterAdvancedMode — useTouchGalStore.ts

// Stage 1: upstream query
const upstreamQuery = { nsfwMode, selectedPlatform, minRatingCount }

// Stage 2: midstream predicate (pure function, zero IO)
const midstreamPass = (record) => {
  if (yearConstraints.length > 0) { /* range check */ }
  if (minRatingScore > 0 && record.averageRating < minRatingScore) return false
  if (minCommentCount > 0 && record.commentCount < minCommentCount) return false
  return true
}

// Stage 3: only runs if selectedTags.length > 0
// Enriches ONLY finalCandidates, not full catalog
await runBounded(finalCandidates, 6, async (resource) => {
  const intro = await TouchGalClient.getPatchIntroduction(resource.uniqueId)
  // update store, re-apply filter incrementally
})
```

### 上游变化时的 Advanced Mode 行为

| 情况 | 行为 |
|---|---|
| NSFW/Platform 变化，无 advanced 条件 | 直接 API 请求，退出 advanced mode |
| NSFW/Platform 变化，有 advanced 条件，domain 改变 | 不自动重建，等用户点「应用筛选」 |
| Advanced Ready 状态，仅中游/下游条件变化 | 本地重过滤，零网络 IO |

---

## 三、标签系统 ✅

### FilterBar 标签搜索

- **数据源**: `TAG_LIBRARY` — 内置 91 个热门标签，含使用量，定义在 `FilterBar.tsx` 文件顶层
- **搜索**: 150ms 防抖，本地 `.filter().sort(count desc).slice(12)` 匹配，零 API 请求
- **UI**: 搜索框 `onFocus` 开启建议列表，`onMouseDown + preventDefault` 解决 blur race condition
- **Dropdown**: `position: absolute + z-[100]`，父容器 `overflow-visible`，不会被截断

### DetailOverlay 标签点击

```
tag.onClick → store.addTagFilter(tagName) → clearSelected() → Home 激活标签过滤
```

### 标签库维护

标签数据来源为 TouchGal 官网，当前 91 条，按使用量排序。需要增加标签时直接编辑 `FilterBar.tsx` 顶部的 `TAG_LIBRARY` 数组。

---

## 四、详情页 ✅

### 标签页结构

| Tab | 内容 |
|---|---|
| 游戏信息 | 介绍、截图画廊、PV 视频、标签（可点击跳转过滤）、会社、外部 ID |
| 资源链接 | 下载资源列表（待实现） |
| 讨论版 | 评论区（登录后可见） |
| 游戏评价 | 评分直方图 + 推荐倾向 + 用户评价（部分登录后可见） |

### 评分直方图 (RatingHistogram) ✅

```
ratingSummary.average     → 综合评分大字显示
ratingSummary.count       → 评价人数 (toLocaleString 格式化)
ratingSummary.histogram[] → 横向条形图，按分数降序，颜色按区间
  9+ → emerald-500
  7+ → blue-500
  5+ → amber-400
  3+ → orange-400
  <3 → rose-500
ratingSummary.recommend   → 推荐倾向堆叠比例条 + 图例
```

**注意**: `ratingSummary.count` 是 `minRatingCount` 中游过滤的数据来源，必须从 API 的 `ratingSummary` 字段读取，而非 `averageRatingCount`（该字段不存在）。

### 登录墙 (BlurredSection)

```tsx
// 未登录时: 内容模糊 + 遮罩 + 引导登录
// 已登录时: 正常渲染
<BlurredSection isLoggedIn={isLoggedIn} title="用户评价">
  <EvaluationSection ... />
</BlurredSection>
```

评分直方图对所有用户可见（不需要登录），用户评价区需登录。

---

## 五、验证码与登录流程 ✅

### 修复的 Bug

**症状**: 验证码通过但邮箱/密码错误后，再次点击 NEXT 不会重新弹出验证码。

**根因**: `login()` 失败后调用 `fetchCaptcha()` 时，`captchaChallenge` 从旧值覆盖为新值（非 null→值），React `useEffect([captchaChallenge])` 无法检测到变化。

**修复**:
```typescript
// useTouchGalStore.ts — login action
} catch (err) {
  // 先置 null，再 fetch，确保 useEffect 能检测到变化
  set({ error: err.message, captchaUrl: null, captchaChallenge: null })
  await get().fetchCaptcha()
}
```

---

## 六、功能 3：下载链接解析与下载管理器 🔲

### 6.1 已验证：Cloudreve 直链提取

```typescript
// PUT /api/v3/share/download/{shareId}
// Response: { code: 0, data: "https://xxx.touchgaldownload.xyz/uploads/...?X-Amz-Signature=..." }
```

- 后端为 S3 兼容对象存储（Backblaze B2 / MinIO 类）
- 直链有效期 **1 小时**，必须在下载前实时获取

### 6.2 支持的链接类型

| 类型 | URL 格式 | 状态 |
|---|---|---|
| Cloudreve | `pan.touchgal.net/s/{shareId}` | ✅ 已验证解析方案 |
| 直链 | `https://xxx.zip` | 🔲 直接下载 |
| 百度网盘 | `pan.baidu.com/s/{id}` | 🔲 引导手动打开 |
| Mega | `mega.nz/...` | 🔲 引导手动打开 |
| OneDrive | `1drv.ms/...` | 🔲 引导手动打开 |

### 6.3 下载管理器设计

```
DownloadManager (src/main/downloader.ts) — 待完整实现
├── SQLite 持久化任务队列
│   └── status: queued|resolving|downloading|paused|completed|error
├── 下载引擎
│   ├── 断点续传 (Range header)
│   ├── 速度计算 (滑动窗口)
│   └── 进度推送 (webContents.send → ipcRenderer.on)
└── IPC 接口
    ├── tg-resolve-link, tg-add-download, tg-pause/resume/cancel/retry
    └── tg-get-queue, tg-set-save-path, tg-open-in-folder
```

---

## 七、功能 4：本地文件管理 🔲

### 下载后处理流程

```
下载完成 → 检测分卷 → Bandizip 解压 → FTS5 模糊匹配元数据 → 入库
```

### 分卷检测模式

| 格式 | 示例 |
|---|---|
| RAR 分卷 | `game.part1.rar`, `game.part2.rar` |
| ZIP 分卷 | `game.z01`, `game.z02`, `game.zip` |
| 7z 分卷 | `game.001`, `game.002` |

### 游戏匹配优先级

1. 压缩包内 `.tg_id` 文件 → 直接读取 `uniqueId`
2. 下载任务携带 `gameId` → 直接关联
3. SQLite FTS5 模糊匹配解压后文件夹名 → 候选列表供用户确认
4. 用户手动拖拽匹配

---

## 八、功能 5：Bandizip 批量解压 🔲

### Bandizip CLI 集成

```bash
bz.exe x -o:"D:\Games\output" -y "game.part1.rar"
# 只需传第一个分卷，Bandizip 自动处理其余
```

### 路径探测顺序

1. `C:\Program Files\Bandizip\bz.exe`
2. `C:\Program Files (x86)\Bandizip\bz.exe`
3. `%PROGRAMFILES%\Bandizip\bz.exe`
4. `where bz.exe` (PATH 查找)

---

## 九、设置页面 (Settings.tsx) 🔲

配置持久化到 `userData/settings.json`，通过 `tg-get-settings` / `tg-set-settings` IPC 读写。

### 分区与字段

| 分区 | 关键字段 |
|---|---|
| **账户** | 登录状态展示 + 退出登录 |
| **存储与路径** | `downloadDir`, `libraryRoots`, `bandizipPath`, `afterExtract` |
| **下载行为** | `maxConcurrentDownloads`, `autoExtractAfterDownload`, `autoMatchAfterExtract`, `downloadSpeedLimit` |
| **浏览与显示** | `defaultNsfwMode`, `defaultPageSize`, `defaultSortField`, `defaultPlatform` |
| **本地数据库** | 重建 FTS5 索引、清空记录、导出/导入 JSON |
| **高级** | `apiBaseUrl`, `requestTimeout`, `devMode`, `logLevel` |

影响主进程的设置（`apiBaseUrl`, `maxConcurrentDownloads`, `bandizipPath`）变更后需立即通知主进程生效，不能仅写文件。

---

## 十、实现优先级

| 优先级 | 功能 | 状态 |
|---|---|---|
| P0 | 三阶段数据管线 | ✅ 已完成 |
| P0 | 详情页评分直方图 | ✅ 已完成 |
| P0 | 标签搜索 (本地库) | ✅ 已完成 |
| P0 | 登录/验证码流程修复 | ✅ 已完成 |
| P1 | Cloudreve 直链下载 | 🔲 待实现 |
| P1 | 完整下载管理器 UI | 🔲 待实现 |
| P2 | 设置页面 | 🔲 待实现 |
| P2 | Bandizip 集成 + 解压队列 | 🔲 待实现 |
| P3 | 解压后游戏元数据自动匹配 | 🔲 待实现 |

---

## 十一、关键技术决策

1. **禁用 `/api/search` 做标签过滤** — 该端点返回的标签过滤结果不可靠。替代方案是三阶段管线的下游富化。

2. **Cloudreve 直链用 PUT** — `PUT /api/v3/share/download/{shareId}` 是令牌生成接口，必须用 PUT 而非 GET。

3. **下载进度用 `webContents.send`** — IPC handle 是请求-响应模型，无法持续推送。进度事件必须用主动推送。

4. **Bandizip 分卷只传第一个文件** — `bz.exe x` 命令会自动查找同目录其余分卷。

5. **标签过滤用本地库而非 API** — `/api/tag` 接口搜索质量有限，内置 TAG_LIBRARY 响应更快且零依赖。

6. **`ratingSummary.count` 是评价人数的正确来源** — `averageRatingCount` 字段不存在于 API 响应中。
