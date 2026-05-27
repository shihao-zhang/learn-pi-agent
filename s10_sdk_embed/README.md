# s10 SDK Embed

## 核心问题

Pi 只能作为终端工具使用吗？

不是。Pi 的一个重要产品形态是 embeddable harness：你可以在自己的应用里创建 agent session，注入工具、资源、模型和 session manager。

## 学完你应该理解

- CLI 是一种外壳，SDK 是把 harness 放进产品的入口。
- 嵌入时要显式设计 auth storage、session storage、resource loader、tools。
- 自己的产品可以复用 Pi 的 loop，同时提供领域工具。

## 运行

```bash
node s10_sdk_embed/code.mjs
```

这个 demo 用本地 mock 展示“应用创建 session、注入 custom tool、发送用户消息”的结构。

## 真实 SDK 参考代码

见 [sdk-example.ts](sdk-example.ts)。这段代码需要真实依赖：

```bash
npm install @earendil-works/pi-coding-agent @earendil-works/pi-ai typebox
```

本仓库默认不安装这些依赖，避免学习 demo 一开始就被环境卡住。

## 对应 Pi

官方 SDK 文档的核心入口是 `createAgentSession()`。它可以配合 `DefaultResourceLoader`、`SessionManager`、`AuthStorage`、`ModelRegistry` 等组件使用。
