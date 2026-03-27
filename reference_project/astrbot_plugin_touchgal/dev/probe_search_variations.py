import requests
import json

def probe_search_variations():
    url = "https://www.touchgal.top/api/search"
    
    # 尝试多种 queryString 格式
    variations = [
        # 1. 之前 main.py 推荐的格式
        json.dumps([{"type": "keyword", "name": "妹妹"}]),
        # 2. 纯字符串
        "妹妹",
        # 3. 简单的列表
        json.dumps(["妹妹"])
    ]
    
    cookies = {"kun-patch-setting-store|state|data|kunNsfwEnable": "all"}
    headers = {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }

    for i, qs in enumerate(variations, 1):
        print(f"\n--- 测试格式 {i}: {qs} ---")
        payload = {
            "queryString": qs,
            "limit": 5,
            "searchOption": {"searchInIntroduction": True, "searchInAlias": True, "searchInTag": True},
            "page": 1,
            "selectedType": "all",
            "selectedLanguage": "all",
            "selectedPlatform": "all",
            "sortField": "resource_update_time", # 回到工作的字段测试
            "sortOrder": "desc",
            "selectedYears": ["all"],
            "selectedMonths": ["all"]
        }
        
        try:
            resp = requests.post(url, json=payload, headers=headers, cookies=cookies, timeout=10)
            data = resp.json()
            # 解码字符串 JSON
            if isinstance(data, str): data = json.loads(data)
            
            if isinstance(data, dict):
                count = len(data.get("galgames", []))
                print(f"结果数: {count}")
                if count > 0:
                    print(f"首个结果: {data['galgames'][0].get('name')}")
            elif isinstance(data, list):
                print(f"列表长度: {len(data)}")
                if len(data) > 0 and isinstance(data[0], dict):
                    print(f"首个结果: {data[0].get('name')}")
            else:
                print(f"未知结构: {data}")
        except Exception as e:
            print(f"测试失败: {e}")

if __name__ == "__main__":
    probe_search_variations()
