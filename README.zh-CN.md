[![English](https://img.shields.io/badge/Language-English-lightgrey?style=for-the-badge)](./README.md)
[![中文](https://img.shields.io/badge/%E8%AF%AD%E8%A8%80-%E4%B8%AD%E6%96%87-blue?style=for-the-badge)](./README.zh-CN.md)

# TouchGal Local Manager

一个基于 Electron 的 TouchGal 桌面客户端，重点放在本地状态驱动的交互体验、高级首页筛选，以及后续可扩展的本地优先能力。

## 当前重点

- 通过 Electron 主进程中转上游 API
- 在主进程中统一处理 session / token 规范化
- 主进程同时持久化标准化 token 与上游认证 cookies，以提升重启后的登录恢复成功率
- 基于 React + Zustand 的渲染层状态管理
- 支持刷新恢复的首页浏览状态持久化
- 基于本地目录管线的高级首页筛选与评分排序，并通过发售日期补全保证年份筛选正确性
- 独立的 Favorites 页面，并行展示“本地收藏夹”和“云端收藏夹”
- 详情页收藏菜单支持免登录加入本地收藏夹
- 云端收藏夹现已支持点开并分页查看收藏内容
- 详情页弹层：游戏介绍、提取后的截图 / PV、分组资源链接、评分与评论
- 详情页右键返回行为，可在设置页中配置
- 早期阶段的本地 SQLite 与下载管理脚手架

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

- 首页浏览与刷新恢复
- 主进程 auth / session 中转
- 主进程认证持久化：token + cookies 恢复，以及失效会话自动清理
- 高级首页筛选与本地评分排序管线
- 本地收藏夹 CRUD 与并列云端收藏展示
- 云端收藏夹内容接口 `/user/profile/favorite/folder/patch` 已接入
- 详情页弹层：评论、评分、截图、PV 提取、分组资源链接
- 可在设置页中配置的详情页右键行为

仍在开发中：

- 更广泛地利用本地 metadata cache
- 超出当前脚手架 / 持久化层的完整 downloader 流程
- 更完善的本地优先 / 离线友好浏览路径

## 文档

- [docs/README.md](docs/README.md)
- [docs/architecture.md](docs/architecture.md)
- [docs/advanced-filter.md](docs/advanced-filter.md)
- [docs/decisions.md](docs/decisions.md)
- [docs/styling.md](docs/styling.md)

当前文档内容已覆盖：首页状态重构、高级筛选行为、基于本地目录管线的评分排序稳定化、主进程 session 中转规则、认证 cookies 持久化恢复、启动恢复失败后的失效认证清理策略、本地收藏与云端收藏并行架构、云端收藏夹内容分页加载，以及当前详情弹层的数据流。
