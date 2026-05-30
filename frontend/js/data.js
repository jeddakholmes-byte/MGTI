// ==================== MGTI 数据加载与处理 ====================
// My Game Type Indicator
// 本文件负责加载 MGTI 配置、英雄基础数据，并将英雄五维人格数据合并到英雄对象中。

// ==================== 全局常量 ====================
const MGTI_FULLNAME = "My Game Type Indicator";
const MGTI_DIMENSION_IDS = ["TAC", "TEA", "EMO", "DEC", "PRE"];
const DEFAULT_HERO_DIMENSIONS = Object.freeze({
  TAC: 0,
  TEA: 0,
  EMO: 0,
  DEC: 0,
  PRE: 0
});

// 数据文件名集中管理。后续如果拆分题库、皮肤、地区等数据，可以在这里继续扩展。
const MGTI_DATA_FILES = Object.freeze({
  dimensions: "dimensions.json",
  questions: "questions.json",
  heroProfiles: "heroes_profile.json",
  resultTemplates: "result_templates.json",
  champions: "champions.json"
});

// 默认部署路径。
// - 本地开发：./data/
// - GitHub Pages / 静态站生产环境：/MGTI/data/
// 如项目部署在其他目录，可在 config.js 中设置 window.MGTI_CONFIG.DATA_BASE_PATH 覆盖。
const DEFAULT_LOCAL_DATA_BASE_PATH = "./data/";
const DEFAULT_PRODUCTION_DATA_BASE_PATH = "/MGTI/data/";
const FETCH_TIMEOUT_MS = 8000;

// 全局英雄数据。loadChampions() 成功后会更新 window.championsData。
let championsData = [];

// 初始化全局配置，避免其他脚本在加载前读取时报错。
window.MGTI_FULLNAME = MGTI_FULLNAME;
window.MGTI_DIMENSION_IDS = MGTI_DIMENSION_IDS;
window.dimensions = window.dimensions || [];
window.questions = window.questions || [];
window.heroProfiles = window.heroProfiles || { version: "fallback", heroes: {} };
window.resultTemplates = window.resultTemplates || getDefaultResultTemplates();
window.championsData = championsData;

