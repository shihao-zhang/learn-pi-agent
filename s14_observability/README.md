# s14 Observability & Trace

> 事实基准:Pi monorepo commit `dbb9911a`(2026-05-30),npm `@earendil-works/pi-coding-agent@0.78.0`。
> 本章主要依据 `packages/agent/docs/observability.md`(设计文档)。该文件标注为 design notes,部分能力是方向性设计;凡属"计划中"我都显式标注。

## 本章要解决的问题

前面所有章节讲的是 agent **做什么**:跑 loop、调工具、压缩上下文、控权限。本章换一个视角:**当 agent 在跑,外部系统怎么看见它正在发生什么?**

这不是锦上添花。没有可观测性,你就只能:
- UI 上干等 `prompt()` 返回,中间一片黑;
- 出问题时翻一大段聊天记录猜哪步错了;
- 无法接审计、无法做集成测试断言、无法接 APM。

一句话:

```text
observability = 把 agent 内部进度变成稳定、结构化的事件,让 UI / 日志 / 审计 / 测试都能消费。
```

> 这是 [00 机制地图](../00_map/README.md) 横切线 4。它和 s10(SDK 事件流)、s07(session 作为可恢复状态)同源:**agent 的状态和进度必须能被外部看见**,只是落地形态不同——事件流给 UI、trace 给可观测性、session 给恢复。

## 为什么前面的章不够

s10 讲了 SDK 的事件流(`message_update`、`tool_execution_start/end` 等)——那是给**你的应用 UI**看的、面向单次会话的事件。

但可观测性要回答更系统的问题:
- 一次 user turn 在底层裂解成多少个操作?它们的**因果父子关系**是什么?
- 一个操作花了多久?token 用了多少?成本多少?
- 怎么把这些喂给 OpenTelemetry / Sentry / 自建日志,而**不让核心包依赖任何特定 APM 厂商**?

Pi 的答案是一套**runtime-agnostic 的 trace 抽象**:核心包只发结构化事件,适配器决定事件去哪。这是 s10 的事件流没覆盖的层面。

## 核心心智模型:trace = 一棵因果树

- **trace**:一次因果工作树,比如一个 user turn。
- **span**:树里一个有时长的操作,用 id 表示(不是对象指针):

```ts
interface SpanRecord {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  startTime: number;
  endTime?: number;
  attributes: Record<string, unknown>;
  status: "ok" | "error";
}
```

一棵典型的树(`observability.md`):

```text
traceId=t1 spanId=s1 parent=-  name=pi.agent.prompt
traceId=t1 spanId=s2 parent=s1 name=pi.agent.turn
traceId=t1 spanId=s3 parent=s2 name=pi.ai.provider.request
traceId=t1 spanId=s4 parent=s2 name=pi.agent.tool_call
traceId=t1 spanId=s5 parent=s4 name=pi.session.append_entry
```

## 三个设计支柱

### 1. runtime-agnostic 抽象 + 适配器
Pi 必须能跑在 Node、Bun、浏览器、worker 等多种 JS runtime,所以**不能**把 Node 专属的 `AsyncLocalStorage` 当核心。核心是一个小接口:

```ts
export interface PiObservability {
  getContext(): PiObservabilityContext | undefined;
  runWithContext<T>(context: PiObservabilityContext, fn: () => T): T;
  emit(event: PiObservabilityEvent): void;
  hasSubscribers(): boolean;
}
```

公共 API:`configurePiObservability()`、`subscribePiObservability(listener)`、`runWithPiContext(userContext, fn)`、`traceOperation(name, payload, fn)`。

- **Node 适配器**:用 `AsyncLocalStorage` 做 async 上下文传播(JS 的 "ThreadLocal"),可选 `diagnostics_channel` 发布。
- **浏览器/worker**:本地 subscriber 集合 + 有限的手动上下文传播。

### 2. `traceOperation()`:自动建立父子关系
包一个操作时,它:读当前上下文 → 没有 traceId 就新建 → 生成新 spanId → 用当前 span 作为 parentSpanId → emit `start` → 在子上下文里跑 → emit `end`/`error` → 出错重抛(`observability.md`)。

