# s07 Sessions

## 核心问题

为什么 coding agent 需要 session tree？

因为真实任务会分叉：你会尝试一个方案、回退、换模型、保留另一个分支。线性聊天记录只能“继续往下写”，session tree 才能表达探索。

## 学完你应该理解

- Session 是产品能力，不只是日志文件。
- `id` / `parentId` 可以表示分支。
- 分支保留让 agent 行为更容易复盘，也更适合回滚。

## 运行

```bash
node s07_sessions/code.mjs
```

## 对应 Pi

Pi SDK 文档描述了 `SessionManager.create()`、`continueRecent()`、`open()`、`list()`，以及 `/new`、`/resume`、`/fork`、`/clone` 等 session replacement 场景。
