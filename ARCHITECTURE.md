# TouchGal Local Manager — 完整功能架构设计

> 本文件是所有后续开发的规划蓝图，涵盖待实现功能的技术方案、数据流设计和实现路径。

---

## 一、已有架构概览

```
Electron App
├── Main Process (Node.js)
│   ├── index.ts         — IPC Hub + API Proxy (绕过 CORS) + 数据标准化
│   ├── db.ts            — SQLite (better-sqlite3) + FTS5 全文搜索 + Delta Sync
│   ├── downloader.ts    — 下载任务队列管理器 (单例)
│   └── utils.ts         — 文件夹名清洗、可执行文件探测
├── Preload (contextBridge)
│   └── index.ts         — window.api 安全桥接，最小化 API 暴露
└── Renderer (React 19 + Vite + Zustand + Tailwind 4)
    ├── components/
    │   ├── Home.tsx         — 主页列表 + 分页
    │   ├── FilterBar.tsx    — 筛选面板 (平台/年份/NSFW/标签)
    │   ├── ResourceCard.tsx — 游戏卡片
    │   ├── DetailOverlay.tsx — 详情面板 (覆盖层)
    │   ├── Library.tsx      — 本地库管理
    │   ├── LoginModal.tsx   — 登录
    │   └── SortDropdown.tsx — 排序
    ├── store/useTouchGalStore.ts — Zustand 全局状态
    ├── data/TouchGalClient.ts   — window.api 强类型封装
    ├── schemas/index.ts         — Zod 响应验证
    └── types/                   — TypeScript 接口
```

---

## 二、功能 1：多标签过滤（主页 /galgame）

### 2.1 问题分析

TouchGal API `/api/galgame` 支持通过 `tagString` 参数传递标签列表（JSON 数组格式）进行服务端过滤。  
详情页标签已显示"X 个 galgame 使用了此标签"，点击标签应能触发主页的多标签过滤。

### 2.2 API 调用方式

```
GET /api/galgame?tagString=["萌系","学园"]&page=1&limit=24...
```

标签在 API 中以名称字符串数组传递，与 `/api/search` 的 `queryString` 格式不同，属于专用参数。

### 2.3 架构方案

#### 主进程 (`src/main/index.ts`)
- `tg-fetch-resources` IPC 接口新增 `tagString` 参数
- 将 `selectedTags: string[]` 序列化为 `JSON.stringify(tags)` 传入 API

#### 渲染进程

**FilterBar.tsx — 标签搜索与选择**
```
[当前状态] 标签区域有 UI 框架但"添加标签"按钮无功能

[目标实现]
1. 点击"添加标签"→ 弹出 TagSearchModal
2. TagSearchModal: 输入关键词 → 调用 GET /api/tag?name=xxx&limit=20
3. 返回标签列表 (含使用数量) → 展示为可选列表
4. 选中标签 → 加入 FilterBar selectedTags 状态
5. FilterBar 触发 onFilterChange → Home.tsx 重新请求
```

**DetailOverlay.tsx — 标签点击跳转**
```
[当前状态] 标签以静态药丸渲染，无交互

[目标实现]
标签点击 → 调用 store.addTagFilter(tagName) → 关闭详情面板 → 
Home 页面激活该标签过滤 → FilterBar 显示已选标签
```

#### 新增 IPC 接口
```typescript
// 主进程添加
ipcMain.handle('tg-search-tags', async (_event, keyword: string) => {
  const response = await API_CLIENT.get('/tag', { params: { name: keyword, limit: 20 } })
  return ensureValidResponse(response.data) // [{ id, name, count }]
})
```

#### Zustand Store 新增
```typescript
addTagFilter: (tag: string) => void   // 从详情页添加标签到主页筛选
clearDetailAndGoHome: () => void      // 关闭详情 + 激活标签筛选
```

---

## 三、功能 2：详情页完善

### 3.1 PV 视频未加载

**根本原因**: API `/api/patch` 返回的 `pvVideoUrl` 字段经 `normalizeResource` 后映射到了 `pvUrl`，但 API 实际字段名需核对。

**修复方案**:
```typescript
// normalizeResource 中确保映射
pvUrl: raw.pvVideoUrl ?? raw.pv_video_url ?? raw.pvUrl ?? null,
screenshots: raw.fullScreenshotUrls ?? raw.screenshots ?? [],
```

