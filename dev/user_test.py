import requests
import json
import os

base_url = "https://www.touchgal.top/api"
uid = 372067
cookie = "kun-galgame-patch-moe-token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJ0b3VjaGdhbCIsImF1ZCI6InRvdWNoZ2FsX2FkbWluIiwidWlkIjozNzIwNjcsIm5hbWUiOiJtZWtvMjYyIiwicm9sZSI6MSwiaWF0IjoxNzc0ODE3NzA3LCJleHAiOjE3Nzc0MDk3MDd9.TXxkJHNKR2u8hlNbcohNjsPTuAOsSstuMA2ROVmu9eE"

headers = {
    "Cookie": cookie,
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Referer": "https://www.touchgal.top/",
    "Origin": "https://www.touchgal.top"
}

results = {}

def fetch(name, endpoint, params=None):
    try:
        url = f"{base_url}{endpoint}"
        response = requests.get(url, headers=headers, params=params, timeout=20)
        if response.status_code == 200:
            results[name] = response.json()
        else:
            results[name] = {"error": response.status_code, "text": response.text}
    except Exception as e:
        results[name] = {"exception": str(e)}

fetch("status_info", "/user/status/info", {"id": uid})
fetch("comments", "/user/profile/comment", {"uid": uid, "page": 1, "limit": 5})
fetch("resources", "/user/profile/resource", {"uid": uid, "page": 1, "limit": 5})
fetch("rating_guessed", "/user/profile/rating", {"uid": uid, "page": 1, "limit": 5})
fetch("patch_rating_guessed", "/user/profile/patch-rating", {"uid": uid, "page": 1, "limit": 5})
fetch("favorites", "/user/profile/favorite", {"uid": uid, "page": 1, "limit": 5})

with open("/tmp/api_results.json", "w", encoding="utf-8") as f:
    json.dump(results, f, indent=2, ensure_ascii=False)

print("Results saved to /tmp/api_results.json")
