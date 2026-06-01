# s09 Permissions（工具执行门）

> 事实基准:Pi monorepo `dbb9911a`(2026-05-30),npm `@earendil-works/pi-coding-agent@0.78.0`。
> 本章引用的 `file:line` 均对应该 commit;易过期点见末尾"事实核验清单"。

## 本章要解决的问题

agent 能调用 `bash`,就意味着它能运行任意命令。这是能力,也是风险。

权限要解决的是一个很窄、但很关键的问题:**在某次工具调用真正执行之前,harness 是否要把它拦下来。**

一句话:

```text
工具存在 ≠ 每次调用都允许。
```

但这里有一个产品经理特别容易踩的坑,本章必须先讲清楚:

> **Pi 没有一个独立的"权限系统",也没有 allow / ask / block 三态枚举。**
> 它只有一个布尔开关:工具执行前的 `tool_call` hook,允许处理器返回 `{ block: true, reason }` 把这次调用拦下来。其余一切(询问用户、黑名单、审批)都是你在这个布尔开关之上自己搭出来的。

这正是 Pi "极简"哲学的典型体现:harness 只给一个最小拦截点,策略留给使用者。

## 为什么上一章不够

s06 讲了 extension 的 hook 机制,但没有聚焦到一个具体问题上:**当模型请求一个危险动作时,那个拦截点(`tool_call` hook)的真实契约到底是什么?** 这就是本章。

## 真实机制:一个布尔门,不是三态机

### 1. 决策点:工具执行前的 `tool_call` 事件

Pi 的工具执行链路上,事件按固定顺序触发(源码确认):

```text
tool_execution_start  →  tool_call(可拦截)  →  执行 handler  →  tool_result(可改写)  →  tool_execution_end
```

`tool_call` 是唯一能"阻止执行"的点。
依据:`packages/coding-agent/src/core/extensions/types.ts:682`(事件类型定义)。

### 2. 决策结果:只有 `block?: boolean`

`tool_call` 处理器(handler,即你注册给该事件的回调)返回的类型是:

```ts
// packages/coding-agent/src/core/extensions/types.ts:986
interface ToolCallEventResult {
  block?: boolean;
  reason?: string;
}
```

注意:**没有 `allow`,没有 `ask`,没有 enum。**

- 不返回 / 返回 `{}` / `block` 不为真 → 调用照常执行(这就是隐式的 "allow")。
- 返回 `{ block: true, reason }` → 这次调用被拦,`reason` 回到模型上下文。

多个处理器顺序执行,**任一返回 `block:true` 即早退**(first-block-wins)。
依据:`packages/coding-agent/src/core/extensions/runner.ts:796`(`emitToolCall` 返回 `{ blocked, reason }`)。

### 3. "询问用户(ask)"不是内置态,是你拼出来的

很多人以为 Pi 有"ask 用户确认"的权限态。**源码里没有。**
要实现 ask,你在 `tool_call` 处理器内部自己调 UI:

```ts
// 教学伪代码:ask 是 block 之上的自定义逻辑,不是内置枚举
pi.on("tool_call", async (event, ctx) => {
  if (isDangerous(event)) {
    const ok = await ctx.ui.select("允许这次危险命令吗?", ["允许", "拒绝"]);
    if (ok !== "允许") return { block: true, reason: "用户拒绝" };
  }
});
```

也就是说:**block 是机制,ask 是你用 block + UI 组合出的策略。**

### 4. 没有持久权限策略文件

证据:在整个 checkout 里 `find -iname '*permission*'` **只匹配到一个示例** `examples/extensions/permission-gate.ts`;
`settings.json` 里**没有 `permissions` 键**,没有预批准命令 allowlist,没有策略引擎。

产品含义:Pi 不替你做策略管理。想要"团队级危险命令黑名单 / 审批流",得自己用 extension + 配置实现。

### 5. 顺带:`tool_result` 也能改(对照理解)

和 `tool_call` 对称,执行后的 `tool_result` 事件可以 patch 结果(`content` / `details` / `isError`,later-wins)。
依据:`packages/coding-agent/src/core/extensions/types.ts:1000`。
这说明 Pi 的控制面是"两个钩子":一个拦执行(`tool_call`),一个改结果(`tool_result`)。

## Mermaid 图示(已修正为真实二态)

```mermaid
flowchart TD
  A["tool_execution_start"] --> B["tool_call 事件<br/>顺序执行各处理器"]
  B --> C{"任一返回 block:true?"}
  C -->|否(隐式 allow)| D["执行 tool handler"]
  C -->|是| E["拦截:不执行<br/>reason 回到上下文"]
  D --> F["tool_result 事件<br/>可 patch content/details/isError"]
  E --> G["tool_execution_end"]
  F --> G
```

> 图里只有"拦 / 不拦"两态,没有 allow / ask / block 三分支。ask 是 block 之上的自定义,不是图里的一条边。

## 代码导读

运行:

```bash
node s09_permissions/code.mjs
```

`code.mjs` 实现了一个单 `block?:boolean` 门,与本 README 的契约一致,演示三件事:

