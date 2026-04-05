[![中文](https://img.shields.io/badge/%E8%AF%AD%E8%A8%80-%E4%B8%AD%E6%96%87-blue?style=for-the-badge)](./README.md)
[![English Notes](https://img.shields.io/badge/Language-English-lightgrey?style=for-the-badge)](./README.zh-CN.md)

# TouchGal Local Manager

一个偏本地管理、偏桌面工作流的 TouchGal 客户端。

现在这个项目的重点已经不是“把网页搬进 Electron”，而是把 TouchGal 浏览、收藏、下载、解压、入库、打开目录这一整条链路做成真正可用的本地管理器。

## 现在能做什么

- 首页浏览、搜索、详情页、截图查看、评分评论查看
- TouchGal 官方资源直接在应用内加入下载队列
- 独立下载页，支持进度、暂停、恢复、重试、删除、批量选择、批量删真实文件
- 下载后自动解压，并把结果统一整理进 `library/`
- 自动识别可用解压器，优先 `Bandizip`，回退 `7-Zip`
- 支持递归解压内层压缩包，并在失败时给出明确提示
- 本地库支持标题/别名搜索、最近加入、最近打开、打开目录
- 本地游戏点击后可进入管理弹层，或按设置打开独立窗口
- 本地收藏夹与云端收藏夹并存，详情页和收藏页都能直接操作
- 设置页可配置下载目录、下载并发、递归解压层数、交互行为、维护动作
- 提供“清空数据库”和“清空缓存”两个独立维护入口

## 当前产品形态

这个项目现在已经形成了一个比较明确的使用流：

1. 在首页或搜索页找游戏
2. 在详情页或快速下载面板把官方资源加入下载
3. 下载文件先进入 `download/`
4. 自动解压后整理进入 `library/`
5. 在本地库里按游戏维度继续管理、打开目录、后续准备接更重的本地逻辑

当前默认目录模型：

- 原始压缩包: `download/`
- 解压后的本地库: `library/`
- 资源会尽量按游戏收敛，而不是散成一堆顶层压缩包和重复文件夹

## 功能重点

- 本地库优先，不再只是网页数据浏览器
- 下载、解压、入库是同一条链路，不是彼此断开的功能块
- 收藏分成本地与云端两套，分别服务“本机整理”和“账号同步”
- UI 已基本切成中文，操作面向日常使用而不是调试演示

## 快速开始

环境要求：

- Node.js 21.7+
- `pnpm`

启动开发环境：

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

## 文档

更细的实现说明、架构决策、数据流和当前难点都放在 `docs/`，README 不再展开技术细节。

- [docs/README.md](docs/README.md)
- [docs/architecture.md](docs/architecture.md)
- [docs/advanced-filter.md](docs/advanced-filter.md)
- [docs/decisions.md](docs/decisions.md)
- [docs/library-resource-pipeline-status.md](docs/library-resource-pipeline-status.md)
- [docs/styling.md](docs/styling.md)

## 致谢与免责声明

- Made with love by `Meiko Mei`
- 原站：<https://www.touchgal.top/>
- 项目仓库：<https://github.com/MeikoMei16/touchgal-local-manager>
- 请支持原站与原作者。本项目是开源且免费的第三方桌面工具，不是 TouchGal 官方客户端。
- 游戏资源、站点内容、接口数据、名称与相关归属，均应以原站及原权利人为准；本项目主要提供本地管理与桌面交互层。
- 本项目由 Linux.do 激励实现，成为可能。学 AI，上 L 站！真诚、友善、团结、专业，共建你我引以为荣之社区。

## 备注

- 仓库里的 `reference_project/` 只是参考材料，不属于主应用运行链路
- `README.zh-CN.md` 目前保留为补充说明页；主入口已经切到这个 `README.md`
