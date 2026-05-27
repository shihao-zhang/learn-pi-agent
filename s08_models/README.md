# s08 Models

## 核心问题

多模型支持真的只是换一个 API endpoint 吗？

不是。难点在于不同 provider 的消息格式、streaming、reasoning trace、token 统计、tool call 表示、缓存语义都不一样。Harness 要把这些差异收敛成稳定接口。

## 学完你应该理解

- 模型切换是产品体验，不只是配置项。
- Session 需要在 provider 切换后继续可用。
- 统一 API 层的价值是隔离 wire protocol 差异。

## 运行

```bash
node s08_models/code.mjs
```

## 对应 Pi

Pi monorepo 中的 `@earendil-works/pi-ai` 负责统一多 provider LLM API；`@earendil-works/pi-coding-agent` 在 CLI / SDK 层处理模型选择和 session 继续。