### 3.2 登录后才可见内容的模糊处理

**目标效果**: 未登录时，评论区和个人评价区域内容模糊 + 遮罩 + 引导登录按钮。

**架构方案**:

```tsx
// 新增 BlurredSection 组件
const BlurredSection: React.FC<{ isLoggedIn: boolean; title: string }> = ({ isLoggedIn, title, children }) => {
  if (isLoggedIn) return <section>{children}</section>
  return (
    <section className="relative">
      <div className="blur-sm pointer-events-none select-none opacity-40">{children}</div>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white/60 backdrop-blur-sm rounded-xl">
        <Lock size={24} />
        <span className="font-bold text-slate-600">登录后可查看{title}</span>
        <button onClick={openLogin} className="px-6 py-2 bg-blue-600 text-white rounded-xl font-bold">立即登录</button>
      </div>
    </section>
  )
}
```

**需要模糊的区域**:
- 用户评论列表 (`GET /api/patch/comment?patchId=xxx`)
- 用户个人评价留言
- 收藏操作按钮（改为提示登录）

**登录态管理**: `useTouchGalStore` 已有 `isLoggedIn` 状态，直接读取。

### 3.3 标签使用数量显示

详情页标签药丸点击后应支持跳转过滤（见功能1），标签悬停 tooltip 显示使用量（从 API tag 接口缓存）。

---

## 四、功能 3：下载链接解析与下载管理器

### 4.1 已知链接类型

| 存储类型 | URL 格式 | 解析方式 |
|---|---|---|
| **pan.touchgal.net** (Cloudreve) | `https://pan.touchgal.net/s/{shareId}` | `PUT /api/v3/share/download/{shareId}` → 返回 S3 预签名直链 |
| **百度网盘** | `https://pan.baidu.com/s/{id}` | 需要 Cookie + 复杂 API，暂列为手动打开 |
| **Mega** | `https://mega.nz/...` | 需要 mega.js SDK 解密，暂列为手动打开 |
| **OneDrive** | `https://1drv.ms/...` | 重定向后得直链，可尝试 HEAD 跟随 |
| **Google Drive** | `https://drive.google.com/...` | 需要 API Key，暂列为手动打开 |
| **直链** | `https://xxx.zip` | 直接下载 |

### 4.2 Cloudreve (pan.touchgal.net) 直链提取（已验证）

```typescript
// 主进程
async function resolveCloudreveLink(shareId: string): Promise<string | null> {
  const res = await axios.put(
    `https://pan.touchgal.net/api/v3/share/download/${shareId}`,
    null,
    {
      headers: {
        'Origin': 'https://pan.touchgal.net',
        'Referer': `https://pan.touchgal.net/s/${shareId}`,
        'User-Agent': '...'
      }
    }
  )
  if (res.data?.code === 0) return res.data.data  // S3 预签名 URL，有效期 1 小时
  return null
}
```

直链格式: `https://{random}.touchgaldownload.xyz/uploads/...?X-Amz-Signature=...&X-Amz-Expires=3600`

> **注意**: 直链有效期 **1 小时**，需在下载前实时获取，不能预先存储。

### 4.3 下载管理器完整架构

```
DownloadManager (src/main/downloader.ts) — 重构为完整管理器
├── 任务队列 (SQLite 持久化)
│   ├── id, gameId, gameName
│   ├── resourceName, storageType (cloudreve|baidu|mega|direct)
│   ├── shareId, rawUrl
│   ├── savePath (用户指定下载目录)
│   ├── status: queued|resolving|downloading|paused|completed|error
│   ├── progress (0-100), speed (bytes/s), eta (seconds)
│   ├── downloadedBytes, totalBytes
│   ├── filename (从 Content-Disposition 解析)
│   └── error (失败原因)
├── 下载引擎 (Node.js http/https + 分块)
│   ├── 串行队列 (同时最多 N 个并发，可配置)
│   ├── 支持断点续传 (Range: bytes=xxx- header)
│   ├── 速度计算 (滑动窗口平均)
│   └── 进度通过 IPC event 推送到渲染进程
└── IPC 接口
    ├── tg-resolve-link(rawUrl) → { directUrl, filename, size, type }
    ├── tg-add-download(taskParams) → taskId
    ├── tg-pause-download(taskId)
    ├── tg-resume-download(taskId)
    ├── tg-cancel-download(taskId)
    ├── tg-retry-download(taskId)
    ├── tg-get-queue() → DownloadTask[]
    ├── tg-set-save-path(path) — 设置全局下载目录
    └── tg-open-in-folder(taskId) — 打开文件所在目录
```