// ==================== 别名映射（用于搜索） ====================
const heroAliasMap = {
  // 常用简称 / 外号 → 标准名称
  "ez": "探险家",
  "小黄毛": "探险家",
  "探险家": "探险家",
  "卡莎": "虚空之女",
  "虚空之女": "虚空之女",
  "亚索": "疾风剑豪",
  "疾风剑豪": "疾风剑豪",
  "永恩": "封魔剑魂",
  "封魔剑魂": "封魔剑魂",
  "锐雯": "放逐之刃",
  "放逐之刃": "放逐之刃",
  "艾瑞莉娅": "刀锋舞者",
  "刀锋舞者": "刀锋舞者",
  "刀妹": "刀锋舞者",
  "阿狸": "九尾妖狐",
  "九尾妖狐": "九尾妖狐",
  "李青": "盲僧",
  "盲僧": "盲僧",
  "瞎子": "盲僧",
  "劫": "影流之主",
  "影流之主": "影流之主",
  "凯隐": "影流之镰",
  "影流之镰": "影流之镰",
  "烬": "戏命师",
  "戏命师": "戏命师",
  "金克丝": "暴走萝莉",
  "暴走萝莉": "暴走萝莉",
  "蔚": "皮城执法官",
  "皮城执法官": "皮城执法官",
  "凯特琳": "皮城女警",
  "皮城女警": "皮城女警",
  "女警": "皮城女警",
  "杰斯": "未来守护者",
  "未来守护者": "未来守护者",
  "维克托": "奥术先驱",
  "奥术先驱": "奥术先驱",
  "艾克": "时间刺客",
  "时间刺客": "时间刺客",
  "小鱼人": "潮汐海灵",
  "潮汐海灵": "潮汐海灵",
  "卡牌": "卡牌大师",
  "卡牌大师": "卡牌大师",
  "男刀": "刀锋之影",
  "刀锋之影": "刀锋之影",
  "诺手": "诺克萨斯之手",
  "诺克萨斯之手": "诺克萨斯之手",
  "德莱文": "荣耀行刑官",
  "荣耀行刑官": "荣耀行刑官",
  "安妮": "黑暗之女",
  "黑暗之女": "黑暗之女",
  "奥拉夫": "狂战士",
  "狂战士": "狂战士",
  "加里奥": "正义巨像",
  "正义巨像": "正义巨像",
  "崔斯特": "卡牌大师",
  "赵信": "德邦总管",
  "德邦总管": "德邦总管",
  "厄加特": "无畏战车",
  "无畏战车": "无畏战车",
  "乐芙兰": "诡术妖姬",
  "诡术妖姬": "诡术妖姬",
  "妖姬": "诡术妖姬",
  "弗拉基米尔": "猩红收割者",
  "猩红收割者": "猩红收割者",
  "吸血鬼": "猩红收割者",
  "费德提克": "远古恐惧",
  "远古恐惧": "远古恐惧",
  "稻草人": "远古恐惧",
  "凯尔": "正义天使",
  "正义天使": "正义天使",
  "天使": "正义天使",
  "易": "无极剑圣",
  "无极剑圣": "无极剑圣",
  "剑圣": "无极剑圣",
  "阿利斯塔": "牛头酋长",
  "牛头酋长": "牛头酋长",
  "牛头": "牛头酋长",
  "瑞兹": "符文法师",
  "符文法师": "符文法师",
  "光头": "符文法师",
  "赛恩": "亡灵战神",
  "亡灵战神": "亡灵战神",
  "老司机": "亡灵战神",
  "希维尔": "战争女神",
  "战争女神": "战争女神",
  "轮子妈": "战争女神",
  "索拉卡": "众星之子",
  "众星之子": "众星之子",
  "奶妈": "众星之子",
  "提莫": "迅捷斥候",
  "迅捷斥候": "迅捷斥候",
  "提百万": "迅捷斥候",
  "崔丝塔娜": "麦林炮手",
  "麦林炮手": "麦林炮手",
  "小炮": "麦林炮手",
  "沃里克": "祖安怒兽",
  "祖安怒兽": "祖安怒兽",
  "狼人": "祖安怒兽",
  "努努和威朗普": "雪原双子",
  "雪原双子": "雪原双子",
  "努努": "雪原双子",
  "厄运小姐": "赏金猎人",
  "赏金猎人": "赏金猎人",
  "女枪": "赏金猎人",
  "艾希": "寒冰射手",
  "寒冰射手": "寒冰射手",
  "寒冰": "寒冰射手",
  "泰达米尔": "蛮族之王",
  "蛮族之王": "蛮族之王",
  "蛮王": "蛮族之王",
  "贾克斯": "武器大师",
  "武器大师": "武器大师",
  "莫甘娜": "堕落天使",
  "堕落天使": "堕落天使",
  "基兰": "时光守护者",
  "时光守护者": "时光守护者",
  "时光老头": "时光守护者",
  "辛吉德": "炼金术士",
  "炼金术士": "炼金术士",
  "炼金": "炼金术士",
  "伊芙琳": "痛苦之拥",
  "痛苦之拥": "痛苦之拥",
  "寡妇": "痛苦之拥",
  "图奇": "瘟疫之源",
  "瘟疫之源": "瘟疫之源",
  "老鼠": "瘟疫之源",
  "卡尔萨斯": "死亡颂唱者",
  "死亡颂唱者": "死亡颂唱者",
  "死歌": "死亡颂唱者",
  "科加斯": "虚空恐惧",
  "虚空恐惧": "虚空恐惧",
  "大虫子": "虚空恐惧",
  "阿木木": "殇之木乃伊",
  "殇之木乃伊": "殇之木乃伊",
  "木木": "殇之木乃伊",
  "拉莫斯": "披甲龙龟",
  "披甲龙龟": "披甲龙龟",
  "龙龟": "披甲龙龟",
  "艾尼维亚": "冰晶凤凰",
  "冰晶凤凰": "冰晶凤凰",
  "冰鸟": "冰晶凤凰",
  "萨科": "恶魔小丑",
  "恶魔小丑": "恶魔小丑",
  "小丑": "恶魔小丑",
  "蒙多医生": "祖安狂人",
  "祖安狂人": "祖安狂人",
  "蒙多": "祖安狂人",
  "娑娜": "琴瑟仙女",
  "琴瑟仙女": "琴瑟仙女",
  "琴女": "琴瑟仙女",
  "卡萨丁": "虚空行者",
  "虚空行者": "虚空行者",
  "迦娜": "风暴之怒",
  "风暴之怒": "风暴之怒",
  "风女": "风暴之怒",
  "普朗克": "海洋之灾",
  "海洋之灾": "海洋之灾",
  "船长": "海洋之灾",
  "库奇": "英勇投弹手",
  "英勇投弹手": "英勇投弹手",
  "飞机": "英勇投弹手",
  "卡尔玛": "天启者",
  "天启者": "天启者",
  "扇子妈": "天启者",
  "塔里克": "瓦洛兰之盾",
  "瓦洛兰之盾": "瓦洛兰之盾",
  "宝石": "瓦洛兰之盾",
  "维迦": "邪恶小法师",
  "邪恶小法师": "邪恶小法师",
  "小法": "邪恶小法师",
  "特朗德尔": "巨魔之王",
  "巨魔之王": "巨魔之王",
  "巨魔": "巨魔之王",
  "斯维因": "诺克萨斯统领",
  "诺克萨斯统领": "诺克萨斯统领",
  "乌鸦": "诺克萨斯统领",
  "布里茨": "蒸汽机器人",
  "蒸汽机器人": "蒸汽机器人",
  "机器人": "蒸汽机器人",
  "墨菲特": "熔岩巨兽",
  "熔岩巨兽": "熔岩巨兽",
  "石头人": "熔岩巨兽",
  "卡特琳娜": "不祥之刃",
  "不祥之刃": "不祥之刃",
  "卡特": "不祥之刃",
  "魔腾": "永恒梦魇",
  "永恒梦魇": "永恒梦魇",
  "梦魇": "永恒梦魇",
  "茂凯": "扭曲树精",
  "扭曲树精": "扭曲树精",
  "大树": "扭曲树精",
  "雷克顿": "荒漠屠夫",
  "荒漠屠夫": "荒漠屠夫",
  "鳄鱼": "荒漠屠夫",
  "嘉文四世": "德玛西亚皇子",
  "德玛西亚皇子": "德玛西亚皇子",
  "皇子": "德玛西亚皇子",
  "伊莉丝": "蜘蛛女皇",
  "蜘蛛女皇": "蜘蛛女皇",
  "蜘蛛": "蜘蛛女皇",
  "奥莉安娜": "发条魔灵",
  "发条魔灵": "发条魔灵",
  "发条": "发条魔灵",
  "孙悟空": "齐天大圣",
  "齐天大圣": "齐天大圣",
  "猴子": "齐天大圣",
  "布兰德": "复仇焰魂",
  "复仇焰魂": "复仇焰魂",
  "火男": "复仇焰魂",
  "薇恩": "暗夜猎手",
  "暗夜猎手": "暗夜猎手",
  "vn": "暗夜猎手",
  "兰博": "机械公敌",
  "机械公敌": "机械公敌",
  "卡西奥佩娅": "魔蛇之拥",
  "魔蛇之拥": "魔蛇之拥",
  "蛇女": "魔蛇之拥",
  "斯卡纳": "上古领主",
  "上古领主": "上古领主",
  "蝎子": "上古领主",
  "黑默丁格": "大发明家",
  "大发明家": "大发明家",
  "大头": "大发明家",
  "内瑟斯": "沙漠死神",
  "沙漠死神": "沙漠死神",
  "狗头": "沙漠死神",
  "奈德丽": "狂野女猎手",
  "狂野女猎手": "狂野女猎手",
  "豹女": "狂野女猎手",
  "乌迪尔": "兽灵行者",
  "兽灵行者": "兽灵行者",
  "波比": "圣锤之毅",
  "圣锤之毅": "圣锤之毅",
  "古拉加斯": "酒桶",
  "酒桶": "酒桶",
  "潘森": "不屈之枪",
  "不屈之枪": "不屈之枪",
  "莫德凯撒": "铁铠冥魂",
  "铁铠冥魂": "铁铠冥魂",
  "铁男": "铁铠冥魂",
  "约里克": "牧魂人",
  "牧魂人": "牧魂人",
  "掘墓": "牧魂人",
  "阿卡丽": "离群之刺",
  "离群之刺": "离群之刺",
  "凯南": "狂暴之心",
  "狂暴之心": "狂暴之心",
  "盖伦": "德玛西亚之力",
  "德玛西亚之力": "德玛西亚之力",
  "蕾欧娜": "曙光女神",
  "曙光女神": "曙光女神",
  "日女": "曙光女神",
  "玛尔扎哈": "虚空先知",
  "虚空先知": "虚空先知",
  "蚂蚱": "虚空先知",
  "泰隆": "刀锋之影",
  "克格莫": "深渊巨口",
  "深渊巨口": "深渊巨口",
  "大嘴": "深渊巨口",
  "慎": "暮光之眼",
  "暮光之眼": "暮光之眼",
  "拉克丝": "光辉女郎",
  "光辉女郎": "光辉女郎",
  "泽拉斯": "远古巫灵",
  "远古巫灵": "远古巫灵",
  "希瓦娜": "龙血武姬",
  "龙血武姬": "龙血武姬",
  "龙女": "龙血武姬",
  "格雷福斯": "法外狂徒",
  "法外狂徒": "法外狂徒",
  "男枪": "法外狂徒",
  "菲兹": "潮汐海灵",
  "沃利贝尔": "不灭狂雷",
  "不灭狂雷": "不灭狂雷",
  "狗熊": "不灭狂雷",
  "雷恩加尔": "傲之追猎者",
  "傲之追猎者": "傲之追猎者",
  "狮子狗": "傲之追猎者",
  "韦鲁斯": "惩戒之箭",
  "惩戒之箭": "惩戒之箭",
  "诺提勒斯": "深海泰坦",
  "深海泰坦": "深海泰坦",
  "泰坦": "深海泰坦",
  "瑟庄妮": "北地之怒",
  "北地之怒": "北地之怒",
  "猪妹": "北地之怒",
  "菲奥娜": "无双剑姬",
  "无双剑姬": "无双剑姬",
  "剑姬": "无双剑姬",
  "吉格斯": "爆破鬼才",
  "爆破鬼才": "爆破鬼才",
  "炸弹人": "爆破鬼才",
  "璐璐": "仙灵女巫",
  "仙灵女巫": "仙灵女巫",
  "赫卡里姆": "战争之影",
  "战争之影": "战争之影",
  "人马": "战争之影",
  "卡兹克": "虚空掠夺者",
  "虚空掠夺者": "虚空掠夺者",
  "螳螂": "虚空掠夺者",
  "德莱厄斯": "诺克萨斯之手",
  "丽桑卓": "冰霜女巫",
  "冰霜女巫": "冰霜女巫",
  "冰女": "冰霜女巫",
  "黛安娜": "皎月女神",
  "皎月女神": "皎月女神",
  "皎月": "皎月女神",
  "奎因": "德玛西亚之翼",
  "德玛西亚之翼": "德玛西亚之翼",
  "辛德拉": "暗黑元首",
  "暗黑元首": "暗黑元首",
  "球女": "暗黑元首",
  "奥瑞利安索尔": "铸星龙王",
  "铸星龙王": "铸星龙王",
  "龙王": "铸星龙王",
  "佐伊": "暮光星灵",
  "暮光星灵": "暮光星灵",
  "婕拉": "荆棘之兴",
  "荆棘之兴": "荆棘之兴",
  "萨勒芬妮": "星籁歌姬",
  "星籁歌姬": "星籁歌姬",
  "歌姬": "星籁歌姬",
  "纳尔": "迷失之牙",
  "迷失之牙": "迷失之牙",
  "扎克": "生化魔人",
  "生化魔人": "生化魔人",
  "维克兹": "虚空之眼",
  "虚空之眼": "虚空之眼",
  "大眼": "虚空之眼",
  "塔莉垭": "岩雀",
  "岩雀": "岩雀",
  "卡蜜尔": "青钢影",
  "青钢影": "青钢影",
  "阿克尚": "影哨",
  "影哨": "影哨",
  "卑尔维斯": "虚空女皇",
  "虚空女皇": "虚空女皇",
  "布隆": "弗雷尔卓德之心",
  "弗雷尔卓德之心": "弗雷尔卓德之心",
  "千珏": "永猎双子",
  "永猎双子": "永猎双子",
  "泽丽": "祖安花火",
  "祖安花火": "祖安花火",
  "塔姆": "河流之王",
  "河流之王": "河流之王",
  "塔姆肯奇": "河流之王",
  "贝蕾亚": "狂厄蔷薇",
  "狂厄蔷薇": "狂厄蔷薇",
  "佛耶戈": "破败之王",
  "破败之王": "破败之王",
  "赛娜": "涤魂圣枪",
  "涤魂圣枪": "涤魂圣枪",
  "卢锡安": "圣枪游侠",
  "圣枪游侠": "圣枪游侠",
  "奥巴马": "圣枪游侠",
  "克烈": "暴怒骑士",
  "暴怒骑士": "暴怒骑士",
  "奇亚娜": "元素女皇",
  "元素女皇": "元素女皇",
  "亚托克斯": "暗裔剑魔",
  "暗裔剑魔": "暗裔剑魔",
  "剑魔": "暗裔剑魔",
  "娜美": "唤潮鲛姬",
  "唤潮鲛姬": "唤潮鲛姬",
  "阿兹尔": "沙漠皇帝",
  "沙漠皇帝": "沙漠皇帝",
  "沙皇": "沙漠皇帝",
  "悠米": "魔法猫咪",
  "魔法猫咪": "魔法猫咪",
  "猫咪": "魔法猫咪",
  "莎弥拉": "沙漠玫瑰",
  "沙漠玫瑰": "沙漠玫瑰",
  "锤石": "魂锁典狱长",
  "魂锁典狱长": "魂锁典狱长",
  "俄洛伊": "海兽祭司",
  "海兽祭司": "海兽祭司",
  "雷克塞": "虚空遁地兽",
  "虚空遁地兽": "虚空遁地兽",
  "挖掘机": "虚空遁地兽",
  "艾翁": "翠神",
  "翠神": "翠神",
  "卡莉丝塔": "复仇之矛",
  "复仇之矛": "复仇之矛",
  "滑板鞋": "复仇之矛",
  "巴德": "星界游神",
  "星界游神": "星界游神",
  "洛": "幻翎",
  "幻翎": "幻翎",
  "霞": "逆羽",
  "逆羽": "逆羽",
  "奥恩": "山隐之焰",
  "山隐之焰": "山隐之焰",
  "塞拉斯": "解脱者",
  "解脱者": "解脱者",
  "妮蔻": "万花通灵",
  "万花通灵": "万花通灵",
  "厄斐琉斯": "残月之肃",
  "残月之肃": "残月之肃",
  "芮尔": "镕铁少女",
  "镕铁少女": "镕铁少女",
  "派克": "血港鬼影",
  "血港鬼影": "血港鬼影",
  "薇古丝": "愁云使者",
  "愁云使者": "愁云使者",
  "安蓓萨": "铁血狼母",
  "铁血狼母": "铁血狼母",
  "梅尔": "流光镜影",
  "流光镜影": "流光镜影",
  "芸阿娜": "不破之誓",
  "不破之誓": "不破之誓",
  "瑟提": "腕豪",
  "腕豪": "腕豪",
  "莉莉娅": "含羞蓓蕾",
  "含羞蓓蕾": "含羞蓓蕾",
  "格温": "灵罗娃娃",
  "灵罗娃娃": "灵罗娃娃",
  "烈娜塔": "炼金男爵",
  "炼金男爵": "炼金男爵",
  "阿萝拉": "双界灵兔",
  "双界灵兔": "双界灵兔",
  "尼菈": "不羁之悦",
  "不羁之悦": "不羁之悦",
  "奎桑提": "纳祖芒荣耀",
  "纳祖芒荣耀": "纳祖芒荣耀",
  "斯莫德": "炽炎雏龙",
  "炽炎雏龙": "炽炎雏龙",
  "小龙": "炽炎雏龙",
  "米利欧": "明烛",
  "明烛": "明烛",
  "亚恒": "不落魔锋",
  "不落魔锋": "不落魔锋",
  "彗": "异画师",
  "异画师": "异画师",
  "纳亚菲利": "百裂冥犬",
  "百裂冥犬": "百裂冥犬",
  "狗群": "百裂冥犬"
};

