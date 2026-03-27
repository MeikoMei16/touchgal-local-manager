import requests
import json

def probe_search():
    url = "https://www.touchgal.top/api/search"
    query_string = json.dumps([{"type": "keyword", "name": "妹妹"}])
    
    payload = {
        "queryString": query_string,
        "limit": 10,
        "searchOption": {"searchInIntroduction": True, "searchInAlias": True, "searchInTag": True},
        "page": 1,
        "selectedType": "all",
        "selectedLanguage": "all",
        "selectedPlatform": "all",
        "sortField": "relevance", 
        "sortOrder": "desc",
        "selectedYears": ["all"],
        "selectedMonths": ["all"]
    }
    
    headers = {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Origin": "https://www.touchgal.top",
        "Referer": "https://www.touchgal.top/search"
    }
    
    cookies = {"kun-patch-setting-store|state|data|kunNsfwEnable": "all"}
    
    try:
        response = requests.post(url, json=payload, headers=headers, cookies=cookies, timeout=10)
        # 有些 API 返回的是字符串，需要二次反序列化
        raw_data = response.json()
        
        if isinstance(raw_data, str):
            data = json.loads(raw_data)
        else:
            data = raw_data
            
        print(f"数据解析成功，类型: {type(data)}")
        
        if isinstance(data, dict):
            galgames = data.get("galgames", [])
            print(f"找到 {len(galgames)} 个结果：\n")
            for i, game in enumerate(galgames[:10], 1):
                print(f"{i}. [{game.get('id')}] {game.get('name')}")
        elif isinstance(data, list):
            print(f"找到 {len(data)} 个结果（列表形式）：\n")
            for i, game in enumerate(data[:10], 1):
                print(f"{i}. [{game.get('id')}] {game.get('name')}")
                
    except Exception as e:
        print(f"发生错误: {e}")

if __name__ == "__main__":
    probe_search()
