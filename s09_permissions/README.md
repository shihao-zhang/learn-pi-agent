# s09 Permissions

## 核心问题

极简 harness 是否就不需要权限系统？

恰恰相反。工具越强，边界越要清楚。`bash`、`write`、`edit` 都能造成真实影响，harness 至少要能 allow、ask、block。

## 学完你应该理解

- 权限不是“降低 agent 能力”，而是给能力可控出口。
- 规则应尽量可解释，避免隐藏魔法。
- 破坏性操作、凭证文件、生产环境命令需要单独处理。

## 运行

```bash
node s09_permissions/code.mjs
```

## 对应 Pi

Pi 的 extension 能在 `tool_call` 事件中拦截或阻止操作。本仓库的 `.pi/extensions/protect-dangerous.ts` 就是一个最小权限门样例。
