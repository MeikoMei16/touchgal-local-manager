[![English](https://img.shields.io/badge/Language-English-lightgrey?style=for-the-badge)](./README.md)
[![中文](https://img.shields.io/badge/%E8%AF%AD%E8%A8%80-%E4%B8%AD%E6%96%87-blue?style=for-the-badge)](./README.zh-CN.md)

# TouchGal Local Manager

一个基于 Electron 的 TouchGal 桌面客户端，重点放在本地状态驱动的交互体验、高级首页筛选，以及后续可扩展的本地优先能力。

## 当前重点

- 通过 Electron 主进程中转上游 API
- 在主进程中统一处理 session / token 规范化
- 基于 React + Zustand 的渲染层状态管理
- 支持刷新恢复的应用级左侧导航状态
- 支持 hydration 感知的首页浏览状态持久化与恢复
- 基于本地目录管线的高级首页筛选与评分排序，并通过发售日期补全保证年份筛选正确性
- 独立的搜索页，支持关键词模糊搜索、范围开关和上游排序
- 搜索页 NSFW 域切换已接入主进程搜索中转
- 搜索页 `rating` 排序基于稳定候选集在本地重建，并显示过程进度与增量渲染
- 支持 checkpoint 的高级构建恢复，保留页面 / 资源级进度
- 首页资源卡片采用紧凑 3 标签、内联统计图标、右侧悬浮操作条和翻页回顶
- 详情页弹层支持介绍、提取后的截图 / PV、分组资源链接、评分、评论、session 感知门禁、可配置右键返回，以及 `Esc` 关闭
- 全屏截图查看器支持前后切换与键盘方向键导航
- 详情资源 metadata chips 已按字段归一为中文标签，并去除重复标签
- 详情资源类型已兼容上游枚举漂移，例如 `row` 会显示为 `生肉资源`
- 详情页链接面板现在会把 TouchGal 官方资源直接加入应用内下载队列，而社区资源仍然走外部链接
- 启动时会通过主进程 session 重新验证登录状态，而不是盲信渲染层持久化 user
- 主进程会同时持久化标准化 token 与上游认证 cookies，以提升重启后的登录恢复成功率
- 若启动恢复发现会话失效，会自动清理已过期的认证持久化数据
- 设置页支持交互偏好与下载目录配置
- 设置页现已支持 Library 管理入口模式切换，以及“清空数据库 / 清空缓存”两个独立维护动作
- 独立 Favorites 页面，并行展示“本地收藏夹”和“云端收藏夹”
- 详情页收藏菜单支持免登录加入 / 移出本地收藏夹
- 云端收藏夹已支持点开并分页查看收藏内容
- 首页卡片与收藏卡片都支持官方资源 quick download 弹层
- 独立 Downloads 页面支持持久化逐文件队列、进度、暂停 / 恢复 / 重试、完成清理、批量选择，以及删除当前下载根目录下的真实文件
- 基于 SQLite 的本地下载队列，支持 Cloudreve 直链解析、预签名对象下载与并发 worker
- Library 页面会自动把 `library/` 设为默认监控根目录，并采用以本地游戏为主的布局，支持卡片级打开目录、启动游戏，以及 unresolved / orphaned / broken 的集中提示
- 下载队列支持主进程 push 更新，设置页支持下载并发数与解压器状态显示

## 技术栈

- Electron 41
- electron-vite 5
- Vite 7
- React 19
- Zustand 5
- Tailwind CSS 4
- better-sqlite3

## 开发

环境要求：

- 建议使用 Node.js 21.7+（适配当前 Vite 工具链）
- pnpm

安装并运行：

```bash
pnpm install
pnpm dev
```

常用命令：

```bash
pnpm typecheck
pnpm lint
pnpm build
```

平台构建：

- `pnpm build:win`
- `pnpm build:linux`

## 本机构建

本地开发运行：

```bash
pnpm install
pnpm dev
```

产出生产构建：

```bash
pnpm exec electron-vite build
```

构建 Windows 64 位安装包：

```bash
pnpm build:win
```

当前 Windows 目标产物是 NSIS 的 `x64` 安装器 `.exe`，输出目录在 `release/0.0.0/`。

## 路线图

已实现 / 当前可用：

- 应用主区刷新恢复与左侧导航记忆
- 首页浏览与刷新恢复
- 独立搜索页，支持关键词范围开关和上游排序
- 搜索页 NSFW 模式切换（`仅 SFW` / `仅 NSFW` / `全部内容`）
- 搜索页 `rating` 排序通过本地候选集重建，带候选抓取 / 本地排序进度与增量分页
- 主进程 auth / session 中转
- 启动 session 重新验证，保证渲染层登录状态跟随真实主进程 token
- 主进程持久化 token 与认证 cookies，并在恢复失败时自动清理陈旧认证
- 高级首页筛选与本地评分排序管线
- 基于 SQLite + IPC 的本地收藏夹 CRUD 与独立 Favorites 页面
- 云端收藏夹内容接口 `/user/profile/favorite/folder/patch` 已接入
- checkpoint 式高级构建恢复，避免构建中翻页被强制打回第 1 页
- 首页卡片围绕 feed 级浏览数据重做，而不是伪装成 detail 卡片
- 详情页弹层支持评论、评分、截图、PV 提取、分组资源链接与 session 感知门禁
- 详情页官方资源下载按钮现在直接进入 Downloads，社区资源仍保持外链打开
- 详情页 `Esc` 键关闭与截图查看层级化关闭行为
- 全屏截图支持左右箭头和键盘左右键导航
- 详情资源 chips 已兼容上游 `row` 等枚举漂移，统一显示为 `生肉资源`
- 设置页可配置详情页右键行为
- 设置页可配置下载目录，默认压缩包落在项目根 `download/`，解压结果落在项目根 `library/`
- 首页 quick-download 仅展示 TouchGal 官方 `galgame` 资源，并显示完整 metadata chips，如 section/type/language/platform 与提取码 / 解压码
- 本地收藏卡片与云端收藏卡片支持 quick-download
- Downloads 页面支持持久化队列、进度、暂停 / 恢复 / 重试 / 删除 / 清空已完成、批量选择，以及删除当前下载目录下的真实文件
- Library 页面自动把 `library/` 设为默认监控根目录，支持原生目录选择、重扫、linked local-path 清单、打开本地目录、启动游戏，以及按 linked / needs attention / watched directories 分组
- 设置页可查看下载并发数与解压器检测状态；Downloads 页面改为主进程 push 驱动更新
- 设置页维护区已拆分出两个独立操作：`清空数据库` 与 `清空缓存`，两者分别确认、分别执行
- 解压器回退顺序为 `Bandizip -> 7-Zip`，密码探测当前仅尝试 `""` 与 `touchgal`
- Library 扫描现在是最多 3 层的有界递归，并把候选目录标记为 `linked`、`orphaned`、`unresolved`、`broken`
- 解压目标目录具备碰撞保护：若 `library/Game Name` 已存在，会自动分配 `Game Name (2)` 之类的新目录，而不会覆盖旧目录

仍在开发中：

- 更广泛地利用本地 metadata cache
- 更完善的本地优先 / 离线友好浏览路径
- 更深层的未知来源本地目录匹配仍然延后，当前仍以 `.tg_id` 为主链路

已知问题：

- 首页 `rating` 排序仍然受限于上游候选集完整性；本地高级管线能修复页序漂移与重复，但不能补回上游根本没返回的资源
- 搜索页 `rating` 排序虽然在本地重建，但完整性仍取决于底层非 rating 搜索候选集
- 首页 feed 卡片目前仍只显示 `/api/galgame` 返回的标签子集，更完整标签仍可能只存在于 `/api/patch/introduction`

持久化范围说明：

- SQLite 当前用于持久化“本地拥有权明确”的应用状态，而不是 browse/detail 元数据的主真相源
- 已落地的 SQLite 本地状态包括：本地收藏夹、下载队列与逐文件任务状态
- browse/detail 资源持久化仍有意延后，直到更完整的本地优先读取路径被明确
- 当前适合持久化的数据包括：渲染层 UI 恢复状态、主进程 auth/session 工件、本地收藏夹、下载任务、本地文件链接，以及未来的用户自有元数据

## 文档

- [docs/README.md](docs/README.md)
- [docs/architecture.md](docs/architecture.md)
- [docs/advanced-filter.md](docs/advanced-filter.md)
- [docs/decisions.md](docs/decisions.md)
- [docs/styling.md](docs/styling.md)

当前文档内容已覆盖：左侧导航刷新恢复、首页卡片交互设计、feed 与 detail 标签来源差异、首页 / 搜索页翻页回顶、首页状态重构、高级筛选行为、checkpoint 高级构建恢复、搜索页范围 / 排序 / NSFW 控件、搜索页评分排序可视化进度、基于本地目录管线的评分排序稳定化、主进程 session 中转规则、启动 session 重验证、认证 cookie 恢复 / 清理、本地收藏与云端收藏并行架构、云端收藏夹内容分页、首页与收藏页官方 quick-download 入口、详情页官方资源入队与社区资源外链分流、quick-download metadata chips 展示、下载目录设置、持久化并发下载队列、Downloads 批量选择与文件删除、当前 local-library 管理流程、`download/ -> library/` 解压默认行为、library-first 本地游戏管理、递归扫描分类、本地目录打开与启动支持、Library 管理入口的 popup / 独立窗口模式、设置页中“清空数据库 / 清空缓存”两种独立维护动作、解压器回退顺序与密码探测规则、上游下载类型归一（如 `row -> raw`）、全屏截图导航、详情页 `Esc` 行为，以及当前详情弹层包含 session-aware social gating 与登录后社交数据刷新在内的数据流。

Lint 说明：

- 仓库包含一个 `reference_project/` 目录作为参考材料；应用 lint 已排除该目录，因此 `pnpm lint` 聚焦当前 Electron 应用本身
