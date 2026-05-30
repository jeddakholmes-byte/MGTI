import requests
import json
import os
import time
import random
from typing import List, Dict, Optional
from dataclasses import dataclass, asdict

# ==================== 配置部分 ====================
# Data Dragon CDN 基础地址（Riot 官方静态资源）
DD_VERSION = "15.5.1"   # 可定期更新
DD_BASE = f"https://ddragon.leagueoflegends.com/cdn/{DD_VERSION}"
CHAMPION_LIST_URL = f"{DD_BASE}/data/zh_CN/champion.json"
# 头像 URL 模板（使用 ddragon 官方路径）
AVATAR_URL_TEMPLATE = f"{DD_BASE}/img/champion/{{}}.png"
# 原画 URL 模板（经典皮肤，索引0）
SPLASH_URL_TEMPLATE = "https://ddragon.leagueoflegends.com/cdn/img/champion/splash/{}_{}.jpg"

# 英雄联盟宇宙 API 基础地址
UNIVERSE_BASE = "https://yz.lol.qq.com/v1/zh_cn"
SEARCH_API = f"{UNIVERSE_BASE}/search/index.json"
CHAMPION_API_TEMPLATE = f"{UNIVERSE_BASE}/champions/{{}}/index.json"

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
    id: str
    name: str
    title: str
    alias: str
    story: str
    roles: List[str]
    tags: List[str]
    release_date: str
    image_url: str          # 头像 URL
    splash_url: str         # 原画 URL
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

def get_champions_from_ddragon() -> Dict[str, str]:
    """
    从 Data Dragon 获取英雄中英文名称映射和头像路径
    返回 { "中文名": "英文Key" } 例如 { "阿狸": "Ahri" }
    """
    print("📋 [1/3] 从 Data Dragon 获取英雄列表...")
    data = safe_request(CHAMPION_LIST_URL)
    if not data or "data" not in data:
        print("  ❌ 获取英雄列表失败")
        return {}
    result = {}
    for key, info in data["data"].items():
        # 注意：info["name"] 是中文名，例如 "阿狸"
        result[info["name"]] = key
    print(f"  ✅ 共获取到 {len(result)} 个英雄")
    return result

def get_universe_champion_list() -> List[Dict]:
    """从英雄联盟宇宙 API 获取所有英雄列表"""
    print("\n📋 [2/3] 从英雄联盟宇宙获取完整英雄数据...")
    data = safe_request(SEARCH_API)
    if not data or "champions" not in data:
        print("  ❌ 获取英雄列表失败")
        return []
    champions = data.get("champions", [])
    print(f"  ✅ 共获取到 {len(champions)} 个角色")
    return champions

def get_champion_detail(slug: str) -> Optional[Dict]:
    """获取单个英雄的详细信息（包含背景故事）"""
    url = CHAMPION_API_TEMPLATE.format(slug)
    data = safe_request(url)
    if not data or "champion" not in data:
        return None
    return data["champion"]

def extract_story_from_detail(detail: Dict) -> str:
    """从英雄详情中提取背景故事"""
    if not detail:
        return "暂无故事数据"
    biography = detail.get("biography", {})
    if biography.get("full"):
        return biography["full"]
    if biography.get("concise"):
        return biography["concise"]
    story_parts = []
    if "lore" in detail and detail["lore"]:
        story_parts.append(detail["lore"])
    if "quote" in detail and detail["quote"]:
        story_parts.append(f'"{detail["quote"]}"')
    associated = detail.get("associated", [])
    for story in associated:
        if story.get("description"):
            story_parts.append(story["description"])
    return "\n\n".join(story_parts) if story_parts else "暂无故事数据"

def build_image_urls(chinese_name: str, name_to_key: Dict[str, str]) -> tuple:
    """
    根据英雄中文名构造头像 URL 和原画 URL
    返回 (头像URL, 原画URL)
    """
    if chinese_name not in name_to_key:
        # 如果没有映射（例如新英雄尚未更新到ddragon），返回默认占位图
        default_avatar = "https://via.placeholder.com/120x120?text=No+Image"
        default_splash = "https://via.placeholder.com/1920x1080?text=No+Splash"
        return default_avatar, default_splash
    
    key = name_to_key[chinese_name]   # 例如 "Ahri"（首字母大写）
    avatar_url = AVATAR_URL_TEMPLATE.format(key)
    # 原画使用经典皮肤索引 0
    splash_url = SPLASH_URL_TEMPLATE.format(key, 0)
    return avatar_url, splash_url

def main():
    print("=" * 60)
    print("🌈 MGTI 英雄联盟英雄数据爬虫 (带插画版)")
    print("获取英雄故事 + 头像 + 原画链接")
    print("=" * 60)
    
    # Step 1: 获取英雄名称 -> DDragon key 映射
    name_to_key = get_champions_from_ddragon()
    if not name_to_key:
        print("❌ 爬取终止：无法获取英雄数据")
        return
    
    # Step 2: 获取宇宙 API 英雄列表
    universe_champions = get_universe_champion_list()
    if not universe_champions:
        print("❌ 爬取终止：无法获取英雄列表")
        return
    
    champions_data = []
    total = len(universe_champions)
    
    print(f"\n📥 [3/3] 开始爬取每个英雄的详细信息...")
    print(f"共 {total} 个角色，预计需要 {total * (MIN_DELAY + MAX_DELAY) / 2:.0f} 秒\n")
    
    for idx, champion in enumerate(universe_champions, 1):
        slug = champion.get("slug")      # 英文名（小写），如 "ahri"
        name = champion.get("name")      # 中文名，如 "阿狸"
        title = champion.get("title")
        
        if not slug:
            print(f"[{idx}/{total}] 跳过: {name or 'unknown'} (缺少 slug)")
            continue
        
        print(f"[{idx}/{total}] 正在处理: {name} ({slug})")
        
        # 从宇宙 API 获取详情
        detail = get_champion_detail(slug)
        time.sleep(random.uniform(MIN_DELAY, MAX_DELAY))
        
        # 提取故事
        story = extract_story_from_detail(detail) if detail else "暂无故事数据"
        
        # 获取角色标签
        tags = []
        if detail and "tags" in detail:
            tags = detail.get("tags", [])
        
        # 构造图片 URL
        avatar_url, splash_url = build_image_urls(name, name_to_key)
        
        # 构建英雄数据
        champ_obj = Champion(
            id=detail.get("id", "") if detail else "",
            name=name,
            title=title,
            alias=slug,
            story=story,
            roles=champion.get("roles", []),
            tags=tags,
            release_date=detail.get("release-date", "") if detail else "",
            image_url=avatar_url,
            splash_url=splash_url,
            mbti=None,
        )
        champions_data.append(asdict(champ_obj))
        
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
    print(f"📊 共处理: {len(champions_data)} 个英雄/角色")
    print(f"📁 数据保存至: {output_path}")
    print("=" * 60)

if __name__ == "__main__":
    main()