import json
import os
import argparse
from touchgal.api import TouchGalAPI
from touchgal.downloader import DownloadEngine

def run_extract(api: TouchGalAPI, input_path: str, output_file: str):
    """从本地 JSON 收藏列表提取数字 ID 及元数据"""
    items = []
    if os.path.isdir(input_path):
        for filename in os.listdir(input_path):
            if filename.endswith(".json") and not filename.startswith(("_", "metadata", "game_details")):
                file_path = os.path.join(input_path, filename)
                with open(file_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    if isinstance(data, list): items.extend(data)
    else:
        with open(input_path, "r", encoding="utf-8") as f:
            items = json.load(f)

    results = []
    for i, item in enumerate(items, 1):
        title = item['title']
        uid = item['url'].split('/')[-1]
        print(f"[{i}/{len(items)}] 正在获取: {title}")
        
        # 简单清洗标题以提高搜索成功率
        search_title = title.split(" - ")[0].split(" 【")[0].strip()
        search_res = api.search_game(search_title)
        
        # 尝试匹配 unique_id 以确保 ID 的唯一性
        numeric_id = next((g['id'] for g in search_res if g.get("uniqueId") == uid or g.get("unique_id") == uid), None)
        
        if numeric_id:
            results.append({
                "title": title, 
                "id": numeric_id, 
                "unique_id": uid, 
                "downloads": api.get_resources(numeric_id)
            })
    
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2, ensure_ascii=False)

def run_download(api: TouchGalAPI, input_file: str, workers: int):
    """根据提取出的详情文件进行批量下载"""
    if not os.path.exists(input_file):
        print(f"❌ 找不到详情文件: {input_file}")
        return

    with open(input_file, "r", encoding="utf-8") as f:
        items = json.load(f)
    
    tasks = []
    for item in items:
        # 自动提取 Windows 平台资源
        for dl in item.get('downloads', []):
            name = dl['name'].lower()
            if 'windows' in name or 'win' in name:
                tasks.append({
                    "title": f"{item['title']} - {dl['name']}",
                    "link": dl['link']
                })
    
    if not tasks:
        print("❌ 未在详情文件中发现符合条件的 Windows 下载项。")
        return

    print(f"🚀 开始批量下载，并发线程数: {workers}...")
    engine = DownloadEngine(max_workers=workers)
    engine.bulk_download(tasks, api.get_pan_direct_link)

def main():
    parser = argparse.ArgumentParser(description="TouchGal 资源自动化管理 CLI 工具")
    subparsers = parser.add_subparsers(dest="command", help="子命令: extract (提取) | download (下载)")

    # 提取阶段
    extract_p = subparsers.add_parser("extract", help="从 JSON 列表中提取数字 ID 与资源详情")
    extract_p.add_argument("--input", default=".", help="输入目录或 JSON 文件")
    extract_p.add_argument("--output", default="game_details.json", help="输出的详情 JSON 文件名")

    # 下载阶段
    download_p = subparsers.add_parser("download", help="批量多线程下载")
    download_p.add_argument("--input", default="game_details.json", help="extract 命令生成的详情文件")
    download_p.add_argument("--workers", type=int, default=4, help="并发下载线程数")

    args = parser.parse_args()
    api = TouchGalAPI(nsfw=True)

    if args.command == "extract":
        run_extract(api, args.input, args.output)
        print(f"✅ 提取完成，详情已保存至 {args.output}")
    elif args.command == "download":
        run_download(api, args.input, args.workers)
    else:
        parser.print_help()

if __name__ == "__main__":
    main()
