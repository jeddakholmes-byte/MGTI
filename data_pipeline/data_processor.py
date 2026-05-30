import os
import json
import time
from typing import List, Dict, Any
import google.generativeai as genai
from pydantic import BaseModel, Field

# =====================================================================
# 1. 配置与环境初始化
# =====================================================================
# 在运行此脚本前，请确保在环境变量中配置了你的 API Key：
# export GEMINI_API_KEY="你的实际API_KEY"
if "GEMINI_API_KEY" not in os.environ:
    print("【警告】: 未检测到 GEMINI_API_KEY 环境变量，请确保后续配置正确。")

genai.configure(api_key=os.environ.get("GEMINI_API_KEY"))

# =====================================================================
# 2. 定义高度结构化的心理学/MBTI数据模型 (Pydantic Schema)
# =====================================================================
class MbtiDimension(BaseModel):
    score: int = Field(..., description="该维度的倾向得分百分比，范围 0-100。例如在 E/I 轴中，分值越高代表内倾越极端的倾向")
    dominant_trait: str = Field(..., description="该维度的胜出主导特质单字母，例如 'E' 或 'I'")
    analysis: str = Field(..., description="结合英雄背景故事、技能设定或战术提示，给出的深度心理学判定依据文本（100字以内）")

class ChampionMbtiProfile(BaseModel):
    champion_id: str = Field(..., description="英雄的唯一英文ID标识，例如 'Yasuo', 'Garen'")
    champion_name: str = Field(..., description="英雄的中文官方名称，例如 '疾风剑豪 亚索'")
    mbti_type: str = Field(..., description="最终确定的 4 字母 MBTI 类型结果，例如 'INTJ', 'ESTP'")
    personality_title: str = Field(..., description="符合该英雄性格特征的游戏玩家风格称号，例如 '无情大局观战术家'、'独狼极限制空刺客'")
    
    # 心理学四大核心认知维度拆解
    ei_dimension: MbtiDimension = Field(..., description="能量来源维度：外倾 (Extraversion) vs 内倾 (Introversion)")
    sn_dimension: MbtiDimension = Field(..., description="信息获取维度：感觉 (Sensing) vs 直觉 (Intuition)")
    tf_dimension: MbtiDimension = Field(..., description="决策方式维度：思考 (Thinking) vs 情感 (Feeling)")
    jp_dimension: MbtiDimension = Field(..., description="生活态度维度：判断 (Judging) vs 知觉 (Perceiving)")
    
    core_motivation: str = Field(..., description="该角色的核心心理动机与精神图腾（究竟是什么在驱动这位英雄的行动）")
    gaming_style_mapping: List[str] = Field(..., description="该人格映射到真实玩家身上的典型游戏行为特征，列举2-3条，例如：['极度热衷全图控图与资源运营', '倾向于单带边路，抗拒抱团']")
    representative_quote: str = Field(..., description="该英雄最具其性格代表性的一句经典台词或背景设定语录")