并发安全靠 async context:多条 async 链各自保留独立的 current context,所以同时跑两个 `harness.prompt()` 不会串 trace。

### 3. Pi 只发事件,不直接建 OTel/Sentry span
> Pi 定义稳定、安全的事件契约;适配器决定事件去哪。
> 这让 ai/harness 可观测,又不把核心包绑死在 OTel、Sentry、Node-only API 或 monkey-patching 上。

初期事件名(`observability.md`):

```text
pi.agent.prompt      pi.agent.skill        pi.agent.prompt_template
pi.agent.compaction  pi.agent.branch_navigation
pi.agent.session.append_entry             pi.ai.provider.request
```

每个操作发 `start` / `end` / `error`。后续计划增补 `pi.agent.turn`、`pi.agent.tool_call`、`pi.ai.provider.first_token`、`pi.ai.provider.usage` 等。

## 安全与脱敏:默认不泄露内容

这是本章产品经理最该记住的一点。trace 默认 payload 必须安全:

| 默认**安全**(可进 trace) | 默认**不安全**(默认不进 trace) |
|---|---|
| provider、model、API 标识 | prompts、completions |
| session id、entry type、tool name | tool args、tool results |
| status code、stop reason | shell 输出、文件内容 |
| token 计数、成本、时长 | provider 请求/响应体、API key、headers |

内容捕获只能**显式 opt-in**,且要带脱敏 hook。

> 另一条铁律:**可观测性绝不能影响 agent 执行。** subscriber 的错误必须被吞掉/隔离。对比 s06 的 hook——hook 是控制面、可以改执行;observability subscriber 是被动旁观、绝不能改执行。这是两类回调的根本区别。

## 用户上下文

可以给一次 turn 关联任意业务上下文,它会自动出现在该 async 链里的每个事件上:

```ts
await runWithPiContext(
  { userId: "u123", orgId: "acme", region: "eu" },
  () => harness.prompt("fix this"),
);
```

OTel 适配器可把它映射成 span attributes,Sentry 适配器映射成 context,自建可直接打 JSON 日志。

## 它和 CLI 的 JSON / RPC 模式什么关系

s10 提到的 JSON event stream / RPC 模式,是这套可观测性思想的**对外进程形态**:把 agent 进度变成结构化事件输出给宿主进程。区别在于:

- **JSON/RPC 模式**:面向跨进程集成,事件经 stdout JSONL / stdin-stdout。
- **本章 observability**:面向同进程的 trace/span,经 subscriber/diagnostics_channel,服务 APM 与调试。

两者都是"把内部进度结构化"的同一思想,落在不同边界。

## 代码导读

运行:

```bash
node s14_observability/code.mjs
```

本章 mock 实现一个最小 observability 内核,演示 trace 树怎么自动长出来:

- `runWithContext()` / `getContext()`:用一个简化的"当前上下文栈"模拟 async context(真实是 `AsyncLocalStorage`)。
- `traceOperation(name, payload, fn)`:建 span、继承 parentSpanId、emit start/end/error。
- `subscribe(listener)`:订阅事件;listener 抛错被**隔离**(不影响主流程)。
- `redact(payload)`:演示默认脱敏——白名单字段保留,黑名单字段替换成 `[redacted]`。
- 一个假的 `harness.prompt()`,内部嵌套 `pi.agent.turn` → `pi.ai.provider.request` + `pi.agent.tool_call` → `pi.session.append_entry`,跑完打印出完整 span 树。

输出会展示:① 事件流(start/end);② 重建出的因果树(traceId/spanId/parent);③ 脱敏前后对比;④ subscriber 抛错被隔离、主流程照常完成。

> 教学边界:mock 用同步上下文栈代替 `AsyncLocalStorage`,真并发下不等价;时间、token、成本都是假的。本章只演示**trace 树怎么形成、脱敏边界在哪、subscriber 为什么必须被动**这套设计。

## 对应真实 Pi

