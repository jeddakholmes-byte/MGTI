# MGTI - 英雄联盟五维游戏人格测试

MGTI，全称 **My Game Type Indicator**。项目基于《英雄联盟》的英雄定位、玩法特征与玩家游戏行为，构建一个五维连续向量人格测试系统。

当前版本已经移除传统 MBTI 的 16 型分类逻辑。系统使用 `TAC / TEA / EMO / DEC / PRE` 五个维度描述玩家风格，并将玩家答题结果与英雄五维画像进行向量匹配。测试结果不再依赖固定类型标签，而是根据玩家和英雄的行为相似度生成本命英雄。

## 项目目标

MGTI 主要解决三类问题。

| 问题 | 原有表现 | 当前处理方式 |
| --- | --- | --- |
| 类型过粗 | 16 型人格无法区分同类英雄差异 | 使用五维连续分数描述英雄风格 |
| 游戏关联弱 | I/E、N/S 等字母与真实游戏行为关系较弱 | 使用对线、支援、团战、开团、英雄偏好等场景定义维度 |
| 结果解释弱 | 只给出英雄，缺少匹配理由 | 结果页展示用户五维得分、维度解释、匹配英雄打法建议 |

## MGTI 五维体系

每个维度的分值区间为 `-2 ~ +2`。负数代表低分倾向，正数代表高分倾向。数值越接近两端，风格越鲜明。

| 维度代码 | 维度名称 | 低分倾向 | 高分倾向 | 游戏内表现 |
| --- | --- | --- | --- | --- |
| TAC | 战术风格 | 直觉型 | 谋略型 | 直觉型更依赖手感和临场反应；谋略型更重视技能冷却、兵线、换血收益和视野信息 |
| TEA | 团队角色 | 独行侠 | 团队核心 | 独行侠偏单带、单杀和个人突破；团队核心偏支援、开团、保护和资源联动 |
| EMO | 情绪反应 | 冷静 | 激情 | 冷静型能处理逆风和失误；激情型更容易被击杀、优势或残血目标激发进攻欲望 |
| DEC | 决策速度 | 谨慎 | 果敢 | 谨慎型等待关键技能和队友位置；果敢型看到机会会立刻动手 |
| PRE | 英雄偏好 | 传统 | 异类 | 传统型偏稳定输出和低风险英雄；异类型偏高操作、高风险、高收益英雄 |


## 渐进式答题逻辑

当前题库保留 80 道候选题。系统不会要求用户一次做完全部题目。

默认流程如下。

```text
候选题库：80 道
基础题量：20 道
继续追加：每次 10 道
用户选择：20 道后可以直接出结果，也可以继续做题
```

用户完成 20 道基础题后，页面会显示一个选择卡片。用户可以直接出结果，也可以继续做 10 道。提示文案会说明：继续做题会覆盖更多候选题，减少随机抽题偏差，使五维均值更稳定，英雄匹配更贴近完整算法。

这个设计保留了完整题库的算法空间，也降低了普通用户的完成压力。娱乐测试默认不应该强迫用户完成 80 道题。

## 当前功能

- 在线答题测试。
- 五维分数实时计算。
- 反向题与一致性校验。
- 结果页展示用户五维条形图。
- 结果页展示每个维度的高低分解释。
- 根据英雄五维画像进行向量匹配。
- 英雄图鉴支持搜索、排序、维度筛选。
- 英雄图鉴支持分批加载，降低低端手机渲染压力。
- 支持 PWA 基础能力，可缓存核心静态资源。
- 支持社交分享预览图。
- 支持集中配置数据路径和部署路径。

## 项目结构

