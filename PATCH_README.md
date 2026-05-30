# MGTI Gate Choice Fix Patch

这次补丁修复两个实际问题：

1. 做完 20 道后没有出现“直接出结果 / 继续做题”的选择页。
2. 题目区域仍然居中、字号偏大，长题目换行后不好看。

请按路径覆盖：

```text
MGTI/
├── data/
│   └── questions.json
├── frontend/
│   ├── css/
│   │   └── style.css
│   └── js/
│       └── test.js
├── index.html
├── sw.js
└── README.md
```

覆盖后建议在浏览器里强制刷新一次：

```text
Mac: Command + Shift + R
Windows: Ctrl + Shift + R
```

如果你之前已经安装过 PWA 或浏览器强缓存非常顽固，可以在 DevTools → Application → Service Workers 里点 Unregister，再刷新页面。
