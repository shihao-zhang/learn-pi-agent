# s12 Comprehensive

## 核心问题

这么多机制最后怎样回到一个 harness？

答案不是再造一个复杂编排器，而是把资源加载、权限判断、工具执行、session 记录都挂回同一个 agent loop。

## 学完你应该理解

- 主循环保持小，周边机制通过清晰接口接入。
- Context / prompt / skill 是知识入口。
- Extension / permission 是行为边界。
- Session 是可追踪的产品记忆。

## 运行

```bash
node s12_comprehensive/code.mjs
```

## 对应 Pi

这个例子仍然是 mock harness，但结构对应真实 Pi 的几个关键面：ResourceLoader、tool registry、event hooks、permission decision、session entries。
