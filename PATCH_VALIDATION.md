# MGTI Gate Choice Fix Validation
## 修改结论
- 已重新修复 `test.js`。完成 20 道后会进入选择页，不会继续自动渲染第 21 题。
- 已升级 `PROGRESS_KEY` 和 `PROGRESS_VERSION`，旧的 80 题进度不会继续污染新流程。
- 已给 `index.html` 的 CSS/JS 引用增加 `?v=mgti-gate-v4`，避免浏览器或 Service Worker 继续使用旧缓存。
- 已升级 `sw.js` 缓存版本，并把 JS/CSS 改为 network-first。
- 已追加更强 CSS 选择器，压掉题目区域居中、字号过大、换行居中的问题。

## 题库配置
- 候选题数量：80
- 基础题量：20
- 每次继续追加：10
- 最大题量：80

## 语法检查
```text
node --check exit code: 0
```
