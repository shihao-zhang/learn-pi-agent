# s06 Extensions

## 核心问题

如果 prompt 和 skill 不够，怎样改变 harness 行为？

Pi 的 TypeScript extension 可以注册工具、订阅生命周期事件、增加 slash command、拦截危险工具调用，也可以定制 UI。它是“挂在 loop 周边”的扩展点。

## 学完你应该理解

- Extension 是代码，能力更强，风险也更高。
- 适合做权限门、项目自动化、外部系统集成、状态管理。
- 扩展应该小而清晰；能用 prompt template / skill 解决时，不急着写 extension。

## 运行

```bash
node s06_extensions/code.mjs
```

## 对应 Pi

真实 Pi 会发现 `.pi/extensions/*.ts`。本仓库的样例是 [.pi/extensions/protect-dangerous.ts](../.pi/extensions/protect-dangerous.ts)。
