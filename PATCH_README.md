# MGTI Answer State Fix v5.1

本补丁修复“上一题选项高光残留到下一题”的严重交互问题，并顺手优化题目区域视觉表现。

## 覆盖文件

按路径覆盖到项目中：

```text
frontend/js/test.js
frontend/css/style.css
index.html
sw.js
```

## 修复点

### 1. JS 状态修复

`frontend/js/test.js` 增加了以下机制：

- 每次渲染新题前，清空上一题的临时选中态。
- 每次渲染新题前，主动 `blur()` 题目区域内的当前焦点元素。
- 点击选项后，只给当前题当前选项加 `.is-selected` 和 `aria-pressed="true"`。
- 点击选项后，其他选项统一恢复 `aria-pressed="false"`。
- 答题动画期间给选项加 `is-answering`，防止用户连续误触。
- 进度 key 升级为 `mgti_progress_v5_answer_state_fix`，避免旧缓存进度污染新流程。

### 2. CSS 状态修复

`frontend/css/style.css` 增加了末尾覆盖样式：

- 真正的选中态只由 `.is-selected` 或 `aria-pressed="true"` 控制。
- `hover` 和 `focus-visible` 不再长得像“已经选择”。
- 移动端禁用 sticky hover 的强高亮效果。
- 选中态增加 `✓` 标识，降低误判。
- 题目和选项继续保持左对齐，避免长文本换行后居中。

### 3. 缓存修复

`index.html` 和 `sw.js` 升级版本号：

```text
mgti-answer-state-v51
mgti-cache-v5-answer-state-fix
```

这可以减少浏览器继续使用旧 JS / CSS 的概率。

## 覆盖后建议操作

覆盖文件后强制刷新：

```text
Mac：Command + Shift + R
Windows：Ctrl + Shift + R
```

如果仍然看到旧样式，打开 DevTools：

```text
Application → Service Workers → Unregister
Application → Storage → Clear site data
```

再重新打开页面测试。