**进度推送** (主进程 → 渲染进程):
```typescript
// 主进程: 使用 webContents.send 推送进度事件
win.webContents.send('download-progress', { taskId, progress, speed, eta, downloadedBytes, totalBytes })

// 渲染进程: preload 注册监听
onDownloadProgress: (callback) => ipcRenderer.on('download-progress', (_, data) => callback(data))
```

### 4.4 下载管理器 UI

```
新增 Downloads.tsx 页面
├── 顶部状态栏: 正在下载 N 个 | 总速度 x MB/s | 队列 N 个
├── 任务列表
│   ├── 游戏 banner 缩略图 + 名称
│   ├── 资源名称 (如"PC 版汉化补丁 v1.2")
│   ├── 进度条 (带百分比和已下载/总大小)
│   ├── 速度 + 预计剩余时间
│   ├── 操作按钮: 暂停/继续 | 取消 | 打开文件夹
│   └── 状态标签: 解析中/下载中/已完成/失败
├── 已完成列表 (可折叠)
└── 设置: 下载目录 | 最大并发数
```

---

## 五、功能 4：本地文件管理机制

### 5.1 下载后的文件处理流程

```
下载完成
   │
   ├─→ 单文件 (.zip/.rar/.7z) ──────────→ [解压] → [命名匹配] → [入库]
   │
   └─→ 分卷压缩 (part1.rar, part2.rar) → [等待全部就绪] → [合并解压] → [命名匹配] → [入库]
```

### 5.2 分卷检测算法

```typescript
function detectParts(files: string[]): PartGroup[] {
  // 匹配模式:
  // game.part1.rar, game.part2.rar (RAR 分卷)
  // game.z01, game.z02, game.zip (ZIP 分卷)
  // game.001, game.002 (7z 分卷)
  const patterns = [
    /^(.+)\.part(\d+)\.rar$/i,
    /^(.+)\.r(\d+)$/i,       // .r00, .r01...
    /^(.+)\.z(\d{2})$/i,     // .z01, .z02...
    /^(.+)\.(\d{3})$/,       // .001, .002...
  ]
  // 分组逻辑: 按基础名称归组，检测是否完整 (part1 到 partN 连续)
}
```

### 5.3 文件名匹配与入库

解压后文件夹名称可能与游戏元数据不一致，需要匹配策略:

```
优先级 1: 压缩包内包含 .tg_id 文件 → 直接读取 uniqueId
优先级 2: 下载任务携带 gameId → 直接关联
优先级 3: SQLite FTS5 模糊匹配解压后的文件夹名 → 候选列表供用户确认
优先级 4: 用户手动拖拽匹配 (Library.tsx 已有基础框架)
```

### 5.4 本地库数据库 Schema (扩展)

```sql
-- 现有
CREATE TABLE games (id, unique_id, name, banner, ...);
CREATE TABLE local_paths (id, path, game_id, FOREIGN KEY(game_id));

-- 新增
CREATE TABLE download_files (
  id INTEGER PRIMARY KEY,
  task_id INTEGER,           -- 关联下载任务
  game_id INTEGER,           -- 关联游戏
  file_path TEXT NOT NULL,   -- 绝对路径
  file_type TEXT,            -- 'archive'|'extracted'|'executable'
  is_extracted INTEGER DEFAULT 0,
  extracted_path TEXT,       -- 解压目标路径
  FOREIGN KEY(game_id) REFERENCES games(id)
);

CREATE TABLE extraction_jobs (
  id INTEGER PRIMARY KEY,
  source_files TEXT,         -- JSON 数组，分卷文件路径列表
  target_dir TEXT,
  status TEXT,               -- 'pending'|'running'|'done'|'error'
  game_id INTEGER,
  created_at INTEGER
);
```

---

## 六、功能 5：Bandizip 批量解压集成

### 6.1 Bandizip CLI 能力

Bandizip 提供 `bz.exe` CLI 工具，支持完整的无头操作:

