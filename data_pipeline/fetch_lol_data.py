import requests
import json
import os
import time

def get_latest_version():
    """获取当前 LOL 客户端的最新版本号"""
    url = "https://ddragon.leagueoflegends.com/api/versions.json"
    response = requests.get(url)
    response.raise_for_status()
    return response.json()[0]

def fetch_lol_champion_data(language="zh_CN"):
    """
    抓取并整理所有英雄的详细设定资料
    语言可选: zh_CN (简中), en_US (英文) 等
    """
    print("正在获取最新版本号...")
    version = get_latest_version()
    print(f"当前最新版本: {version}")

    # 获取所有英雄的简略列表 (为了拿到所有英雄的 ID)
    list_url = f"https://ddragon.leagueoflegends.com/cdn/{version}/data/{language}/champion.json"
    print("正在获取英雄列表...")
    list_response = requests.get(list_url)
    champions_dict = list_response.json()['data']
    
    all_champions_detailed = []
    total_champs = len(champions_dict)
    print(f"共发现 {total_champs} 位英雄，开始拉取详细设定...\n")

    # 遍历每个英雄，拉取其专属的详细接口
    for i, champ_id in enumerate(champions_dict.keys(), 1):
        detail_url = f"https://ddragon.leagueoflegends.com/cdn/{version}/data/{language}/champion/{champ_id}.json"
        
        try:
            detail_response = requests.get(detail_url)
            detail_data = detail_response.json()['data'][champ_id]
            
            # 整理我们需要的人格分析/设定资料
            champ_info = {
                "id": detail_data.get("id"),
                "name": detail_data.get("name"),           # 名字，如：亚索
                "title": detail_data.get("title"),         # 称号，如：疾风剑豪
                "tags": detail_data.get("tags"),           # 定位标签，如：['Fighter', 'Assassin']
                "lore": detail_data.get("lore"),           # 完整的背景故事 (重点分析数据)
                "allytips": detail_data.get("allytips"),   # 己方使用提示 (可以看出英雄的行动模式)
                "enemytips": detail_data.get("enemytips"), # 敌方应对提示
                "info": detail_data.get("info"),           # 官方难度/攻击/防御评级
            }
            
            all_champions_detailed.append(champ_info)
            print(f"[{i}/{total_champs}] 成功获取: {champ_info['name']} - {champ_info['title']}")
            
            # 稍微休眠，避免请求过快
            time.sleep(0.1)
            
        except Exception as e:
            print(f"获取 {champ_id} 数据时出错: {e}")

    # 保存到本地 JSON 文件
    output_filename = f"lol_champions_lore_{language}.json"
    with open(output_filename, 'w', encoding='utf-8') as f:
        json.dump(all_champions_detailed, f, ensure_ascii=False, indent=4)
    
    print(f"\n大功告成！所有详细数据已保存至 {output_filename}")

if __name__ == "__main__":
    # 你可以在这里把 "zh_CN" 改为 "en_US" 以获取英文版资料
    fetch_lol_champion_data("zh_CN")