```text
MGTI/
├── crawler/
│   ├── __init__.py
│   └── main.py                         # 英雄基础数据爬虫脚本
│
├── data/
│   ├── champions.json                  # 英雄基础信息：名称、称号、故事、头像、原画、定位等
│   ├── dimensions.json                 # MGTI 五维定义、文案、行为解释
│   ├── questions.json                  # 测试题库、反向题、一致性校验配置
│   ├── heroes_profile.json             # 英雄五维分数画像
│   └── result_templates.json           # 结果页文案模板、维度短句、角色建议
│
├── frontend/
│   ├── css/
│   │   └── style.css                   # 全局样式、测试页、结果页、图鉴页样式
│   │
│   └── js/
│       ├── config.js                   # 新增：全局配置，必须在 data.js 前加载
│       ├── data.js                     # 数据加载、路径回退、数据标准化、英雄合并
│       ├── test.js                     # 测试流程、答题计分、结果匹配、一致性提示
│       └── catalog.js                  # 英雄图鉴搜索、排序、筛选、分批加载、详情弹窗
│
├── assets/
│   ├── icons/
│   │   ├── icon-192.png                # 新增：PWA 192 图标
│   │   └── icon-512.png                # 新增：PWA 512 图标
│   │
│   └── og/
│       └── mgti-og.png                 # 新增：社交分享预览图，建议 1200×630
│
├── index.html                          # 测试主页
├── catalog.html                        # 英雄图鉴页
├── manifest.json                       # 新增：PWA 应用声明文件
├── sw.js                               # 新增：Service Worker 缓存脚本
├── README.md                           # 项目说明与维护指南
├── requirements.txt                    # Python 爬虫依赖
└── .gitignore
```

## 刚刚新增文件的放置位置

下面这些文件需要放到指定位置。路径必须保持一致，因为 `index.html`、`catalog.html` 和 `sw.js` 已经按这些路径引用。

| 新增文件 | 放置位置 | 用途 | 是否必须 |
| --- | --- | --- | --- |
| `config.js` | `frontend/js/config.js` | 统一管理数据路径、部署基础路径、题目版本号、统计配置 | 必须 |
| `manifest.json` | 项目根目录 `manifest.json` | PWA 应用名称、图标、主题色、启动地址配置 | 建议保留 |
| `sw.js` | 项目根目录 `sw.js` | Service Worker，用于缓存核心静态资源 | 建议保留 |
| `icon-192.png` | `assets/icons/icon-192.png` | PWA 小尺寸图标 | 建议保留 |
| `icon-512.png` | `assets/icons/icon-512.png` | PWA 大尺寸图标 | 建议保留 |
| `mgti-og.png` | `assets/og/mgti-og.png` | 微信、QQ、Twitter、Discord 等分享时的预览图 | 建议保留 |

当前两个 HTML 页面已经引用这些文件。不要把它们放进 `data/`，也不要放进 `frontend/css/`。

## 替换文件清单

如果你是把我生成的文件合并回项目，请按下面路径替换。

| 生成文件 | 项目内目标路径 |
| --- | --- |
| `dimensions.json` | `data/dimensions.json` |
| `questions.json` | `data/questions.json` |
| `result_templates.json` | `data/result_templates.json` |
| `heroes_profile.json` | `data/heroes_profile.json` |
| `style.css` | `frontend/css/style.css` |
| `catalog.js` | `frontend/js/catalog.js` |
| `data.js` | `frontend/js/data.js` |
| `test.js` | `frontend/js/test.js` |
| `config.js` | `frontend/js/config.js` |
| `index.html` | `index.html` |
| `catalog.html` | `catalog.html` |
| `manifest.json` | `manifest.json` |
| `sw.js` | `sw.js` |
| `icon-192.png` | `assets/icons/icon-192.png` |
| `icon-512.png` | `assets/icons/icon-512.png` |
| `mgti-og.png` | `assets/og/mgti-og.png` |

## 脚本加载顺序

`config.js` 必须在 `data.js` 之前加载。`data.js` 必须在业务脚本之前加载。

测试页加载顺序：

```html
<script src="frontend/js/config.js" defer></script>
<script src="frontend/js/data.js" defer></script>
<script src="frontend/js/test.js" defer></script>
```

图鉴页加载顺序：

```html
<script src="frontend/js/config.js" defer></script>
<script src="frontend/js/data.js" defer></script>
<script src="frontend/js/catalog.js" defer></script>
```

不要把 `test.js` 放在 `data.js` 前面。否则 `window.loadChampions()`、`window.questions`、`window.dimensions` 等对象可能还没有准备好。

## 本地运行方式

项目是纯前端页面。不要直接双击 `index.html` 运行。浏览器在 `file://` 协议下会限制 `fetch()` 加载 JSON。

推荐使用本地静态服务。

```bash
# 进入项目根目录
cd MGTI

# Python 3
python -m http.server 8000
```