// ==================== MBTI 旧逻辑弃用说明 ====================
// DEPRECATED: 已迁移至 MGTI 体系。
// 原 championMbtiMap、mbtiDeepAnalysis / heroDeepAnalysis、MBTI 维度计算、MBTI 类型解析等逻辑不再使用。
// 新体系使用 dimensions.json、questions.json、heroes_profile.json、result_templates.json。
// 如需回滚旧逻辑，请从版本历史中恢复，不要在当前 MGTI 流程中继续引用 MBTI 变量。

// ==================== 默认数据 ====================
function getDefaultDimensions() {
  return {
    version: "fallback",
    dimensions: []
  };
}

function getDefaultQuestions() {
  return {
    version: "fallback",
    questions: []
  };
}

function getDefaultHeroProfiles() {
  return {
    version: "fallback",
    heroes: {}
  };
}

function getDefaultResultTemplates() {
  return {
    version: "fallback",
    dimensionPhrases: {
      TAC_high: "你善于精打细算，用头脑压制对手。",
      TAC_low: "你反应神速，凭本能打出亮眼操作。",
      TEA_high: "你是个可靠的队友，总在关键时刻支援。",
      TEA_low: "你喜欢独自承担压力，用分带给团队创造空间。",
      EMO_high: "你激情四射，容易上头但极具观赏性。",
      EMO_low: "你冷静如冰，逆风也能稳住心态。",
      DEC_high: "你果断勇敢，机会出现绝不犹豫。",
      DEC_low: "你谨慎稳重，从不贸然行动。",
      PRE_high: "你热爱高风险高回报的英雄。",
      PRE_low: "你偏好安全输出的传统角色。"
    },
    combinedTemplate: "你的风格是：{{tactics}}，{{teamRole}}，{{emotion}}，{{decision}}，{{preference}}。这与英雄 {{heroName}} 的 {{resonance}} 高度契合。",
    personalityTemplate: "{{heroName}} 与你的风格高度契合。你们都{{resonance}}。",
    defaultAdvice: "在符文之地继续你的冒险吧！",
    shareTemplate: "我在 MGTI 人格测试中的本命英雄是 {{heroName}}！你也来找找属于你的英雄吧~"
  };
}

