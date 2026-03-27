import requests
import json

def compare_search():
    url = "https://www.touchgal.top/api/search"
    
    # 对比 1 和 3
    variations = [
        ("复杂的 JSON 数组", json.dumps([{"type": "keyword", "name": "妹妹"}])),
        ("简单的字符串列表", json.dumps(["妹妹"]))
    ]
    
    cookies = {"kun-patch-setting-store|state|data|kunNsfwEnable": "all"}
    headers = {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }

    for label, qs in variations:
        print(f"\n--- {label} ---")
        payload = {
            "queryString": qs,
            "limit": 10,
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
            resp = requests.post(url, json=payload, headers=headers, cookies=cookies, timeout=10)
            data = resp.json()
            if isinstance(data, str): data = json.loads(data)
            
            games = data.get("galgames", [])
            for i, g in enumerate(games, 1):
                print(f"{i}. {g.get('name')}")
        except:
            pass

if __name__ == "__main__":
    compare_search()