> ⚠️ `observability.md` 是 **design notes**(设计文档),描述方向与契约。具体 API 是否已在 `packages/observability` / `packages/ai` / `packages/agent` 落地、落到什么程度,需对照当时源码核验;本章只声明"设计意图",不声明"已实现的运行时 API"。

已核验(基于 `packages/agent/docs/observability.md`,commit `dbb9911a`):

- 目标:让 `packages/ai` 和 `packages/agent` 可观测,而不依赖 OTel/Sentry/任何 APM 厂商。
- trace=因果树、span=有时长操作,用 id(非指针)表示;`SpanRecord` 字段如上。
- 抽象 `PiObservability` + 公共 API `configurePiObservability` / `subscribePiObservability` / `runWithPiContext` / `traceOperation`。
- Node 适配器用 `AsyncLocalStorage`(+ 可选 `diagnostics_channel`);浏览器/worker 用 subscriber 集合 fallback。
- 初期事件名 `pi.agent.*` / `pi.ai.provider.request`,各发 start/end/error;计划增补 turn/tool_call/first_token/usage 等。
- 默认脱敏白/黑名单如上表;内容捕获 opt-in。
- subscriber 必须被动,错误被隔离,绝不影响执行。
- 计划包结构:`packages/observability`(核心)、`packages/observability-node`(ALS+diagnostics_channel)、`packages/otel`(OTel 适配器)。

官方入口:源码 [`observability.md`](https://github.com/earendil-works/pi-mono/blob/main/packages/agent/docs/observability.md)

## 教学简化 vs 生产差异

| 主题 | 本章 mock | 真实 Pi(设计) |
|---|---|---|
| async 上下文 | 同步上下文栈 | `AsyncLocalStorage`(Node)/ 运行时适配器 |
| 事件去向 | 内存 subscriber | subscriber + `diagnostics_channel` + OTel/Sentry 适配器 |
| span 数据 | 假 time/token | 真实时长、token、成本、stop reason、status code |
| 脱敏 | 静态白/黑名单 | opt-in 内容捕获 + 脱敏 hook |
| 落地状态 | 教学演示 | design notes;实现程度以源码为准 |

## 练习

1. 给 `traceOperation` 增加 `pi.ai.provider.request` 的子 span,确认它的 `parentSpanId` 指向 turn span。
2. 注册一个会抛错的 subscriber,验证主流程不受影响(错误被隔离)。
3. 把一个含 `prompt` 和 `apiKey` 的 payload 过 `redact()`,确认敏感字段被替换、白名单字段保留。
4. 用 `runWithContext` 注入 `{ userId }`,确认它出现在该链路每个事件上。
5. 思考:为什么 observability subscriber 必须被动(不能改执行),而 s06 的 hook 可以改执行?把两者画在同一张"回调谱系"上。
6. 设计题:你要把 Pi 事件接入公司的 OTel。哪些字段可以直接进 span attributes,哪些必须先脱敏或 opt-in?

## 事实核验清单

写 observability 内容时,下面这些不要凭记忆:

- `observability.md` 是否仍是 design notes,相关 API 是否已落地、落到哪个包:`packages/agent/docs/observability.md`。
- `PiObservability` 接口与四个公共 API 名称是否变化。
- 事件名集(`pi.agent.*` / `pi.ai.*`)是否变化,是否已增补 turn/tool_call 等。
- 默认脱敏白/黑名单是否变化。
- "subscriber 被动、错误隔离"原则是否仍成立。
- 计划中的包(`packages/observability` / `-node` / `packages/otel`)是否已存在。

底线:凡 `observability.md` 标"计划/方向"的,本章都不得写成"Pi 已经这样实现"。

## 小结

可观测性是 harness 的"神经系统":把 agent 内部进度变成结构化、安全、runtime-agnostic 的事件,让 UI、日志、审计、APM、测试都能看见同一套事实。它和事件流(s10)、session(s07)同根——**agent 的状态必须可被外部观察**——但它多了三条铁律:trace 是因果树、默认脱敏、subscriber 被动。理解这三条,你设计任何 agent 平台的监控层时都不会跑偏。
