import requests
import json
import os
from bs4 import BeautifulSoup

# 英雄联盟国服英雄列表API
HERO_LIST_API = "https://yz.lol.qq.com/v1/zh_cn/search/index.json"
# 英雄联盟宇宙英雄详情基础URL
UNIVERSE_HERO_URL = "https://universe.leagueoflegends.com/zh_CN/story/champion/{}/"

def get_all_heroes():
    """获取所有英雄的基本信息"""
    try:
        response = requests.get(HERO_LIST_API, timeout=10)
        response.raise_for_status()
        data = response.json()
        return data.get('heroes', [])
    except Exception as e:
        print(f"获取英雄列表失败: {e}")
        return []

def get_hero_story(hero_name_en):
    """获取单个英雄的背景故事"""
    url = UNIVERSE_HERO_URL.format(hero_name_en)
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    try:
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, 'lxml')
        
        # 提取故事内容，适配英雄联盟宇宙页面结构
        story_selectors = [
            'div.sc-145c31b-1',
            'div.champion-story__content',
            'div[class*="story-content"]'
        ]
        
        story_content = None
        for selector in story_selectors:
            story_content = soup.select_one(selector)
            if story_content:
                break
        
        if story_content:
            return story_content.get_text(strip=True, separator='\n')
        
        return "暂无故事数据"
    except Exception as e:
        print(f"获取英雄 {hero_name_en} 故事失败: {e}")
        return "获取故事失败"

def main():
    print("=" * 50)
    print("MGTI 英雄联盟英雄数据爬虫")
    print("正在爬取英雄联盟宇宙官方英雄设定与故事...")
    print("=" * 50)
    
    heroes = get_all_heroes()
    if not heroes:
        print("未能获取到英雄列表，程序退出")
        return
    
    print(f"共找到 {len(heroes)} 个英雄")
    print("-" * 50)
    
    champions_data = []
    
    for idx, hero in enumerate(heroes):
        hero_id = hero.get('heroId')
        name = hero.get('name')
        title = hero.get('title')
        name_en = hero.get('alias')
        
        if not name_en:
            print(f"[{idx+1}/{len(heroes)}] 跳过无效英雄: {name}")
            continue
        
        print(f"[{idx+1}/{len(heroes)}] 正在处理: {name} ({name_en})")
        
        # 获取故事
        story = get_hero_story(name_en)
        
        # 整理数据
        champion = {
            "id": hero_id,
            "name": name,
            "title": title,
            "alias": name_en,
            "story": story,
            "roles": hero.get('roles', []),
            "mbti": None  # 后续可补充MBTI分类
        }
        
        champions_data.append(champion)
    
    # 保存数据
    output_dir = os.path.join(os.path.dirname(__file__), '../data')
    os.makedirs(output_dir, exist_ok=True)
    output_path = os.path.join(output_dir, 'champions.json')
    
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(champions_data, f, ensure_ascii=False, indent=2)
    
    print("-" * 50)
    print(f"数据爬取完成！")
    print(f"共成功处理 {len(champions_data)} 个英雄")
    print(f"数据已保存到: {output_path}")
    print("=" * 50)

if __name__ == "__main__":
    main()