// ==================== 通用工具函数 ====================
function isPlainObject(value) {
  return Object.prototype.toString.call(value) === "[object Object]";
}

function toFiniteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min = -2, max = 2) {
  return Math.min(max, Math.max(min, value));
}

function uniqueArray(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function normalizeBasePath(path) {
  const raw = String(path || "").trim();
  if (!raw) return "";
  return raw.endsWith("/") ? raw : `${raw}/`;
}

function isAbsoluteDataPath(fileName) {
  const raw = String(fileName || "");
  return (
    raw.startsWith("http://") ||
    raw.startsWith("https://") ||
    raw.startsWith("/") ||
    raw.startsWith("./") ||
    raw.startsWith("../")
  );
}

function getRuntimeConfig() {
  const config = isPlainObject(window.MGTI_CONFIG) ? window.MGTI_CONFIG : {};
  return {
    dataBasePath: normalizeBasePath(config.DATA_BASE_PATH || window.MGTI_DATA_BASE_PATH || ""),
    dataPathCandidates: Array.isArray(config.DATA_PATH_CANDIDATES)
      ? config.DATA_PATH_CANDIDATES.map(normalizeBasePath).filter(Boolean)
      : [],
    fetchTimeoutMs: toFiniteNumber(config.FETCH_TIMEOUT_MS, FETCH_TIMEOUT_MS),
    debug: Boolean(config.DEBUG || window.MGTI_DEBUG)
  };
}

function isLocalRuntime() {
  const host = window.location?.hostname || "";
  const protocol = window.location?.protocol || "";
  return (
    protocol === "file:" ||
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "0.0.0.0" ||
    host.endsWith(".local")
  );
}

function getPrimaryDataBasePath() {
  const runtimeConfig = getRuntimeConfig();
  if (runtimeConfig.dataBasePath) return runtimeConfig.dataBasePath;
  return isLocalRuntime() ? DEFAULT_LOCAL_DATA_BASE_PATH : DEFAULT_PRODUCTION_DATA_BASE_PATH;
}

function getDataPathCandidates(fileName) {
  if (!fileName) return [];

  const rawFileName = String(fileName).trim();

  // 如果调用方传入的是完整路径或明确相对路径，优先尊重该路径。
  if (isAbsoluteDataPath(rawFileName)) {
    return uniqueArray([rawFileName]);
  }

  const runtimeConfig = getRuntimeConfig();
  const primaryBasePath = getPrimaryDataBasePath();

  // 回退顺序有意保持稳定：配置路径 > 当前环境主路径 > 常见开发路径 > 根目录路径。
  // 这样线上部署不会被 ../data/ 抢先误命中，本地打开也仍然能回退。
  return uniqueArray([
    ...runtimeConfig.dataPathCandidates.map((basePath) => `${basePath}${rawFileName}`),
    `${primaryBasePath}${rawFileName}`,
    `./data/${rawFileName}`,
    `../data/${rawFileName}`,
    `/data/${rawFileName}`,
    `${DEFAULT_PRODUCTION_DATA_BASE_PATH}${rawFileName}`
  ]);
}

function showUserError(message, options = {}) {
  const text = String(message || "系统暂时无法完成操作，请稍后重试。");
  const duration = toFiniteNumber(options.duration, 3600);

  try {
    let toast = document.getElementById("mgti-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "mgti-toast";
      toast.setAttribute("role", "status");
      toast.setAttribute("aria-live", "polite");
      document.body.appendChild(toast);
    }

    toast.className = options.type ? `mgti-toast-${options.type}` : "mgti-toast-error";
    toast.textContent = text;
    toast.hidden = false;

    if (toast._mgtiTimer) {
      window.clearTimeout(toast._mgtiTimer);
    }

    toast._mgtiTimer = window.setTimeout(() => {
      toast.hidden = true;
      toast.remove();
    }, duration);
  } catch (error) {
    // Toast 失败不应影响主流程。
    console.warn("[MGTI] 用户错误提示渲染失败：", error);
  }
}

async function fetchWithTimeout(path, timeoutMs) {
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = controller
    ? window.setTimeout(() => controller.abort(), timeoutMs)
    : null;

  try {
    return await fetch(path, {
      cache: "no-cache",
      signal: controller?.signal
    });
  } finally {
    if (timer) window.clearTimeout(timer);
  }
}

async function fetchJsonWithFallback(fileName, fallbackValue, options = {}) {
  const candidates = getDataPathCandidates(fileName);
  const runtimeConfig = getRuntimeConfig();
  let lastError = null;

  for (const path of candidates) {
    try {
      const response = await fetchWithTimeout(path, runtimeConfig.fetchTimeoutMs);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }

      const json = await response.json();

      if (runtimeConfig.debug) {
        console.info(`[MGTI] ${fileName} 加载成功：${path}`);
      }

      return json;
    } catch (error) {
      lastError = error;
      console.warn(`[MGTI] 加载 ${path} 失败，尝试下一个路径。`, error);
    }
  }

  console.error(`[MGTI] ${fileName} 加载失败，已使用默认值。`, lastError);

  if (options.userMessage) {
    showUserError(options.userMessage);
  }

  return fallbackValue;
}