```bash
# 解压到指定目录
bz.exe x -o:"D:\Games\output" -y "D:\Downloads\game.part1.rar"

# 测试压缩包完整性
bz.exe t "D:\Downloads\game.part1.rar"

# 创建压缩包
bz.exe c "output.zip" "input_folder\"

# 分卷解压 (只需指定第一个分卷，Bandizip 自动处理其余)
bz.exe x -o:"D:\Games" -y "D:\Downloads\game.part1.rar"
```

### 6.2 Bandizip 路径探测

```typescript
// src/main/utils.ts 新增
async function findBandizip(): Promise<string | null> {
  const candidates = [
    'C:\\Program Files\\Bandizip\\bz.exe',
    'C:\\Program Files (x86)\\Bandizip\\bz.exe',
    process.env['PROGRAMFILES'] + '\\Bandizip\\bz.exe',
    process.env['PROGRAMFILES(X86)'] + '\\Bandizip\\bz.exe',
  ]
  for (const p of candidates) {
    if (fs.existsSync(p)) return p
  }
  // 尝试 PATH 查找
  try {
    const result = execSync('where bz.exe', { encoding: 'utf8' })
    return result.trim().split('\n')[0]
  } catch { return null }
}
```

### 6.3 解压队列管理器

```typescript
// src/main/extractor.ts (新文件)
class ExtractionManager {
  private queue: ExtractionJob[] = []
  private running = false

  async addJob(job: ExtractionJob): Promise<number>
  async processNext(): Promise<void>
  
  private async extractWithBandizip(job: ExtractionJob): Promise<void> {
    const bzPath = await findBandizip()
    if (!bzPath) throw new Error('Bandizip not found')
    
    // 对于分卷，只传第一个文件
    const firstFile = job.sourceFiles.sort()[0]
    
    return new Promise((resolve, reject) => {
      const child = spawn(bzPath, ['x', `-o:${job.targetDir}`, '-y', firstFile], {
        stdio: ['ignore', 'pipe', 'pipe']
      })
      
      child.stdout.on('data', (data) => {
        // 解析 Bandizip 输出的进度信息
        const match = data.toString().match(/(\d+)%/)
        if (match) {
          this.emitProgress(job.id, parseInt(match[1]))
        }
      })
      
      child.on('close', (code) => {
        if (code === 0) resolve()
        else reject(new Error(`bz.exe exited with code ${code}`))
      })
    })
  }
}
```

### 6.4 IPC 接口

```typescript
ipcMain.handle('bz-check-available', async () => {
  const path = await findBandizip()
  return { available: !!path, path }
})

ipcMain.handle('bz-test-archive', async (_event, filePath: string) => {
  // 验证压缩包完整性
})

ipcMain.handle('bz-extract', async (_event, job: ExtractionJobParams) => {
  return extractionManager.addJob(job)
})

ipcMain.handle('bz-extract-batch', async (_event, jobs: ExtractionJobParams[]) => {
  // 批量加入解压队列
  return Promise.all(jobs.map(j => extractionManager.addJob(j)))
})

ipcMain.handle('bz-get-queue', () => {
  return extractionManager.getQueue()
})
```

### 6.5 解压 UI

```
ExtractionPanel.tsx
├── Bandizip 状态检测条 (找到/未找到 + 路径显示)
├── 批量任务队列
│   ├── 源文件列表 (高亮显示分卷归组)
│   ├── 目标目录选择
│   ├── 完整性验证结果 (绿勾/红叉)
│   ├── 解压进度条
│   └── 完成后自动入库开关
├── 全局设置
│   ├── Bandizip 路径 (手动指定)
│   ├── 默认解压目录
│   ├── 解压完成后: 删除原压缩包 | 移入回收站 | 保留
│   └── 解压完成后: 自动匹配游戏元数据
└── 日志查看器 (滚动输出 bz.exe stdout)
```

---

## 七、新增文件清单

```
src/
├── main/
│   ├── index.ts          [修改] 新增标签搜索/下载解析 IPC
│   ├── downloader.ts     [重构] 完整下载管理器
│   ├── extractor.ts      [新建] Bandizip 解压管理器
│   └── utils.ts          [修改] findBandizip() + detectParts()
└── renderer/src/
    ├── components/
    │   ├── FilterBar.tsx     [修改] 标签搜索弹窗 + API 对接
    │   ├── DetailOverlay.tsx [修改] 标签点击跳转 + 模糊遮罩 + PV修复
    │   ├── Downloads.tsx     [新建] 下载管理器页面
    │   ├── ExtractionPanel.tsx [新建] 解压管理页面
    │   ├── TagSearchModal.tsx  [新建] 标签搜索弹窗
    │   └── BlurredSection.tsx  [新建] 登录墙模糊组件
    └── store/
        ├── useTouchGalStore.ts [修改] 下载队列状态 + 标签过滤状态
        └── useSettingsStore.ts [新建] 应用设置全局状态
```

