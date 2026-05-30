# MGTI 渐进式答题补丁

把压缩包内文件按原路径覆盖到项目中。

```text
data/questions.json
frontend/js/test.js
frontend/css/style.css
index.html
README.md
PATCH_VALIDATION.md
```

主要变化：

- 保留 80 道候选题。
- 用户先做 20 道基础题。
- 20 道后可以直接出结果，也可以继续做 10 道。
- 继续做题时页面会提示：题目越多，五维均值越稳定，结果越贴近完整算法。
- 修复题目和选项换行后仍然居中的问题。
- 降低题目字号，减少压迫感。

