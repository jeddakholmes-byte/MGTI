// 全局英雄数据存储
let championsData = [];

// 预置的 MBTI 人格映射 (基于英雄性格/故事合理推测，可自行扩展)
const championMbtiMap = {
  "亚索": "ISTP", "永恩": "INFJ", "锐雯": "ESTP", "艾瑞莉娅": "ENFJ",
  "阿狸": "ENFP", "李青": "ISTJ", "卡尔玛": "INFJ", "劫": "INTJ",
  "慎": "ISTJ", "凯南": "ENFP", "阿卡丽": "ISTP", "烬": "INTJ",
  "瑟提": "ESTP", "佛耶戈": "ENTJ", "卡莉丝塔": "ISTJ", "锤石": "ENTP",
  "卢锡安": "ESTJ", "赛娜": "INFJ", "格温": "INFP", "薇恩": "ISTP",
  "盖伦": "ESTJ", "拉克丝": "ENFP", "加里奥": "ISFJ", "嘉文四世": "ENTJ",
  "赵信": "ISFJ", "菲奥娜": "ENTJ", "奎因": "ISTP", "德莱厄斯": "ESTJ",
  "斯维因": "INTJ", "卡特琳娜": "ESTP", "德莱文": "ESFP", "弗拉基米尔": "ENTP",
  "乐芙兰": "ENTP", "玛尔扎哈": "INTJ", "卡萨丁": "INFJ", "卡莎": "ISFP",
  "凯尔": "ESTJ", "莫甘娜": "INFP", "潘森": "ESTP", "蕾欧娜": "ESTJ",
  "黛安娜": "INFP", "佐伊": "ENFP", "奥瑞利安·索尔": "INTP", "巴德": "INFP",
  "索拉卡": "INFJ", "娜美": "ENFJ", "塔莉垭": "ENFP", "妮蔻": "ENFP",
  "洛": "ESFP", "霞": "ISTP", "克烈": "ESTP", "艾克": "ENTP",
  "金克丝": "ENTP", "蔚": "ESTP", "凯特琳": "ISTJ", "杰斯": "ENTJ",
  "维克托": "INTJ", "黑默丁格": "INTP", "吉格斯": "ENTP", "提莫": "INFP",
  "崔丝塔娜": "ESFJ", "库奇": "ESTP", "兰博": "ENTP", "璐璐": "ENFP",
  "维迦": "INTJ", "阿木木": "INFP", "艾翁": "INFP", "奥恩": "ISTJ",
  "沃利贝尔": "ESTP", "艾尼维亚": "INFJ", "乌迪尔": "ISFP", "布兰德": "ENTP",
  "雷克顿": "ESTP", "内瑟斯": "ISTJ", "阿兹尔": "ENTJ", "泽拉斯": "INTJ",
  "希维尔": "ESTP", "雷恩加尔": "ISTP", "卡兹克": "ENTP", "雷克塞": "ISTP",
  "科加斯": "ENTJ", "克格莫": "ISFP", "维克兹": "INTP", "卑尔维斯": "INTJ",
  "费德提克": "INTP", "魔腾": "INTJ", "伊芙琳": "ENTP", "塔姆": "ESTP",
  "派克": "ISTP", "俄洛伊": "ESTJ", "诺提勒斯": "ISTJ", "菲兹": "ENFP",
  "墨菲特": "ISTJ", "蒙多医生": "ESFP", "扎克": "ENFP", "布里茨": "ENFJ",
  "奥莉安娜": "INTJ", "辛吉德": "INTP", "图奇": "ISTP", "厄加特": "ESTP",
  "沃里克": "ISTP", "约里克": "INFJ", "茂凯": "INFJ", "卡尔萨斯": "INTJ",
  "赫卡里姆": "ESTJ", "卡西奥佩娅": "ENTJ", "娜亚菲利": "ESTP", "贝蕾亚": "ESFP",
  "米利欧": "ENFJ", "奎桑提": "ESTJ", "彗": "INFP", "斯莫德": "ENFP",
  "亚托克斯": "ENTJ", "韦鲁斯": "INTJ", "莉莉娅": "INFP", "悠米": "ENFP",
  "妮菈": "ESTP", "泽丽": "ENFP", "烈娜塔": "ENTJ", "萨勒芬妮": "ENFJ",
  "梅尔": "ENTJ", "安蓓萨": "ESTJ", "芸阿娜": "ISTJ", "诺拉": "ENFP",
  "亚恒": "INTJ", "阿萝拉": "INFP", "芮尔": "ESTP", "格温": "INFP",
  "艾希": "ISTJ", "瑟庄妮": "ESTJ", "泰达米尔": "ESTP", "奥拉夫": "ESTP",
  "布隆": "ESFJ", "古拉加斯": "ESFP", "特朗德尔": "ESTP", "努努和威朗普": "ENFP",
  "易": "INTP", "孙悟空": "ENFP", "索拉卡": "INFJ", "娜美": "ENFJ",
  "塔莉垭": "ENFP", "妮蔻": "ENFP", "洛": "ESFP", "霞": "ISTP",
  "克烈": "ESTP", "艾克": "ENTP", "金克丝": "ENTP", "蔚": "ESTP",
  "凯特琳": "ISTJ", "杰斯": "ENTJ", "维克托": "INTJ", "黑默丁格": "INTP",
  "吉格斯": "ENTP", "提莫": "INFP", "崔丝塔娜": "ESFJ", "库奇": "ESTP",
  "兰博": "ENTP", "璐璐": "ENFP", "维迦": "INTJ", "阿木木": "INFP",
  "艾翁": "INFP", "奥恩": "ISTJ", "沃利贝尔": "ESTP", "艾尼维亚": "INFJ",
  "乌迪尔": "ISFP", "布兰德": "ENTP", "雷克顿": "ESTP", "内瑟斯": "ISTJ",
  "阿兹尔": "ENTJ", "泽拉斯": "INTJ", "希维尔": "ESTP", "雷恩加尔": "ISTP",
  "卡兹克": "ENTP", "雷克塞": "ISTP", "科加斯": "ENTJ", "克格莫": "ISFP",
  "维克兹": "INTP", "卑尔维斯": "INTJ", "费德提克": "INTP", "魔腾": "INTJ",
  "伊芙琳": "ENTP", "塔姆": "ESTP", "派克": "ISTP", "俄洛伊": "ESTJ",
  "诺提勒斯": "ISTJ", "菲兹": "ENFP", "墨菲特": "ISTJ", "蒙多医生": "ESFP",
  "扎克": "ENFP", "布里茨": "ENFJ", "奥莉安娜": "INTJ", "辛吉德": "INTP",
  "图奇": "ISTP", "厄加特": "ESTP", "沃里克": "ISTP", "约里克": "INFJ",
  "茂凯": "INFJ", "卡尔萨斯": "INTJ", "赫卡里姆": "ESTJ", "卡西奥佩娅": "ENTJ",
  "娜亚菲利": "ESTP", "贝蕾亚": "ESFP", "米利欧": "ENFJ", "奎桑提": "ESTJ",
  "彗": "INFP", "斯莫德": "ENFP", "亚托克斯": "ENTJ", "韦鲁斯": "INTJ",
  "莉莉娅": "INFP", "悠米": "ENFP", "妮菈": "ESTP", "泽丽": "ENFP",
  "烈娜塔": "ENTJ", "萨勒芬妮": "ENFJ", "梅尔": "ENTJ", "安蓓萨": "ESTJ",
  "芸阿娜": "ISTJ", "诺拉": "ENFP", "亚恒": "INTJ", "阿萝拉": "INFP",
  "芮尔": "ESTP", "格温": "INFP", "艾希": "ISTJ", "瑟庄妮": "ESTJ",
  "泰达米尔": "ESTP", "奥拉夫": "ESTP", "布隆": "ESFJ", "古拉加斯": "ESFP",
  "特朗德尔": "ESTP", "努努和威朗普": "ENFP"
};

// 加载 champions.json
async function loadChampions() {
  try {
    const response = await fetch('../data/champions.json');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    let champions = await response.json();
    // 附加 MBTI 字段，并确保图片 URL 存在
    champions = champions.map(champ => {
      let mbti = championMbtiMap[champ.name] || "未知";
      // 保证图片字段存在，若无则使用默认占位图（Data Dragon 默认英雄头像）
      const imageUrl = champ.image_url || "https://ddragon.leagueoflegends.com/cdn/15.5.1/img/champion/default.png";
      const splashUrl = champ.splash_url || "https://via.placeholder.com/1920x1080?text=No+Splash";
      return { ...champ, mbti, image_url: imageUrl, splash_url: splashUrl };
    });
    championsData = champions;
    return champions;
  } catch (error) {
    console.error('加载英雄数据失败:', error);
    // 返回空数组，避免页面崩溃
    return [];
  }
}