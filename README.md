MGTI - 游戏人格测试平台
找到与你人格最契合的游戏本命英雄
灵感源自爆火的 SBTI 原神人格测试，MGTI 是一个开源的多游戏宇宙人格测试平台。我们基于官方角色设定与背景故事，通过 MBTI 人格模型，为你匹配最符合你性格的本命角色。
目前项目优先支持《英雄联盟》，后续将逐步扩展至瓦罗兰特、原神等更多热门游戏，让不同游戏的玩家都能找到属于自己的专属角色匹配。
✨ 项目特色
🎮 多游戏宇宙支持：模块化设计，可无缝切换不同游戏的测试题库与角色库
📜 官方正版数据：所有角色数据均来自游戏官方平台，确保设定的准确性与权威性
🧠 精准人格匹配：基于官方剧情资料，通过大语言模型完成标准化 MBTI 人格维度映射
✨ 交互式体验：流畅的答题流程、炫酷的六芒星结果展示，支持生成分享海报
🧩 易扩展架构：低代码即可接入新游戏，欢迎社区贡献更多游戏的支持
🚀 快速开始
环境准备
Python 3.10+ (用于数据处理 pipeline)
Node.js 18+ (用于前端项目)
本地部署
# 1. 克隆项目仓库
git clone https://github.com/jeddakholmes-byte/MGTI.git
cd MGTI

# 2. 初始化数据 pipeline
cd data_pipeline
pip install -r requirements.txt

# 3. 拉取英雄联盟官方最新英雄数据
# 脚本会自动从官方数据源获取所有英雄的完整设定、传记与基础信息
python fetch_lol_data.py

# 4. 运行数据处理，将英雄故事映射为 MBTI 维度数据
python data_processor.py

# 5. 启动前端项目
cd ../
npm install
npm run dev

📚 数据来源
所有游戏数据均来自官方公开平台，保证数据的官方性与时效性：
英雄联盟 (League of Legends)
基础元数据：来自 Riot 官方 Data Dragon 静态数据服务，包含英雄名称、称号、定位、所属地区、官方头像等完整基础信息
背景故事与设定：来自拳头游戏官方 《英雄联盟》宇宙 平台，包含完整的英雄传记、角色性格、人际关系等深度剧情资料，覆盖你需要的所有英雄设定细节
人格映射：基于官方剧情文本，通过大语言模型进行标准化的 MBTI 人格维度分析，确保角色人格匹配的合理性与准确性
📁 项目结构
game-mbti-tester/
│
├── data_pipeline/                # 数据获取与预处理模块 (Python)
│   ├── fetch_lol_data.py         # LOL 官方数据获取脚本
│   ├── fetch_valorant_data.py    # 预留：瓦罗兰特数据脚本
│   ├── requirements.txt          # Python 依赖清单
│   └── data_processor.py         # 背景故事 -> MBTI 维度映射处理脚本
│
├── public/                       # 静态资源
│   ├── datasets/                 # 供前端调用的清洗后 JSON 数据
│   │   ├── lol_champions_full_data.json # 原始LOL英雄完整数据
│   │   ├── lol_mbti_mapping.json # LOL 英雄-MBTI 映射数据
│   │   └── game_list.json        # 支持的游戏列表配置
│   └── images/                   # 游戏角色头像/背景图资源
│
├── src/                          # 前端源码 (React + Vite)
│   ├── components/               # UI 组件
│   │   ├── QuestionCard.jsx      # 交互式答题卡片
│   │   ├── ResultHexagon.jsx     # 六芒星/雷达图结果展示组件
│   │   └── CharacterMatch.jsx    # 本命英雄匹配结果展示组件
│   ├── pages/
│   │   ├── Home.jsx              # 首页：游戏宇宙选择页
│   │   ├── Quiz.jsx              # 测试进行页
│   │   └── Result.jsx            # 结果海报生成页
│   ├── utils/
│   │   └── scoring_algo.js       # 答题分数计算核心算法
│   ├── App.jsx
│   └── main.jsx
│
├── package.json
└── README.md                     # 项目说明文档

🤝 贡献指南
我们非常欢迎社区的贡献！如果你想：
添加新的游戏支持
优化现有的人格映射算法
改进前端交互体验
修复已知问题
请参考贡献指南 (Coming soon)，提交你的 Pull Request！
如何添加新游戏？
在 data_pipeline/ 下新增对应游戏的 fetch_xxx_data.py 脚本，拉取官方角色数据
完善数据处理流程，将角色背景故事映射为标准化的 MBTI 维度数据
在前端添加游戏选择入口与对应的展示逻辑
提交 PR 即可！
📄 许可证
本项目采用 MIT 许可证，你可以自由使用、修改与分发本项目的代码。
⭐ 支持我们
如果你喜欢这个项目，欢迎给我们点个 Star，这是对我们最大的支持！

 