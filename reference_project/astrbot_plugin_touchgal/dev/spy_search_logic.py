from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from webdriver_manager.chrome import ChromeDriverManager
import json
import time

def spy_touchgal_search():
    print("🚀 启动无头浏览器进行网络探测...")
    chrome_options = Options()
    chrome_options.add_argument("--headless")
    chrome_options.add_argument("--disable-gpu")
    chrome_options.add_argument("--window-size=1920,1080")
    chrome_options.add_argument("user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")

    driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=chrome_options)
    
    try:
        driver.get("https://www.touchgal.top/search")
        time.sleep(3)
        
        # 修正 JS 语法：使用 JSON.stringify
        driver.execute_script("localStorage.setItem('kun-patch-setting-store', JSON.stringify({'state': {'data': {'kunNsfwEnable': 'all'}}}))")
        driver.refresh() # 刷新以应用设置
        time.sleep(2)

        # 执行真实 API 请求
        script = """
        return fetch('https://www.touchgal.top/api/search', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                "queryString": JSON.stringify(["妹妹"]),
                "limit": 10,
                "searchOption": {"searchInIntroduction": true, "searchInAlias": true, "searchInTag": true},
                "page": 1,
                "selectedType": "all",
                "selectedLanguage": "all",
                "selectedPlatform": "all",
                "sortField": "relevance",
                "sortOrder": "desc",
                "selectedYears": ["all"],
                "selectedMonths": ["all"]
            })
        }).then(r => r.json());
        """
        print("\n🚀 执行浏览器端 API 请求...")
        api_data = driver.execute_script(script)
        
        if isinstance(api_data, str):
            api_data = json.loads(api_data)
        
        if isinstance(api_data, dict):
            games = api_data.get("galgames", [])
            print(f"✅ 找到 {len(games)} 个结果：")
            for i, g in enumerate(games[:10], 1):
                print(f"{i}. [{g.get('id')}] {g.get('name')}")
        else:
            print(f"返回结果非字典: {api_data}")
        
    except Exception as e:
        print(f"探测出错: {e}")
    finally:
        driver.quit()

if __name__ == "__main__":
    spy_touchgal_search()