---

## 八、设置页面 (Settings.tsx)

应用设置持久化到 Electron `app.getPath('userData')/settings.json`，通过 `tg-get-settings` / `tg-set-settings` IPC 读写。渲染进程维护 `useSettingsStore`（Zustand），启动时从主进程加载一次，之后本地实时更新。

### 8.1 设置分区与字段

#### 账户 (Account)
| 设置项 | 类型 | 说明 |
|---|---|---|
| 登录状态展示 | 只读 | 头像、用户名、登录时间；未登录时显示登录按钮 |
| 退出登录 | 按钮 | 清空 store.user + Cookie |

#### 存储与路径 (Storage & Paths)
| 设置项 | 类型 | 默认值 |
|---|---|---|
| `downloadDir` | 目录选择 | `~/Downloads/TouchGal` |
| `libraryRoots` | 目录列表（可增删）| `[]` — Library 扫描时默认使用全部 |
| `bandizipPath` | 文件选择 + 自动探测 | 自动探测，找不到则空 |
| `afterExtract` | radio | `keep` / `trash` / `delete` |
| 数据库路径 | 只读展示 + "打开目录"按钮 | `userData/touchgal.db` |

#### 下载行为 (Download)
| 设置项 | 类型 | 默认值 |
|---|---|---|
| `maxConcurrentDownloads` | slider 1-5 | `2` |
| `autoExtractAfterDownload` | 开关 | `true` |
| `autoMatchAfterExtract` | 开关 | `true` |
| `directLinkRefreshMode` | radio | `before_download`（下载前实时获取）/ `scheduled`（提前 30 分钟刷新） |
| `downloadSpeedLimit` | 数字输入 (KB/s, 0=不限) | `0` |

#### 浏览与显示 (Browse & Display)
| 设置项 | 类型 | 默认值 |
|---|---|---|
| `defaultNsfwMode` | radio | `safe` / `nsfw` / `all` |
| `defaultPageSize` | select | `12` / `24` / `48` |
| `defaultSortField` | select | `resource_update_time` |
| `defaultPlatform` | select | `all` |
| `defaultLanguage` | select | `all` |

这些值在 Home.tsx 初始化 FilterBar 时作为初始状态注入，用户可临时覆盖但不自动回写设置。

#### 本地数据库 (Local Database)
| 操作 | 类型 | 说明 |
|---|---|---|
| 重建 FTS5 索引 | 危险按钮（需确认）| `INSERT INTO games_fts(games_fts) VALUES('rebuild')` |
| 清空已完成下载记录 | 按钮 | 只删 `download_tasks WHERE status='done'` |
| 清空游戏目录缓存 | 危险按钮 | 清空 `games` 表，保留 `local_paths` 和 `personal_metadata` |
| 导出个人数据 | 按钮 | 将 `personal_metadata` / `collections` / `play_sessions` 导出为 JSON |
| 导入个人数据 | 按钮 | 从 JSON 恢复，冲突时 upsert |
| 数据库统计 | 只读 | 显示 games / local_paths / download_tasks 条数 + DB 文件大小 |

#### 高级 (Advanced)
| 设置项 | 类型 | 默认值 |
|---|---|---|
| `apiBaseUrl` | 文本输入 + 恢复默认按钮 | `https://www.touchgal.top/api` |
| `requestTimeout` | 数字输入 (秒) | `30` |
| `devMode` | 开关 | `false`，开启后显示 DevTools 入口 + 原始 API 响应查看器 |
| `logLevel` | select | `info` / `debug` / `verbose` |
| 打开日志文件 | 按钮 | 用 shell.openPath 打开 `userData/logs/` |

### 8.2 数据流

