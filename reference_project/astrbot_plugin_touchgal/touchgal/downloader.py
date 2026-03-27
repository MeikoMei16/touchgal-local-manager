import os
import requests
from tqdm import tqdm
from urllib.parse import unquote
import concurrent.futures
from typing import Dict, Any, List, Optional, Callable
import logging

class DownloadEngine:
    """多线程流式下载引擎，带实时进度监控。"""

    def __init__(self, output_dir: str = "output", max_workers: int = 4):
        self.output_dir = output_dir
        self.max_workers = max_workers
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
        if not os.path.exists(self.output_dir):
            os.makedirs(self.output_dir)

    def download_file(self, url: str, display_name: str) -> Optional[str]:
        """
        下载单个文件。
        
        Args:
            url: 动态获取的直链。
            display_name: 用于进度条显示的标题。
        """
        try:
            response = requests.get(url, headers=self.headers, stream=True, timeout=30)
            response.raise_for_status()

            cd = response.headers.get('content-disposition', '')
            if 'filename=' in cd:
                filename = unquote(cd.split('filename=')[-1].strip('"'))
            else:
                filename = unquote(url.split('/')[-1].split('?')[0])
            
            # 清理 Windows 非法文件名字符
            filename = "".join([c for c in filename if c not in '<>:"/\\|?*']).strip()
            save_path = os.path.join(self.output_dir, filename)
            
            total_size = int(response.headers.get('content-length', 0))
            
            with open(save_path, 'wb') as f:
                with tqdm(total=total_size, unit='B', unit_scale=True, desc=f" {display_name[:20]}", leave=False) as pbar:
                    for chunk in response.iter_content(chunk_size=1024*1024):
                        if chunk:
                            f.write(chunk)
                            pbar.update(len(chunk))
            
            return save_path
        except Exception as e:
            logging.error(f"下载失败 {display_name}: {e}")
            return None

    def bulk_download(self, task_list: List[Dict[str, Any]], link_resolver: Callable[[str], Optional[str]]):
        """
        并发执行下载任务。
        
        Args:
            task_list: 包含游戏标题和原始链接的字典列表。
            link_resolver: 一个接收 ShareID 并返回实时直链的回调函数。
        """
        with concurrent.futures.ThreadPoolExecutor(max_workers=self.max_workers) as executor:
            # 提交任务
            future_to_task = {}
            for task in task_list:
                share_id = task['link'].split("/")[-1]
                direct_url = link_resolver(share_id)
                if direct_url:
                    f = executor.submit(self.download_file, direct_url, task['title'])
                    future_to_task[f] = task['title']
                else:
                    print(f"[跳过] 无法生成直链: {task['title']}")

            for future in concurrent.futures.as_completed(future_to_task):
                title = future_to_task[future]
                result = future.result()
                if result:
                    print(f"✅ 完成下载: {title}")
                else:
                    print(f"❌ 下载中断: {title}")
