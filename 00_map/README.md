# 00 机制地图:Pi / coding agent harness 怎么学

> 事实基准:Pi monorepo commit `dbb9911a`(2026-05-30),npm `@earendil-works/pi-coding-agent@0.78.0`。
> 本页所有 `file:line` 仅对该 commit 有效;源码事实清单见 [`.evidence/pi-evidence.json`](../.evidence/README.md)。

这一页不是又一篇导论。它是一张**机制地图**:先告诉你 Pi 这类 coding agent harness 由哪些机制组成、它们彼此怎么咬合,再告诉你**按你的角色该走哪条路径**。

后面的 `s01`–`s12` 是这些机制的逐个展开。但**章号是顺序,不是结构**——结构在这页。你完全可以不按 01→12 读,而是按下面的"读者路径"跳着读。

---

## 一、最重要的一张图:Pi 是三层,不是一坨

很多人把 "Pi" 当成一个东西。真实 Pi 是一个 monorepo,**三层职责清晰分离**(已逐包核验):

```text
┌─────────────────────────────────────────────────────────────┐
│  L3  pi-coding-agent  (packages/coding-agent)                │
│      面向人的 CLI 产品:tools / skills / prompts / extensions │
│      / packages / compaction / sessions / TUI / RPC / JSON    │
├─────────────────────────────────────────────────────────────┤
│  L2  pi-agent-core    (packages/agent)                       │
│      harness 运行时:                                          │
│        · 裸 agent loop   (agent-loop.ts)                      │
│        · AgentHarness 编排层 (harness/agent-harness.ts)       │
│          (编排层;内部细节未纳入 evidence,待核验)             │
├─────────────────────────────────────────────────────────────┤
│  L1  pi-ai            (packages/ai)                           │
│      统一多 provider LLM API:30+ provider / OAuth / compat    │
└─────────────────────────────────────────────────────────────┘
```

| 层 | 包 | 它负责什么 | 它**不**负责什么 |
|---|---|---|---|
| **L1 pi-ai** | `packages/ai` | 把不同 provider 的 wire 协议、认证、模型 compat flag 收口成一个统一 API | 不知道"工具""会话""技能"是什么 |
| **L2 pi-agent-core** | `packages/agent` | 跑 agent loop;`AgentHarness`(`harness/agent-harness.ts`)在其上加一层编排——其内部细节(turn/队列/持久状态等)**未纳入本轮 evidence**,字段级说法视为待核验 | 不知道 `read`/`bash` 具体怎么实现,不管 TUI |
| **L3 pi-coding-agent** | `packages/coding-agent` | 把 L2 包装成能用的终端 coding agent:内置工具、资源发现、扩展、权限门、压缩、会话 UI | 不重复造 loop;loop 在 L2 |

> 为什么这张图重要:你想做的事落在**哪一层**,决定了你该读哪些章、该改哪些代码。
> - 想换模型 / 加 provider → L1(s08)。
> - 想理解"自动化为什么会停 / 怎么排队 steer" → L2(s01 + AgentHarness)。
> - 想加工具 / 写扩展 / 控权限 / 打包分发 → L3(s02、s05、s06、s09、s11)。

裸 loop 的核心闭环(`packages/agent/src/agent-loop.ts:166`):

```text
prompt → 外层 follow-up 循环 ┐
            内层 turn 循环:模型输出 → 过滤 toolCall → 执行 → 结果回灌 context+transcript
            停止 = 自然退出(无 tool call 且无排队)/ stopReason error|aborted / shouldStopAfterTurn hook
         └→ agent_end
```

注意:**loop 里没有 `maxTurns` 计数器**(详见 [s01](../s01_agent_loop/README.md))。停止边界由调用方的 hook 决定,这是 Pi"少替人做主"的典型取舍。

---

## 二、四条横切线:不属于某一章,但贯穿所有章

有四个机制不是"某一层的某个功能",而是横切整个 harness 的设计主线。看不见它们,就只会看见一堆平铺的名词。

### 横切线 1:系统提示词是"编译产物",不是一段手写长文
系统提示词 = 基础身份 + context 文件(`AGENTS.md`/`CLAUDE.md`,`resource-loader.ts:58`)+ skill catalog(`<available_skills>` XML,`skills.ts:347`)+ 安全说明。它在每个 turn 由资源**组装**出来。
→ 涉及章:s03(context)、s04(prompt)、s05(skills)、s12(总装)。

### 横切线 2:Token / 上下文经济学——progressive disclosure 为什么存在
上下文窗口有限,所以 Pi 处处在省 token:skill 先只暴露 catalog、用到才加载全文;**compaction** 在 `contextTokens > contextWindow - reserveTokens`(默认 `reserveTokens=16384`、`keepRecentTokens=20000`)时自动摘要旧消息;tool result 序列化时截断到 2000 字符。
→ 涉及章:s05(渐进披露)、[s13 compaction](../s13_compaction/README.md)(上下文经济学专章)。

### 横切线 3:信任与来源——什么是代码,什么只是数据
- **extension / package 是代码**,以你的系统权限运行(`extensions.md:110`)→ 安装前必须 review 源码。
- **skill / context / prompt 是数据**,只能影响模型读到什么,不能保证执行。
- **权限门**只有一个 `block?:boolean`(`extensions/types.ts:986`),不是策略系统。
→ 涉及章:s06(extension 是代码)、s09(权限门)、s11(package 供应链)。