function normalizeDimensionObject(dimensions) {
  const source = isPlainObject(dimensions) ? dimensions : {};
  const normalized = {};

  MGTI_DIMENSION_IDS.forEach((id) => {
    normalized[id] = clamp(toFiniteNumber(source[id], DEFAULT_HERO_DIMENSIONS[id]));
  });

  return normalized;
}

function dimensionsToVector(dimensions) {
  const normalized = normalizeDimensionObject(dimensions);
  return MGTI_DIMENSION_IDS.map((id) => normalized[id]);
}

function normalizeDimensionMeta(meta) {
  const item = isPlainObject(meta) ? meta : {};
  const id = String(item.id || "").trim().toUpperCase();

  if (!MGTI_DIMENSION_IDS.includes(id)) return null;

  return {
    ...item,
    id,
    name: item.name || id,
    lowLabel: item.lowLabel || "低分倾向",
    highLabel: item.highLabel || "高分倾向",
    lowDesc: item.lowDesc || "偏向低分侧的游戏行为。",
    highDesc: item.highDesc || "偏向高分侧的游戏行为。"
  };
}

function normalizeQuestion(question, index) {
  const item = isPlainObject(question) ? question : {};
  const dimension = String(item.dimension || "").trim().toUpperCase();

  if (!item.text || !MGTI_DIMENSION_IDS.includes(dimension)) {
    console.warn(`[MGTI] 第 ${index + 1} 道题格式异常，已跳过。`, question);
    return null;
  }

  return {
    ...item,
    id: item.id || `Q${String(index + 1).padStart(2, "0")}`,
    text: String(item.text).trim(),
    dimension,
    reverse: Boolean(item.reverse)
  };
}

