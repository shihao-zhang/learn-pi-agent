# s04 Prompt Templates

## 核心问题

重复任务怎么变成一个可复用入口？

Pi 的 prompt template 是 Markdown 片段。文件名变成 slash command，用户输入 `/review`，模板展开成完整 prompt。

## 学完你应该理解

- Prompt template 适合高频、低状态、需要统一口径的任务。
- 它不是 skill：template 只展开文本，skill 可以携带工作流、脚本和资料。
- 参数让模板从“固定话术”变成“轻量命令”。

## 运行

```bash
node s04_prompt_templates/code.mjs
```

## 对应 Pi

真实 Pi 会发现 `.pi/prompts/*.md`。本仓库的样例是 [.pi/prompts/review.md](../.pi/prompts/review.md)。
