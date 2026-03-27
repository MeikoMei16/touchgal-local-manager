# TouchGal 资源自动化管理工具 (AstrBot Plugin)

这是一个专为 TouchGal 平台设计的资源管理与自动化下载工具，同时作为 AstrBot 插件运行。它能够从简单的游戏 URL 清单中自动提取详细的元数据、下载链接、解压密码，并支持多线程并发直连下载。

## 🚀 核心功能

*   **智能 ID 转换**：自动将前端 URL 的 `unique_id` 转换为 API 所需的数字 `patchId`。
*   **资源提取**：扫描指定目录下的所有 JSON 收藏清单，自动提取数字 ID 并关联所有下载资源。
*   **动态直链提取**：模拟网盘 PUT 请求，实时生成带签名的直链，绕过 1 小时时效限制。
*   **多线程下载引擎**：支持并发流式下载，带实时百分比进度条。
*   **AstrBot 集成**：支持通过机器人指令搜索、查询、下载 TouchGal 资源。

## 📦 安装与依赖

项目依赖于 Python 3.8+ 及以下第三方库：

```bash
pip install -r requirements.txt
```

## 🛠️ CLI 使用指南

该工具通过 `cli.py` 进行操作，分为 **提取 (Extract)** 和 **下载 (Download)** 两个阶段。

### 第一阶段：提取资源详情

扫描本地的 JSON 列表（如网页端导出的收藏），获取详细的数字 ID 和下载链接。

```bash
# 扫描当前目录下的所有 JSON 文件并合并提取
python cli.py extract --input . --output game_details.json
```

### 第二阶段：批量下载

使用提取到的详情文件进行多线程下载。

```bash
# 开启 8 个并发线程进行下载
python cli.py download --input game_details.json --workers 8
```

## 📂 项目结构

*   `touchgal/api.py`: 封装了 TouchGal 核心 API（搜索、资源获取、直链提取）。
*   `touchgal/downloader.py`: 多线程流式下载引擎。
*   `main.py`: AstrBot 插件入口。
*   `cli.py`: 命令行工具。
*   `dev/`: 开发辅助脚本与 API 探测工具。

## 🔗 相关项目

*   [TouchGal-Local-Manager](./TouchGal-Local-Manager): 专注于本地已下载 Galgame 资产管理（身份锁定、模糊检索）的独立项目。

## ⚠️ 注意事项

1.  **NSFW 内容**：工具默认启用 NSFW 模式，请确保在合规环境下使用。
2.  **频率限制**：如果遇到 `429 Too Many Requests`，请调低并发数或等待后重试。