function normalizeRoleList(roles) {
  const validRoles = new Set(["assassin", "fighter", "mage", "marksman", "support", "tank"]);
  if (!Array.isArray(roles)) return [];
  return uniqueArray(roles.map((role) => String(role || "").trim().toLowerCase()))
    .filter((role) => validRoles.has(role));
}

function normalizeTagList(tags) {
  if (!Array.isArray(tags)) return [];
  return uniqueArray(tags.map((tag) => String(tag || "").trim()).filter(Boolean));
}

function normalizeReleaseDate(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const match = raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (!match) return raw;
  const [, year, month, day] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function resolveHeroName(input) {
  if (!input) return "";

  if (typeof input === "object") {
    return input.name || input.title || input.alias || "";
  }

  const raw = String(input).trim();
  if (!raw) return "";

  const lower = raw.toLowerCase();

  if (heroAliasMap[raw]) return heroAliasMap[raw];
  if (heroAliasMap[lower]) return heroAliasMap[lower];

  return raw;
}

function findHeroProfile(hero, profileMap) {
  const candidates = uniqueArray([
    hero?.name,
    hero?.title,
    hero?.alias,
    resolveHeroName(hero?.name),
    resolveHeroName(hero?.title),
    resolveHeroName(hero?.alias)
  ].map((value) => String(value || "").trim()));

  for (const name of candidates) {
    if (profileMap[name]) return profileMap[name];
  }

  return null;
}

function getDimensionMeta(dimensionId) {
  return (window.dimensions || []).find((dimension) => dimension.id === dimensionId) || null;
}

function getDimensionLabel(dimensionId, value) {
  const meta = getDimensionMeta(dimensionId);
  if (!meta) return dimensionId;
  return value >= 0 ? meta.highLabel : meta.lowLabel;
}

function mergeResultTemplates(base, incoming) {
  const source = isPlainObject(incoming) ? incoming : {};
  return {
    ...base,
    ...source,
    dimensionPhrases: {
      ...(base.dimensionPhrases || {}),
      ...(source.dimensionPhrases || {})
    },
    roleDescriptions: {
      ...(base.roleDescriptions || {}),
      ...(source.roleDescriptions || {})
    },
    dimensionExplanations: {
      ...(base.dimensionExplanations || {}),
      ...(source.dimensionExplanations || {})
    },
    consistency: {
      ...(base.consistency || {}),
      ...(source.consistency || {})
    }
  };
}

// ==================== 配置文件加载函数 ====================
async function loadDimensions() {
  const data = await fetchJsonWithFallback(
    MGTI_DATA_FILES.dimensions,
    getDefaultDimensions(),
    { userMessage: "维度配置加载失败，已临时使用默认配置。" }
  );

  const rawDimensions = Array.isArray(data?.dimensions) ? data.dimensions : [];
  const normalized = rawDimensions
    .map(normalizeDimensionMeta)
    .filter(Boolean);

  const missingIds = MGTI_DIMENSION_IDS.filter((id) => !normalized.some((item) => item.id === id));
  missingIds.forEach((id) => {
    normalized.push({
      id,
      name: id,
      lowLabel: "低分倾向",
      highLabel: "高分倾向",
      lowDesc: "偏向低分侧的游戏行为。",
      highDesc: "偏向高分侧的游戏行为。"
    });
    console.warn(`[MGTI] dimensions.json 缺少 ${id}，已补入兜底维度。`);
  });

  window.dimensions = normalized;
  return window.dimensions;
}

async function loadQuestions() {
  const data = await fetchJsonWithFallback(
    MGTI_DATA_FILES.questions,
    getDefaultQuestions(),
    { userMessage: "题库加载失败，请检查 data/questions.json。" }
  );

  const rawQuestions = Array.isArray(data?.questions) ? data.questions : [];
  window.questions = rawQuestions
    .map(normalizeQuestion)
    .filter(Boolean);

  window.questionMeta = {
    version: data?.version || "fallback",
    consistency: data?.consistency || null,
    scoring: data?.scoring || null,
    total: window.questions.length
  };

  return window.questions;
}

async function loadHeroProfiles() {
  const data = await fetchJsonWithFallback(
    MGTI_DATA_FILES.heroProfiles,
    getDefaultHeroProfiles(),
    { userMessage: "英雄五维画像加载失败，匹配结果可能不准确。" }
  );

  if (!isPlainObject(data) || !isPlainObject(data.heroes)) {
    console.warn("[MGTI] heroes_profile.json 格式异常，已使用默认英雄五维数据。", data);
    window.heroProfiles = getDefaultHeroProfiles();
  } else {
    const normalizedHeroes = {};
    Object.entries(data.heroes).forEach(([heroName, dimensions]) => {
      if (!heroName) return;
      normalizedHeroes[heroName] = normalizeDimensionObject(dimensions);
    });

    // 保留 scale、dimensionRules、calibrationNotes 等维护字段，方便后续调试和数据校验。
    window.heroProfiles = {
      ...data,
      version: data.version || "1.0",
      heroes: normalizedHeroes
    };
  }

  return window.heroProfiles;
}

async function loadResultTemplates() {
  const fallbackTemplates = getDefaultResultTemplates();
  const data = await fetchJsonWithFallback(
    MGTI_DATA_FILES.resultTemplates,
    fallbackTemplates,
    { userMessage: "结果页模板加载失败，已使用默认文案。" }
  );

  if (!isPlainObject(data)) {
    console.warn("[MGTI] result_templates.json 格式异常，已使用默认结果模板。", data);
    window.resultTemplates = fallbackTemplates;
  } else {
    window.resultTemplates = mergeResultTemplates(fallbackTemplates, data);
  }

  return window.resultTemplates;
}

async function loadMGTIConfigs() {
  const [dimensions, questions, heroProfiles, resultTemplates] = await Promise.all([
    loadDimensions(),
    loadQuestions(),
    loadHeroProfiles(),
    loadResultTemplates()
  ]);

  return {
    dimensions,
    questions,
    heroProfiles,
    resultTemplates
  };
}

// ==================== 英雄数据加载函数 ====================
async function loadChampions() {
  // 先加载 MGTI 配置，确保英雄五维数据可以被合并。
  await loadMGTIConfigs();

  const rawChampions = await fetchJsonWithFallback(
    MGTI_DATA_FILES.champions,
    [],
    { userMessage: "英雄基础数据加载失败，请刷新页面或检查部署路径。" }
  );
  const heroesProfileMap = window.heroProfiles?.heroes || {};

  if (!Array.isArray(rawChampions)) {
    console.error("[MGTI] champions.json 格式错误：根节点应为数组。", rawChampions);
    showUserError("英雄数据格式错误，无法生成图鉴。请检查 champions.json。");
    championsData = [];
    window.championsData = championsData;
    return championsData;
  }

  const uniqueMap = new Map();
  rawChampions.forEach((hero, index) => {
    const heroId = String(hero?.id ?? "").trim();
    const fallbackKey = `__missing_id_${index}_${hero?.name || hero?.title || "unknown"}`;
    const key = heroId || fallbackKey;

    if (uniqueMap.has(key)) {
      const existed = uniqueMap.get(key);
      console.warn(
        `[MGTI] 重复英雄 ID: ${key} (${hero?.name || "未知英雄"})，将保留第一个：${existed?.name || "未知英雄"}`,
        hero
      );
      return;
    }

    uniqueMap.set(key, hero);
  });

  const uniqueChampions = Array.from(uniqueMap.values());
  const missingProfileNames = [];

  championsData = uniqueChampions.map((hero, index) => {
    // 不再把 mbti 字段放入前端英雄对象，避免 catalog/test 继续误用旧体系。
    const { mbti, ...baseHero } = hero || {};
    const profile = findHeroProfile(baseHero, heroesProfileMap);
    const dimensions = normalizeDimensionObject(profile);

    if (!profile) {
      missingProfileNames.push(baseHero.name || baseHero.title || baseHero.alias || `第 ${index + 1} 个英雄`);
    }

    return {
      ...baseHero,
      id: String(baseHero.id ?? ""),
      name: baseHero.name || "未知英雄",
      title: baseHero.title || "",
      alias: baseHero.alias || "",
      story: baseHero.story || "暂无故事数据",
      roles: normalizeRoleList(baseHero.roles),
      tags: normalizeTagList(baseHero.tags),
      release_date: normalizeReleaseDate(baseHero.release_date),
      image_url: baseHero.image_url || "",
      splash_url: baseHero.splash_url || "",
      dimensions,
      vector: dimensionsToVector(dimensions),
      _dataIndex: index
    };
  });

  window.championsData = championsData;

  if (missingProfileNames.length) {
    console.warn(
      `[MGTI] ${missingProfileNames.length} 个英雄缺少 heroes_profile.json 五维画像，已使用 0 值兜底。`,
      missingProfileNames.slice(0, 30)
    );
  }

  console.info(
    `[MGTI] 英雄数据加载完成：${championsData.length} 个英雄。原始 ${rawChampions.length} 个，去重后 ${uniqueChampions.length} 个。`
  );

  return championsData;
}

// ==================== 对外辅助函数 ====================
function getHeroVector(heroName) {
  const resolvedName = resolveHeroName(heroName);
  const profileMap = window.heroProfiles?.heroes || {};

  if (profileMap[resolvedName]) {
    return dimensionsToVector(profileMap[resolvedName]);
  }

  const matchedHero = (window.championsData || []).find((hero) => {
    return hero.name === resolvedName || hero.title === resolvedName || hero.alias === resolvedName;
  });

  if (matchedHero?.dimensions) {
    return dimensionsToVector(matchedHero.dimensions);
  }

  return dimensionsToVector(DEFAULT_HERO_DIMENSIONS);
}

function getHeroDimensions(heroName) {
  const resolvedName = resolveHeroName(heroName);
  const profileMap = window.heroProfiles?.heroes || {};

  if (profileMap[resolvedName]) {
    return normalizeDimensionObject(profileMap[resolvedName]);
  }

  const matchedHero = (window.championsData || []).find((hero) => {
    return hero.name === resolvedName || hero.title === resolvedName || hero.alias === resolvedName;
  });

  return normalizeDimensionObject(matchedHero?.dimensions);
}

function getUserVectorFromScores(scores, questionCount) {
  const scoreMap = isPlainObject(scores) ? scores : {};
  const countMap = isPlainObject(questionCount) ? questionCount : {};

  return MGTI_DIMENSION_IDS.map((dimensionId) => {
    const totalScore = toFiniteNumber(scoreMap[dimensionId], 0);
    const count = isPlainObject(questionCount)
      ? toFiniteNumber(countMap[dimensionId], 0)
      : toFiniteNumber(questionCount, 0);

    if (count <= 0) return 0;

    // 用户答题 rawValue 应在 -2~2，平均后仍限制在 -2~2。
    return Number(clamp(totalScore / count).toFixed(3));
  });
}

function getDominantDimension(dimensions, threshold = 0.5) {
  const normalized = normalizeDimensionObject(dimensions);
  let best = null;

  MGTI_DIMENSION_IDS.forEach((dimensionId) => {
    const value = normalized[dimensionId];
    const absValue = Math.abs(value);

    if (!best || absValue > best.absValue) {
      best = {
        id: dimensionId,
        value,
        absValue,
        label: getDimensionLabel(dimensionId, value),
        meta: getDimensionMeta(dimensionId)
      };
    }
  });

  if (!best || best.absValue < threshold) return null;
  return best;
}

function searchChampionName(keyword) {
  const query = String(keyword || "").trim();
  if (!query) return "";

  const lower = query.toLowerCase();
  return heroAliasMap[query] || heroAliasMap[lower] || query;
}

// ==================== 全局导出 ====================
window.heroAliasMap = heroAliasMap;
window.MGTI_DATA_FILES = MGTI_DATA_FILES;
window.DEFAULT_HERO_DIMENSIONS = DEFAULT_HERO_DIMENSIONS;
window.getDataPathCandidates = getDataPathCandidates;
window.getPrimaryDataBasePath = getPrimaryDataBasePath;
window.showUserError = window.showUserError || showUserError;
window.loadDimensions = loadDimensions;
window.loadQuestions = loadQuestions;
window.loadHeroProfiles = loadHeroProfiles;
window.loadResultTemplates = loadResultTemplates;
window.loadMGTIConfigs = loadMGTIConfigs;
window.loadChampions = loadChampions;
window.getHeroVector = getHeroVector;
window.getHeroDimensions = getHeroDimensions;
window.getUserVectorFromScores = getUserVectorFromScores;
window.getDominantDimension = getDominantDimension;
window.getDimensionMeta = getDimensionMeta;
window.getDimensionLabel = getDimensionLabel;
window.searchChampionName = searchChampionName;
window.normalizeDimensionObject = normalizeDimensionObject;
window.dimensionsToVector = dimensionsToVector;
window.MGTIDataDebug = {
  getRuntimeConfig,
  getDataPathCandidates,
  getPrimaryDataBasePath,
  normalizeDimensionObject,
  dimensionsToVector,
  normalizeQuestion,
  normalizeDimensionMeta
};