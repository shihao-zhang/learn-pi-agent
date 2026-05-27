# s01 Agent Loop

## 核心问题

一个 coding agent harness 最小需要什么？

Pi 的答案很克制：一个循环，加上少量工具。模型决定是否调用工具；harness 只负责执行、记录结果、再把结果放回上下文。

## 学完你应该理解

- `messages[]` 是 agent 的工作记忆。
- `tool_call` 不是异常路径，而是主循环的一部分。
- 工具越少，越要求工具描述清楚、返回值稳定。

## 运行

```bash
node s01_agent_loop/code.mjs
```

## 对应 Pi

Pi 默认提供 `read`、`write`、`edit`、`bash` 四个工具。这个例子用 mock model 演示同样的 loop，不连接真实 LLM。
