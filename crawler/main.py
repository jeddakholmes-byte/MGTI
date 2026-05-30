import requests
import json
import os
import time
import random
from typing import List, Dict, Optional
from dataclasses import dataclass, asdict

# ==================== 配置部分 ====================
# Data Dragon CDN 基础地址
DD_BASE = "https://ddragon.leagueoflegends.com/cdn/15.5.1/data/zh_CN"
CHAMPION_LIST_URL = f"{DD_BASE}/champion.json"

# 英雄联盟宇宙 API 基础地址
UNIVERSE_BASE = "https://yz.lol.qq.com/v1/zh_cn"
SEARCH_API = f"{UNIVERSE_BASE}/search/index.json"
CHAMPION_API_TEMPLATE = f"{UNIVERSE_BASE}/champions/{{}}/index.json"

# 代理和请求配置
USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
]

# 请求延迟范围（秒）
MIN_DELAY = 0.5
MAX_DELAY = 1.5


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
    mbti: Optional[str] = None


def get_random_headers() -> Dict[str, str]:
    """获取随机 User-Agent 的请求头"""
    return {"User-Agent": random.choice(USER_AGENTS)}


def safe_request(url: str, retries: int = 3) -> Optional[Dict]:
    """安全发送 HTTP 请求，支持自动重试"""
    for attempt in range(retries):
        try:
            response = requests.get(url, headers=get_random_headers(), timeout=15)
            response.raise_for_status()
            return response.json()
        except requests.RequestException as e:
            print(f"  ⚠️  请求失败 (尝试 {attempt + 1}/{retries}): {e}")
            if attempt < retries - 1:
                time.sleep(2 ** attempt)  # 指数退避
    print(f"  ❌ 最终失败: {url}")
    return None


def get_champions_from_ddragon() -> Dict[str, str]:
    """
    从 Data Dragon 获取英雄中英文名称映射
    这是 Riot 官方提供的静态资源 API，稳定可靠
    """
    print("📋 [1/3] 从 Data Dragon 获取英雄列表...")
    data = safe_request(CHAMPION_LIST_URL)
    
    if not data or "data" not in data:
        print("  ❌ 获取英雄列表失败")
        return {}
    
    result = {}
    for key, info in data["data"].items():
        # key 是英雄英文 ID（如 "Ahri"），name 是中文名（如 "九尾妖狐"）
        result[info["name"]] = key
    
    print(f"  ✅ 共获取到 {len(result)} 个英雄")
    return result


def get_universe_champion_list() -> List[Dict]:
    """
    从英雄联盟宇宙 API 获取所有英雄列表
    返回 champions 数组，每个包含 slug（英文名）、name、title 等
    """
    print("\n📋 [2/3] 从英雄联盟宇宙获取完整英雄数据...")
    data = safe_request(SEARCH_API)
    
    if not data or "champions" not in data:
        print("  ❌ 获取英雄列表失败")
        return []
    
    # 注意：这里的 champions 字段包含所有英雄/角色，过滤掉非游戏英雄
    champions = data.get("champions", [])
    print(f"  ✅ 共获取到 {len(champions)} 个角色（含部分非游戏角色）")
    return champions


def get_champion_detail(slug: str) -> Optional[Dict]:
    """
    获取单个英雄的详细信息（包含背景故事）
    使用官方 API，返回 JSON 数据比解析 HTML 更稳定可靠！
    """
    url = CHAMPION_API_TEMPLATE.format(slug)
    data = safe_request(url)
    
    if not data or "champion" not in data:
        return None
    
    return data["champion"]


def extract_story_from_detail(detail: Dict) -> str:
    """
    从英雄详情 API 响应中提取背景故事
    API 返回的结构比解析 HTML 稳定得多！
    """
    if not detail:
        return "暂无故事数据"
    
    # 优先取 biography.full（完整传记）
    biography = detail.get("biography", {})
    if biography.get("full"):
        return biography["full"]
    
    # 备选：取 concise 简介
    if biography.get("concise"):
        return biography["concise"]
    
    # 兜底：从多个段落拼接
    story_parts = []
    if "lore" in detail and detail["lore"]:
        story_parts.append(detail["lore"])
    if "quote" in detail and detail["quote"]:
        story_parts.append(f'"{detail["quote"]}"')
    
    # 如果有关联故事区域
    associated = detail.get("associated", [])
    for story in associated:
        if story.get("description"):
            story_parts.append(story["description"])
    
    return "\n\n".join(story_parts) if story_parts else "暂无故事数据"


def main():
    print("=" * 60)
    print("🌈 MGTI 英雄联盟英雄数据爬虫 (改进版)")
    print("使用官方 Data Dragon + 英雄联盟宇宙 API")
    print("=" * 60)
    
    # Step 1: 获取英雄名称映射
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
        slug = champion.get("slug")  # 英文名，如 "ahri"
        name = champion.get("name")  # 中文名，如 "阿狸"
        title = champion.get("title")
        
        if not slug:
            print(f"[{idx}/{total}] 跳过: {name or 'unknown'} (缺少 slug)")
            continue
        
        print(f"[{idx}/{total}] 正在处理: {name} ({slug})")
        
        # 从宇宙 API 获取详情
        detail = get_champion_detail(slug)
        time.sleep(random.uniform(MIN_DELAY, MAX_DELAY))  # 礼貌爬取
        
        # 提取故事
        story = extract_story_from_detail(detail) if detail else "暂无故事数据"
        
        # 获取角色标签
        tags = []
        if detail and "tags" in detail:
            tags = detail.get("tags", [])
        
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
            mbti=None,
        )
        champions_data.append(asdict(champ_obj))
        
        # 进度提示
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