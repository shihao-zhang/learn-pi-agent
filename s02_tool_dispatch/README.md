# s02 Tool Dispatch

## 核心问题

如何增加工具而不改 agent loop？

答案是 dispatch map：loop 只认识“工具名 -> handler”的映射。新工具注册进去，主循环不用长出新的 `if else`。

## 学完你应该理解

- 工具是 action interface，不是 prompt 技巧。
- 工具 schema、handler、权限策略应该分开。
- “加工具”应该是扩展 registry，而不是修改主循环。

## 运行

```bash
node s02_tool_dispatch/code.mjs
```

## 对应 Pi

Pi 内置工具和 extension 注册的 custom tools 最终都会进入可调用工具池。保持 loop 简单，才方便后续接 extensions、permissions 和 UI rendering。