# =====================================================================
# 3. 核心大模型心理分析函数
# =====================================================================
def analyze_champion_personality(champ_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    调用大模型对单个英雄的原始语料集进行全方位的心理学分析与 MBTI 建模
    """
    # 动态构建上下文，将背景故事与对局策略结合，全面展现角色的人格画像
    context = f"""
英雄名称: {champ_data.get('name')} ({champ_data.get('title')})
英雄标签: {', '.join(champ_data.get('tags', []))}
基础能力评级: {json.dumps(champ_data.get('info', {}))}

官方背景故事设定集 (Lore):
{champ_data.get('lore')}

己方对局战术提示 (Ally Tips):
{chr(10).join(champ_data.get('allytips', []))}

敌方应对战术提示 (Enemy Tips):
{chr(10).join(champ_data.get('enemytips', []))}
"""

    prompt = f"""
你是一位顶级的游戏心理学专家和 MBTI 人格分析导师。请阅读下方提供的《英雄联盟》英雄的官方世界观设定、传记故事、以及游戏内所表现出的战术风格提示。
你需要对该英雄进行深度的 MBTI 人格类型判定，并将这种人格特质完美映射到热爱该英雄的玩家身上的现实对局决策风格中。

请务必从能量聚焦（E/I）、信息感知（S/N）、逻辑决策（T/F）和生活组织（J/P）四个专业心理维度进行严谨推理，确保分析逻辑闭环。

需要深度建模的英雄原始语料库如下：
{context}
"""

    # 选用具备卓越推理能力的专业级模型，开启精准结构化提取
    model = genai.GenerativeModel("gemini-2.5-pro")
    
    try:
        response = model.generate_content(
            prompt,
            generation_config=genai.GenerationConfig(
                response_mime_type="application/json",
                response_schema=ChampionMbtiProfile,
                temperature=0.1,  # 极低随机性，确保模型聚焦于严谨的文本线索推理而非胡编乱造
            )
        )
        # 此时的 response.text 已经是完美契合 Pydantic 定义的合法 JSON
        return json.loads(response.text)
    except Exception as e:
        print(f"【错误】分析英雄 {champ_data.get('name')} 的心理模型时 API 发生异常: {e}")
        return None

# =====================================================================
# 4. 断点续传与自动化流水线逻辑
# =====================================================================
def run_pipeline(input_file: str, output_file: str):
    if not os.path.exists(input_file):
        print(f"【发生错误】: 未能找到输入文件 {input_file}。请先执行第一步的获取数据脚本。")
        return

    with open(input_file, 'r', encoding='utf-8') as f:
        raw_champions = json.load(f)

    # 极具弹性的设计：支持断点续传。如果文件被意外中断，下次运行直接跳过已完成部分
    processed_profiles = {}
    if os.path.exists(output_file):
        try:
            with open(output_file, 'r', encoding='utf-8') as f:
                existing_data = json.load(f)
                if isinstance(existing_data, list):
                    processed_profiles = {p['champion_id']: p for p in existing_data}
            print(f"【进度发现】: 检测到本地已存在历史处理进度，已完成 {len(processed_profiles)} 位英雄。将自动执行增量建模。")
        except Exception:
            print("【提示】: 读取原有输出文件失败或文件为空，将启动全新全量建模。")

    results_list = list(processed_profiles.values())
    total_count = len(raw_champions)

    print(f"【启动建模】: 开始将英雄官方设定投喂心理学模型，预计处理 {total_count} 位英雄...")
    
    for idx, champ in enumerate(raw_champions, 1):
        champ_id = champ.get("id")
        
        # 增量检测，跳过已处理的数据
        if champ_id in processed_profiles:
            continue
            
        print(f"[{idx}/{total_count}] 正在对角色进行心理分析: {champ.get('name')} - {champ.get('title')}...")
        
        # 调用大模型执行分析
        profile = analyze_champion_personality(champ)
        
        if profile:
            results_list.append(profile)
            
            # 每一位英雄建模完毕即刻写入磁盘，避免中途断网导致数据前功尽弃，这对于批量处理非常关键
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(results_list, f, ensure_ascii=False, indent=4)
            print(f" -> 建模成功！判定人格: 【{profile['mbti_type']}】 ({profile['personality_title']})")
        else:
            print(f" -> {champ.get('name')} 建模失败，跳过，等待重试。")
        
        # 频率安全锁：由于批量处理数据较大，稍微加入睡眠延迟，保护 API 不被频限拦截
        time.sleep(2.0)

    print(f"\n【建模圆满完成】！生成的所有结构化 MBTI 核心映射库已同步至: {output_file}")

if __name__ == "__main__":
    # 根据我们在上一轮中规划的工程架构，将输入和输出路径精准连接
    INPUT_PATH = "lol_champions_lore_zh_CN.json"
    OUTPUT_PATH = "../public/datasets/lol_mbti_mapping.json"
    
    # 自动化构建前端存放数据集的公用目录
    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    
    run_pipeline(INPUT_PATH, OUTPUT_PATH)