访问：

```text
http://localhost:8000/
http://localhost:8000/catalog.html
```

`data.js` 在本地开发环境会优先尝试 `./data/`。生产环境默认尝试 `/MGTI/data/`，同时保留 `../data/` 和 `/data/` 回退路径。

## 部署路径配置

部署到 GitHub Pages 的项目路径通常类似：

```text
https://your-name.github.io/MGTI/
```

这种情况下可以保留当前默认配置。

如果你部署到根域名，例如：

```text
https://example.com/
```

需要检查 `frontend/js/config.js` 中的基础路径，将项目路径从 `/MGTI/` 改成 `/`。

如果你部署到其他子目录，例如：

```text
https://example.com/tools/mgti/
```

需要同步修改：

- `frontend/js/config.js` 中的数据路径。
- `index.html` 的 `canonical`、`og:url`、`og:image`。
- `catalog.html` 的 `canonical`、`og:url`、`og:image`。
- `sw.js` 中需要缓存的静态文件路径。
- `manifest.json` 中的 `start_url` 和 `scope`。

## 数据文件说明

### `data/dimensions.json`

用于定义五个维度的名称、标签和解释文案。

核心字段需要保持：

```json
{
  "id": "TAC",
  "name": "战术风格",
  "lowLabel": "直觉型",
  "highLabel": "谋略型",
  "lowDesc": "...",
  "highDesc": "..."
}
```

可以继续添加扩展字段。前端只依赖核心字段，扩展字段不会破坏现有逻辑。

### `data/questions.json`

用于定义测试题。

核心字段需要保持：

```json
{
  "id": "Q_TAC_01",
  "text": "我会主动记录对方关键技能冷却时间。",
  "dimension": "TAC",
  "reverse": true
}
```

当前 `test.js` 支持题目权重、一致性配对和反向题。题目扩展字段可以用于后续分析，但不要删除 `text / dimension / reverse`。

### `data/heroes_profile.json`

用于定义英雄五维画像。

核心结构需要保持：

```json
{
  "version": "2.0",
  "heroes": {
    "盲僧": {
      "TAC": -1.24,
      "TEA": -0.39,
      "EMO": 0.85,
      "DEC": 1.58,
      "PRE": 1.51
    }
  }
}
```

英雄名必须和 `champions.json` 中的 `name` 字段一致。否则 `data.js` 无法把英雄基础资料和五维画像合并。

### `data/champions.json`

用于定义英雄基础信息。

核心字段建议保持：

```json
{
  "id": "64",
  "name": "盲僧",
  "title": "李青",
  "alias": "LeeSin",
  "story": "...",
  "roles": ["fighter", "assassin"],
  "release_date": "2011-04-01",
  "image_url": "...",
  "splash_url": "..."
}
```

后续仍需要补齐 `release_date`，并重新审核 `roles`。当前项目可以在 `release_date` 为空时正常运行，但图鉴信息不够完整。

### `data/result_templates.json`

用于定义结果页文案。

保留字段：

```json
{
  "dimensionPhrases": {},
  "roleDescriptions": {},
  "personalityTemplate": "...",
  "synergies": [],
  "defaultAdvice": "...",
  "shareTemplate": "..."
}
```

新增的维度解释、矛盾答案提示、英雄建议都可以放在这个文件中。

## 英雄五维评分规则

英雄评分不要按职业批量复制。相同职业内部也需要区分。

| 维度 | 正值倾向 | 负值倾向 |
| --- | --- | --- |
| TAC | 需要技能预判、连招规划、视野计算、兵线管理 | 依赖手感、贴脸反应、临场操作 |
| TEA | 强开团、保护、支援、团队资源联动 | 单带、刺杀、单人突破、个人压制 |
| EMO | 易上头、越打越兴奋、残血追击、强烈进攻欲 | 稳定运营、逆风止损、长期耐心 |
| DEC | 机会出现时快速动手，吃操作窗口 | 等关键时机、等技能、等队友、等资源 |
| PRE | 高操作、高风险、非常规、刺客型、秀操作型 | 传统、安全、站桩、稳定输出型 |

评分建议：

