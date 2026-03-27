from touchgal.api import TouchGalAPI
import json

def test_meimei_search():
    # 初始化 API，默认已开启 NSFW (all) 模式
    api = TouchGalAPI(nsfw=True)
    keyword = "妹妹"
    
    print(f"🔍 正在执行 NSFW 搜索，关键字: '{keyword}'...")
    results = api.search_game(keyword)
    
    if not results:
        print("❌ 未找到结果。")
        return

    print(f"✅ 成功找到 {len(results)} 个结果。前 5 个如下：\n")
    print(f"{'ID':<6} | {'Unique ID':<10} | {'游戏名称'}")
    print("-" * 60)
    
    for game in results[:5]:
        game_id = game.get("id")
        unique_id = game.get("uniqueId") or game.get("unique_id")
        name = game.get("name")
        print(f"{game_id:<6} | {unique_id:<10} | {name}")
        
        # 打印部分标签以确认 NSFW 内容是否可见
        tags = game.get("tags", [])
        if tags:
            print(f"       🏷️ 标签: {', '.join(tags[:5])}")
        print()

if __name__ == "__main__":
    test_meimei_search()
