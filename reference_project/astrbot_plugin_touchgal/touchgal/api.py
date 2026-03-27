import requests
import json
import logging
from typing import List, Dict, Any, Optional

class TouchGalAPI:
    """TouchGal API 核心客户端，封装了搜索、资源获取及网盘直链提取功能。"""
    
    BASE_URL = "https://www.touchgal.top/api"
    PAN_URL = "https://pan.touchgal.net/api/v3"

    def __init__(self, nsfw: bool = True):
        self.nsfw = nsfw
        self.cookies = {
            "kun-patch-setting-store|state|data|kunNsfwEnable": "all" if nsfw else "sfw"
        }
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Content-Type": "application/json"
        }

    def search_game(self, keyword: str) -> List[Dict[str, Any]]:
        """
        通过关键词搜索游戏。
        
        Args:
            keyword: 搜索关键词。
            
        Returns:
            包含搜索结果的列表。
        """
        query_string = json.dumps([{"type": "keyword", "name": keyword}])
        payload = {
            "queryString": query_string,
            "limit": 5,
            "searchOption": {"searchInIntroduction": True, "searchInAlias": True, "searchInTag": True},
            "page": 1,
            "selectedType": "all",
            "selectedLanguage": "all",
            "selectedPlatform": "all",
            "sortField": "resource_update_time",
            "sortOrder": "desc",
            "selectedYears": ["all"],
            "selectedMonths": ["all"]
        }
        try:
            resp = requests.post(f"{self.BASE_URL}/search", json=payload, headers=self.headers, cookies=self.cookies, timeout=10)
            resp.raise_for_status()
            return resp.json().get("galgames", [])
        except Exception as e:
            logging.error(f"搜索失败: {e}")
            return []

    def get_resources(self, patch_id: int) -> List[Dict[str, Any]]:
        """
        通过数字 ID 获取下载资源列表。
        
        Args:
            patch_id: 游戏的数字 ID。
        """
        try:
            resp = requests.get(f"{self.BASE_URL}/patch/resource", params={"patchId": patch_id}, cookies=self.cookies, timeout=10)
            resp.raise_for_status()
            return resp.json()
        except Exception as e:
            logging.error(f"获取资源失败: {e}")
            return []

    def get_pan_direct_link(self, share_id: str) -> Optional[str]:
        """
        模拟点击下载按钮获取网盘直链。
        
        Args:
            share_id: 网盘分享 ID (如 P6kVTR)。
        """
        api_url = f"{self.PAN_URL}/share/download/{share_id}"
        headers = self.headers.copy()
        headers["Origin"] = "https://pan.touchgal.net"
        headers["Referer"] = f"https://pan.touchgal.net/s/{share_id}"
        
        try:
            # Cloudreve 必须使用 PUT 请求来生成直链
            resp = requests.put(api_url, headers=headers, timeout=10)
            if resp.status_code == 200:
                result = resp.json()
                if result.get("code") == 0:
                    return result.get("data")
        except Exception as e:
            logging.error(f"直链提取失败 {share_id}: {e}")
        return None
