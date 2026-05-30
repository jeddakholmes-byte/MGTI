// ==================== 全局数据 ====================
let championsData = [];

// ==================== 别名映射（用于搜索） ====================
const heroAliasMap = {
  // 英雄常见外号/别称 -> 标准名称
  "老鼠": "图奇",
  "瘟疫之源": "图奇",
  "老鼠人": "图奇",
  "ez": "伊泽瑞尔",
  "小黄毛": "伊泽瑞尔",
  "探险家": "伊泽瑞尔",
  "卡莎": "卡莎",
  "虚空之女": "卡莎",
  "亚索": "亚索",
  "疾风剑豪": "亚索",
  "永恩": "永恩",
  "封魔剑魂": "永恩",
  "锐雯": "锐雯",
  "放逐之刃": "锐雯",
  "艾瑞莉娅": "艾瑞莉娅",
  "刀锋舞者": "艾瑞莉娅",
  "阿狸": "阿狸",
  "九尾妖狐": "阿狸",
  "李青": "李青",
  "盲僧": "李青",
  "瞎子": "李青",
  "劫": "劫",
  "影流之主": "劫",
  "凯隐": "凯隐",
  "影流之镰": "凯隐",
  "烬": "烬",
  "戏命师": "烬",
  "金克丝": "金克丝",
  "暴走萝莉": "金克丝",
  "蔚": "蔚",
  "皮城执法官": "蔚",
  "凯特琳": "凯特琳",
  "皮城女警": "凯特琳",
  "女警": "凯特琳",
  "杰斯": "杰斯",
  "未来守护者": "杰斯",
  "维克托": "维克托",
  "机械先驱": "维克托",
  "艾克": "艾克",
  "时间刺客": "艾克",
  "小鱼人": "菲兹",
  "潮汐海灵": "菲兹",
  "卡牌": "崔斯特",
  "卡牌大师": "崔斯特",
  "男刀": "泰隆",
  "刀锋之影": "泰隆",
  "诺手": "德莱厄斯",
  "诺克萨斯之手": "德莱厄斯",
  "德莱文": "德莱文",
  "荣耀行刑官": "德莱文",
  // 可根据需要继续扩充
};

// ==================== 深度解析库（英雄人格自洽解释） ====================
// 为每个英雄提供一套完整的性格解析（类似SBTI风格）
// 如果某个英雄没有专属解析，则使用其MBTI类型的通用解析
const heroDeepAnalysis = {
  // 示例：亚索的深度解析
  "亚索": {
    title: "浪客之道 · 不羁之风",
    personality: "ISTP（鉴赏家）",
    traits: "你像亚索一样，独立、务实、行动力强，信奉'一剑了结'的简洁哲学。你讨厌被规则束缚，更愿意用自己的方式解决问题。",
    strengths: "反应敏捷，适应力强，危机中能保持冷静，擅长即兴发挥。",
    weaknesses: "有时过于冲动，不擅表达情感，容易给人冷漠或叛逆的印象。",
    advice: "学会信任他人，偶尔放下剑，用语言沟通也能化解恩怨。",
    quote: "“死亡如风，常伴吾身。” —— 亚索"
  },
  // 阿狸示例
  "阿狸": {
    title: "九尾妖狐 · 魅惑之舞",
    personality: "ENFP（竞选者）",
    traits: "你像阿狸一样，充满魅力、好奇心旺盛，渴望与人建立深刻的情感连接。你擅长感知他人的情绪，并用温柔的方式影响他们。",
    strengths: "社交能力强，富有同理心，创意丰富，善于激励他人。",
    weaknesses: "容易分心，情绪波动较大，有时会为了取悦他人而迷失自我。",
    advice: "在照顾他人感受的同时，别忘了倾听自己内心的声音。",
    quote: "“别害羞嘛。” —— 阿狸"
  },
  // 劫
  "劫": {
    title: "影流之主 · 暗影中的复仇",
    personality: "INTJ（建筑师）",
    traits: "你像劫一样，独立、果断、目标明确，愿意为信念付出一切。你不轻易相信他人，但对自己认同的使命绝对忠诚。",
    strengths: "战略思维强，执行力高，能承受巨大压力。",
    weaknesses: "有时过于冷酷，难以接受反对意见，容易陷入孤立。",
    advice: "真正的力量不在于摧毁对手，而在于建立更强大的联盟。",
    quote: "“无形之刃，最为致命。” —— 劫"
  },
  // 可继续为每个英雄添加，暂时用下面的通用模板兜底
};