- 普通英雄不要全部集中在 `0` 附近。
- 风格鲜明英雄至少有 1 到 2 个维度超过 `±1.0`。
- 极端英雄可以接近 `±1.6`，但不建议大量使用 `±2.0`。
- 同一位置英雄应体现玩法差异。比如亚索和永恩不能完全同分，女警和金克丝也不能完全同分。
- 分数保留 1 到 2 位小数即可。

## 题库维护规则

每个维度建议至少 4 道题。题目不要只问抽象性格，要绑定游戏行为。

好题目示例：

```text
我会主动记住对方闪现、净化、秒表或关键大招的大致时间。
```

较弱题目示例：

```text
我是一个聪明的人。
```

反向题需要和正向题成对出现。成对题不能措辞完全重复，但意思需要相反。这样才能检测用户是否全程乱点或自相矛盾。

一致性校验不用于否定用户结果，只用于提示：

```text
部分答案可能存在矛盾，建议重新测试。
```

## 前端逻辑说明

### `frontend/js/data.js`

负责加载并合并数据。

主要职责：

- 读取 `dimensions.json`。
- 读取 `questions.json`。
- 读取 `champions.json`。
- 读取 `heroes_profile.json`。
- 读取 `result_templates.json`。
- 合并英雄基础资料和五维画像。
- 去重重复英雄 ID。
- 把英雄五维分数限制在 `-2 ~ +2`。
- 提供 `window.loadChampions()`、`window.getHeroVector()` 等全局函数。

### `frontend/js/test.js`

负责测试流程。

主要职责：

- 渲染题目。
- 记录用户答案。
- 防止 300ms 内重复点击。
- 计算五维得分。
- 执行一致性校验。
- 匹配英雄。
- 渲染结果页。
- 展示维度解释和矛盾答案提示。
- 处理重新测试确认。

### `frontend/js/catalog.js`

负责英雄图鉴。

主要职责：

- 搜索英雄名称、英文别名和常用外号。
- 按维度排序。
- 按维度高低分筛选。
- 首次渲染 50 个英雄。
- 滚动到底部继续加载。
- 展示英雄五维详情弹窗。

## PWA 文件说明

### `manifest.json`

浏览器会读取该文件，用于展示应用名称、图标、主题色和启动路径。

它应放在项目根目录，并由 HTML 引用：

```html
<link rel="manifest" href="manifest.json">
```

### `sw.js`

Service Worker 只能在 HTTPS 或 `localhost` 下正常注册。直接双击 HTML 时不会生效。

它应放在项目根目录。这样它的作用域可以覆盖整个站点。

### `assets/icons/`

用于存放 PWA 图标。当前包含：

```text
assets/icons/icon-192.png
assets/icons/icon-512.png
```

### `assets/og/`

用于存放社交分享图。当前包含：

```text
assets/og/mgti-og.png
```

如果后续重新设计封面图，建议保持 1200×630 的比例。

## 后续仍需要修改的地方

### `data/champions.json`

需要补齐 `release_date`。

建议格式：

```json
"release_date": "2011-04-01"
```

还需要重新审核 `roles`。例如部分英雄历史数据中包含非常规定位，但图鉴里应优先使用官方定位和长期主流定位。

### `crawler/main.py`

当前爬虫主要用于抓取腾讯英雄基础数据。后续可以增加：

- 自动补齐 `release_date`。
- 抓取官方英雄定位。
- 合并时保留人工维护字段。
- 避免爬虫覆盖 `heroes_profile.json` 的手工评分。

### `crawler/validate.py`

建议新增数据校验脚本。

校验内容：

- JSON 是否能正常解析。
- `champions.json` 是否存在 `id / name / title / alias / roles / image_url / splash_url`。
- `heroes_profile.json` 是否覆盖所有英雄。
- 五维分数是否都在 `-2 ~ +2`。
- `questions.json` 的 `dimension` 是否只使用 `TAC / TEA / EMO / DEC / PRE`。
- 一致性校验题是否能找到对应题目。

### `.github/workflows/validate-data.yml`

建议新增 GitHub Actions。每次修改 `data/`、`frontend/js/` 或 HTML 时自动运行校验。

### `Dockerfile` 和 `nginx.conf`

如果需要部署到云服务器，可以加入静态站点镜像。项目本身不需要 Node 构建，Nginx 直接托管即可。

