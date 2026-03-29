import json
import time
import os
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service

try:
    from webdriver_manager.chrome import ChromeDriverManager
    USE_MANAGER = True
except ImportError:
    USE_MANAGER = False

def inspect_page():
    print(f"\n{'='*20} PAGE-LEVEL SCAN: /galgame {'='*20}")
    
    chrome_options = Options()
    chrome_options.add_argument("--headless")
    chrome_options.add_argument("--disable-gpu")
    chrome_options.add_argument("--window-size=1920,1080")
    chrome_options.add_argument("user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")

    if USE_MANAGER:
        driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=chrome_options)
    else:
        driver = webdriver.Chrome(options=chrome_options)
    
    try:
        # Step 1: Visit the page UI
        URL = "https://www.touchgal.top/galgame"
        print(f"Navigating to: {URL}")
        driver.get(URL)
        time.sleep(10) # Heavy page, wait for Next.js to hydrate and data to load
        
        # Step 2: Try to find data in __NEXT_DATA__ (if SSR)
        try:
            next_data_script = driver.find_element("id", "__NEXT_DATA__").get_attribute("innerHTML")
            next_data = json.loads(next_data_script)
            with open("dev/next_data.json", "w", encoding="utf-8") as f:
                json.dump(next_data, f, indent=2, ensure_ascii=False)
            print("Successfully dumped __NEXT_DATA__ to dev/next_data.json")
        except:
            print("__NEXT_DATA__ not found (maybe CSR-only).")

        # Step 3: Capture the current data from the main fetch
        # We can execute a script to intercept the current state if it's stored globally,
        # or we can look at the DOM.
        
        cards = driver.find_elements("css selector", "div.flex.flex-col.gap-2")
        print(f"Found {len(cards)} cards on the page.")
        
        for i, card in enumerate(cards[:10]): # Scan first 10
            try:
                title = card.find_element("css selector", "div.text-sm.font-bold").text
                print(f"[{i}] {title}")
                # Try to find stats text
                stats = card.text.split('\n')
                print(f"   Stats: {stats}")
            except:
                pass

        # Step 4: Perform a manual fetch in the browser context to see the EXACT JSON
        print("\nExecuting manual fetch to /api/galgame in browser context...")
        script = """
        return fetch('/api/galgame?page=1&limit=24').then(res => res.json());
        """
        api_data = driver.execute_script(script)
        with open("dev/api_browser_fetch.json", "w", encoding="utf-8") as f:
            json.dump(api_data, f, indent=2, ensure_ascii=False)
        print("Successfully captured browser-context API response to dev/api_browser_fetch.json")
        
        if "galgames" in api_data:
            game = api_data["galgames"][0]
            print("\nFirst Game (Raw API):")
            print(json.dumps(game, indent=2, ensure_ascii=False))

    except Exception as e:
        print(f"Error: {e}")
    finally:
        driver.quit()

if __name__ == "__main__":
    inspect_page()