// 为MBTI类型提供的通用解析（当英雄没有专属解析时使用）
const mbtiDeepAnalysis = {
  "ISTP": {
    title: "鉴赏家 · 务实行动派",
    personality: "ISTP（鉴赏家）",
    traits: "你是典型的行动派，擅长动手解决问题，对机械、工具或技能有天赋。你喜欢自由，讨厌被指挥。",
    strengths: "冷静，理性，擅长在压力下工作，适应力强。",
    weaknesses: "可能显得冷漠，不善于表达情感，容易冒险。",
    advice: "尝试放慢节奏，多关注他人的感受。",
    quote: "“行动胜于空谈。”"
  },
  "ENFP": {
    title: "竞选者 · 热情梦想家",
    personality: "ENFP（竞选者）",
    traits: "你充满热情和创意，喜欢探索新事物，与各种人建立联系。你相信可能性，乐于激励他人。",
    strengths: "沟通能力强，富有同理心，适应力强，乐观。",
    weaknesses: "容易分心，情绪起伏大，可能过度承诺。",
    advice: "学会管理精力，专注于完成一个目标。",
    quote: "“想象力比知识更重要。”"
  },
  "INTJ": {
    title: "建筑师 · 战略大师",
    personality: "INTJ（建筑师）",
    traits: "你善于制定长期计划，逻辑清晰，对自己和他人要求严格。你追求效率，不喜无意义的社交。",
    strengths: "独立思考，目标明确，善于分析，执行力强。",
    weaknesses: "可能显得傲慢，不善于处理情感问题。",
    advice: "偶尔放下理性，用心感受世界。",
    quote: "“完美不是没有东西可加，而是没有东西可减。”"
  },
  // 其他MBTI类型可类似扩展，暂时使用默认
  "default": {
    title: "英雄本色",
    personality: "未知",
    traits: "你是一位独特的召唤师，你的性格与符文之地的某位英雄产生了共鸣。",
    strengths: "有待发掘",
    weaknesses: "有待发掘",
    advice: "继续探索内心，找到真正的自己。",
    quote: "“英雄，去超越。”"
  }
};

// 获取英雄的深度解析（优先专属，否则根据MBTI取通用，再取默认）
function getHeroDeepAnalysis(hero) {
  if (heroDeepAnalysis[hero.name]) {
    return heroDeepAnalysis[hero.name];
  }
  const mbti = hero.mbti;
  if (mbti && mbtiDeepAnalysis[mbti]) {
    return mbtiDeepAnalysis[mbti];
  }
  return mbtiDeepAnalysis["default"];
}

// 加载 champions.json，并附加 MBTI、解析等字段
async function loadChampions() {
  try {
    const response = await fetch('../data/champions.json');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    let champions = await response.json();
    champions = champions.map(champ => {
      let mbti = championMbtiMap[champ.name] || "未知";
      const imageUrl = champ.image_url || "https://ddragon.leagueoflegends.com/cdn/15.5.1/img/champion/default.png";
      const splashUrl = champ.splash_url || "https://via.placeholder.com/1920x1080?text=No+Splash";
      return { ...champ, mbti, image_url: imageUrl, splash_url: splashUrl };
    });
    championsData = champions;
    return champions;
  } catch (error) {
    console.error('加载英雄数据失败:', error);
    return [];
  }
}

// 导出全局映射（供其他模块使用）
window.heroAliasMap = heroAliasMap;
window.getHeroDeepAnalysis = getHeroDeepAnalysis;