### 横切线 4:可观测性——agent 在做什么,系统怎么看见
Pi 有一套 runtime-agnostic 的 trace 设计(`pi.agent.*` / `pi.ai.*` span 事件、默认脱敏白/黑名单),把 agent 内部进度变成结构化事件,供 UI / 日志 / 审计 / 测试消费。RPC、JSON event stream 模式是它的对外形态。
→ 涉及章:s10(SDK/事件)、[s14 observability](../s14_observability/README.md)(trace 专章)、s07(session 作为可恢复状态)。

---

## 三、三条读者路径:同一批章节,按角色跳读

不用从 s01 读到 s12。按你是谁选一条:

### 路径 A:AI 产品经理 / 需求方
你要的是**正确的心智模型**,不被错误假设带偏需求。重点读每章的"本章要解决的问题""图示""教学简化 vs 生产差异",跳过 `code.mjs`。

```text
00 本页(三层 + 横切线)
 → s01 agent loop(只读概念:模型提动作、harness 执行、为什么会停)
 → s05 skills(渐进披露:能力很多但按需加载)
 → 横切线2 token 经济学 / compaction(为什么上下文要省)
 → s09 permissions(关键:Pi 没有 allow/ask/block 三态,只有一个 block 门)
 → s12 comprehensive(所有机制如何回到一张架构图)
```
**最该记住的反直觉点**:Pi 没有"权限系统";`max_turns` 不是 Pi 概念;skill 不能保证执行。带着这些去写需求,不会要求工程做 Pi 根本不提供的东西。

### 路径 B:agent 平台 / harness 设计者
你要的是**运行时控制面**:状态、队列、拦截点、可恢复性、可观测性。

```text
00 本页
 → s01 + L2 AgentHarness 编排层(编排细节未纳入 evidence,待核验)
 → s06 extensions(事件:观察型 vs 控制/变更型;tool_call 可 block、tool_result 可改)
 → s09 permissions(确定性 gate 落在哪)
 → 横切线4 observability(trace 设计、脱敏边界)
 → session-format / durable(可恢复状态树)
```
**最该带走的**:Pi 把"策略"留给调用方(stop 边界、权限、压缩都可由 hook/extension 自定义),核心保持小。设计平台时,想清楚哪些该进核心、哪些该外挂。

### 路径 C:工程读者 / 想真接 Pi 的人
全章 + `code.mjs` + 下钻 `.evidence` 的 file:line。

```text
按 s01 → s12 顺序通读,每章:
  1. 读"机制拆解"建立结构
  2. 跑 code.mjs 看教学 mock 怎么表达机制
  3. 读"对应真实 Pi"的 file:line,去 pi-mono 源码对照
  4. 读"事实核验清单"知道哪些会过期
真接 Pi 前:优先读官方 SDK / Extensions / Packages / Sessions 文档 + .evidence。
```
**最该用好的**:`.evidence/pi-evidence.json` 是所有 file:line 的上游;本仓库是概念地图,不是 API 手册——签名以源码为准。

---

## 四、机制 → 章节 索引

| 机制 | 层 | 章节 | 一句话 |
|---|---|---|---|
| agent loop | L2 | [s01](../s01_agent_loop/README.md) | 模型提动作、harness 执行、结果回灌;停止靠 hook 不靠计数器 |
| tool dispatch | L3 | [s02](../s02_tool_dispatch/README.md) | 加工具改 registry 不改 loop;默认 4 工具 + 可选只读 3 |
| context files | L3 | [s03](../s03_context_files/README.md) | `AGENTS.md` 是常驻项目知识入口 |
| prompt templates | L3 | [s04](../s04_prompt_templates/README.md) | 可复用任务写成 `/command` |
| skills | L3 | [s05](../s05_skills/README.md) | 先暴露 catalog,用到才加载全文(渐进披露) |
| extensions | L3 | [s06](../s06_extensions/README.md) | TypeScript 扩展;事件分观察型与控制/变更型 |
| sessions | L3+L2 | [s07](../s07_sessions/README.md) | session tree:分支/回退/复盘 |
| models & providers | L1 | [s08](../s08_models/README.md) | 多 provider 难在消息与 compat,不在 API 名 |
| permissions | L3 | [s09](../s09_permissions/README.md) | 一个 `block?:boolean` 门,不是三态系统 |
| SDK embed | L2/L3 | [s10](../s10_sdk_embed/README.md) | 把 Pi 当可嵌入 runtime;事件流是耳朵 |
| packages | L3 | [s11](../s11_packages/README.md) | 把 prompts/skills/extensions/themes 打包分发 |
| comprehensive | 全 | [s12](../s12_comprehensive/README.md) | 所有机制回到一张架构图 |
| compaction | L3 | [s13](../s13_compaction/README.md) | 横切线2:上下文经济学的核心 |
| observability | L1+L2 | [s14](../s14_observability/README.md) | 横切线4:agent 进度怎么被看见 |

---

## 五、怎么用这份地图

1. **先定位你的需求落在哪一层**(第一节的表),再选路径(第三节)。
2. 读到任何"对应真实 Pi"的声明,都能在 `.evidence` 或 pi-mono 源码里按 file:line 复核——这是本仓库和"看起来很对的二手解读"的根本区别。
3. 看到 ⚠️ 边界声明就当真:Pi 刻意留白的地方(权限策略、stop 策略、压缩策略),都是留给你用 hook/extension 自己实现的。

> 本页是教学地图,不是 Pi 官方文档,也不声明任何 Pi 内部实现细节。容易过期的事实(包名、版本、默认模型、字段名)以 `dbb9911a` 为基准,Pi 更新后需重新核验。