```
启动时:
  Main: 读 settings.json → 返回 SettingsObject
  Renderer: useSettingsStore.init(settings)

用户修改:
  Renderer: useSettingsStore.set(key, value) → 防抖 500ms → tg-set-settings(partial)
  Main: 深度合并到 settings.json

影响主进程的设置 (需立即通知主进程):
  apiBaseUrl / requestTimeout → 重建 API_CLIENT axios 实例
  bandizipPath → 更新 ExtractionManager.bzPath
  maxConcurrentDownloads → 更新 DownloadManager.concurrency
  downloadSpeedLimit → 更新 DownloadManager.speedLimit
```

### 8.3 新增文件

```
src/
├── main/
│   └── settings.ts          [新建] SettingsManager: 读写 settings.json, 提供 getSettings/patchSettings
├── renderer/src/
│   ├── components/
│   │   └── Settings.tsx     [新建] 设置页面 UI，分 tab 展示各分区
│   └── store/
│       └── useSettingsStore.ts [新建] Zustand settings 状态，启动时从主进程加载
```

### 8.4 Settings.json 默认值

```typescript
export interface AppSettings {
  // Storage
  downloadDir: string
  libraryRoots: string[]
  bandizipPath: string
  afterExtract: 'keep' | 'trash' | 'delete'
  // Download
  maxConcurrentDownloads: number
  autoExtractAfterDownload: boolean
  autoMatchAfterExtract: boolean
  directLinkRefreshMode: 'before_download' | 'scheduled'
  downloadSpeedLimit: number
  // Browse
  defaultNsfwMode: 'safe' | 'nsfw' | 'all'
  defaultPageSize: 12 | 24 | 48
  defaultSortField: string
  defaultPlatform: string
  defaultLanguage: string
  // Advanced
  apiBaseUrl: string
  requestTimeout: number
  devMode: boolean
  logLevel: 'info' | 'debug' | 'verbose'
}

export const DEFAULT_SETTINGS: AppSettings = {
  downloadDir: '',           // 运行时填充 app.getPath('downloads') + '/TouchGal'
  libraryRoots: [],
  bandizipPath: '',          // 运行时自动探测
  afterExtract: 'trash',
  maxConcurrentDownloads: 2,
  autoExtractAfterDownload: true,
  autoMatchAfterExtract: true,
  directLinkRefreshMode: 'before_download',
  downloadSpeedLimit: 0,
  defaultNsfwMode: 'safe',
  defaultPageSize: 24,
  defaultSortField: 'resource_update_time',
  defaultPlatform: 'all',
  defaultLanguage: 'all',
  apiBaseUrl: 'https://www.touchgal.top/api',
  requestTimeout: 30,
  devMode: false,
  logLevel: 'info',
}
```

---

## 九、实现优先级

| 优先级 | 功能 | 依赖 | 预估工作量 |
|---|---|---|---|
| P0 | Cloudreve 直链解析 + 基础下载 | — | 0.5 天 |
| P0 | DetailOverlay PV 修复 | — | 0.5 小时 |
| P1 | 标签搜索 API + FilterBar 对接 | — | 1 天 |
| P1 | 登录墙模糊组件 | LoginModal | 0.5 天 |
| P1 | 完整下载管理器 UI + 断点续传 | 直链解析 | 2 天 |
| P2 | Bandizip 集成 + 解压队列 | 下载管理器 | 1.5 天 |
| P2 | 分卷检测 + 自动归组 | 解压队列 | 1 天 |
| P2 | 设置页面 UI + SettingsManager | — | 1 天 |
| P3 | 解压后自动游戏元数据匹配 | FTS5 | 1 天 |

---

## 九、关键技术决策记录

1. **Cloudreve 直链用 PUT**: `PUT /api/v3/share/download/{shareId}` 是 Cloudreve 的令牌生成接口，必须用 PUT 而非 GET。直链有效期 1 小时，每次下载前必须实时获取。

2. **下载进度用 `webContents.send`**: 由于下载是持续推送，不能用 `ipcMain.handle`（请求-响应模式），必须用主动推送事件。

3. **分卷解压只传第一个文件**: Bandizip 的 `x` 命令会自动查找同目录下的其余分卷文件，无需手动指定所有分卷。

4. **标签过滤用服务端 API**: `/api/galgame` 支持 `tagString` 参数，优先服务端过滤而非本地过滤，避免拉取全量数据。

5. **解压后游戏匹配用 FTS5**: 本地 SQLite FTS5 索引已建立，模糊匹配解压后的文件夹名比依赖在线 API 更快更可靠。