### 统计代码

HTML 中已经预留统计扩展的空间。后续可以接入：

- Google Analytics。
- Umami。
- 自建后端接口。

建议追踪事件：

- 开始测试。
- 完成测试。
- 重新测试。
- 分享结果。
- 图鉴搜索关键词。
- 图鉴维度筛选。
- 最终匹配英雄分布。

## 常见问题

### 页面打开后一直显示加载失败

常见原因是直接双击 `index.html`。请使用本地静态服务。

```bash
python -m http.server 8000
```

### 英雄图鉴没有显示五维分数

检查 `heroes_profile.json` 中的英雄名是否和 `champions.json` 的 `name` 完全一致。

### 修改了 JSON 后页面没有变化

浏览器可能命中了 Service Worker 缓存。可以尝试：

- 强制刷新页面。
- 清除浏览器站点数据。
- 在 DevTools 的 Application 面板中 unregister Service Worker。
- 修改 `sw.js` 里的缓存版本号。

### 分享图没有显示

检查 `assets/og/mgti-og.png` 是否存在，并检查 `og:image` 是否是可公网访问的完整地址。部分平台不会读取相对路径。

## 维护原则

- 数据字段可以扩展，但不要删除现有核心字段。
- 维度 ID 保持大写：`TAC / TEA / EMO / DEC / PRE`。
- 英雄名以 `champions.json` 的 `name` 为准。
- 不要让爬虫覆盖人工评分文件。
- 修改数据后优先本地跑一遍页面。
- 上线前检查浏览器控制台是否有 JSON 加载错误。


## V3：趣味化与随机抽题改造说明

当前版本在不推翻五维算法的前提下，增加了一层更适合传播的“峡谷人格发疯测试”表达。
底层仍然是：用户答题 → TAC / TEA / EMO / DEC / PRE 五维向量 → 与英雄五维向量做余弦相似度匹配。
前台展示改成：随机题面 → 梗化人格标题 → 本命英雄 → 系统诊断 → 分享文案。

### 随机抽题规则

`data/questions.json` 中现在包含 80 道候选题。
五个维度各 16 道。
每个维度由 8 组相反题组成。
每次测试从每个维度随机抽 3 组相反题，也就是每个维度 6 道。
五个维度合计 30 道。

这个规则由 `questions.json` 顶部的 `sampling` 字段控制：

```json
{
  "enabled": true,
  "strategy": "balanced-pairs-per-dimension",
  "pairsPerDimension": 3,
  "questionsPerDimension": 6,
  "totalQuestions": 30
}
```

如需缩短测试，可以把 `pairsPerDimension` 改成 `2`，总题量会变成 20 道。
如需更稳定的结果，可以把 `pairsPerDimension` 改成 `4`，总题量会变成 40 道。

### 新增字段不会破坏旧逻辑

题目仍保留旧代码需要的三个字段：

```json
{
  "text": "题目文案",
  "dimension": "TAC",
  "reverse": false
}
```

V3 额外增加了：

```json
{
  "plainText": "严肃解释版题目",
  "funText": "前端优先展示的玩梗题目",
  "polarity": "low",
  "consistencyPairId": "TAC-C1",
  "tone": "self-roast",
  "tags": ["手感", "低分侧"]
}
```

`test.js` 会优先显示 `funText`。
如果没有 `funText`，会回退到 `text`。

### 页面排版修正

旧版页面中，较长题目和结果说明容易出现“整段居中换行”的问题。
V3 已调整：

- 题目正文改为左对齐。
- 结果说明改为左对齐。
- 首页说明卡片改为左对齐。
- 只保留品牌标题、头像区域等适合居中的元素。
- 使用 `text-wrap: balance / pretty` 和 `overflow-wrap` 减少难看的断行。

### 本次需要覆盖的文件

请按下面路径替换：

```text
MGTI/
├── data/
│   ├── dimensions.json
│   ├── questions.json
│   └── result_templates.json
├── frontend/
│   ├── css/
│   │   └── style.css
│   └── js/
│       ├── data.js
│       └── test.js
├── index.html
└── README.md
```

`catalog.js` 和 `catalog.html` 本次没有强制改动。
它们仍可读取新字段，但图鉴页的娱乐化展示可以后续单独做。
