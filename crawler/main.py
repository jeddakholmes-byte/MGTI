import requests
import json
import os
import time
import random
import re
from typing import List, Dict, Optional
from dataclasses import dataclass, asdict

# ==================== 配置 ====================
# 腾讯官方API（用于头像、原画、基础信息）
HERO_LIST_API = "https://game.gtimg.cn/images/lol/act/img/js/heroList/hero_list.js"
HERO_DETAIL_API_TEMPLATE = "https://game.gtimg.cn/images/lol/act/img/js/hero/{}.js"

# 英雄联盟宇宙API（用于故事）
UNIVERSE_BASE = "https://yz.lol.qq.com/v1/zh_cn"
CHAMPION_API_TEMPLATE = f"{UNIVERSE_BASE}/champions/{{}}/index.json"

MIN_DELAY = 0.3
MAX_DELAY = 0.8

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
]

@dataclass
class Champion:
    id: str
    name: str
    title: str
    alias: str
    story: str
    roles: List[str]
    tags: List[str]
    release_date: str
    image_url: str
    splash_url: str
    mbti: Optional[str] = None

def get_random_headers() -> Dict[str, str]:
    return {"User-Agent": random.choice(USER_AGENTS)}

def safe_request(url: str, retries: int = 3) -> Optional[Dict]:
    for attempt in range(retries):
        try:
            response = requests.get(url, headers=get_random_headers(), timeout=15)
            response.raise_for_status()
            return response.json()
        except requests.RequestException as e:
            print(f"  ⚠️ 请求失败 (尝试 {attempt + 1}/{retries}): {e}")
            if attempt < retries - 1:
                time.sleep(2 ** attempt)
    print(f"  ❌ 最终失败: {url}")
    return None

def get_hero_list() -> List[Dict]:
    print("📋 [1/3] 从腾讯官方接口获取英雄列表...")
    data = safe_request(HERO_LIST_API)
    if not data or "hero" not in data:
        print("  ❌ 获取英雄列表失败")
        return []
    heroes = data.get("hero", [])
    print(f"  ✅ 共获取到 {len(heroes)} 个英雄")
    return heroes

def get_universe_story(alias: str) -> str:
    """从英雄联盟宇宙API获取故事（使用 yz.lol.qq.com）"""
    if not alias:
        return "暂无故事数据"
    url = CHAMPION_API_TEMPLATE.format(alias.lower())
    data = safe_request(url)
    if not data or "champion" not in data:
        return "暂无故事数据"
    champion_data = data["champion"]
    biography = champion_data.get("biography", {})
    story = biography.get("full") or biography.get("concise") or ""
    if story:
        # 清理可能存在的HTML标签，保留段落分隔
        story = re.sub(r'<br\s*/?>', '\n', story)
        story = re.sub(r'</p>', '\n', story)
        story = re.sub(r'<[^>]+>', '', story)
        story = re.sub(r'\n\s*\n', '\n\n', story)
        return story.strip()
    return "暂无故事数据"

def get_images_from_tencent(hero_detail: Dict, hero_alias: str) -> tuple:
    """从腾讯API详情中提取头像和原画URL"""
    skins = hero_detail.get("skins", [])
    if not skins:
        default_avatar = f"https://game.gtimg.cn/images/lol/act/img/champion/{hero_alias}.png"
        default_splash = f"https://game.gtimg.cn/images/lol/act/img/skin/big/{hero_alias}000.jpg"
        return default_avatar, default_splash

    classic = next((s for s in skins if s.get("isBase") == "1"), skins[0])
    avatar_url = classic.get("iconImg", "")
    splash_url = classic.get("mainImg", "")
    if not splash_url:
        splash_url = classic.get("chromaImg", "")
    if not avatar_url:
        avatar_url = f"https://game.gtimg.cn/images/lol/act/img/champion/{hero_alias}.png"
    if not splash_url:
        splash_url = f"https://game.gtimg.cn/images/lol/act/img/skin/big/{hero_alias}000.jpg"
    return avatar_url, splash_url

def main():
    print("=" * 60)
    print("🌈 MGTI 英雄联盟英雄数据爬虫 (混合版)")
    print("头像/原画来自腾讯API，故事来自英雄联盟宇宙API")
    print("=" * 60)
    
    heroes = get_hero_list()
    if not heroes:
        print("❌ 爬取终止")
        return
    
    total = len(heroes)
    champions_data = []
    
    print(f"\n📥 [2/3] 获取腾讯API详情（用于头像原画）...")
    print(f"📥 [3/3] 获取宇宙API故事...")
    print(f"共 {total} 个英雄\n")
    
    for idx, hero in enumerate(heroes, 1):
        hero_id = hero.get("heroId")
        name = hero.get("name")
        alias = hero.get("alias")  # 例如 "Annie"
        title = hero.get("title")
        roles = hero.get("roles", [])
        tags = hero.get("tags", [])
        release_date = hero.get("sellTime", "")
        
        if not hero_id:
            print(f"[{idx}/{total}] 跳过: {name}")
            continue
        
        print(f"[{idx}/{total}] 正在处理: {name} ({alias})")
        
        # 1. 从腾讯API获取详情（为了头像原画）
        detail = safe_request(HERO_DETAIL_API_TEMPLATE.format(hero_id))
        time.sleep(random.uniform(MIN_DELAY, MAX_DELAY))
        
        if detail:
            avatar_url, splash_url = get_images_from_tencent(detail, alias)
        else:
            avatar_url = f"https://game.gtimg.cn/images/lol/act/img/champion/{alias}.png"
            splash_url = f"https://game.gtimg.cn/images/lol/act/img/skin/big/{alias}000.jpg"
        
        # 2. 从宇宙API获取故事
        story = get_universe_story(alias)
        
        champ = Champion(
            id=hero_id,
            name=name,
            title=title or "",
            alias=alias or "",
            story=story,
            roles=roles,
            tags=tags,
            release_date=release_date,
            image_url=avatar_url,
            splash_url=splash_url,
            mbti=None
        )
        champions_data.append(asdict(champ))
        
        if idx % 20 == 0:
            print(f"  📊 进度: {idx}/{total} ({idx/total*100:.1f}%)")
    
    output_dir = os.path.join(os.path.dirname(__file__), "../data")
    os.makedirs(output_dir, exist_ok=True)
    output_path = os.path.join(output_dir, "champions.json")
    
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(champions_data, f, ensure_ascii=False, indent=2)
    
    print("\n" + "=" * 60)
    print(f"✅ 爬取完成！共 {len(champions_data)} 个英雄")
    print(f"📁 数据保存至: {output_path}")
    print("=" * 60)

if __name__ == "__main__":
    main()