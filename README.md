# MGTI - 英雄联盟英雄人格测试

基于英雄联盟官方英雄设定的人格测试项目，灵感来源于爆火的 SBTI 赛博人格测试。

通过自动爬取英雄联盟宇宙官方的英雄背景故事与设定资料，我们整理了完整的英雄资料库，并基于 MBTI 人格理论，打造了这款游戏人格测试，帮你找到最契合你人格的英雄联盟英雄！

## ✨ 功能特性



* 🤖 **自动爬取官方资料**：一键爬取英雄联盟宇宙所有英雄的官方背景故事、设定资料，自动整理成结构化资料库

* 🧑‍💻 **在线交互测试**：纯前端无后端的交互测试，回答问题即可为你匹配最契合的英雄联盟英雄人格

* 📚 **完整英雄图鉴**：查看所有英雄的 MBTI 人格类型，以及对应的官方背景故事，探索符文之地的英雄们

* 🚀 **一键部署**：支持一键部署到 GitHub Pages，无需服务器，开箱即用

## 📂 项目结构



```
MGTI/

├── crawler/                  # 爬虫模块

│   ├── \_\_init\_\_.py

│   └── main.py              # 爬虫主脚本，用于爬取官方英雄数据

├── data/                     # 数据存储目录

│   └── champions.json        # 爬取整理后的英雄结构化数据

├── frontend/                 # 前端交互页面

│   ├── css/

│   │   └── style.css         # 全局样式

│   └── js/

│       ├── data.js           # 数据加载与处理

│       ├── test.js           # 测试核心逻辑

│       └── catalog.js        # 图鉴页面逻辑

├── .gitignore                # Git 忽略文件配置

├── README.md                 # 项目文档

├── index.html            # 人格测试主页面

├── catalog.html          # 英雄图鉴页面

└── requirements.txt          # Python 依赖配置
```

## 🚀 快速开始

### 1. 克隆项目



```
git clone https://github.com/jeddakholmes-byte/MGTI.git

cd MGTI
```

### 2. 安装爬虫依赖

我们使用 Python 编写爬虫来获取官方最新的英雄数据：



```
pip install -r requirements.txt
```

### 3. 运行爬虫，获取最新英雄数据

运行爬虫脚本，自动爬取英雄联盟宇宙的所有英雄设定与故事：



```
python crawler/main.py
```

执行完成后，最新的英雄数据会自动保存到 `data/champions.json`

### 4. 启动前端页面

你可以直接打开 `frontend/index.html` 来本地体验测试，或者使用任意静态文件服务器：



```
\# 使用 Python 内置的静态服务器

cd frontend

python -m http.server 8080
```

然后访问 `http://localhost:8080` 即可开始测试！

### 5. 部署到 GitHub Pages

你可以轻松将前端页面部署到 GitHub Pages，让所有人都能访问你的测试：



1. Fork 本项目

2. 在项目的 Settings -> Pages 中，将部署源设置为 `frontend` 目录

3. 等待部署完成，即可通过你的 GitHub Pages 地址访问！

## 🤝 贡献指南

欢迎任何形式的贡献！你可以：



* 完善测试题库，让测试结果更准确

* 补充英雄的 MBTI 人格分类

* 优化前端页面的交互与样式

* 改进爬虫，支持更多官方资料的爬取（比如地区故事、英雄关系等）

* 提交 Issue 反馈问题或建议

## 📜 许可证

本项目采用 [MIT](LICENSE) 许可证开源。

## 🙏 致谢



* [SBTI](https://github.com/pingfanfan/SBTI)：本项目的灵感来源，感谢开发者的开源工作

* [Riot Games](https://www.riotgames.com/)：感谢拳头游戏创造了英雄联盟以及丰富的英雄世界观

* 所有为这个项目贡献过代码的开发者们



***

⭐ 如果这个项目对你有帮助，欢迎给我们点个 Star 支持一下！