- **两个 `tool_call` 处理器顺序执行,first-block-wins**:`denyHardRules`(硬禁止凭证/越界写,不问人)和 `askOnDangerousShell`(危险命令/越界读时调 `ctx.ui.select` 问一下)。
- **拦截返回 `{ block, reason }`**,对应 `ToolCallEventResult`;被拦的调用不抛异常,而是一条稳定的、带 `reason` 的结果回灌模型。
- **ask 是拼出来的**:`askOnDangerousShell` 用 `ctx.ui.select` 把"问用户"翻译成 block 与否——Pi 没有 ask 内置态。

读 code 时重点对照:`emitToolCall()` 的 first-block-wins 聚合,对应真实 `runner.ts:796`;而"是否危险"的规则是 mock 自己写的,真实 Pi 不内置任何危险判断。

运行输出会显示 5 条 BLOCK / 3 条 allow,以及一行提醒:本 mock 只有 block 一个开关。

## 对应真实 Pi

截至 commit `dbb9911a`,已逐行核验:

- 工具执行前的拦截点是 extension 的 `tool_call` 事件,在 `tool_execution_start` 之后、handler 执行之前触发:`extensions/types.ts:682`。
- 返回类型是 `ToolCallEventResult { block?: boolean; reason?: string }`,**无 allow/ask 枚举**:`extensions/types.ts:986`。
- 多处理器 first-block-wins,聚合返回 `{ blocked, reason }`:`extensions/runner.ts:796`。
- 拥有 typed `tool_call`/`tool_result` 事件的内置工具:`bash, read, edit, write, grep, find, ls`:`extensions/types.ts:824`。
- 全仓库无独立 permissions 目录/无持久策略;唯一相关物是示例 `examples/extensions/permission-gate.ts`。

官方文档入口(注意:**没有** `permissions` 专页,权限语义在 extensions 文档内):

- [Pi Extensions](https://pi.dev/docs/latest/extensions)
- 源码:[`extensions/types.ts`](https://github.com/earendil-works/pi-mono/blob/main/packages/coding-agent/src/core/extensions/types.ts)

> 重要更正:本章 v1 曾引用 `https://pi.dev/docs/latest/permissions` 并描述 allow/ask/block 三态。**该 URL 不存在,该模型也不存在**,已删除。这正是本仓库"不要把不确定内容包装成官方事实"红线要防的错误。

## 教学简化 vs 生产差异

| 主题 | 本章 mock | 真实 Pi / 生产 |
|---|---|---|
| 决策态 | block / 不 block 二态 | 同为二态(`block?:boolean`),无 allow/ask 枚举 |
| 危险判断 | 硬编码规则 | Pi 不内置,由你在 `tool_call` 处理器实现 |
| ask 用户 | 不演示 | `ctx.ui.select` 在处理器内自行实现 |
| 策略来源 | 单一 mock | 多 extension 顺序执行,first-block-wins |
| 持久策略 | 无 | 仍无内置;团队黑名单需自建 extension+配置 |
| 审计 | 无 | 可在 `tool_call`/`tool_result` 处理器里写日志 |

## 练习

1. 把 mock 拦截函数的返回从布尔改造成 `{ block, reason }`,确认 `reason` 出现在回灌给模型的 tool result 里。
2. 实现"ask":拦截到危险命令时,用一个模拟的 `ui.select` 决定 block 与否,体会 ask = block + UI。
3. 注册第二个 `tool_call` 处理器,验证 first-block-wins:前一个不拦、后一个拦,最终结果是拦。
4. 思考:为什么 Pi 选择只给 `block` 一个布尔,而不内置 allow/ask/block 三态?这对"极简 harness"意味着什么?
5. 设计题:你要做"团队级危险命令黑名单",在 Pi 里应该落在哪一层(extension? package? settings?),数据从哪来?

## 事实核验清单

写权限相关内容时,下面这些不要凭记忆:

- `tool_call` 事件的触发时机(是否仍在 `tool_execution_start` 后、handler 前):`extensions/types.ts:682`。
- 返回类型是否仍是 `{ block?, reason? }`、是否仍无 allow/ask 枚举:`extensions/types.ts:986`。
- 多处理器是否仍 first-block-wins:`extensions/runner.ts:796`。
- 是否仍**不存在** `pi.dev/docs/latest/permissions` 专页 —— 若官方新增,需更新本章。
- 是否仍**没有** settings 级 `permissions` 策略键。
- 拥有 typed 工具事件的内置工具集是否变化:`extensions/types.ts:824`。

底线:**Pi 的权限不是一套系统,而是一个布尔拦截点。** 把它讲成三态机,就是把教学想象冒充成 Pi 事实。

## 小结

Permissions 在 Pi 里被刻意做小:一个 `tool_call` 钩子 + 一个 `block?:boolean`。
能力虽小,位置却关键 —— 它是模型"想做"和环境"准做"之间唯一的确定性闸门。
更复杂的策略(ask、黑名单、审批、审计)都不是 Pi 替你做的,而是你在这个最小闸门之上自己组装的。这既是 Pi 的克制,也是使用者的责任。
