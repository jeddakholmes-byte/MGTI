import requests
import json
import os
import time
import random
from typing import List, Dict, Optional
from dataclasses import dataclass, asdict

# ==================== 配置 ====================
# 腾讯官方API
HERO_LIST_API = "https://game.gtimg.cn/images/lol/act/img/js/heroList/hero_list.js"
HERO_DETAIL_API_TEMPLATE = "https://game.gtimg.cn/images/lol/act/img/js/hero/{}.js"

# 请求延迟范围（秒）
MIN_DELAY = 0.3
MAX_DELAY = 0.8

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
]

@dataclass
class Champion:
    """英雄数据模型"""
    id: str                # 英雄ID (数字)
    name: str              # 英雄名称
    title: str             # 称号
    alias: str             # 英文ID (如 "Annie")
    story: str             # 背景故事
    roles: List[str]       # 定位 (如 ["法师", "刺客"])
    tags: List[str]        # 标签 (官方分类)
    release_date: str      # 上线日期
    image_url: str         # 头像URL
    splash_url: str        # 原画URL
    mbti: Optional[str] = None

def get_random_headers() -> Dict[str, str]:
    return {"User-Agent": random.choice(USER_AGENTS)}

def safe_request(url: str, retries: int = 3) -> Optional[Dict]:
    """安全发送请求，自动重试"""
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
    """获取所有英雄的基础信息（包含英雄ID、名称、alias等）"""
    print("📋 [1/2] 从腾讯官方接口获取英雄列表...")
    data = safe_request(HERO_LIST_API)
    if not data or "hero" not in data:
        print("  ❌ 获取英雄列表失败")
        return []
    heroes = data.get("hero", [])
    print(f"  ✅ 共获取到 {len(heroes)} 个英雄")
    return heroes

def get_hero_detail(hero_id: str) -> Optional[Dict]:
    """通过英雄ID获取详细信息（故事、皮肤、标签等）"""
    url = HERO_DETAIL_API_TEMPLATE.format(hero_id)
    data = safe_request(url)
    if not data or "hero" not in data:
        return None
    return data

def extract_story(hero_detail: Dict) -> str:
    """提取故事文本，清理HTML标签"""
    hero_info = hero_detail.get("hero", {})
    story = hero_info.get("story", "暂无故事数据")
    if story:
        # 简单清理HTML标签，保留段落分隔
        story = story.replace("<br>", "\n").replace("<br/>", "\n")
        story = story.replace("<p>", "").replace("</p>", "\n")
        # 移除其他可能的标签（可选）
        import re
        story = re.sub(r'<[^>]+>', '', story)
    return story.strip()

def get_images(hero_detail: Dict, hero_alias: str) -> tuple:
    """
    从详情中提取头像和原画URL
    优先使用经典皮肤（isBase == '1'）的图片
    返回 (image_url, splash_url)
    """
    skins = hero_detail.get("skins", [])
    if not skins:
        # 降级：使用基于alias的默认URL
        default_avatar = f"https://game.gtimg.cn/images/lol/act/img/champion/{hero_alias}.png"
        default_splash = f"https://game.gtimg.cn/images/lol/act/img/skin/big/{hero_alias}000.jpg"
        return default_avatar, default_splash

    # 查找经典皮肤 (isBase == '1')
    classic = next((s for s in skins if s.get("isBase") == "1"), skins[0])
    avatar_url = classic.get("iconImg", "")
    splash_url = classic.get("mainImg", "")
    
    # 若缺少原画，尝试使用 chromaImg
    if not splash_url:
        splash_url = classic.get("chromaImg", "")
    
    # 如果仍然没有，使用基于alias的默认URL
    if not avatar_url:
        avatar_url = f"https://game.gtimg.cn/images/lol/act/img/champion/{hero_alias}.png"
    if not splash_url:
        splash_url = f"https://game.gtimg.cn/images/lol/act/img/skin/big/{hero_alias}000.jpg"
    
    return avatar_url, splash_url

def main():
    print("=" * 60)
    print("🌈 MGTI 英雄联盟英雄数据爬虫 (腾讯官方API版)")
    print("获取英雄列表、故事、头像及原画")
    print("=" * 60)
    
    # Step 1: 获取英雄列表
    heroes = get_hero_list()
    if not heroes:
        print("❌ 爬取终止：无法获取英雄列表")
        return
    
    total = len(heroes)
    champions_data = []
    
    print(f"\n📥 [2/2] 开始获取每个英雄的详细信息...")
    print(f"共 {total} 个英雄，预计需要 {total * (MIN_DELAY + MAX_DELAY) / 2:.0f} 秒\n")
    
    for idx, hero in enumerate(heroes, 1):
        hero_id = hero.get("heroId")
        name = hero.get("name")
        alias = hero.get("alias")      # 英文ID，如 "Annie"
        title = hero.get("title")
        roles = hero.get("roles", [])  # 定位列表
        tags = hero.get("tags", [])    # 标签列表
        release_date = hero.get("sellTime", "")  # 上线时间
        
        if not hero_id:
            print(f"[{idx}/{total}] 跳过: {name} (缺少 heroId)")
            continue
        
        print(f"[{idx}/{total}] 正在处理: {name} ({alias})")
        
        # 获取详情
        detail = get_hero_detail(hero_id)
        time.sleep(random.uniform(MIN_DELAY, MAX_DELAY))
        
        if not detail:
            print(f"  ⚠️ 详情获取失败，使用基础数据")
            story = "暂无故事数据"
            avatar_url, splash_url = get_images({}, alias)
        else:
            story = extract_story(detail)
            avatar_url, splash_url = get_images(detail, alias)
        
        # 构建数据对象
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
    
    # 保存数据
    output_dir = os.path.join(os.path.dirname(__file__), "../data")
    os.makedirs(output_dir, exist_ok=True)
    output_path = os.path.join(output_dir, "champions.json")
    
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(champions_data, f, ensure_ascii=False, indent=2)
    
    print("\n" + "=" * 60)
    print(f"✅ 爬取完成！")
    print(f"📊 共处理: {len(champions_data)} 个英雄")
    print(f"📁 数据保存至: {output_path}")
    print("=" * 60)

if __name__ == "__main__":
    main()